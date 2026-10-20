/**
 * Wrong-network wallet recovery coverage.
 *
 * The Freighter extension is replaced by a stub that answers the extension
 * message protocol, so the flow can be exercised deterministically in a real
 * browser on the desktop and the mobile project.
 *
 * The stub reports a wallet on the Stellar public network while the frontend
 * requires Stellar testnet, which is the mismatch the recovery flow exists
 * for.
 */

import { expect, test, type Page } from "@playwright/test";

const PUBLIC_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const PUBLIC_KEY = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";

type StubbedWallet = {
  network: string;
  networkPassphrase: string;
  publicKey: string;
};

/**
 * Answers the Freighter extension message protocol with a synthetic wallet.
 * The account and the network are public testnet values only.
 */
async function stubFreighter(page: Page, wallet: StubbedWallet) {
  await page.addInitScript((stub) => {
    window.addEventListener("message", (event) => {
      const data = event.data as { messageId?: number; source?: string; type?: string } | undefined;

      if (
        !data ||
        data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST" ||
        data.messageId === undefined
      ) {
        return;
      }

      const responses: Record<string, Record<string, unknown>> = {
        REQUEST_ACCESS: { publicKey: stub.publicKey, apiError: "" },
        REQUEST_ALLOWED_STATUS: { isAllowed: true, apiError: "" },
        REQUEST_NETWORK: {
          network: stub.network,
          networkPassphrase: stub.networkPassphrase,
          apiError: ""
        },
        REQUEST_NETWORK_DETAILS: {
          apiError: "",
          networkDetails: {
            network: stub.network,
            networkName: stub.network,
            networkPassphrase: stub.networkPassphrase,
            networkUrl: "https://horizon.stellar.org",
            sorobanRpcUrl: "https://mainnet.sorobanrpc.com"
          }
        },
        REQUEST_PUBLIC_KEY: { publicKey: stub.publicKey, apiError: "" }
      };

      window.postMessage(
        {
          source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
          messagedId: data.messageId,
          ...(responses[data.type ?? ""] ?? { apiError: "" })
        },
        window.location.origin
      );
    });
  }, wallet);
}

test("blocks the wallet and shows both networks when the wallet is on another network", async ({
  page
}) => {
  await stubFreighter(page, {
    network: "PUBLIC",
    networkPassphrase: PUBLIC_PASSPHRASE,
    publicKey: PUBLIC_KEY
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Connect Freighter/i }).click();

  await expect(page.getByText("Wrong wallet network")).toBeVisible();
  await expect(page.getByText("Expected network:")).toBeVisible();
  await expect(page.getByText("Stellar Testnet", { exact: true })).toBeVisible();
  await expect(page.getByText("Current network:")).toBeVisible();
  await expect(page.getByText("Stellar Public Network", { exact: true })).toBeVisible();
  await expect(page.getByText(/signing stays blocked/i)).toBeVisible();
});

test("keeps the recovery actions keyboard reachable", async ({ page }) => {
  await stubFreighter(page, {
    network: "PUBLIC",
    networkPassphrase: PUBLIC_PASSPHRASE,
    publicKey: PUBLIC_KEY
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Connect Freighter/i }).click();

  const switchAction = page.getByRole("button", { name: "Switch to Stellar Testnet" });
  const recheckAction = page.getByRole("button", { name: "Re-check network" });

  await expect(switchAction).toBeVisible();
  await expect(recheckAction).toBeVisible();

  await switchAction.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("cannot change networks");

  await recheckAction.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("still on Stellar Public Network");
});

test("reports that the wallet must be switched inside the wallet", async ({ page }) => {
  await stubFreighter(page, {
    network: "PUBLIC",
    networkPassphrase: PUBLIC_PASSPHRASE,
    publicKey: PUBLIC_KEY
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Connect Freighter/i }).click();
  await expect(page.getByText("Wrong wallet network")).toBeVisible();

  await page.getByRole("button", { name: "Switch to Stellar Testnet" }).click();

  await expect(page.getByRole("status")).toContainText("cannot change networks");
  await expect(page.getByText("Open the Freighter extension.")).toBeVisible();
  await expect(page.getByText("Switch the network to Stellar Testnet.")).toBeVisible();
});

test("blocks the wallet when the wallet does not report a network", async ({ page }) => {
  await stubFreighter(page, {
    network: "",
    networkPassphrase: "",
    publicKey: PUBLIC_KEY
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Connect Freighter/i }).click();

  await expect(page.getByText("Wallet network not verified")).toBeVisible();
  await expect(page.getByText("Current network:")).toBeVisible();
  await expect(page.getByText("Unknown network")).toBeVisible();
});

test("does not overflow the viewport", async ({ page }) => {
  await stubFreighter(page, {
    network: "PUBLIC",
    networkPassphrase: PUBLIC_PASSPHRASE,
    publicKey: PUBLIC_KEY
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Connect Freighter/i }).click();
  await expect(page.getByText("Wrong wallet network")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
});
