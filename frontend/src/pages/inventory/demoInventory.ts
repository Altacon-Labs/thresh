import { inventoryCategories, type Actor, type Category, type InventoryClient, type Lot, type Role } from "./inventoryClient.ts";

const day = 86_400_000;
const markets = ["Kano", "Kaduna", "Ibadan", "Jos", "Minna", "Makurdi"];
const sampleAssets = {
  maize: { name: "Maize", basePrice: 40_000, priceStep: 650, identifier: "" },
  packaged_goods: { name: "Packaged detergent", basePrice: 125_000, priceStep: 1_000, identifier: "BATCH" },
  spare_parts: { name: "Water pump impellers", basePrice: 850_000, priceStep: 4_500, identifier: "PART" },
  equipment: { name: "Commercial air compressor", basePrice: 85_000_000, priceStep: 250_000, identifier: "SERIAL" },
} as const;
const sampleCategories: Category[] = ["maize", "packaged_goods", "spare_parts", "equipment"];

export function demoActor(role: Role): Actor {
  return { id: `demo-${role}`, role };
}

export function demoLots(now = Date.now()): Lot[] {
  return Array.from({ length: 24 }, (_, index) => {
    const serial = String(index + 1).padStart(3, "0");
    const id = `demo-${serial}`;
    const category = sampleCategories[index % sampleCategories.length];
    const asset = sampleAssets[category];
    const unit = inventoryCategories[category].unit;
    const quantity = category === "equipment" ? 1 : category === "maize" ? 1_000 + index * 250 : 50 + index * 8;
    const market = markets[index % markets.length];
    const status = index < 14 ? "verified" : index < 20 ? "pending" : index < 22 ? "rejected" : "revoked";
    const expired = index >= 11;
    const inspected = now - (expired ? 35 : 2 + index % 9) * day;
    const inspectedAt = new Date(inspected).toISOString();
    const verificationExpiresAt = new Date(inspected + 30 * day).toISOString();
    const valuationHistory = Array.from({ length: 4 }, (_, point) => {
      const recordedAt = new Date(inspected + (point + 1) * 3_600_000).toISOString();
      const observedOn = new Date(inspected - (3 - point) * 3 * day).toISOString().slice(0, 10);
      const priceKoboPerUnit = asset.basePrice + asset.priceStep * (index + [1, 3, 2, 4][point]);
      const estimatedValueKobo = priceKoboPerUnit * quantity;
      return {
        id: `${id}-price-${point}`, market, source: "Sample market survey",
        observedOn, recordedAt, priceKoboPerUnit, estimatedValueKobo,
        ...(point === 3 ? { approvedValueKobo: Math.floor(estimatedValueKobo * 0.85) } : {}),
      };
    });
    return {
      id, receiptNumber: `DEMO-WH-${serial}`, category, assetName: asset.name, quantity, unit,
      ...(asset.identifier ? { assetIdentifier: `${asset.identifier}-${serial}` } : {}),
      grade: category === "maize" ? (index % 3 === 2 ? "Grade B" : "Grade A") : (index % 3 === 2 ? "Good" : "New"),
      receiptEvidenceId: `demo-receipt-${serial}`,
      status, verificationExpiresAt: status === "verified" || status === "revoked" ? verificationExpiresAt : undefined,
      verificationCurrent: status === "verified" && !expired,
      valuations: status === "verified" ? valuationHistory : [],
      reviews: status === "pending" ? [] : [{
        decision: status === "revoked" ? "verified" : status,
        actorId: "demo-verifier", recordedAt: inspectedAt, inspectedAt,
        reason: status === "rejected" ? "Sample grade discrepancy." : "Sample stock and receipt checked.",
        inspectionEvidenceId: `demo-inspection-${serial}`,
        demoProofRecorded: index % 4 === 0 && status === "verified",
      }, ...(status === "revoked" ? [{
        decision: "revoked" as const, actorId: "demo-verifier",
        recordedAt: new Date(inspected + day).toISOString(), inspectedAt,
        reason: "Sample custody discrepancy.", inspectionEvidenceId: `demo-revocation-${serial}`,
      }] : [])],
    };
  });
}

export function createDemoInventory(clock = Date.now) {
  let lots = demoLots(clock());
  let nextId = 25;

  function find(id: string) {
    const lot = lots.find((item) => item.id === id);
    if (!lot) throw new Error("Demo lot not found.");
    lot.verificationCurrent = lot.status === "verified" && Date.parse(lot.verificationExpiresAt ?? "") > clock();
    return lot;
  }

  function roleRequired(actual: Role, required: Role) {
    if (actual !== required) throw new Error(`Switch to the ${required} demo role to continue.`);
  }

  function reset() {
    lots = demoLots(clock());
    nextId = 25;
  }

  function client(role: Role): InventoryClient {
    return {
      async list() {
        return lots.map(({ id }) => structuredClone(find(id)));
      },
      async register(input) {
        roleRequired(role, "warehouse");
        const receiptNumber = input.receiptNumber.trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9./_-]{0,79}$/.test(receiptNumber)
          || !Object.prototype.hasOwnProperty.call(inventoryCategories, input.category)
          || !Number.isSafeInteger(input.quantity) || input.quantity < 1 || !input.grade.trim()
          || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(input.receiptEvidenceId)) {
          throw new Error("Enter a valid receipt, grade or condition, positive quantity, and evidence ID.");
        }
        if (input.category !== "maize" && (!input.assetName?.trim() || !input.assetIdentifier?.trim())) {
          throw new Error("An asset name and identifier are required.");
        }
        if (input.category === "equipment" && input.quantity !== 1) throw new Error("Register one equipment item per serial number.");
        if (lots.some((lot) => lot.receiptNumber === receiptNumber)) throw new Error("This receipt is already registered.");
        const identifier = input.assetIdentifier?.trim();
        const assetIdentifier = input.category === "equipment" ? identifier?.toUpperCase() : identifier;
        if (input.category === "equipment" && lots.some((lot) => lot.category === "equipment" && lot.assetIdentifier === assetIdentifier)) {
          throw new Error("This equipment serial number is already registered.");
        }
        const lot: Lot = { ...input, assetName: input.category === "maize" ? "Maize" : input.assetName!.trim(),
          assetIdentifier: input.category === "maize" ? undefined : assetIdentifier,
          unit: inventoryCategories[input.category].unit, grade: input.grade.trim(), receiptNumber, id: `demo-${nextId++}`,
          status: "pending", verificationCurrent: false, reviews: [], valuations: [] };
        lots.unshift(lot);
        return structuredClone(lot);
      },
      async review(id, input) {
        roleRequired(role, "verifier");
        const lot = find(id);
        const validTransition = input.decision === "revoked" ? lot.status === "verified"
          : lot.status === "pending" || (input.decision === "verified" && lot.status === "verified" && !lot.verificationCurrent);
        if (!validTransition) throw new Error("This lot is no longer available for that review.");
        const inspected = Date.parse(input.inspectedAt);
        const now = clock();
        if (!Number.isFinite(inspected) || inspected > now || !input.reason.trim()
          || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(input.inspectionEvidenceId)) {
          throw new Error("Enter a past inspection time, evidence ID, and reason.");
        }
        if (input.decision === "verified") {
          if (inspected + 30 * day <= now) throw new Error("Verification requires an inspection from the last 30 days.");
          lot.verificationExpiresAt = new Date(inspected + 30 * day).toISOString();
        }
        lot.status = input.decision;
        lot.reviews.push({ ...input, actorId: "demo-verifier", recordedAt: new Date(now).toISOString() });
        return structuredClone(find(id));
      },
      async value(id, input) {
        roleRequired(role, "lender");
        const lot = find(id);
        if (!lot.verificationCurrent) throw new Error("A current inventory verification is required.");
        const now = clock();
        const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Lagos" }).format(now);
        const observed = Date.parse(input.observedOn);
        const estimatedValueKobo = input.priceKoboPerUnit * lot.quantity;
        if (!input.market.trim() || !input.source.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.observedOn)
          || !Number.isFinite(observed) || new Date(observed).toISOString().slice(0, 10) !== input.observedOn
          || input.observedOn > today
          || !Number.isSafeInteger(input.priceKoboPerUnit) || input.priceKoboPerUnit < 1
          || !Number.isSafeInteger(estimatedValueKobo)
          || (input.approvedValueKobo !== undefined
            && (!Number.isSafeInteger(input.approvedValueKobo) || input.approvedValueKobo < 1))) {
          throw new Error("Enter a valid dated reference price and valuation.");
        }
        const existing = lot.valuations ??= [];
        const entry = { ...input, market: input.market.trim(), source: input.source.trim() };
        if (!existing.some((value) => value.market === entry.market && value.source === entry.source
          && value.observedOn === entry.observedOn && value.priceKoboPerUnit === entry.priceKoboPerUnit
          && value.approvedValueKobo === entry.approvedValueKobo)) {
          existing.push({ ...entry, id: `${id}-valuation-${existing.length}`, estimatedValueKobo,
            recordedAt: new Date(now).toISOString() });
        }
        return structuredClone(lot);
      },
      async prepareProof() {
        throw new Error("Demo mode does not submit Stellar transactions.");
      },
      async recordProof(id) {
        roleRequired(role, "verifier");
        const lot = find(id);
        const review = lot.reviews[lot.reviews.length - 1];
        if (!lot.verificationCurrent || !review || review.actorId !== "demo-verifier") {
          throw new Error("A current demo verification is required.");
        }
        review.demoProofRecorded = true;
        return structuredClone(lot);
      },
    };
  }

  return { client, reset, initialLots: () => lots.map((lot) => structuredClone(lot)) };
}
