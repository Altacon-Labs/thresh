import type { Lot, Role } from "./inventoryClient";

export const workflow = {
  warehouse: {
    label: "Asset registry", signInDescription: "Register assets and follow their verification status.",
    description: "Record an asset, its location, and the evidence an inspector will need.",
    queueLabel: "All assets", empty: "Register your first asset to start an inspection.",
  },
  verifier: {
    label: "Inspection queue", signInDescription: "Review evidence and record inspection decisions.",
    description: "Open an asset awaiting review, check its evidence, and record your decision.",
    queueLabel: "Needs inspection", empty: "No assets need an inspection right now.",
  },
  lender: {
    label: "Collateral review", signInDescription: "Review verified assets and record valuations.",
    description: "Open a verified asset to review its evidence and record a valuation.",
    queueLabel: "Currently verified", empty: "No currently verified assets are ready for review.",
  },
} as const;

export function inRoleQueue(lot: Lot, role: Role) {
  if (role === "verifier") return lot.status === "pending" || (lot.status === "verified" && !lot.verificationCurrent);
  if (role === "lender") return lot.verificationCurrent;
  return true;
}
