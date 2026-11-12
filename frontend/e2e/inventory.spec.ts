import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, key: string) {
  await page.getByRole("button", { name: "Connect live workspace" }).click();
  await page.getByLabel("Inventory access key").fill(key);
  await page.getByRole("button", { name: "Open live inventory" }).click();
}

async function register(page: Page, receipt: string) {
  await page.getByLabel("Receipt number", { exact: true }).fill(receipt);
  await page.getByLabel("Quantity (kg)").fill("5000");
  await page.getByLabel("Grade", { exact: true }).fill("Grade A");
  await page.getByLabel("Receipt evidence ID").fill("receipt-example");
  await page.getByRole("button", { name: "Register lot" }).click();
  await expect(page.getByRole("status")).toHaveText("Lot registered.");
}

async function review(page: Page, decision = "verified") {
  await page.getByLabel("Decision").selectOption(decision);
  await page.getByLabel("Inspection time").fill(new Date(Date.now() - 7_200_000).toISOString().slice(0, 16));
  await page.getByLabel("Inspection evidence ID").fill("inspection-example");
  await page.getByLabel("Reason").fill("Stock and receipt checked.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("status")).toHaveText("Inspection decision recorded.");
}

async function value(page: Page, daysAgo: number, price: string, approved?: string, unit = "kilogram") {
  await page.getByLabel("Market", { exact: true }).fill("Kano");
  await page.getByLabel("Price source").fill("Pilot survey");
  await page.getByLabel("Price date").fill(new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10));
  await page.getByLabel(`Price per ${unit} (₦)`).fill(price);
  if (approved) await page.getByLabel("Lender-approved lot value (₦, optional)").fill(approved);
  await page.getByRole("button", { name: "Record valuation" }).click();
  await expect(page.getByRole("status")).toHaveText("Valuation recorded.");
}

test("demo renders 24 lots and charts, then supports a complete role-based walkthrough", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(25);
  await expect(page.getByRole("img", { name: /reference price history/ })).toBeVisible();
  await page.getByLabel("Find receipt").fill("no-match");
  await expect(page.getByText("No matching receipts.")).toBeVisible();
  await page.getByLabel("Demo role").selectOption("warehouse");
  await register(page, "WALKTHROUGH-001");
  await expect(page.getByRole("heading", { name: "Receipt WALKTHROUGH-001" })).toBeVisible();

  await page.getByLabel("Demo role").selectOption("verifier");
  await review(page);
  await page.getByRole("button", { name: "Simulate Stellar proof" }).click();
  await expect(page.getByText("Simulated Stellar proof", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /View Stellar/ })).toHaveCount(0);

  await page.getByLabel("Demo role").selectOption("lender");
  await value(page, 2, "430.00");
  await expect(page.getByText("The chart appears after two dates", { exact: false })).toBeVisible();
  await value(page, 1, "450.05", "2000000");
  await expect(page.getByText("₦2,250,250.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("₦2,000,000.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Kano from Pilot survey/ })).toBeVisible();
  await page.getByText("Valuation history", { exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Estimate" })).toBeVisible();

  await page.getByLabel("Demo role").selectOption("verifier");
  await review(page, "revoked");
  await page.getByLabel("Demo role").selectOption("lender");
  await expect(page.getByText(/Historical valuations/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Record valuation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("row")).toHaveCount(25);
});

test("live sign-in replaces demo records, including with an empty live list", async ({ page }) => {
  await page.route("**/api/inventory/**", async (route) => {
    const headers = {
      "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const key = route.request().headers().authorization;
    if (key !== "Bearer good-key") {
      return route.fulfill({ status: 401, headers, json: { message: "Invalid live access key." } });
    }
    return route.fulfill({
      headers,
      json: route.request().url().endsWith("/session") ? { id: "live-lender", role: "lender" } : [],
    });
  });

  await page.goto("/dashboard/inventory");
  await signIn(page, "bad-key");
  await expect(page.getByRole("alert")).toHaveText("Invalid live access key.");
  await expect(page.getByRole("button", { name: "DEMO-WH-001", exact: true })).toBeVisible();
  await page.getByLabel("Inventory access key").fill("good-key");
  await page.getByRole("button", { name: "Open live inventory" }).click();
  await expect(page.getByText("Live workspace · lender")).toBeVisible();
  await expect(page.getByText("No lots registered.")).toBeVisible();
  await expect(page.getByText("Demo workspace", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh inventory" }).click();
  await expect(page.getByRole("status")).toHaveText("Inventory refreshed.");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
});

test("a live packaged-goods lot persists across roles through the real API and MongoDB", async ({ page }) => {
  test.skip(process.env.THRESH_LIVE_E2E !== "1", "Requires the integration MongoDB database.");
  const receipt = `BROWSER-${randomUUID().toUpperCase()}`;
  await page.goto("/");
  await signIn(page, "0".repeat(64));
  await expect(page.getByText("Live workspace · warehouse")).toBeVisible();
  await page.getByLabel("Asset category").selectOption("packaged_goods");
  await page.getByLabel("Receipt number", { exact: true }).fill(receipt);
  await page.getByLabel("Asset name").fill("Boxed detergent");
  await page.getByLabel("Batch ID").fill("DETERGENT-001");
  await page.getByLabel("Quantity (units)").fill("100");
  await page.getByLabel("Condition", { exact: true }).fill("Sealed");
  await page.getByLabel("Receipt evidence ID").fill("receipt-example");
  await page.getByRole("button", { name: "Register lot" }).click();
  await expect(page.getByRole("status")).toHaveText("Lot registered.");
  await page.getByRole("button", { name: "Sign out" }).click();

  await signIn(page, "1".repeat(64));
  await expect(page.getByText("Live workspace · verifier")).toBeVisible();
  await page.getByLabel("Find receipt").fill(receipt);
  await page.getByRole("button", { name: receipt, exact: true }).click();
  await review(page);
  await page.getByRole("button", { name: "Sign out" }).click();

  await signIn(page, "2".repeat(64));
  await expect(page.getByText("Live workspace · lender")).toBeVisible();
  await page.getByLabel("Find receipt").fill(receipt);
  await page.getByRole("button", { name: receipt, exact: true }).click();
  await value(page, 2, "430.00", undefined, "unit");
  await value(page, 1, "450.05", "40000", "unit");
  await expect(page.getByRole("img", { name: /Kano from Pilot survey/ })).toBeVisible();
  await expect(page.getByText("₦45,005.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^DEMO-WH-/ })).toHaveCount(0);
});

test("live API checks credentials, role, lot validation and workspace scope", async ({ request }) => {
  test.skip(process.env.THRESH_LIVE_E2E !== "1", "Requires the integration MongoDB database.");
  const api = "http://127.0.0.1:3102/api/inventory";
  const headers = (digit: string) => ({ Authorization: `Bearer ${digit.repeat(64)}` });
  const receiptNumber = `API-${randomUUID().toUpperCase()}`;
  const data = { receiptNumber, commodity: "maize", quantityKg: 5000, grade: "Grade A", receiptEvidenceId: "test-receipt" };
  expect((await request.get(`${api}/lots`)).status()).toBe(401);
  expect((await request.post(`${api}/lots`, { headers: headers("2"), data })).status()).toBe(403);
  expect((await request.post(`${api}/lots`, { headers: headers("0"), data: { ...data, quantityKg: 0 } })).status()).toBe(400);
  const created = await request.post(`${api}/lots`, { headers: headers("0"), data });
  expect(created.status()).toBe(201);
  const lot = await created.json();
  expect(lot.status).toBe("pending");
  expect(lot.category).toBe("maize");
  expect(lot.quantity).toBe(5000);
  expect(lot.unit).toBe("kg");
  expect((await request.post(`${api}/lots`, { headers: headers("0"), data })).status()).toBe(409);
  const outsider = await request.get(`${api}/lots`, { headers: headers("3") });
  expect(outsider.status()).toBe(200);
  expect(await outsider.json()).toEqual([]);
  const value = { market: "Kano", source: "Survey", observedOn: "2025-01-01", priceKoboPerKg: 45005 };
  expect((await request.post(`${api}/lots/${lot.id}/valuations`, { headers: headers("3"), data: value })).status()).toBe(404);
  expect((await request.post(`${api}/lots/${lot.id}/valuations`, { headers: headers("2"), data: value })).status()).toBe(409);

  const equipment = { receiptNumber: `${receiptNumber}-EQUIP`, category: "equipment", quantity: 1,
    assetName: "Compressor", assetIdentifier: `serial-${randomUUID()}`, grade: "Good", receiptEvidenceId: "test-equip" };
  expect((await request.post(`${api}/lots`, { headers: headers("0"), data: { ...equipment, quantity: 2 } })).status()).toBe(400);
  expect((await request.post(`${api}/lots`, { headers: headers("0"), data: equipment })).status()).toBe(201);
  expect((await request.post(`${api}/lots`, { headers: headers("0"), data: {
    ...equipment, receiptNumber: `${receiptNumber}-SECOND`, assetIdentifier: equipment.assetIdentifier.toUpperCase(),
  } })).status()).toBe(409);
});

test("a live verifier can prepare a Stellar proof and save the confirmed hash", async ({ page }) => {
  const hash = "a".repeat(64);
  const account = "G".padEnd(56, "A");
  const inspectedAt = new Date(Date.now() - 86_400_000).toISOString();
  const inspection = { actorId: "live-verifier", decision: "verified", reason: "Stock checked",
    recordedAt: inspectedAt, inspectedAt, inspectionEvidenceId: "test-inspection" };
  const lot = { id: "live-01", receiptNumber: "LIVE-WH-001", category: "maize", assetName: "Maize", quantity: 5000, unit: "kg",
    grade: "Grade A", receiptEvidenceId: "test-receipt", status: "verified", verificationCurrent: true,
    reviews: [inspection], valuations: [] };
  await page.route("**/api/inventory/**", async (route) => {
    const headers = {
      "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    };
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (req.url().endsWith("/session")) {
      return route.fulfill({ headers, json: { role: "verifier", id: "live-verifier", stellarAccount: account } });
    }
    if (req.url().endsWith("/lots")) return route.fulfill({ headers, json: [lot] });
    if (req.method() === "GET") {
      return route.fulfill({ headers, json: { account, dataName: "versei.inspection.v1", dataValue: "d".repeat(64) } });
    }
    expect(req.postDataJSON()).toEqual({ transactionHash: hash });
    return route.fulfill({ headers, json: { ...lot, reviews: [{ ...inspection, stellarTransactionHash: hash }] } });
  });
  await page.goto("/");
  await signIn(page, "live-key");
  await page.getByRole("button", { name: "Get Stellar transaction details" }).click();
  await expect(page.getByText("d".repeat(64), { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Build in Stellar Lab" })).toBeVisible();
  await page.getByLabel("Submitted transaction hash").fill(hash);
  await page.getByRole("button", { name: "Verify and save proof" }).click();
  await expect(page.getByRole("link", { name: "View Stellar Testnet transaction" }))
    .toHaveAttribute("href", `https://horizon-testnet.stellar.org/transactions/${hash}`);
});
