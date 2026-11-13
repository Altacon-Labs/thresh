const examples = [
  { symbol: "NLS", name: "Northline Systems", sector: "Technology", cents: [4120, 4195, 4080, 4325, 4450] },
  { symbol: "BGE", name: "Bluegrove Energy", sector: "Energy", cents: [6820, 6740, 6900, 6710, 6600] },
  { symbol: "HFG", name: "Harborfield Goods", sector: "Consumer goods", cents: [2530, 2510, 2580, 2620, 2645] },
  { symbol: "SIL", name: "Stonebridge Industrial", sector: "Industrials", cents: [8700, 8910, 8830, 9100, 9025] },
];

const dates = ["2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01"];

export const tokenizedStocks = examples.map(({ symbol, name, sector, cents }) => ({
  id: `stock-${symbol.toLowerCase()}`,
  symbol,
  name,
  sector,
  history: cents.map((priceCents, index) => ({ date: dates[index], priceCents })),
  priceCents: cents[cents.length - 1],
  change: (cents[cents.length - 1] / cents[cents.length - 2] - 1) * 100,
}));

export type TokenizedStock = (typeof tokenizedStocks)[number];
