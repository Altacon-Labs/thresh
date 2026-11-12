export const categories = ['maize', 'packaged_goods', 'spare_parts', 'equipment'] as const;
export type InventoryCategory = typeof categories[number];
export const custodyTypes = ['warehouse', 'owner_site', 'third_party'] as const;
export type CustodyType = typeof custodyTypes[number];

export function inventoryUnit(category: InventoryCategory): 'kg' | 'unit' {
  return category === 'maize' ? 'kg' : 'unit';
}
