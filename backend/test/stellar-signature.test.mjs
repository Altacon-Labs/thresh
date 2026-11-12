import assert from "node:assert/strict";
import { test } from "node:test";
import { stellarPublicKey, verifyStellarSignature } from "../src/modules/inventory/stellar-signature.ts";

// Published SEP-53 verification vectors.
const address = "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";
const english = "fO5dbYhXUhBMhe6kId/cuVq/AfEnHRHEvsP8vXh03M1uLpi5e46yO2Q8rEBzu3feXQewcQE5GArp88u6ePK6BA==";
const japanese = "CDU265Xs8y3OWbB/56H9jPgUss5G9A0qFuTqH2zs2YDgTm+++dIfmAEceFqB7bhfN3am59lCtDXrCtwH2k1GBA==";

test("verifies the published SEP-53 message signatures", () => {
  assert.equal(stellarPublicKey(address).length, 32);
  assert.equal(verifyStellarSignature(address, "Hello, World!", english), true);
  assert.equal(verifyStellarSignature(address, "こんにちは、世界！", japanese), true);
});

test("rejects a modified message, address checksum, or noncanonical signature", () => {
  assert.equal(verifyStellarSignature(address, "Hello, world!", english), false);
  assert.equal(stellarPublicKey(address.slice(0, -1) + "A"), null);
  assert.equal(verifyStellarSignature(address, "Hello, World!", english.slice(0, -3) + "B=="), false);
  assert.equal(verifyStellarSignature(address, "Hello, World!", "invalid"), false);
});
