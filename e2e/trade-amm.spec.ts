import { test, expect, type BrowserContext } from "@playwright/test";

test.describe.serial("Trade AMM", () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: ".auth/wallet.json" });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("AMM Pool panel visible", async () => {
    const page = await context.newPage();
    await page.goto("/trade");
    await page.getByLabel("Base").selectOption({ label: "TCOIN" });
    await page.getByLabel("Quote").selectOption({ label: "XRP" });
    await expect(page.getByRole("heading", { name: "AMM Pool" })).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText("No AMM Pool").or(page.getByText("Spot Price")),
    ).toBeVisible({ timeout: 15_000 });

    await page.close();
  });

  test("AMM Create modal UI", async () => {
    const page = await context.newPage();
    await page.goto("/trade");
    await page.getByLabel("Base").selectOption({ label: "TCOIN" });
    await page.getByLabel("Quote").selectOption({ label: "XRP" });
    await expect(page.getByRole("heading", { name: "AMM Pool" })).toBeVisible({ timeout: 15_000 });

    const createButton = page.getByRole("button", { name: "Create Pool" });
    let createVisible = false;
    try {
      await expect(createButton).toBeVisible({ timeout: 5_000 });
      createVisible = true;
    } catch {
      // pool already exists
    }
    if (!createVisible) {
      test.skip(true, "Pool already exists");
      return;
    }

    await createButton.click();
    await expect(page.getByRole("heading", { name: "Create AMM Pool", level: 2 })).toBeVisible();

    await expect(page.getByRole("button", { name: "0.10%" })).toBeVisible();
    await expect(page.getByRole("button", { name: "0.30%" })).toBeVisible();
    await expect(page.getByRole("button", { name: "1.00%" })).toBeVisible();

    await expect(page.getByText(/approximately 0\.2 XRP/)).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("heading", { name: "Create AMM Pool", level: 2 })).not.toBeVisible();

    await page.close();
  });

  test("AMM Create full flow", async () => {
    test.setTimeout(120_000);

    const page = await context.newPage();
    await page.goto("/trade");
    await page.getByLabel("Base").selectOption({ label: "TCOIN" });
    await page.getByLabel("Quote").selectOption({ label: "XRP" });
    await expect(page.getByRole("heading", { name: "AMM Pool" })).toBeVisible({ timeout: 15_000 });

    const createButton = page.getByRole("button", { name: "Create Pool" });
    let createVisible = false;
    try {
      await expect(createButton).toBeVisible({ timeout: 5_000 });
      createVisible = true;
    } catch {
      // pool already exists
    }
    if (!createVisible) {
      test.skip(true, "Pool already exists");
      return;
    }

    await createButton.click();
    await page.getByRole("button", { name: "0.30%" }).click();

    const spinbuttons = page.getByRole("spinbutton");
    await spinbuttons.nth(0).fill("10");
    await spinbuttons.nth(1).fill("0.01");

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name: "Preview AMM Pool", level: 2 })).toBeVisible();

    await page.getByRole("button", { name: "Confirm & Create" }).click();
    await expect(page.getByText("AMM pool created successfully!")).toBeVisible({ timeout: 60_000 });

    await page.close();
  });

  test("AMM Deposit modal tabs", async () => {
    const page = await context.newPage();
    await page.goto("/trade");
    await page.getByLabel("Base").selectOption({ label: "TCOIN" });
    await page.getByLabel("Quote").selectOption({ label: "XRP" });
    await expect(page.getByRole("heading", { name: "AMM Pool" })).toBeVisible({ timeout: 15_000 });

    const depositButton = page.getByRole("button", { name: "Deposit" });
    let depositVisible = false;
    try {
      await expect(depositButton).toBeVisible({ timeout: 5_000 });
      depositVisible = true;
    } catch {
      // pool does not exist
    }
    if (!depositVisible) {
      test.skip(true, "No AMM pool to deposit into");
      return;
    }

    await depositButton.click();
    await expect(page.getByRole("heading", { name: "Deposit into AMM Pool", level: 2 })).toBeVisible();

    await expect(page.getByRole("button", { name: "Both Assets" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Single Asset" })).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();

    await page.close();
  });

  test("AMM Deposit execute", async () => {
    test.setTimeout(60_000);

    const page = await context.newPage();
    await page.goto("/trade");
    await page.getByLabel("Base").selectOption({ label: "TCOIN" });
    await page.getByLabel("Quote").selectOption({ label: "XRP" });
    await expect(page.getByRole("heading", { name: "AMM Pool" })).toBeVisible({ timeout: 15_000 });

    const depositButton = page.getByRole("button", { name: "Deposit" });
    let depositVisible = false;
    try {
      await expect(depositButton).toBeVisible({ timeout: 5_000 });
      depositVisible = true;
    } catch {
      // pool does not exist
    }
    if (!depositVisible) {
      test.skip(true, "No AMM pool to deposit into");
      return;
    }

    await depositButton.click();

    // "Both Assets" mode should be default
    const spinbuttons = page.getByRole("spinbutton");
    await spinbuttons.nth(0).fill("5");
    await spinbuttons.nth(1).fill("0.005");

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Deposit successful!")).toBeVisible({ timeout: 45_000 });

    await page.close();
  });

  test("AMM Withdraw modal tabs", async () => {
    const page = await context.newPage();
    await page.goto("/trade");
    await page.getByLabel("Base").selectOption({ label: "TCOIN" });
    await page.getByLabel("Quote").selectOption({ label: "XRP" });
    await expect(page.getByRole("heading", { name: "AMM Pool" })).toBeVisible({ timeout: 15_000 });

    const withdrawButton = page.getByRole("button", { name: "Withdraw" });
    let withdrawVisible = false;
    try {
      await expect(withdrawButton).toBeVisible({ timeout: 5_000 });
      withdrawVisible = true;
    } catch {
      // pool does not exist
    }
    if (!withdrawVisible) {
      test.skip(true, "No AMM pool to withdraw from");
      return;
    }

    await withdrawButton.click();
    await expect(page.getByRole("heading", { name: "Withdraw from AMM Pool", level: 2 })).toBeVisible();

    await expect(page.getByRole("button", { name: "Withdraw All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Both Assets" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Single Asset" })).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();

    await page.close();
  });

  test("AMM Withdraw All — cleanup", async () => {
    test.setTimeout(60_000);

    const page = await context.newPage();
    await page.goto("/trade");
    await page.getByLabel("Base").selectOption({ label: "TCOIN" });
    await page.getByLabel("Quote").selectOption({ label: "XRP" });
    await expect(page.getByRole("heading", { name: "AMM Pool" })).toBeVisible({ timeout: 15_000 });

    const withdrawButton = page.getByRole("button", { name: "Withdraw" });
    let withdrawVisible = false;
    try {
      await expect(withdrawButton).toBeVisible({ timeout: 5_000 });
      withdrawVisible = true;
    } catch {
      // pool does not exist
    }
    if (!withdrawVisible) {
      test.skip(true, "No AMM pool to withdraw from");
      return;
    }

    await withdrawButton.click();
    await page.getByRole("button", { name: "Withdraw All" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Pool has been deleted.")).toBeVisible({ timeout: 45_000 });

    await page.close();
  });
});
