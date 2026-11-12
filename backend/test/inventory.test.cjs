const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHash } = require("node:crypto");
const axios = require("axios");
const { validate } = require("class-validator");
const { InventoryGuard } = require("../dist/modules/inventory/inventory.guard.js");
const { InventoryService } = require("../dist/modules/inventory/inventory.service.js");
const { RegisterLotDto, ReviewLotDto, RecordValuationDto, RecordStellarProofDto } = require("../dist/modules/inventory/inventory.dto.js");

const scope = { workspaceId: "pilot" };
const account = "G".padEnd(56, "A");
const verifier = { ...scope, id: "inspector", role: "verifier", stellarAccount: account };
const lender = { ...scope, id: "lender", role: "lender" };
const id = "1".repeat(24);
const hash = "a".repeat(64);

function inventoryFixture() {
  const now = Date.now();
  const lot = {
    id, _id: id, ...scope, receiptNumber: "WH-0001", commodity: "maize", quantityKg: 5000,
    grade: "Grade A", receiptEvidenceId: "receipt-0001", status: "verified",
    verificationExpiresAt: new Date(now + 86_400_000), valuations: [],
    reviews: [{
      decision: "verified", actorId: verifier.id, reason: "Verified stock",
      inspectedAt: new Date(now - 86_400_000), recordedAt: new Date(now - 60_000),
      inspectionEvidenceId: "inspection-0001", stellarNonce: "f".repeat(64),
    }],
  };
  let writes = 0;
  const model = {
    findOne: (filter) => ({ exec: async () => filter.workspaceId === lot.workspaceId ? lot : null }),
    findOneAndUpdate: (filter, update) => ({ exec: async () => {
      if (filter.workspaceId !== lot.workspaceId || filter.status !== lot.status
        || lot.verificationExpiresAt <= filter.verificationExpiresAt.$gt) return null;
      if (update.$push?.valuations) {
        if (lot.valuations.some((valuation) => valuation.id === filter["valuations.id"].$ne)) return null;
        lot.valuations.push(update.$push.valuations);
      } else {
        const target = lot.reviews.find((review) => review.stellarNonce === filter.reviews.$elemMatch.stellarNonce);
        if (!target || target.stellarTransactionHash) return null;
        target.stellarTransactionHash = update.$set["reviews.$.stellarTransactionHash"];
      }
      writes++;
      return lot;
    } }),
  };
  return { lot, service: new InventoryService(model), writes: () => writes };
}

test("inventory guard accepts only a configured bearer key and never exposes its hash", () => {
  const key = "d".repeat(64);
  const tokenHash = createHash("sha256").update(key).digest("hex");
  const guard = new InventoryGuard({ get: () => JSON.stringify([{ ...verifier, tokenHash }]) });
  const request = { headers: { authorization: `Bearer ${key}` } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  assert.equal(guard.canActivate(context), true);
  assert.deepEqual(request.inventoryActor, verifier);
  request.headers.authorization = "Bearer invalid";
  assert.throws(() => guard.canActivate(context), { name: "UnauthorizedException" });
  assert.throws(() => new InventoryGuard({ get: () => JSON.stringify([{ ...verifier, tokenHash }, { ...verifier, tokenHash }]) }), /duplicate/);
});

test("request DTOs reject invalid dates, token hashes, quantities and optional values", async () => {
  const check = async (DTO, fields) => (await validate(Object.assign(new DTO(), fields))).map((entry) => entry.property);
  const lot = { receiptNumber: "WH-01", commodity: "maize", quantityKg: 1, grade: "Grade A", receiptEvidenceId: "ref" };
  const review = { decision: "verified", reason: "Checked", inspectionEvidenceId: "check", inspectedAt: "2026-01-10T12:00:00Z" };
  const value = { market: "Kano", source: "Survey", observedOn: "2026-01-10", priceKoboPerKg: 45005 };
  assert.deepEqual(await check(RegisterLotDto, lot), []);
  assert((await check(RegisterLotDto, { ...lot, quantityKg: 0 })).includes("quantityKg"));
  const modern = { receiptNumber: "PARTS-01", category: "spare_parts", quantity: 12,
    grade: "New", receiptEvidenceId: "parts-receipt", assetName: "Water pump", assetIdentifier: "SKU-PUMP" };
  assert.deepEqual(await check(RegisterLotDto, modern), []);
  assert((await check(RegisterLotDto, { ...modern, assetIdentifier: " " })).includes("assetIdentifier"));
  assert((await check(RegisterLotDto, { ...modern, category: "unrecognized" })).includes("category"));
  assert.deepEqual(await check(ReviewLotDto, review), []);
  assert((await check(ReviewLotDto, { ...review, inspectedAt: "2026-01-10" })).includes("inspectedAt"));
  assert.deepEqual(await check(RecordValuationDto, value), []);
  const { priceKoboPerKg, ...reference } = value;
  assert.deepEqual(await check(RecordValuationDto, { ...reference, priceKoboPerUnit: priceKoboPerKg }), []);
  assert((await check(RecordValuationDto, { ...value, observedOn: "2026-02-30" })).includes("observedOn"));
  assert((await check(RecordValuationDto, { ...value, approvedValueKobo: null })).includes("approvedValueKobo"));
  assert.deepEqual(await check(RecordStellarProofDto, { transactionHash: hash }), []);
  assert((await check(RecordStellarProofDto, { transactionHash: "bad" })).includes("transactionHash"));
});

test("non-commodity valuation uses item counts and rejects a kilogram quote", async () => {
  const { service, lot } = inventoryFixture();
  Object.assign(lot, { category: "spare_parts", assetName: "Impellers", assetIdentifier: "SKU-25", quantity: 12 });
  delete lot.quantityKg;
  delete lot.commodity;
  const reference = { market: "Kano", source: "Parts dealer", observedOn: "2025-01-01" };
  await assert.rejects(service.recordValuation(lender, id, { ...reference, priceKoboPerKg: 850000 }), { name: "BadRequestException" });
  const result = await service.recordValuation(lender, id, { ...reference, priceKoboPerUnit: 850000 });
  assert.equal(result.assetIdentifier, "SKU-25");
  assert.equal(result.unit, "unit");
  assert.equal(result.valuations[0].estimatedValueKobo, 10200000);
  assert.equal(result.valuations[0].priceKoboPerUnit, 850000);
  assert.equal(result.valuations[0].priceKoboPerKg, undefined);
});

test("valuation checks role, workspace and expiry and deduplicates simultaneous requests", async () => {
  const { service, lot, writes } = inventoryFixture();
  const input = { market: " Kano ", source: "Survey", observedOn: "2025-01-01", priceKoboPerKg: 45005, approvedValueKobo: 200000000 };
  await assert.rejects(service.recordValuation(verifier, id, input), { name: "ForbiddenException" });
  await assert.rejects(service.recordValuation({ ...lender, workspaceId: "outside" }, id, input), { name: "NotFoundException" });
  await assert.rejects(service.recordValuation(lender, id, { ...input, observedOn: "9999-01-01" }), { name: "BadRequestException" });
  const [first, retry] = await Promise.all([service.recordValuation(lender, id, input), service.recordValuation(lender, id, input)]);
  assert.equal(first.valuations[0].estimatedValueKobo, 225025000);
  assert.equal(first.valuations[0].approvedValueKobo, 200000000);
  assert.equal(first.valuations[0].market, "Kano");
  assert.equal(retry.valuations.length, 1);
  assert.equal(writes(), 1);
  lot.verificationExpiresAt = new Date(Date.now() - 1);
  await assert.rejects(service.recordValuation(lender, id, { ...input, priceKoboPerKg: 45006 }), { name: "ConflictException" });
});

test("proof accepts one matching successful operation and saves it once", async (t) => {
  const { service, writes } = inventoryFixture();
  await assert.rejects(service.prepareStellarProof(lender, id), { name: "ForbiddenException" });
  await assert.rejects(service.prepareStellarProof({ ...verifier, id: "different-verifier" }, id), { name: "ForbiddenException" });
  const proof = await service.prepareStellarProof(verifier, id);
  assert.match(proof.dataValue, /^[a-f0-9]{64}$/);
  const expected = Buffer.from(proof.dataValue, "utf8").toString("base64");
  const tx = { successful: true, source_account: account, operation_count: 1 };
  const op = { type: "manage_data", source_account: account, name: proof.dataName, value: "wrong" };
  t.mock.method(axios, "get", async (url) => ({
    data: url.includes("/operations?") ? { _embedded: { records: [op] } } : tx,
  }));
  await assert.rejects(service.recordStellarProof(verifier, id, hash), { name: "BadRequestException" });
  op.value = expected;
  tx.source_account = "different";
  await assert.rejects(service.recordStellarProof(verifier, id, hash), { name: "BadRequestException" });
  tx.source_account = account;
  const record = await service.recordStellarProof(verifier, id, hash);
  assert.equal(record.reviews[0].stellarTransactionHash, hash);
  assert.equal(record.reviews[0].stellarNonce, undefined);
  await service.recordStellarProof(verifier, id, hash);
  assert.equal(writes(), 1);
});
