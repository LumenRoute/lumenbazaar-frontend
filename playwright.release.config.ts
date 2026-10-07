import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000
  },
  reporter: [["list"]],
  testDir: "./tests/release-e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "node tests/release-e2e/mock-server.mjs",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:8080/version"
    },
    {
      command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3101",
      env: {
        NEXT_PUBLIC_ENABLE_MAINNET: "false",
        NEXT_PUBLIC_ENABLE_UPTO_SESSIONS: "false",
        NEXT_PUBLIC_LUMENBAZAAR_API_URL: "http://localhost:8080",
        NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK: "stellar:testnet",
        NEXT_PUBLIC_LUMENBAZAAR_ENV: "testnet"
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:3101"
    }
  ],
  projects: [
    {
      name: "release-desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "release-mobile",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
