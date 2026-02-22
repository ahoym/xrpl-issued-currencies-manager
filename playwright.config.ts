import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: "global-setup.ts",
    },
    {
      name: "setup-page",
      testMatch: "setup.spec.ts",
      dependencies: ["setup"],
      use: { storageState: ".auth/wallet.json" },
    },
    {
      name: "transact-page",
      testMatch: "transact.spec.ts",
      dependencies: ["setup"],
      use: { storageState: ".auth/wallet.json" },
    },
    {
      name: "trade-dex",
      testMatch: "trade-dex.spec.ts",
      dependencies: ["setup"],
      use: { storageState: ".auth/wallet.json" },
    },
    {
      name: "trade-amm",
      testMatch: "trade-amm.spec.ts",
      dependencies: ["setup"],
      use: { storageState: ".auth/wallet.json" },
    },
    {
      name: "compliance-page",
      testMatch: "compliance.spec.ts",
      dependencies: ["setup"],
      use: { storageState: ".auth/wallet.json" },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
