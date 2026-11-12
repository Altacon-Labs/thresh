import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { demoLots } from "../../frontend/src/pages/inventory/demoInventory.ts";

const actors = JSON.parse(process.env.INVENTORY_ACTORS_JSON || "[]");
const operator = actors.find(({ role, workspaceId }) => role === "warehouse" && workspaceId === "pilot");
const verifier = actors.find(({ role, workspaceId }) => role === "verifier" && workspaceId === "pilot");
if (!operator || !verifier || !process.env.MONGODB_URI) {
  throw new Error("Set MONGODB_URI and generate pilot access keys first.");
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  if (mongoose.connection.db.databaseName !== "thresh_demo") {
    throw new Error("Sample records may only be written to the thresh_demo database.");
  }

  const now = new Date();
  const records = demoLots(now.getTime()).map(({
    id, unit, verificationCurrent, reviews, valuations, verificationExpiresAt, ...lot
  }) => {
    const asset = lot.category === "maize"
      ? { commodity: "maize", quantityKg: lot.quantity }
      : { category: lot.category, quantity: lot.quantity, assetName: lot.assetName, assetIdentifier: lot.assetIdentifier };
    return {
      workspaceId: "pilot", warehouseActorId: operator.id, ...asset,
      receiptNumber: lot.receiptNumber, grade: lot.grade, receiptEvidenceId: lot.receiptEvidenceId,
      custodyType: lot.custodyType, custodyLocation: lot.custodyLocation, status: lot.status,
      ...(verificationExpiresAt ? { verificationExpiresAt: new Date(verificationExpiresAt) } : {}),
      reviews: reviews.map(({ demoProofRecorded, recordedAt, inspectedAt, ...review }) => ({
        ...review, actorId: verifier.id, recordedAt: new Date(recordedAt), inspectedAt: new Date(inspectedAt),
        ...(review.decision === "verified" ? { stellarNonce: randomBytes(32).toString("hex") } : {}),
      })),
      valuations: valuations.map((price) => ({ ...price, actorId: "sample-survey", recordedAt: new Date(price.recordedAt) })),
      createdAt: now, updatedAt: now,
    };
  });
  const result = await mongoose.connection.db.collection("inventorylots").bulkWrite(records.map((record) => ({
    updateOne: {
      filter: { workspaceId: record.workspaceId, receiptNumber: record.receiptNumber },
      update: { $setOnInsert: record },
      upsert: true,
    },
  })));
  console.log(`Inserted ${result.upsertedCount} sample records into thresh_demo.`);
} finally {
  await mongoose.disconnect();
}
