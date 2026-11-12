const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHash, createPrivateKey, sign } = require("node:crypto");
const { InventoryActors, hashCredential } = require("../dist/modules/inventory/inventory-actors.js");
const { InventoryWalletService } = require("../dist/modules/inventory/inventory-wallet.service.js");

// Published SEP-53 test key. Never used as a workspace credential.
const address = "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";
const seed = "SAKICEVQLYWGSOJS4WW7HZJWAHZVEEBS527LHK5V4MLJALYKICQCJXMW";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bits = [...seed].map((letter) => alphabet.indexOf(letter).toString(2).padStart(5, "0")).join("");
const raw = Buffer.from(bits.match(/.{8}/g).map((byte) => Number.parseInt(byte, 2))).subarray(1, 33);
const privateKey = createPrivateKey({
  key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), raw]),
  format: "der",
  type: "pkcs8",
});
const origin = "http://localhost:5173";
const actor = { id: "verifier", workspaceId: "pilot", role: "verifier", walletAddress: address };

function signature(message) {
  const digest = createHash("sha256").update("Stellar Signed Message:\n").update(message).digest();
  return sign(null, digest, privateKey).toString("base64");
}

function inMemoryModel() {
  const records = new Map();
  const matches = (record, filter) => Boolean(record)
    && (!filter.nonce || filter.nonce === record.nonce)
    && (!filter.expiresAt?.$gt || record.expiresAt > filter.expiresAt.$gt);
  return {
    records,
    findOne: (filter) => ({ lean: () => ({ exec: async () => {
      const record = records.get(filter._id);
      return matches(record, filter) ? record : null;
    } }) }),
    findOneAndUpdate: (filter, update) => ({ lean: () => ({ exec: async () => {
      const existing = records.get(filter._id);
      if (existing && existing.expiresAt > filter.expiresAt.$lte) throw Object.assign(new Error("Duplicate"), { code: 11000 });
      const record = { _id: filter._id, ...update.$set };
      records.set(filter._id, record);
      return record;
    } }) }),
    deleteOne: (filter) => ({ exec: async () => ({
      deletedCount: Number(matches(records.get(filter._id), filter) && records.delete(filter._id)),
    }) }),
    create: async (record) => records.set(record._id, record),
  };
}

test("wallet sign-in binds site and role, consumes the challenge once, and revokes sign-out", async () => {
  const config = { get: (name) => name === "THRESH_APP_ORIGIN" ? origin : JSON.stringify([actor]) };
  const challenges = inMemoryModel();
  const sessions = inMemoryModel();
  const actors = new InventoryActors(config);
  const service = new InventoryWalletService(config, actors, challenges, sessions);
  const dto = { address, role: "verifier" };
  await assert.rejects(service.challenge("https://wrong.example", dto), { name: "ForbiddenException" });
  await assert.rejects(service.challenge(origin, { ...dto, role: "lender" }), { name: "ForbiddenException" });

  const prepared = await service.challenge(origin, dto);
  assert.match(prepared.message, /Site: http:\/\/localhost:5173/);
  assert.match(prepared.message, /Role: Verifier/);
  assert.equal((await service.challenge(origin, dto)).nonce, prepared.nonce);
  await assert.rejects(service.authenticate(origin, { ...dto, nonce: prepared.nonce, signature: signature("wrong") }),
    { name: "UnauthorizedException" });
  const signed = { ...dto, nonce: prepared.nonce, signature: signature(prepared.message) };
  const results = await Promise.allSettled([service.authenticate(origin, signed), service.authenticate(origin, signed)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.name, "UnauthorizedException");
  const { token } = results.find((result) => result.status === "fulfilled").value;
  const saved = sessions.records.get(hashCredential(token));
  assert.equal(saved.address, address);
  assert.equal(sessions.records.has(token), false);
  assert.deepEqual(await service.sessionActor(token), { ...actor, stellarAccount: address });
  await service.signOut(origin, `Bearer ${token}`);
  assert.equal(await service.sessionActor(token), undefined);
});

test("expired challenges fail and replaced wallet identities do not inherit sessions", async () => {
  const config = { get: (name) => name === "THRESH_APP_ORIGIN" ? origin : JSON.stringify([actor]) };
  const challenges = inMemoryModel();
  const sessions = inMemoryModel();
  const actors = new InventoryActors(config);
  const service = new InventoryWalletService(config, actors, challenges, sessions);
  const dto = { address, role: "verifier" };
  const expired = await service.challenge(origin, dto);
  challenges.records.get(address).expiresAt = new Date(0);
  await assert.rejects(service.authenticate(origin, { ...dto, nonce: expired.nonce, signature: signature(expired.message) }),
    { name: "UnauthorizedException" });
  const prepared = await service.challenge(origin, dto);
  const { token } = await service.authenticate(origin, { ...dto, nonce: prepared.nonce, signature: signature(prepared.message) });
  const updatedConfig = { get: (name) => name === "THRESH_APP_ORIGIN" ? origin : JSON.stringify([{ ...actor, role: "lender" }]) };
  const updated = new InventoryWalletService(updatedConfig, new InventoryActors(updatedConfig), challenges, sessions);
  assert.equal(await updated.sessionActor(token), undefined);
  sessions.records.get(hashCredential(token)).expiresAt = new Date(0);
  assert.equal(await service.sessionActor(token), undefined);
});
