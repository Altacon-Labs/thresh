import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoInventory, demoLots } from "../src/pages/inventory/demoInventory.ts";
import { liveInventory } from "../src/pages/inventory/inventoryClient.ts";
import { formatNaira, parseNaira } from "../src/pages/inventory/money.ts";

const now = Date.parse("2026-01-31T12:00:00Z");
const newLot = { receiptNumber: " new-lot ", category: "maize", quantity: 5000, grade: "Grade A", receiptEvidenceId: "receipt-new" };
const review = { decision: "verified", reason: "Stock matched receipt.", inspectedAt: "2026-01-30T12:00:00Z", inspectionEvidenceId: "inspection-new" };
const valuation = { market: "Kano", source: "Sample survey", observedOn: "2026-01-30", priceKoboPerUnit: 45005, approvedValueKobo: 200000000 };

test("demo seed includes 24 unique lots, realistic statuses and chart histories", () => {
  const lots = demoLots(now);
  assert.equal(lots.length, 24);
  assert.equal(new Set(lots.map((lot) => lot.receiptNumber)).size, 24);
  assert.deepEqual(new Set(lots.map((lot) => lot.category)), new Set(["maize", "packaged_goods", "spare_parts", "equipment"]));
  assert.deepEqual(new Set(lots.map((lot) => lot.status)), new Set(["pending", "verified", "rejected", "revoked"]));
  assert(lots.some((lot) => lot.status === "verified" && !lot.verificationCurrent));
  assert.equal(lots[0].valuations.length, 4);
  assert(lots[0].valuations.every((price) => price.estimatedValueKobo === price.priceKoboPerUnit * lots[0].quantity));
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

test("warehouse, verifier and lender can complete an isolated demo lifecycle", async () => {
  const demo = createDemoInventory(() => now);
  const warehouse = demo.client("warehouse");
  const verifier = demo.client("verifier");
  const lender = demo.client("lender");
  await assert.rejects(lender.register(newLot), /warehouse/);
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
