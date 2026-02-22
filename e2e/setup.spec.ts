import { test, expect, type Page, type BrowserContext } from "@playwright/test";

test.describe.serial("Setup page", () => {
  let context: BrowserContext;
  let page: Page;
  let issuerAddress: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: ".auth/wallet.json" });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("heading visible", async () => {
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "XRPL Issued Currencies Manager", level: 1 })).toBeVisible();
  });

  test("issuer wallet loaded from state", async () => {
    await page.goto("/setup");
    const addressLink = page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ }).first();
    await expect(addressLink).toBeVisible({ timeout: 15_000 });
    issuerAddress = ((await addressLink.textContent()) ?? "").trim();
    await expect(page.getByText(/\d[\d,.]*\s*XRP/)).toBeVisible({ timeout: 15_000 });
  });

  test("show/hide seed", async () => {
    await expect(page.getByRole("button", { name: "Show secret" })).toBeVisible();
    await page.getByRole("button", { name: "Show secret" }).click();
    await expect(page.getByRole("button", { name: "Hide secret" })).toBeVisible();
    await expect(page.getByText(/^s[a-zA-Z0-9]{20,}/)).toBeVisible();
    await page.getByRole("button", { name: "Hide secret" }).click();
    await expect(page.getByRole("button", { name: "Show secret" })).toBeVisible();
  });

  test("rippling already enabled", async () => {
    const ripplingButton = page.getByRole("button", { name: "Rippling Enabled" });
    await expect(ripplingButton).toBeVisible();
    await expect(ripplingButton).toBeDisabled();
  });

  test("collapse/expand issuer section", async () => {
    // The toggle button is the section header button containing "1. Issuer Wallet"
    const toggleButton = page.getByRole("button", { name: /1\. Issuer Wallet/ });
    await toggleButton.click();
    await expect(page.getByRole("button", { name: "Rippling Enabled" })).not.toBeVisible();
    await toggleButton.click();
    await expect(page.getByRole("button", { name: "Rippling Enabled" })).toBeVisible();
  });

  test("add currency FOO", async () => {
    await page.getByPlaceholder("e.g. USD").fill("FOO");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("FOO")).toBeVisible();
  });

  test("duplicate currency shows error", async () => {
    await page.getByPlaceholder("e.g. USD").fill("FOO");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(/FOO already added/)).toBeVisible();
  });

  test("invalid currency shows error", async () => {
    await page.getByPlaceholder("e.g. USD").fill("A");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(/must be.*uppercase/i)).toBeVisible();
  });

  test("remove local currency", async () => {
    await page.getByPlaceholder("e.g. USD").fill("TEMP");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("TEMP")).toBeVisible();
    await page.getByRole("button", { name: "Remove TEMP" }).click();
    await expect(page.getByText("TEMP")).not.toBeVisible();
  });

  test("recipient card loaded — collapsed", async () => {
    const secondAddressLink = page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ }).nth(1);
    await expect(secondAddressLink).toBeVisible({ timeout: 15_000 });
    // Card starts collapsed — "Fund from Faucet" should not be visible
    await expect(page.getByRole("button", { name: "Fund from Faucet" }).last()).not.toBeVisible();
  });

  test("expand recipient card — shows balances and trust lines", async () => {
    // Click the recipient card toggle button (button containing the recipient address)
    const recipientToggle = page.getByRole("button", { name: /^r[a-zA-Z0-9]{24,}/ });
    await recipientToggle.click();
    // Balance section should now be visible
    await expect(page.getByText("Balances").last()).toBeVisible();
    // TCOIN trust line badge should be visible
    await expect(page.getByText("TCOIN").last()).toBeVisible();
  });

  test("view/hide JSON", async () => {
    await page.getByRole("button", { name: "View JSON" }).click();
    const pre = page.locator("pre");
    await expect(pre).toBeVisible();
    const preContent = await pre.textContent();
    expect(preContent).toContain(issuerAddress);
    await page.getByRole("button", { name: "Hide JSON" }).click();
    await expect(pre).not.toBeVisible();
  });

  test("export → clear → import roundtrip", async () => {
    // Capture the download event triggered by clicking "Export as JSON"
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export as JSON" }).click(),
    ]);
    const downloadPath = await download.path();

    // Accept confirm dialog and clear all data
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Clear All Data" }).click();

    // After clear, "Generate Issuer Wallet" should appear (data cleared)
    await expect(page.getByRole("button", { name: "Generate Issuer Wallet" })).toBeVisible({ timeout: 10_000 });

    // Import the downloaded file back using the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(downloadPath!);

    // Issuer address link should reappear after import
    await expect(page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ }).first()).toBeVisible({ timeout: 15_000 });
  });
});
