import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { assertSuccessMessage } from "./helpers/wait-for-xrpl";

function tradeFormLocator(page: Page) {
  return page.locator("div").filter({
    has: page.getByRole("heading", { name: "Place Order" }),
  });
}

/** Select the TCOIN/XRP pair and wait for the Place Order heading to confirm the pair loaded. */
async function selectTcoinXrpPair(page: Page) {
  await page.goto("/trade");
  // Find the option value for TCOIN in the Base select (value encoded as "TCOIN|<issuer>")
  const baseSelect = page.getByLabel("Base");
  const tcoinValue = await baseSelect.locator("option").filter({ hasText: /^TCOIN/ }).getAttribute("value");
  if (tcoinValue) {
    await baseSelect.selectOption(tcoinValue);
  }
  // XRP has a fixed value of "XRP|"
  await page.getByLabel("Quote").selectOption("XRP|");
  await expect(page.getByRole("heading", { name: "Place Order" })).toBeVisible({ timeout: 15_000 });
}

test.describe.serial("Trade DEX", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: ".auth/wallet.json" });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("page loads — heading and wallet selector", async () => {
    await page.goto("/trade");
    await expect(page.getByRole("heading", { name: "Trade", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("select TCOIN/XRP pair — form renders", async () => {
    await selectTcoinXrpPair(page);
    await expect(page.getByRole("heading", { name: "Place Order", level: 3 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buy TCOIN" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sell TCOIN" })).toBeVisible();
  });

  test("order book renders", async () => {
    await selectTcoinXrpPair(page);
    await expect(page.getByRole("heading", { name: "Order Book" })).toBeVisible({ timeout: 15_000 });
    // Depth select should have "10" as default option
    const depthSelect = page.locator("select").filter({ hasText: "10" });
    await expect(depthSelect).toBeVisible();
  });

  test("custom currency form", async () => {
    await page.goto("/trade");
    await page.getByRole("button", { name: "+ Custom Currency" }).click();
    // Fill currency code (placeholder "USD")
    await page.getByPlaceholder("USD").fill("FAKECOIN");
    // Fill issuer address (placeholder "rXXXXXXXX...")
    await page.getByPlaceholder("rXXXXXXXX...").fill("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh");
    await page.getByRole("button", { name: "Add" }).click();
    // FAKECOIN should appear as an option in Base or Quote select
    await expect(
      page.getByLabel("Base").locator("option", { hasText: /FAKECOIN/ }),
    ).toHaveCount(1);
  });

  test("domain selector", async () => {
    await page.goto("/trade");
    await expect(page.getByText("DEX Mode:")).toBeVisible();
    // Find the select containing "Open DEX" text
    const domainSelect = page.locator("select").filter({ hasText: "Open DEX" });
    await expect(domainSelect).toBeVisible();
    // Change to "custom" option
    await domainSelect.selectOption("custom");
    // Assert placeholder input appears
    await expect(
      page.getByPlaceholder("Enter Domain ID (64-char hex)"),
    ).toBeVisible();
  });

  test("place buy order", async () => {
    test.setTimeout(90_000);
    await selectTcoinXrpPair(page);
    await page.getByRole("button", { name: "Buy TCOIN" }).click();
    const form = tradeFormLocator(page);
    // Fill Amount (1st spinbutton)
    await form.getByRole("spinbutton").nth(0).fill("1");
    // Fill Price (2nd spinbutton) — intentionally low so order sits on book
    await form.getByRole("spinbutton").nth(1).fill("0.000001");
    // Assert submit button enabled
    const submitBtn = form.getByRole("button", { name: "Place Buy Order" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    // Assert success message — auto-clears after 2s, so assert immediately
    await assertSuccessMessage(page, "Order placed successfully!", 45_000);
  });

  test("place sell order", async () => {
    test.setTimeout(90_000);
    await selectTcoinXrpPair(page);
    await page.getByRole("button", { name: "Sell TCOIN" }).click();
    const form = tradeFormLocator(page);
    // Fill Amount (1st spinbutton)
    await form.getByRole("spinbutton").nth(0).fill("1");
    // Fill Price (2nd spinbutton) — intentionally high so order sits on book
    await form.getByRole("spinbutton").nth(1).fill("1000");
    const submitBtn = form.getByRole("button", { name: "Place Sell Order" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await assertSuccessMessage(page, "Order placed successfully!", 45_000);
  });

  test("open orders tab shows count", async () => {
    await selectTcoinXrpPair(page);
    // Wait for Open orders tab to show at least 1 open order
    await expect(
      page.getByRole("button", { name: /Open \([1-9]/ }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("cancel open order", async () => {
    test.setTimeout(60_000);
    await selectTcoinXrpPair(page);
    // Try to expand the orders panel if collapsed
    try {
      const showOrdersBtn = page.getByRole("button", { name: /Show Orders/ });
      await showOrdersBtn.waitFor({ timeout: 3_000 });
      await showOrdersBtn.click();
    } catch {
      // Panel may already be expanded or not present on mobile view — continue
    }
    // Find the first Cancel button
    const cancelBtn = page.getByRole("button", { name: "Cancel" }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 15_000 });
    await cancelBtn.click();
    // Wait for the cancel button to disappear (order removed from table)
    await expect(cancelBtn).not.toBeVisible({ timeout: 30_000 });
  });

  test("order book row click prefills form", async () => {
    test.setTimeout(45_000);
    await selectTcoinXrpPair(page);
    await expect(page.getByRole("heading", { name: "Order Book" })).toBeVisible({ timeout: 15_000 });
    const orderBookRows = page.locator('[role="button"]').filter({ hasText: /\d+\.\d{4,}/ });
    try {
      await orderBookRows.first().waitFor({ timeout: 20_000 });
    } catch {
      test.skip(true, "No clickable order book rows");
      return;
    }
    await orderBookRows.first().click();
    const form = tradeFormLocator(page);
    // Amount and Price fields should be prefilled (not empty)
    await expect(form.getByRole("spinbutton").nth(0)).not.toHaveValue("");
    await expect(form.getByRole("spinbutton").nth(1)).not.toHaveValue("");
  });

  test("Make Market modal opens", async () => {
    await selectTcoinXrpPair(page);
    await page.getByRole("button", { name: /Make Market/ }).click();
    await expect(page.getByRole("heading", { name: "Make Market", level: 2 })).toBeVisible();
    await expect(page.getByText("Bid Wallet")).toBeVisible();
    await expect(page.getByText("Ask Wallet")).toBeVisible();
    await expect(page.getByText(/Mid Price/)).toBeVisible();
  });

  test("Make Market preview flow", async () => {
    await selectTcoinXrpPair(page);
    await page.getByRole("button", { name: /Make Market/ }).click();
    await expect(page.getByRole("heading", { name: "Make Market", level: 2 })).toBeVisible();
    // Fill mid price
    await page.getByPlaceholder("0.00").fill("0.001");
    await page.getByRole("button", { name: "Preview Orders" }).click();
    // Preview step
    await expect(page.getByRole("heading", { name: "Preview Orders", level: 2 })).toBeVisible();
    // At least one Bid and one Ask cell in the preview table
    await expect(page.getByRole("cell", { name: "Bid" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Ask" }).first()).toBeVisible();
    // Click Back
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Make Market", level: 2 })).toBeVisible();
  });

  test("Make Market execute", async () => {
    test.setTimeout(180_000);
    await selectTcoinXrpPair(page);
    await page.getByRole("button", { name: /Make Market/ }).click();
    await expect(page.getByRole("heading", { name: "Make Market", level: 2 })).toBeVisible();
    // Fill mid price
    await page.getByPlaceholder("0.00").fill("0.001");
    await page.getByRole("button", { name: "Preview Orders" }).click();
    await expect(page.getByRole("heading", { name: "Preview Orders", level: 2 })).toBeVisible();
    // Place orders
    await page.getByRole("button", { name: "Place Orders" }).click();
    // Wait for modal to close — the Make Market heading should disappear
    await expect(page.getByRole("heading", { name: "Make Market", level: 2 })).not.toBeVisible({ timeout: 120_000 });
  });
});
