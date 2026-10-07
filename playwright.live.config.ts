import { defineConfig, devices } from "@playwright/test";

const extensionPath = process.env.FREIGHTER_EXTENSION_PATH;

export default defineConfig({
  expect: {
    timeout: 30_000
  },
  reporter: [["list"]],
  testDir: "./tests/live-e2e",
  timeout: 300_000,
  use: {
    baseURL: process.env.LUMENBAZAAR_LIVE_BASE_URL ?? "http://127.0.0.1:3100",
    headless: extensionPath === undefined,
    launchOptions:
      extensionPath === undefined
        ? undefined
        : {
            args: [
              `--disable-extensions-except=${extensionPath}`,
              `--load-extension=${extensionPath}`
            ]
          },
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "external-desktop",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
