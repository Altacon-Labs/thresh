import type { Category } from "./inventoryClient";

export const categoryMarks: Record<Category, string> = {
  maize: "M", packaged_goods: "PG", spare_parts: "SP", equipment: "EQ",
};

export function quoteChange(change: number | null) {
  return change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
}

export function quoteTone(change: number | null) {
  return change === null || change === 0 ? "" : change > 0 ? "up" : "down";
}

