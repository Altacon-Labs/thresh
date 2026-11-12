import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { demoLots } from "../src/pages/inventory/demoInventory";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

async function signIn(page: Page, role: "Asset operator" | "Verifier" | "Lender", key: string) {
  const dialog = page.getByRole("dialog", { name: "Access your workspace" });
  if (!(await dialog.isVisible())) {
    await page.getByRole("navigation", { name: "Public navigation" }).getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await dialog.getByRole("radio", { name: new RegExp(role) }).check();
  await dialog.getByLabel("Access key", { exact: true }).fill(key);
  await dialog.getByRole("button", { name: "Sign in to workspace", exact: true }).click();
}

async function review(page: Page) {
  await page.getByLabel("Decision").selectOption("verified");
  await page.getByLabel("Inspection time").fill(new Date(Date.now() - 7_200_000).toISOString().slice(0, 16));
  await page.getByLabel("Inspection evidence ID").fill("inspection-example");
  await page.getByLabel("Reason").fill("Stock and evidence checked.");
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

test("signed-out visitors browse quotes and can dismiss the role dialog without leaving Explore", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/inventory/**", (route) => {
    requests++;
    return route.abort();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/inventory");
  await expect(page.getByRole("heading", { name: "Real-world assets" })).toBeVisible();
  await expect(page.getByText("Illustrative prices and trends")).toBeVisible();
  const categories = page.getByRole("navigation", { name: "Asset categories" });
  await categories.getByRole("link", { name: "Equipment", exact: true }).click();
  await expect(categories.getByRole("link", { name: "Equipment", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Commercial air compressor, EX-004" }).click();
  await expect(page.getByRole("img", { name: /Commercial air compressor reference price history/ })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Asset context" }).getByRole("heading", { name: "Price performance" })).toBeVisible();
  await expect(page).toHaveURL(/example-4$/);
  const range = page.getByRole("button", { name: "1W", exact: true });
  await range.click();
  await expect(range).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Quantity (units)").fill("0");
  await expect(page.getByLabel("Estimated value")).toHaveText("$0.00");
  await expect(page.getByText("Lender-approved value")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in to review collateral" }).click();
  const dialog = page.getByRole("dialog", { name: "Access your workspace" });
  await expect(dialog.getByRole("radio", { name: /Lender/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Request access" }).click();
  await expect(dialog.getByText(/Ask your workspace administrator/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Commercial air compressor" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(requests).toBe(0);
});

test("quote currency and stablecoin preferences survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings · USD" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings.getByLabel("Preferred Stellar stablecoin")).toHaveValue("USDC");
  await settings.getByLabel("Explore quote currency").selectOption("NGN");
  await settings.getByLabel("Preferred Stellar stablecoin").selectOption("EURC");
  await settings.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Reference prices in NGN")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Settings · NGN" }).click();
  await expect(settings.getByLabel("Preferred Stellar stablecoin")).toHaveValue("EURC");
});

test("Explore shows four metric cards and persists a watched asset", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const highlights = page.getByRole("region", { name: "Market highlights" });
  await expect(highlights.getByRole("heading")).toHaveText(["Trending", "Watchlist", "Market status", "Advertisement"]);
  await expect(highlights.getByRole("img", { name: /Illustrative quote observations by date/ })).toBeVisible();
  const first = await highlights.locator(".public-metric-card").first().boundingBox();
  expect(first!.width).toBeCloseTo(first!.height, 0);
  const watch = page.getByRole("button", { name: "Watch Commercial air compressor" });
  await watch.click();
  await expect(highlights.getByRole("list", { name: "Saved assets" })).toContainText("Commercial air compressor");
  await page.reload();
  await expect(watch).toHaveAttribute("aria-pressed", "true");
  await watch.click();
  await expect(highlights.getByText("Select the star next to an asset to save it here.")).toBeVisible();
});

test("Sign up sits after search and opens the access request flow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const search = await page.getByRole("search").boundingBox();
  const signUp = page.getByRole("button", { name: "Sign up", exact: true });
  const button = await signUp.boundingBox();
  expect(button!.x).toBeGreaterThanOrEqual(search!.x + search!.width);
  await signUp.click();
  await expect(page.getByRole("dialog").getByText(/Ask your workspace administrator/)).toBeVisible();
});

test("Trending and Watchlist show four items and link to the full lists", async ({ page }) => {
  await page.goto("/");
  const highlights = page.getByRole("region", { name: "Market highlights" });
  await expect(highlights.getByRole("list", { name: "Trending assets" }).getByRole("listitem")).toHaveCount(4);
  await highlights.getByRole("link", { name: "More trending assets" }).click();
  await expect(page.getByRole("heading", { name: "Trending assets" })).toBeVisible();
  await expect(page.getByRole("row").nth(5)).toBeVisible();
  await page.getByRole("link", { name: "Back to Explore" }).click();

  const watchButtons = page.getByRole("button", { name: /^Watch / });
  for (let index = 0; index < 5; index++) await watchButtons.nth(index).click();
  await expect(highlights.getByRole("list", { name: "Saved assets" }).getByRole("listitem")).toHaveCount(4);
  await highlights.getByRole("link", { name: "More watched assets" }).click();
  await expect(page.getByRole("heading", { name: "Your watchlist" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(6);
});

test("desktop Explore has public navigation, searchable quotes, and a footer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Asset categories" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Explore footer links" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search assets" }).fill("compressor");
  await page.getByRole("button", { name: "Submit asset search" }).click();
  await expect(page).toHaveURL(/q=compressor$/);
  const table = page.getByRole("region", { name: "Reference quotes table" });
  await expect(table.getByRole("link", { name: "Commercial air compressor, EX-004" })).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

test("desktop asset details place the chart between identity and context", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/real-world-assets/example-4");
  const [left, chart, right] = await Promise.all([
    page.getByRole("complementary", { name: "Asset information" }).boundingBox(),
    page.getByRole("region", { name: "Reference price chart" }).boundingBox(),
    page.getByRole("complementary", { name: "Asset context" }).boundingBox(),
  ]);
  expect(left!.x + left!.width).toBeLessThan(chart!.x);
  expect(chart!.x + chart!.width).toBeLessThan(right!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

test("sign-in rejects a mismatched role without loading records and signs out to Explore", async ({ page }) => {
  let listCalls = 0;
  await page.route("**/api/inventory/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (route.request().url().endsWith("/session")) {
      if (route.request().headers().authorization !== "Bearer lender-key") {
        return route.fulfill({ status: 401, headers: cors, json: { message: "Invalid access key." } });
      }
      return route.fulfill({ headers: cors, json: { id: "lender", role: "lender" } });
    }
    listCalls++;
    return route.fulfill({ headers: cors, json: [] });
  });
  await page.goto("/?view=markets");
  await expect(page.getByRole("heading", { name: "Real-world assets" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace" })).toHaveCount(0);
  await expect(page.getByText("Demo workspace")).toHaveCount(0);
  await signIn(page, "Verifier", "wrong-key");
  await expect(page.getByRole("alert")).toHaveText("Invalid access key.");
  await signIn(page, "Verifier", "lender-key");
  await expect(page.getByRole("alert")).toContainText("belongs to the Lender role");
  expect(listCalls).toBe(0);
  await signIn(page, "Lender", "lender-key");
  await expect(page.getByRole("heading", { name: "Collateral review" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Asset context" }).getByRole("heading", { name: "Workspace snapshot" })).toBeVisible();
  await expect(page.getByText("No currently verified assets are ready for review.")).toBeVisible();
  expect(listCalls).toBe(1);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Real-world assets" })).toBeVisible();
});

test("verifier and lender see different asset queues and controls", async ({ page }) => {
  const samples = demoLots();
  await page.route("**/api/inventory/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const role = req.headers().authorization === "Bearer verifier-key" ? "verifier" : "lender";
    return route.fulfill({ headers: cors, json: req.url().endsWith("/session") ? { id: role, role } : samples });
  });
  await page.goto("/");
  await signIn(page, "Verifier", "verifier-key");
  await expect(page.getByRole("heading", { name: "Inspection queue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Needs inspection" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "DEMO-WH-015", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEMO-WH-001", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Markets" })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "Lender", "lender-key");
  await expect(page.getByRole("heading", { name: "Collateral review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Currently verified" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("complementary", { name: "Asset context" }).getByRole("heading", { name: "Asset snapshot" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEMO-WH-001", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEMO-WH-015", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "All assets" }).click();
  await expect(page.getByRole("button", { name: "DEMO-WH-015", exact: true })).toBeVisible();
});

test("lender can browse Markets and open the exact asset when scrollTo returns a promise", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const scrollTo = window.scrollTo.bind(window);
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: (x: number, y: number) => {
        scrollTo(x, y);
        return Promise.resolve();
      },
    });
  });
  const samples = demoLots();
  await page.route("**/api/inventory/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ headers: cors, json: route.request().url().endsWith("/session")
      ? { id: "lender", role: "lender" } : samples });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await signIn(page, "Lender", "lender-key");
  await page.getByRole("link", { name: "Markets", exact: true }).click();
  await page.getByRole("button", { name: "Equipment", exact: true }).click();
  await page.getByLabel("Find asset", { exact: true }).fill("DEMO-WH-004");
  await page.getByRole("link", { name: "Commercial air compressor, DEMO-WH-004" }).click();
  await expect(page.getByRole("img", { name: /Commercial air compressor reference price history/ })).toBeVisible();
  await page.getByRole("button", { name: "Open asset record" }).click();
  await expect(page.getByRole("heading", { name: "Asset DEMO-WH-004" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("a live packaged-goods lot persists across roles through the real API and MongoDB", async ({ page }) => {
  test.skip(process.env.THRESH_LIVE_E2E !== "1", "Requires the integration MongoDB database.");
  const receipt = `BROWSER-${randomUUID().toUpperCase()}`;
  await page.goto("/dashboard/inventory");
  await signIn(page, "Asset operator", "0".repeat(64));
  await expect(page.getByRole("heading", { name: "Asset registry" })).toBeVisible();
  if (!(await page.getByLabel("Asset category").isVisible())) await page.getByRole("button", { name: "Register an asset", exact: true }).click();
  await page.getByLabel("Asset category").selectOption("packaged_goods");
  await page.getByLabel("Where is the asset held?").selectOption("third_party");
  await page.getByLabel("Site or facility").fill("Partner depot, Kano");
  await page.getByLabel("Custody reference", { exact: true }).fill(receipt);
  await page.getByLabel("Asset name").fill("Boxed detergent");
  await page.getByLabel("Batch ID").fill("DETERGENT-001");
  await page.getByLabel("Quantity (units)").fill("100");
  await page.getByLabel("Condition", { exact: true }).fill("Sealed");
  await page.getByLabel("Custody evidence ID").fill("custody-example");
  await page.getByRole("button", { name: "Register asset" }).click();
  await expect(page.getByRole("status")).toHaveText("Lot registered.");
  await page.getByRole("button", { name: "Sign out" }).click();

  await signIn(page, "Verifier", "1".repeat(64));
  await expect(page.getByRole("heading", { name: "Inspection queue" })).toBeVisible();
  await page.getByLabel("Find asset record").fill(receipt);
  await page.getByRole("button", { name: receipt, exact: true }).click();
  await expect(page.getByText("Third-party custodian · Partner depot, Kano")).toBeVisible();
  await review(page);
  await page.getByRole("button", { name: "Sign out" }).click();

  await signIn(page, "Lender", "2".repeat(64));
  await expect(page.getByRole("heading", { name: "Collateral review" })).toBeVisible();
  await page.getByLabel("Find asset record").fill(receipt);
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

test("a real API wallet session accepts a Stellar signature once and revokes it on sign-out", async ({ request }) => {
  test.skip(process.env.THRESH_LIVE_E2E !== "1", "Requires the integration MongoDB database.");
  const address = "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";
  // Published SEP-53 test key, configured only in the browser test database.
  const seed = "SAKICEVQLYWGSOJS4WW7HZJWAHZVEEBS527LHK5V4MLJALYKICQCJXMW";
  const bits = [...seed].map((letter) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(letter).toString(2).padStart(5, "0")).join("");
  const keyBytes = Buffer.from(bits.match(/.{8}/g)!.map((byte) => Number.parseInt(byte, 2))).subarray(1, 33);
  const signer = createPrivateKey({
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), keyBytes]), format: "der", type: "pkcs8",
  });
  const api = "http://127.0.0.1:3102/api/inventory";
  const headers = { Origin: "http://127.0.0.1:4173" };
  const data = { address, role: "verifier" };
  expect((await request.post(`${api}/wallet/challenge`, { headers, data: { ...data, role: "lender" } })).status()).toBe(403);
  const challenge = await request.post(`${api}/wallet/challenge`, { headers, data });
  expect(challenge.status()).toBe(200);
  const { nonce, message } = await challenge.json();
  const digest = createHash("sha256").update("Stellar Signed Message:\n").update(message).digest();
  const response = { ...data, nonce, signature: sign(null, digest, signer).toString("base64") };
  const verified = await request.post(`${api}/wallet/verify`, { headers, data: response });
  expect(verified.status()).toBe(200);
  const { token } = await verified.json();
  const authorized = { ...headers, Authorization: `Bearer ${token}` };
  const session = await request.get(`${api}/session`, { headers: authorized });
  expect(await session.json()).toMatchObject({ role: "verifier", walletAddress: address, stellarAccount: address });
  expect((await request.post(`${api}/wallet/verify`, { headers, data: response })).status()).toBe(401);
  expect((await request.post(`${api}/wallet/logout`, { headers: authorized, data: {} })).status()).toBe(204);
  expect((await request.get(`${api}/session`, { headers: authorized })).status()).toBe(401);
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
  await page.goto("/dashboard/inventory");
  await signIn(page, "Verifier", "live-key");
  await page.getByRole("button", { name: "All assets", exact: true }).click();
  await page.getByRole("button", { name: "LIVE-WH-001", exact: true }).click();
  await page.getByRole("button", { name: "Get Stellar transaction details" }).click();
  await expect(page.getByText("d".repeat(64), { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Build in Stellar Lab" })).toBeVisible();
  await page.getByLabel("Submitted transaction hash").fill(hash);
  await page.getByRole("button", { name: "Verify and save proof" }).click();
  await expect(page.getByRole("link", { name: "View Stellar Testnet transaction" }))
    .toHaveAttribute("href", `https://horizon-testnet.stellar.org/transactions/${hash}`);
});
