import type { Lot, Valuation } from "./inventoryClient";

export function orderQuotes(valuations: Valuation[]) {
  return [...valuations].sort((a, b) =>
    a.observedOn.localeCompare(b.observedOn) || a.recordedAt.localeCompare(b.recordedAt));
}

export function comparableQuotes(ordered: Valuation[], latest: Valuation) {
  const byDate = new Map<string, Valuation>();
  for (const quote of ordered) {
    if (quote.market.toLowerCase() === latest.market.toLowerCase()
      && quote.source.toLowerCase() === latest.source.toLowerCase()) {
      byDate.set(quote.observedOn, quote);
    }
  }
  return [...byDate.values()];
}

export function quotesWithinDays(series: Valuation[], days: number | null) {
  const latest = series[series.length - 1];
  if (!latest || days === null) return series;
  const cutoff = Date.parse(latest.observedOn) - days * 86_400_000;
  return series.filter(({ observedOn }) => Date.parse(observedOn) >= cutoff);
}

export function marketQuotes(lots: Lot[]) {
  return lots.flatMap((lot) => {
    const ordered = orderQuotes(lot.valuations ?? []);
    const latest = ordered[ordered.length - 1];
    if (!latest) return [];
    const series = comparableQuotes(ordered, latest);
    const previous = series[series.length - 2];
    const change = previous ? (latest.priceKoboPerUnit / previous.priceKoboPerUnit - 1) * 100 : null;
    return [{ lot, latest, series, change }];
  }).sort((a, b) => b.latest.observedOn.localeCompare(a.latest.observedOn)
    || b.latest.recordedAt.localeCompare(a.latest.recordedAt));
}

export type MarketQuote = ReturnType<typeof marketQuotes>[number];

export function marketActivity(quotes: MarketQuote[]) {
  const counts = new Map<string, number>();
  let estimatedValueKobo = 0;
  for (const { latest, series } of quotes) {
    estimatedValueKobo += latest.estimatedValueKobo;
    for (const { observedOn } of series) {
      counts.set(observedOn, (counts.get(observedOn) ?? 0) + 1);
    }
  }
  const observations = [...counts].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
    .map(([date, count]) => ({ date, count }));
  return { estimatedValueKobo, observations };
}

export function trendingQuotes(quotes: MarketQuote[]) {
  return quotes.filter(({ change }) => change !== null)
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));
}
