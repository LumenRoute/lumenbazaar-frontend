import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getNetworkConfig } from "@/config/networks";

import { WalletNetworkRecovery } from "./wallet-network-recovery";

const testnetPassphrase = getNetworkConfig("stellar:testnet").passphrase;
const pubnetPassphrase = getNetworkConfig("stellar:pubnet").passphrase;

function mismatchWallet() {
  return {
    actualNetwork: "stellar:pubnet" as const,
    address: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
    expectedNetwork: "stellar:testnet" as const,
    expectedPassphrase: testnetPassphrase,
    networkName: "PUBLIC",
    networkPassphrase: pubnetPassphrase,
    status: "mismatch" as const,
    walletName: "Freighter"
  };
}

describe("WalletNetworkRecovery", () => {
  it("names the expected and the current network", () => {
    render(
      <WalletNetworkRecovery
        busy={null}
        onRecheck={vi.fn()}
        onSwitch={vi.fn()}
        wallet={mismatchWallet()}
      />
    );

    expect(screen.getByText("Expected network:")).toBeInTheDocument();
    expect(screen.getByText(getNetworkConfig("stellar:testnet").label)).toBeInTheDocument();
    expect(screen.getByText("Current network:")).toBeInTheDocument();
    expect(screen.getByText(getNetworkConfig("stellar:pubnet").label)).toBeInTheDocument();
  });

  it("states that signing stays blocked", () => {
    render(
      <WalletNetworkRecovery
        busy={null}
        onRecheck={vi.fn()}
        onSwitch={vi.fn()}
        wallet={mismatchWallet()}
      />
    );

    expect(screen.getByText(/signing stays blocked/i)).toBeInTheDocument();
    expect(screen.getByText("Wrong wallet network")).toBeInTheDocument();
  });

  it("labels an unverifiable wallet network instead of claiming a mismatch", () => {
    render(
      <WalletNetworkRecovery
        busy={null}
        onRecheck={vi.fn()}
        onSwitch={vi.fn()}
        wallet={{
          expectedNetwork: "stellar:testnet",
          expectedPassphrase: testnetPassphrase,
          status: "network_unknown"
        }}
      />
    );

    expect(screen.getByText("Wallet network not verified")).toBeInTheDocument();
    expect(screen.getByText("Unknown network")).toBeInTheDocument();
  });

  it("exposes the recovery actions as keyboard reachable buttons", async () => {
    const user = userEvent.setup();
    const onRecheck = vi.fn();
    const onSwitch = vi.fn();

    render(
      <WalletNetworkRecovery
        busy={null}
        onRecheck={onRecheck}
        onSwitch={onSwitch}
        wallet={mismatchWallet()}
      />
    );

    const switchButton = screen.getByRole("button", {
      name: `Switch to ${getNetworkConfig("stellar:testnet").label}`
    });
    const recheckButton = screen.getByRole("button", { name: "Re-check network" });

    await user.tab();
    expect(switchButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onRecheck).not.toHaveBeenCalled();

    await user.tab();
    expect(recheckButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("disables both actions while a recovery action is running", () => {
    render(
      <WalletNetworkRecovery
        busy="switch"
        onRecheck={vi.fn()}
        onSwitch={vi.fn()}
        wallet={mismatchWallet()}
      />
    );

    expect(screen.getByRole("button", { name: "Switching" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Re-check network" })).toBeDisabled();
  });

  it("announces the recovery result in a status region", () => {
    render(
      <WalletNetworkRecovery
        busy={null}
        notice={{ tone: "success", message: "The wallet is now on Stellar Testnet." }}
        onRecheck={vi.fn()}
        onSwitch={vi.fn()}
        wallet={mismatchWallet()}
      />
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("The wallet is now on Stellar Testnet.");
  });

  it("lists the manual switch steps when the wallet cannot change networks", () => {
    render(
      <WalletNetworkRecovery
        busy={null}
        notice={{
          tone: "warning",
          message: "This wallet cannot change networks from this page.",
          steps: ["Open the Freighter extension.", "Switch the network to Stellar Testnet."]
        }}
        onRecheck={vi.fn()}
        onSwitch={vi.fn()}
        wallet={mismatchWallet()}
      />
    );

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent("Open the Freighter extension.");
    expect(steps[1]).toHaveTextContent("Switch the network to Stellar Testnet.");
  });
});
