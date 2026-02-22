import { test, expect, type BrowserContext } from "@playwright/test";
import { assertSuccessMessage } from "./helpers/wait-for-xrpl";

test.describe.serial("Transact page", () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: ".auth/wallet.json" });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("page loads — heading, wallet card, Send button", async () => {
    const page = await context.newPage();
    await page.goto("/transact");

    await expect(page.getByRole("heading", { name: "Transact", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();

    await page.close();
  });

  test("wallet card collapse/expand", async () => {
    const page = await context.newPage();
    await page.goto("/transact");

    // The wallet card toggle button contains the address text
    const toggleButton = page.getByRole("button", { name: /^r[a-zA-Z0-9]{24,}/ });
    await expect(toggleButton).toBeVisible();

    // Collapse
    await toggleButton.click();
    await expect(page.getByRole("button", { name: "Send" })).not.toBeVisible();

    // Expand
    await toggleButton.click();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();

    await page.close();
  });

  test("open TransferModal", async () => {
    const page = await context.newPage();
    await page.goto("/transact");

    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("heading", { name: "Send Currency", level: 2 })).toBeVisible();

    await page.close();
  });

  test("currency dropdown has TCOIN", async () => {
    const page = await context.newPage();
    await page.goto("/transact");

    await page.getByRole("button", { name: "Send" }).click();

    // Wait for balances to load
    await expect(page.getByText("Loading balances...")).not.toBeVisible({ timeout: 15_000 });

    // At least one option in the currency select should contain "TCOIN"
    await expect(page.locator("form select option", { hasText: "TCOIN" }).first()).toBeAttached();

    await page.close();
  });

  test("recipient mode toggle", async () => {
    const page = await context.newPage();
    await page.goto("/transact");

    await page.getByRole("button", { name: "Send" }).click();

    // "Known wallet" should be pressed by default
    const knownWalletButton = page.getByRole("button", { name: "Known wallet" });
    const otherButton = page.getByRole("button", { name: "Other" });

    await expect(knownWalletButton).toHaveAttribute("aria-pressed", "true");

    // Switch to "Other"
    await otherButton.click();
    await expect(otherButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByPlaceholder("rXXXXXXXX...")).toBeVisible();

    // Switch back to "Known wallet"
    await knownWalletButton.click();
    await expect(knownWalletButton).toHaveAttribute("aria-pressed", "true");

    await page.close();
  });

  test("trust line validation for unknown address", async () => {
    const page = await context.newPage();
    await page.goto("/transact");

    await page.getByRole("button", { name: "Send" }).click();

    // Wait for balances to load
    await expect(page.getByText("Loading balances...")).not.toBeVisible({ timeout: 15_000 });

    // Select TCOIN if not already selected — find option value by text content
    const currencySelect = page.locator("form select").first();
    const tcoinOption = currencySelect.locator("option", { hasText: "TCOIN" }).first();
    const tcoinValue = await tcoinOption.getAttribute("value");
    await currencySelect.selectOption({ value: tcoinValue ?? "1" });

    // Switch to "Other" recipient mode and fill in genesis account address
    await page.getByRole("button", { name: "Other" }).click();
    await page.getByPlaceholder("rXXXXXXXX...").fill("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh");

    // Assert trust line error message appears
    await expect(page.getByText(/does not have a trust line/)).toBeVisible({ timeout: 15_000 });

    await page.close();
  });

  test("close modal", async () => {
    const page = await context.newPage();
    await page.goto("/transact");

    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("heading", { name: "Send Currency", level: 2 })).toBeVisible();

    // Click close button (aria-label="Close" on ModalShell)
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("heading", { name: "Send Currency", level: 2 })).not.toBeVisible();

    await page.close();
  });

  test("send TCOIN to issuer", async () => {
    test.setTimeout(60_000);

    const page = await context.newPage();
    await page.goto("/transact");

    await page.getByRole("button", { name: "Send" }).click();

    // Wait for balances to load
    await expect(page.getByText("Loading balances...")).not.toBeVisible({ timeout: 15_000 });

    // Select TCOIN — find option value by text content
    const currencySelect = page.locator("form select").first();
    const tcoinOption = currencySelect.locator("option", { hasText: "TCOIN" }).first();
    const tcoinValue = await tcoinOption.getAttribute("value");
    await currencySelect.selectOption({ value: tcoinValue ?? "1" });

    // Fill amount
    await page.locator("form input[type='number']").fill("10");

    // The default "Known wallet" mode — issuer should be in the recipient dropdown
    // A burn warning should appear since recipient is the issuer
    await expect(page.getByText(/This will burn TCOIN/)).toBeVisible({ timeout: 10_000 });

    // Click the Send button scoped to the form
    await page.locator("form").getByRole("button", { name: "Send" }).click();

    // Assert transfer success (auto-clears after 2s, assert immediately)
    await assertSuccessMessage(page, "Transfer successful!", 45_000);

    await page.close();
  });
});
