import { type Page, expect } from "@playwright/test";

/** Wait for a wallet address link to appear after faucet generation. */
export async function waitForWalletGenerated(
  page: Page,
  nth = 0,
  timeout = 45_000,
): Promise<string> {
  const link = page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ }).nth(nth);
  await expect(link).toBeVisible({ timeout });
  return (await link.textContent())!.trim();
}

/** Wait for XRP balance text to appear (confirms faucet funded the wallet). */
export async function waitForXrpBalance(page: Page, timeout = 20_000): Promise<void> {
  await expect(page.getByText(/\d[\d,.]*\s*XRP/)).toBeVisible({ timeout });
}

/** Assert a success message is visible (for auto-clearing banners with 2s window). */
export async function assertSuccessMessage(
  page: Page,
  text: string | RegExp,
  timeout = 30_000,
): Promise<void> {
  await expect(page.getByText(text)).toBeVisible({ timeout });
}
