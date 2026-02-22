import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { assertSuccessMessage } from "./helpers/wait-for-xrpl";

test.describe.serial("Compliance page", () => {
  let context: BrowserContext;
  let page: Page;
  let credIssuerAddress: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: ".auth/wallet.json" });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("page loads — heading and tabs", async () => {
    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: "Compliance", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Credentials" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Domains" })).toBeVisible();
  });

  test("wallet setup cards visible", async () => {
    await page.goto("/compliance");
    await expect(page.getByText("Credential Issuer")).toBeVisible();
    await expect(page.getByText("Domain Owner")).toBeVisible();
    const generateButtons = page.getByRole("button", { name: "Generate Wallet" });
    const count = await generateButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("generate Credential Issuer wallet", async () => {
    test.setTimeout(90_000);

    await page.goto("/compliance");
    await page.getByRole("button", { name: "Generate Wallet" }).first().click();

    const credIssuerCard = page.locator("div").filter({ has: page.getByText("Credential Issuer") }).first();
    const addressLink = credIssuerCard.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ });
    await expect(addressLink).toBeVisible({ timeout: 45_000 });
    credIssuerAddress = ((await addressLink.textContent()) ?? "").trim();
  });

  test("issue KYC credential", async () => {
    test.setTimeout(60_000);

    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: "Issue Credential", level: 3 })).toBeVisible({
      timeout: 10_000,
    });

    // The Subject dropdown is a <select>. Select the first non-placeholder option (index 1).
    const subjectSelect = page.locator("form select").first();
    await subjectSelect.selectOption({ index: 1 });

    // Fill credential type
    await page.getByPlaceholder("e.g. KYC").fill("KYC");

    // Click Issue Credential
    await page.getByRole("button", { name: "Issue Credential" }).click();

    // Assert success — auto-clears after 2s, assert immediately
    await assertSuccessMessage(page, "Credential issued!", 45_000);
  });

  test("Issued Credentials table — Pending status", async () => {
    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: "Issued Credentials", level: 3 })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("KYC")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Pending")).toBeVisible();
  });

  test("accept credential", async () => {
    test.setTimeout(60_000);

    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: "Recipient Credentials", level: 3 })).toBeVisible({
      timeout: 10_000,
    });

    const acceptButton = page.getByRole("button", { name: "Accept" }).first();
    await expect(acceptButton).toBeVisible({ timeout: 15_000 });
    await acceptButton.click();

    await expect(page.getByText("Accepted")).toBeVisible({ timeout: 45_000 });
  });

  test("delete credential", async () => {
    test.setTimeout(45_000);

    await page.goto("/compliance");
    // Wait for KYC credential to appear in the issued credentials table
    await expect(page.getByText("KYC")).toBeVisible({ timeout: 15_000 });

    // Click first "Delete" button in the issued credentials area
    await page.getByRole("button", { name: "Delete" }).first().click();

    // Assert the KYC credential disappears and empty state appears
    await expect(page.getByText("No credentials issued yet.")).toBeVisible({ timeout: 30_000 });
  });

  test("switch to Domains tab", async () => {
    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();
    await expect(page.getByText("Domain Owner")).toBeVisible();
  });

  test("generate Domain Owner wallet", async () => {
    test.setTimeout(90_000);

    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();

    // Credential Issuer already has a wallet — the remaining "Generate Wallet" belongs to Domain Owner
    const generateButton = page.getByRole("button", { name: "Generate Wallet" });
    await generateButton.click();

    const domainOwnerCard = page.locator("div").filter({ has: page.getByText("Domain Owner") }).first();
    const addressLink = domainOwnerCard.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ });
    await expect(addressLink).toBeVisible({ timeout: 45_000 });
  });

  test("Create Domain form visible", async () => {
    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();
    await expect(page.getByRole("heading", { name: "Create Domain", level: 3 })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByPlaceholder("Credential issuer address")).toBeVisible();
    await expect(page.getByPlaceholder("Credential type")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add credential" })).toBeVisible();
  });

  test("create permissioned domain", async () => {
    test.setTimeout(60_000);

    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();

    await page.getByPlaceholder("Credential issuer address").fill(credIssuerAddress);
    await page.getByPlaceholder("Credential type").fill("KYC");

    await page.getByRole("button", { name: "Create Domain" }).click();

    // Assert success — auto-clears after 2s, assert immediately
    await assertSuccessMessage(page, "Domain created!", 45_000);
  });

  test("domain list shows domain with Edit and Delete", async () => {
    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();

    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  test("edit domain — form pre-fills, cancel returns", async () => {
    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();

    // Click Edit button
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(page.getByRole("heading", { name: "Edit Domain", level: 3 })).toBeVisible();

    // Credential type input should be pre-filled with "KYC"
    await expect(page.getByPlaceholder("Credential type")).toHaveValue("KYC");

    // Click Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Should be back to Create Domain mode
    await expect(page.getByRole("heading", { name: "Create Domain", level: 3 })).toBeVisible();
  });

  test("delete domain", async () => {
    test.setTimeout(45_000);

    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();

    const deleteButton = page.getByRole("button", { name: "Delete" });
    await expect(deleteButton).toBeVisible({ timeout: 15_000 });
    await deleteButton.first().click();

    // Domain removed — Delete button should no longer be visible
    await expect(page.getByRole("button", { name: "Delete" })).not.toBeVisible({ timeout: 30_000 });
  });

  test("add credential row", async () => {
    await page.goto("/compliance");
    await page.getByRole("button", { name: "Domains" }).click();

    // Count initial "Credential type" placeholder inputs
    const initialCount = await page.getByPlaceholder("Credential type").count();

    // Click "+ Add credential"
    await page.getByRole("button", { name: "+ Add credential" }).click();

    // Count should have increased by 1
    const newCount = await page.getByPlaceholder("Credential type").count();
    expect(newCount).toBe(initialCount + 1);
  });
});
