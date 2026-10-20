import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNetworkConfig } from "@/config/networks";
import type { WalletConnectionState } from "@/services/wallets";

const wallets = vi.hoisted(() => ({
  connectFreighterWallet: vi.fn(),
  reconnectWallet: vi.fn(),
  switchWalletNetwork: vi.fn()
}));

vi.mock("@/services/wallets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/wallets")>();

  return {
    ...actual,
    connectFreighterWallet: wallets.connectFreighterWallet,
    reconnectWallet: wallets.reconnectWallet,
    switchWalletNetwork: wallets.switchWalletNetwork
  };
});

import { WalletStatus } from "./wallet-status";

const testnetPassphrase = getNetworkConfig("stellar:testnet").passphrase;
const pubnetPassphrase = getNetworkConfig("stellar:pubnet").passphrase;
const account = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";

function connectedState(): WalletConnectionState {
  return {
    actualNetwork: "stellar:testnet",
    address: account,
    expectedNetwork: "stellar:testnet",
    expectedPassphrase: testnetPassphrase,
    networkName: "TESTNET",
    networkPassphrase: testnetPassphrase,
    status: "connected",
    walletName: "Freighter"
  };
}

function mismatchState(): WalletConnectionState {
  return {
    actualNetwork: "stellar:pubnet",
    address: account,
    expectedNetwork: "stellar:testnet",
    expectedPassphrase: testnetPassphrase,
    networkName: "PUBLIC",
    networkPassphrase: pubnetPassphrase,
    status: "mismatch",
    walletName: "Freighter"
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  wallets.connectFreighterWallet.mockResolvedValue(mismatchState());
  wallets.reconnectWallet.mockResolvedValue(mismatchState());
  wallets.switchWalletNetwork.mockResolvedValue({
    type: "manual_required",
    message: "This wallet cannot change networks from this page.",
    retryable: true
  });
});

describe("WalletStatus", () => {
  it("renders a non-custodial Freighter connect action", () => {
    render(<WalletStatus />);

    expect(screen.getByRole("button", { name: /Connect Freighter/i })).toBeInTheDocument();
  });

  it("shows the recovery flow when the wallet is on the wrong network", async () => {
    const user = userEvent.setup();
    render(<WalletStatus />);

    await user.click(screen.getByRole("button", { name: /Connect Freighter/i }));

    expect(await screen.findByText("Wrong wallet network")).toBeInTheDocument();
    expect(screen.getByText("Expected network:")).toBeInTheDocument();
    expect(screen.getByText(getNetworkConfig("stellar:testnet").label)).toBeInTheDocument();
    expect(screen.getByText(getNetworkConfig("stellar:pubnet").label)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Switch to ${getNetworkConfig("stellar:testnet").label}` })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-check network" })).toBeInTheDocument();
  });

  it("keeps signing blocked and explains a refused network switch", async () => {
    const user = userEvent.setup();
    wallets.switchWalletNetwork.mockResolvedValue({
      type: "rejected",
      message: "The wallet refused the switch to Stellar Testnet.",
      retryable: true
    });

    render(<WalletStatus />);
    await user.click(screen.getByRole("button", { name: /Connect Freighter/i }));
    await screen.findByText("Wrong wallet network");

    await user.click(
      screen.getByRole("button", { name: `Switch to ${getNetworkConfig("stellar:testnet").label}` })
    );

    expect(
      await screen.findByText("The wallet refused the switch to Stellar Testnet.")
    ).toBeInTheDocument();
    expect(screen.getByText("Wrong wallet network")).toBeInTheDocument();
  });

  it("lists the manual switch steps when the wallet cannot change networks", async () => {
    const user = userEvent.setup();
    render(<WalletStatus />);

    await user.click(screen.getByRole("button", { name: /Connect Freighter/i }));
    await screen.findByText("Wrong wallet network");

    await user.click(
      screen.getByRole("button", { name: `Switch to ${getNetworkConfig("stellar:testnet").label}` })
    );

    expect(
      await screen.findByText("This wallet cannot change networks from this page.")
    ).toBeInTheDocument();
    expect(screen.getByText("Open the Freighter extension.")).toBeInTheDocument();
  });

  it("reports the connected wallet after a successful re-check", async () => {
    const user = userEvent.setup();
    wallets.reconnectWallet.mockResolvedValue(connectedState());

    render(<WalletStatus />);
    await user.click(screen.getByRole("button", { name: /Connect Freighter/i }));
    await screen.findByText("Wrong wallet network");

    await user.click(screen.getByRole("button", { name: "Re-check network" }));

    expect(await screen.findByText("Wallet connected")).toBeInTheDocument();
    expect(
      screen.getByText(
        `The wallet is on ${getNetworkConfig("stellar:testnet").label} and is ready to sign.`
      )
    ).toBeInTheDocument();
  });

  it("still reports the mismatch when the re-check finds the wrong network", async () => {
    const user = userEvent.setup();
    render(<WalletStatus />);

    await user.click(screen.getByRole("button", { name: /Connect Freighter/i }));
    await screen.findByText("Wrong wallet network");

    await user.click(screen.getByRole("button", { name: "Re-check network" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          `The wallet is still on ${getNetworkConfig("stellar:pubnet").label}. Switch it to ${getNetworkConfig("stellar:testnet").label} in the wallet, then re-check the network.`
        )
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Wrong wallet network")).toBeInTheDocument();
  });
});
