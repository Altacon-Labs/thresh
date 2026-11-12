import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoInventory, demoLots } from "../src/pages/inventory/demoInventory.ts";
import { connectInventory, liveInventory } from "../src/pages/inventory/inventoryClient.ts";
import { inRoleQueue } from "../src/pages/inventory/workflow.ts";
import { formatNaira, parseNaira } from "../src/pages/inventory/money.ts";
import { marketActivity, marketQuotes, quotesWithinDays } from "../src/pages/inventory/quotes.ts";
import { publicExploreLots } from "../src/pages/inventory/publicExplore.ts";
import { connectWalletInventory, revokeWalletSession } from "../src/pages/inventory/walletLogin.ts";

import { formatSampleUsd, parsePreferences, sampleQuoteAmount } from "../src/pages/inventory/preferences.ts";

test("quote preferences default to USD and USDC and validate saved selections", () => {
  assert.deepEqual(parsePreferences(null), { currency: "USD", stablecoin: "USDC" });
  assert.deepEqual(parsePreferences("{"), { currency: "USD", stablecoin: "USDC" });
  assert.deepEqual(parsePreferences('{"currency":"NGN","stablecoin":"EURC"}'), { currency: "NGN", stablecoin: "EURC" });
  assert.deepEqual(parsePreferences('{"currency":"EUR","stablecoin":"XLM"}'), { currency: "USD", stablecoin: "USDC" });
  assert.equal(sampleQuoteAmount(225000, "NGN"), 2250);
  assert.equal(sampleQuoteAmount(225000, "USD"), 1.5);
  assert.equal(formatSampleUsd(225000), "$1.50");
});

const now = Date.parse("2026-01-31T12:00:00Z");
const newLot = { receiptNumber: " new-lot ", category: "maize", quantity: 5000, grade: "Grade A", receiptEvidenceId: "receipt-new" };
const review = { decision: "verified", reason: "Stock matched receipt.", inspectedAt: "2026-01-30T12:00:00Z", inspectionEvidenceId: "inspection-new" };
const valuation = { market: "Kano", source: "Sample survey", observedOn: "2026-01-30", priceKoboPerUnit: 45005, approvedValueKobo: 200000000 };

test("chart ranges use the newest recorded observation", () => {
  const series = ["2025-12-20", "2026-01-01", "2026-01-23", "2026-01-30"]
    .map((observedOn) => ({ ...valuation, observedOn }));
  assert.deepEqual(quotesWithinDays(series, 7), series.slice(2));
  assert.deepEqual(quotesWithinDays(series, 30), series.slice(1));
  assert.deepEqual(quotesWithinDays(series, null), series);
  assert.deepEqual(quotesWithinDays([], 7), []);
});

test("market activity sums the latest inventory values and groups observations by date", () => {
  const quotes = marketQuotes(publicExploreLots());
  const result = marketActivity(quotes);
  assert.equal(result.estimatedValueKobo, quotes.reduce((total, { latest }) => total + latest.estimatedValueKobo, 0));
  assert.ok(result.observations.length > 0 && result.observations.length <= 12);
  for (const { date, count } of result.observations) {
    assert.equal(count, quotes.filter(({ series }) => series.some(({ observedOn }) => observedOn === date)).length);
  }
  assert.deepEqual(marketActivity([]), { estimatedValueKobo: 0, observations: [] });
});

test("public Explore contains illustrative quotes without evidence or approved values", () => {
  const lots = publicExploreLots();
  assert.equal(lots.length, 8);
  assert.equal(new Set(lots.map((lot) => lot.category)).size, 4);
  assert.equal(marketQuotes(lots).length, 8);
  for (const lot of lots) {
    assert.match(lot.id, /^example-/);
    assert.equal(lot.receiptEvidenceId, "");
    assert.equal(lot.custodyLocation, undefined);
    assert.equal(lot.assetIdentifier, undefined);
    assert.deepEqual(lot.reviews, []);
    assert(lot.valuations.every((quote) => quote.approvedValueKobo === undefined && quote.source === "Illustrative price series"));
  }
});

test("each role starts with the records relevant to its workflow", () => {
  const lots = demoLots(now);
  assert.equal(lots.filter((lot) => inRoleQueue(lot, "warehouse")).length, 24);
  assert.equal(lots.filter((lot) => inRoleQueue(lot, "lender")).length, 11);
  assert.equal(lots.filter((lot) => inRoleQueue(lot, "verifier")).length, 9);
  assert.equal(inRoleQueue(lots.find((lot) => lot.status === "revoked"), "verifier"), false);
});

test("sign-in checks the API role before fetching any records", async (t) => {
  const calls = t.mock.method(globalThis, "fetch", async (url) => url.endsWith("/session")
    ? Response.json({ id: "lender", role: "lender" }) : Response.json([]));
  await assert.rejects(connectInventory("http://localhost/api", "key", "verifier"), /belongs to the Lender role/);
  assert.equal(calls.mock.callCount(), 1);
  assert.deepEqual(await connectInventory("http://localhost/api", "key", "lender"), {
    actor: { id: "lender", role: "lender" }, lots: [],
  });
  assert.equal(calls.mock.callCount(), 3);
});

test("wallet sign-in signs the server challenge and loads the linked role with a short-lived session", async (t) => {
  const address = "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";
  const token = `wallet_${"a".repeat(64)}`;
  const expiresAt = "2026-01-31T20:00:00Z";
  const requests = t.mock.method(globalThis, "fetch", async (url, request) => {
    if (url.endsWith("/challenge")) {
      assert.deepEqual(JSON.parse(request.body), { address, role: "verifier" });
      return Response.json({ nonce: "nonce", message: "Sign in to Thresh" });
    }
    if (url.endsWith("/verify")) {
      assert.deepEqual(JSON.parse(request.body), { address, role: "verifier", nonce: "nonce", signature: "signed" });
      return Response.json({ token, expiresAt });
    }
    assert.equal(request.headers.Authorization, `Bearer ${token}`);
    if (url.endsWith("/logout")) return new Response(null, { status: 204 });
    if (url.endsWith("/session")) return Response.json({ id: "verifier", role: "verifier", walletAddress: address, stellarAccount: address });
    return Response.json([]);
  });
  const result = await connectWalletInventory("http://localhost/api", "verifier", {
    connect: async () => address,
    sign: async (message, expectedAddress) => {
      assert.equal(message, "Sign in to Thresh");
      assert.equal(expectedAddress, address);
      return { signature: "signed", signerAddress: address };
    },
  });
  assert.equal(result.actor.stellarAccount, result.walletSession.address);
  assert.deepEqual(result.walletSession, { address, expiresAt });
  await revokeWalletSession("http://localhost/api", token);
  assert.equal(requests.mock.callCount(), 5);
});

test("wallet switching during a signature prompt stops before session creation", async (t) => {
  const calls = t.mock.method(globalThis, "fetch", async () => Response.json({ nonce: "nonce", message: "message" }));
  await assert.rejects(connectWalletInventory("http://localhost/api", "lender", {
    connect: async () => "first-account",
    sign: async () => ({ signature: "signed", signerAddress: "another-account" }),
  }), /wallet account changed/);
  assert.equal(calls.mock.callCount(), 1);
});

test("demo seed includes 24 unique lots, realistic statuses and chart histories", () => {
  const lots = demoLots(now);
  assert.equal(lots.length, 24);
  assert.equal(new Set(lots.map((lot) => lot.receiptNumber)).size, 24);
  assert.deepEqual(new Set(lots.map((lot) => lot.category)), new Set(["maize", "packaged_goods", "spare_parts", "equipment"]));
  assert.deepEqual(new Set(lots.map((lot) => lot.custodyType)), new Set(["warehouse", "owner_site", "third_party"]));
  assert.deepEqual(new Set(lots.map((lot) => lot.status)), new Set(["pending", "verified", "rejected", "revoked"]));
  assert(lots.some((lot) => lot.status === "verified" && !lot.verificationCurrent));
  assert.equal(lots[0].valuations.length, 4);
  assert(lots[0].valuations.every((price) => price.estimatedValueKobo === price.priceKoboPerUnit * lots[0].quantity));
});

test("market changes use distinct dates from the same lot, market and source", () => {
  const lot = demoLots(now)[0];
  const quote = (id, observedOn, priceKoboPerUnit, overrides = {}) => ({
    id, observedOn, priceKoboPerUnit, market: "Kano", source: "Survey",
    recordedAt: `${observedOn}T10:00:00Z`, ...overrides,
  });
  lot.valuations = [
    quote("latest", "2026-01-20", 50000),
    quote("other-market", "2026-01-19", 4000, { market: "Jos" }),
    quote("other-source", "2026-01-18", 3000, { source: "Different source" }),
    quote("old", "2026-01-10", 30000),
    quote("revised", "2026-01-10", 40000, { recordedAt: "2026-01-10T11:00:00Z" }),
  ];
  const [result] = marketQuotes([lot, { ...lot, id: "empty", valuations: [] }]);
  assert.equal(result.latest.id, "latest");
  assert.deepEqual(result.series.map((row) => row.id), ["revised", "latest"]);
  assert.equal(result.change, 25);
  assert.equal(marketQuotes([{ ...lot, valuations: [lot.valuations[0]] }])[0].change, null);
});

test("non-commodity inventory uses counts and category identifiers", async () => {
  const demo = createDemoInventory(() => now);
  const warehouse = demo.client("warehouse");
  const verifier = demo.client("verifier");
  const lender = demo.client("lender");
  for (const category of ["packaged_goods", "spare_parts", "equipment"]) {
    const quantity = category === "equipment" ? 1 : 12;
    const input = { ...newLot, receiptNumber: category.toUpperCase(), category,
      quantity, grade: "Good", assetName: "Example asset", assetIdentifier: "Ref-25" };
    await assert.rejects(warehouse.register({ ...input, assetIdentifier: " " }), /identifier/);
    const lot = await warehouse.register(input);
    assert.equal(lot.unit, "unit");
    assert.equal(lot.quantity, quantity);
    await verifier.review(lot.id, review);
    assert.equal((await lender.value(lot.id, valuation)).valuations[0].estimatedValueKobo, quantity * valuation.priceKoboPerUnit);
    if (category === "equipment") {
      await assert.rejects(warehouse.register({ ...input, receiptNumber: "DIFFERENT", quantity: 2 }), /one equipment item/);
      await assert.rejects(warehouse.register({ ...input, receiptNumber: "DIFFERENT", assetIdentifier: "REF-25" }), /serial number is already/);
    }
  }
});

test("an operator can register and verify an asset at its owner’s site", async () => {
  const demo = createDemoInventory(() => now);
  const operator = demo.client("warehouse");
  const verifier = demo.client("verifier");
  const lender = demo.client("lender");
  const input = { ...newLot, category: "equipment", quantity: 1, assetName: "Workshop generator",
    assetIdentifier: "GEN-008", grade: "Good", receiptEvidenceId: "invoice-008",
    custodyType: "owner_site", custodyLocation: "  Owner workshop, Kaduna  " };
  await assert.rejects(operator.register({ ...input, custodyLocation: " " }), /site or facility/);
  await assert.rejects(operator.register({ ...input, custodyType: undefined }), /custody type/);
  const lot = await operator.register(input);
  assert.equal(lot.custodyType, "owner_site");
  assert.equal(lot.custodyLocation, "Owner workshop, Kaduna");
  assert.equal(lot.receiptEvidenceId, "invoice-008");
  await verifier.review(lot.id, review);
  const valued = await lender.value(lot.id, valuation);
  assert.equal(valued.custodyLocation, "Owner workshop, Kaduna");
  assert.equal(valued.valuations[0].estimatedValueKobo, valuation.priceKoboPerUnit);
});

test("asset operator, verifier and lender can complete an isolated demo lifecycle", async () => {
  const demo = createDemoInventory(() => now);
  const warehouse = demo.client("warehouse");
  const verifier = demo.client("verifier");
  const lender = demo.client("lender");
  await assert.rejects(lender.register(newLot), /asset operator/);
  const lot = await warehouse.register(newLot);
  assert.equal(lot.receiptNumber, "NEW-LOT");
  await assert.rejects(warehouse.register(newLot), /already registered/);
  await assert.rejects(lender.value(lot.id, valuation), /verification/);
  await assert.rejects(warehouse.review(lot.id, review), /verifier/);
  await assert.rejects(verifier.review(lot.id, { ...review, inspectedAt: "2025-12-01T00:00:00Z" }), /last 30 days/);
  assert.equal((await verifier.review(lot.id, review)).verificationCurrent, true);
  await assert.rejects(verifier.prepareProof(lot.id), /does not submit/);
  const anchored = await verifier.recordProof(lot.id, "");
  assert.equal(anchored.reviews[0].demoProofRecorded, true);
  assert.equal(anchored.reviews[0].stellarTransactionHash, undefined);
  await assert.rejects(lender.value(lot.id, { ...valuation, observedOn: "2026-02-02" }), /valid dated/);
  const valued = await lender.value(lot.id, valuation);
  assert.equal(valued.valuations[0].estimatedValueKobo, 225025000);
  assert.equal(valued.valuations[0].approvedValueKobo, 200000000);
  assert.equal((await lender.value(lot.id, valuation)).valuations.length, 1);
  assert.equal((await verifier.review(lot.id, { ...review, decision: "revoked" })).verificationCurrent, false);
  await assert.rejects(lender.value(lot.id, valuation), /verification/);
  demo.reset();
  assert.equal((await lender.list()).length, 24);
});

test("expiry is recalculated and an expired inspection can be renewed", async () => {
  let timestamp = now;
  const demo = createDemoInventory(() => timestamp);
  const verifier = demo.client("verifier");
  const first = (await verifier.list())[0];
  timestamp = Date.parse(first.verificationExpiresAt);
  assert.equal((await verifier.list())[0].verificationCurrent, false);
  assert.equal((await verifier.review(first.id, { ...review, inspectedAt: new Date(timestamp - 60_000).toISOString() })).verificationCurrent, true);
});

test("NGN values preserve kobo and reject invalid amounts", () => {
  assert.equal(parseNaira("450.05"), 45005);
  assert.equal(parseNaira("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(formatNaira(225025000), "₦2,250,250.00");
  for (const value of ["0", "1.999", "-2", "1e3", "90071992547409.92"]) {
    assert.throws(() => parseNaira(value));
  }
});

test("live calls use only API results and preserve an empty inventory", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/session")) return Response.json({ id: "lender", role: "lender" });
    if (url.endsWith("/lots")) return Response.json([]);
    return Response.json({ message: ["Field is required", "Check the date"] }, { status: 400 });
  });
  const client = liveInventory("http://localhost:3000/api/", "key");
  assert.equal((await client.session()).role, "lender");
  assert.deepEqual(await client.list(), []);
  await assert.rejects(client.value("lot/1", valuation), /Field is required. Check the date/);
  const [url, request] = fetchMock.mock.calls[2].arguments;
  assert.equal(url, "http://localhost:3000/api/inventory/lots/lot%2F1/valuations");
  assert.equal(request.headers.Authorization, "Bearer key");
  assert.equal(request.method, "POST");
  assert.deepEqual(JSON.parse(request.body), valuation);
});

test("live failures remain errors instead of returning sample records", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Service offline", { status: 503 }));
  await assert.rejects(liveInventory("http://localhost/api", "key").list(), /503/);
});
