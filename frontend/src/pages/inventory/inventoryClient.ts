export type Valuation = {
  id: string;
  market: string;
  source: string;
  observedOn: string;
  priceKoboPerUnit: number;
  estimatedValueKobo: number;
  approvedValueKobo?: number;
  recordedAt: string;
};
export type Decision = "verified" | "rejected" | "revoked";
export type Role = "warehouse" | "verifier" | "lender";
export type Actor = { id: string; role: Role; stellarAccount?: string };
export type StellarProof = { account: string; dataName: string; dataValue: string };
export type Lot = {
  id: string;
  receiptNumber: string;
  category: Category;
  assetName: string;
  assetIdentifier?: string;
  quantity: number;
  unit: "kg" | "unit";
  grade: string;
  receiptEvidenceId: string;
  status: "pending" | Decision;
  verificationCurrent: boolean;
  verificationExpiresAt?: string;
  valuations?: Valuation[];
  reviews: {
    decision: Decision;
    reason: string;
    actorId: string;
    recordedAt: string;
    inspectedAt: string;
    inspectionEvidenceId: string;
    stellarTransactionHash?: string;
    demoProofRecorded?: boolean;
  }[];
};

export type LotInput = Pick<Lot, "receiptNumber" | "category" | "quantity" | "grade" | "receiptEvidenceId">
  & { assetName?: string; assetIdentifier?: string };
export type ReviewInput = Pick<Lot["reviews"][number], "decision" | "reason" | "inspectedAt" | "inspectionEvidenceId">;
export type ValuationInput = Pick<Valuation, "market" | "source" | "observedOn" | "priceKoboPerUnit" | "approvedValueKobo">;

export type InventoryClient = {
  list(): Promise<Lot[]>;
  register(input: LotInput): Promise<Lot>;
  review(id: string, input: ReviewInput): Promise<Lot>;
  value(id: string, input: ValuationInput): Promise<Lot>;
  prepareProof(id: string): Promise<StellarProof>;
  recordProof(id: string, transactionHash: string): Promise<Lot>;
};

export function liveInventory(api: string, key: string): InventoryClient & { session(): Promise<Actor> } {
  async function request<T>(path: string, body?: object): Promise<T> {
    const response = await fetch(`${api.replace(/\/$/, "")}/inventory/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data === null) {
      const message = Array.isArray(data?.message) ? data.message.join(". ") : data?.message;
      throw new Error(message || `Inventory API request failed (${response.status})`);
    }
    return data as T;
  }

  return {
    session: () => request("session"),
    list: () => request("lots"),
    register: (input) => request("lots", input),
    review: (id, input) => request(`lots/${encodeURIComponent(id)}/reviews`, input),
    value: (id, input) => request(`lots/${encodeURIComponent(id)}/valuations`, input),
    prepareProof: (id) => request(`lots/${encodeURIComponent(id)}/stellar-proof`),
    recordProof: (id, transactionHash) => request(`lots/${encodeURIComponent(id)}/stellar-proof`, { transactionHash }),
  };
}
export const inventoryCategories = {
  maize: { label: "Maize", unit: "kg", priceUnit: "kilogram", conditionLabel: "Grade" },
  packaged_goods: { label: "Packaged goods", unit: "unit", priceUnit: "unit", conditionLabel: "Condition", identifierLabel: "Batch ID" },
  spare_parts: { label: "Spare parts", unit: "unit", priceUnit: "unit", conditionLabel: "Condition", identifierLabel: "SKU or part number" },
  equipment: { label: "Equipment", unit: "unit", priceUnit: "unit", conditionLabel: "Condition", identifierLabel: "Serial number" },
} as const;

export type Category = keyof typeof inventoryCategories;

