import { demoLots } from "./demoInventory.ts";
import type { Lot } from "./inventoryClient";

export function publicExploreLots(): Lot[] {
  return demoLots(Date.UTC(2026, 9, 1)).slice(0, 8).map((lot, index) => ({
    id: `example-${index + 1}`,
    receiptNumber: `EX-${String(index + 1).padStart(3, "0")}`,
    assetName: lot.assetName,
    category: lot.category,
    quantity: lot.quantity,
    unit: lot.unit,
    grade: lot.grade,
    custodyType: lot.custodyType,
    receiptEvidenceId: "",
    status: "pending",
    verificationCurrent: false,
    reviews: [],
    valuations: lot.valuations?.map((quote) => ({
      id: quote.id,
      market: quote.market,
      source: "Illustrative price series",
      observedOn: quote.observedOn,
      priceKoboPerUnit: quote.priceKoboPerUnit,
      estimatedValueKobo: quote.estimatedValueKobo,
      recordedAt: quote.recordedAt,
    })),
  }));
}
