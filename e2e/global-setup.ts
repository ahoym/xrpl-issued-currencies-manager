import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import { waitForWalletGenerated, waitForXrpBalance } from "./helpers/wait-for-xrpl";

setup("bootstrap devnet state", async ({ page }) => {
  setup.setTimeout(300_000);

  // Ensure .auth/ dir exists
  fs.mkdirSync(".auth", { recursive: true });

  // Navigate to setup page
  await page.goto("/setup");

  // Switch network to devnet
  await page.locator("#network").selectOption("devnet");

  // Generate issuer wallet and wait for address link
  await page.getByRole("button", { name: "Generate Issuer Wallet" }).click();
  await waitForWalletGenerated(page, 0, 45_000);
  await waitForXrpBalance(page);

  // Enable Rippling
  await page.getByRole("button", { name: "Enable Rippling" }).click();
  await expect(
    page.getByRole("button", { name: "Rippling Enabled" }),
  ).toBeVisible({ timeout: 30_000 });

  // Add TCOIN currency
  await page.getByPlaceholder("e.g. USD").fill("TCOIN");
  await page.getByRole("button", { name: "Add" }).click();

  // Generate recipient wallet and wait for 2nd address link
  await page.getByRole("button", { name: "Generate Recipient Wallet" }).click();
  await waitForWalletGenerated(page, 1, 45_000);

  // Expand recipient card — toggle button contains the address text
  await page.getByRole("button", { name: /^r[a-zA-Z0-9]{24,}/ }).click();

  // Click "Receive Currency" to open WalletSetupModal
  await page.getByRole("button", { name: "Receive Currency" }).click();

  // WalletSetupModal — click "Set Up"
  await page.getByRole("button", { name: "Set Up" }).click();

  // Assert success message
  await expect(
    page.getByText("Successfully received 1,000 TCOIN tokens."),
  ).toBeVisible({ timeout: 60_000 });

  // Save storage state
  await page.context().storageState({ path: ".auth/wallet.json" });
});
