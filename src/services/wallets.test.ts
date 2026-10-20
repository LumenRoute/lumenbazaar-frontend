import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNetworkConfig } from "@/config/networks";

import {
  connectFreighterWallet,
  describeWalletNetwork,
  isNetworkMismatch,
  mapAuthorizationErrorToOutcome,
  reconnectWallet,
  switchWalletNetwork,
  type WalletConnectionState,
  type WalletOutcome
} from "./wallets";

const testnetPassphrase = getNetworkConfig("stellar:testnet").passphrase;
const pubnetPassphrase = getNetworkConfig("stellar:pubnet").passphrase;
const account = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";

const freighter = vi.hoisted(() => ({
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  isAllowed: vi.fn(),
  requestAccess: vi.fn()
}));

vi.mock("@stellar/freighter-api", () => freighter);
vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { PUBLIC: "PUBLIC", TESTNET: "TESTNET" },
  StellarWalletsKit: { disconnect: vi.fn(), init: vi.fn() }
}));
vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FREIGHTER_ID: "freighter",
  FreighterModule: class {}
}));

beforeEach(() => {
  vi.clearAllMocks();
  freighter.isAllowed.mockResolvedValue({ isAllowed: true });
  freighter.getAddress.mockResolvedValue({ address: account });
  freighter.getNetwork.mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: testnetPassphrase
  });
});

describe("wallet service", () => {
  it("detects wallet network mismatch by passphrase", () => {
    expect(isNetworkMismatch(pubnetPassphrase, testnetPassphrase)).toBe(true);
  });

  it("accepts the configured network passphrase", () => {
    expect(isNetworkMismatch(testnetPassphrase, testnetPassphrase)).toBe(false);
  });

  describe("describeWalletNetwork", () => {
    it("labels the detected network", () => {
      expect(
        describeWalletNetwork({
          actualNetwork: "stellar:pubnet",
          expectedNetwork: "stellar:testnet",
          expectedPassphrase: testnetPassphrase,
          status: "mismatch"
        })
      ).toBe(getNetworkConfig("stellar:pubnet").label);
    });

    it("labels a network that is not configured as unrecognized", () => {
      expect(
        describeWalletNetwork({
          expectedNetwork: "stellar:testnet",
          expectedPassphrase: testnetPassphrase,
          networkName: "FUTURENET",
          networkPassphrase: "Test SDF Future Network ; September 2025",
          status: "network_unknown"
        })
      ).toBe("Unrecognized network (FUTURENET)");
    });

    it("labels a missing network as unknown", () => {
      expect(
        describeWalletNetwork({
          expectedNetwork: "stellar:testnet",
          expectedPassphrase: testnetPassphrase,
          status: "network_unknown"
        })
      ).toBe("Unknown network");
    });
  });

  describe("connectFreighterWallet", () => {
    it("connects when the wallet is on the expected network", async () => {
      const state = await connectFreighterWallet("stellar:testnet");

      expect(state.status).toBe("connected");
      expect(state.actualNetwork).toBe("stellar:testnet");
      expect(state.address).toBe(account);
    });

    it("reports the actual network when the wallet is on another network", async () => {
      freighter.getNetwork.mockResolvedValue({
        network: "PUBLIC",
        networkPassphrase: pubnetPassphrase
      });

      const state = await connectFreighterWallet("stellar:testnet");

      expect(state.status).toBe("mismatch");
      expect(state.actualNetwork).toBe("stellar:pubnet");
      expect(state.expectedNetwork).toBe("stellar:testnet");
    });

    it("fails closed when the wallet does not report a network", async () => {
      freighter.getNetwork.mockResolvedValue({
        network: "",
        networkPassphrase: ""
      });

      const state = await connectFreighterWallet("stellar:testnet");

      expect(state.status).toBe("network_unknown");
      expect(state.actualNetwork).toBeUndefined();
    });
  });

  describe("reconnectWallet", () => {
    it("reports the connected state after the wallet was switched", async () => {
      const state = await reconnectWallet("stellar:testnet");

      expect(state.status).toBe("connected");
      expect(state.actualNetwork).toBe("stellar:testnet");
    });

    it("keeps reporting the mismatch while the wallet stays on the wrong network", async () => {
      freighter.getNetwork.mockResolvedValue({
        network: "PUBLIC",
        networkPassphrase: pubnetPassphrase
      });

      const state = await reconnectWallet("stellar:testnet");

      expect(state.status).toBe("mismatch");
      expect(state.actualNetwork).toBe("stellar:pubnet");
    });

    it("reports a disconnected wallet when the access grant was withdrawn", async () => {
      freighter.isAllowed.mockResolvedValue({ isAllowed: false });

      const state = await reconnectWallet("stellar:testnet");

      expect(state.status).toBe("disconnected");
    });
  });

  describe("switchWalletNetwork", () => {
    it("reports that the wallet is already on the expected network", async () => {
      const outcome = await switchWalletNetwork("stellar:testnet", {
        readNetwork: async () => ({ networkPassphrase: testnetPassphrase })
      });

      expect(outcome).toMatchObject({
        type: "already_on_expected",
        network: "stellar:testnet",
        retryable: false
      });
    });

    it("asks for a manual switch when the wallet cannot change networks", async () => {
      const outcome = await switchWalletNetwork("stellar:testnet", {
        readNetwork: async () => ({ networkPassphrase: pubnetPassphrase })
      });

      expect(outcome).toMatchObject({
        type: "manual_required",
        network: "stellar:testnet",
        retryable: true
      });
      expect(outcome.message).toContain(getNetworkConfig("stellar:testnet").label);
    });

    it("reports a verified switch when the wallet reports the expected network", async () => {
      let networkPassphrase = pubnetPassphrase;
      const outcome = await switchWalletNetwork("stellar:testnet", {
        readNetwork: async () => ({ networkPassphrase }),
        requestSwitch: async () => {
          networkPassphrase = testnetPassphrase;
        }
      });

      expect(outcome).toMatchObject({
        type: "switched",
        network: "stellar:testnet",
        retryable: false
      });
    });

    it("reports a rejected switch when the wallet refuses the request", async () => {
      const outcome = await switchWalletNetwork("stellar:testnet", {
        readNetwork: async () => ({ networkPassphrase: pubnetPassphrase }),
        requestSwitch: async () => {
          throw new Error("User declined the network change.");
        }
      });

      expect(outcome).toMatchObject({
        type: "rejected",
        network: "stellar:testnet",
        retryable: true
      });
    });

    it("does not claim a switch that did not happen", async () => {
      const outcome = await switchWalletNetwork("stellar:testnet", {
        readNetwork: async () => ({ networkPassphrase: pubnetPassphrase }),
        requestSwitch: async () => undefined
      });

      expect(outcome).toMatchObject({
        type: "not_switched",
        network: "stellar:testnet",
        retryable: true
      });
      expect(outcome.message).toContain(getNetworkConfig("stellar:pubnet").label);
    });

    it("reports an unavailable wallet when the network cannot be read", async () => {
      const outcome = await switchWalletNetwork("stellar:testnet", {
        readNetwork: async () => ({ error: "Freighter is not installed." })
      });

      expect(outcome).toMatchObject({
        type: "unavailable",
        retryable: true
      });
    });
  });

  describe("wallet outcome mapping", () => {
    it("maps WALLET_REJECTED to rejected outcome", () => {
      const outcome = mapAuthorizationErrorToOutcome("WALLET_REJECTED");
      expect(outcome).toMatchObject({
        type: "rejected",
        retryable: true,
        errorCode: "WALLET_REJECTED"
      });
      expect(outcome.message).toContain("declined");
    });

    it("maps WALLET_TIMEOUT to timeout outcome", () => {
      const outcome = mapAuthorizationErrorToOutcome("WALLET_TIMEOUT");
      expect(outcome).toMatchObject({
        type: "timeout",
        retryable: true,
        errorCode: "WALLET_TIMEOUT"
      });
      expect(outcome.message).toContain("timed out");
    });

    it("maps WALLET_SIGNING_TIMEOUT to timeout outcome", () => {
      const outcome = mapAuthorizationErrorToOutcome("WALLET_SIGNING_TIMEOUT");
      expect(outcome).toMatchObject({
        type: "timeout",
        retryable: true,
        errorCode: "WALLET_SIGNING_TIMEOUT"
      });
    });

    it("maps WALLET_UNAVAILABLE to unavailable outcome", () => {
      const outcome = mapAuthorizationErrorToOutcome("WALLET_UNAVAILABLE");
      expect(outcome).toMatchObject({
        type: "unavailable",
        retryable: true,
        errorCode: "WALLET_UNAVAILABLE"
      });
      expect(outcome.message).toContain("not available");
    });

    it("maps SIGNATURE_INVALID to malformed_signature outcome", () => {
      const outcome = mapAuthorizationErrorToOutcome("SIGNATURE_INVALID");
      expect(outcome).toMatchObject({
        type: "malformed_signature",
        retryable: true,
        errorCode: "SIGNATURE_INVALID"
      });
      expect(outcome.message).toContain("invalid signature");
    });

    it("maps WALLET_MALFORMED_SIGNATURE to malformed_signature outcome", () => {
      const outcome = mapAuthorizationErrorToOutcome("WALLET_MALFORMED_SIGNATURE");
      expect(outcome).toMatchObject({
        type: "malformed_signature",
        retryable: true,
        errorCode: "WALLET_MALFORMED_SIGNATURE"
      });
    });

    it("maps WALLET_NETWORK_MISMATCH to network_mismatch outcome as non-retryable", () => {
      const outcome = mapAuthorizationErrorToOutcome("WALLET_NETWORK_MISMATCH");
      expect(outcome).toMatchObject({
        type: "network_mismatch",
        retryable: false,
        errorCode: "WALLET_NETWORK_MISMATCH"
      });
      expect(outcome.message).toContain("different network");
    });

    it("maps unknown error code to unavailable outcome", () => {
      const outcome = mapAuthorizationErrorToOutcome("UNKNOWN_ERROR");
      expect(outcome).toMatchObject({
        type: "unavailable",
        retryable: true
      });
      expect(outcome.message).toContain("unexpected");
    });

    it("ensures distinct outcomes for each failure type", () => {
      const outcomes: Record<string, WalletOutcome["type"]> = {
        WALLET_REJECTED: mapAuthorizationErrorToOutcome("WALLET_REJECTED").type,
        WALLET_TIMEOUT: mapAuthorizationErrorToOutcome("WALLET_TIMEOUT").type,
        WALLET_UNAVAILABLE: mapAuthorizationErrorToOutcome("WALLET_UNAVAILABLE").type,
        SIGNATURE_INVALID: mapAuthorizationErrorToOutcome("SIGNATURE_INVALID").type,
        WALLET_NETWORK_MISMATCH: mapAuthorizationErrorToOutcome("WALLET_NETWORK_MISMATCH").type
      };

      const types = Object.values(outcomes);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });
  });
});

describe("wallet connection state", () => {
  it("keeps the expected network and passphrase in sync", () => {
    const state: WalletConnectionState = {
      expectedNetwork: "stellar:testnet",
      expectedPassphrase: testnetPassphrase,
      status: "disconnected"
    };

    expect(state.expectedPassphrase).toBe(getNetworkConfig(state.expectedNetwork).passphrase);
  });
});
