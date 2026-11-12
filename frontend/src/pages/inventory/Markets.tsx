import { useState } from "react";
import { Link } from "react-router-dom";
import { custodyOptions, inventoryCategories, type Category, type Lot } from "./inventoryClient";
import { formatNaira } from "./money";
import { marketQuotes } from "./quotes";
import ValuationPanel from "./ValuationPanel";

export default function Markets({ lots, assetId, onOpenInventory }: {
  lots: Lot[];
  assetId: string | null;
  onOpenInventory: (lotId?: string) => void;
}) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [filter, setFilter] = useState("");
  const quotes = marketQuotes(lots);
  const detail = quotes.find(({ lot }) => lot.id === assetId);
  const marketUrl = "?view=markets";

  if (detail) {
    const { lot, latest } = detail;
    return (
      <section className="workspace-card market-detail" aria-labelledby="market-asset-title">
        <Link className="market-back" to={marketUrl}>← Back to markets</Link>
        <header className="market-detail-header">
          <div>
            <p className="market-kicker">{inventoryCategories[lot.category].label} · {lot.receiptNumber}</p>
            <h2 id="market-asset-title">{lot.assetName}</h2>
            <p>{latest.market} · {lot.grade} · {lot.quantity.toLocaleString()} {lot.unit === "kg" ? "kg" : lot.quantity === 1 ? "unit" : "units"}</p>
          </div>
          <button type="button" className="workspace-button" onClick={() => onOpenInventory(lot.id)}>
            Open asset record
          </button>
        </header>
        <div className="workspace-inset">
          <ValuationPanel valuations={lot.valuations ?? []} assetName={lot.assetName} grade={lot.grade}
            unit={lot.unit} verificationCurrent={lot.verificationCurrent} />
        </div>
        <p className="market-data-note">{custodyOptions[lot.custodyType ?? "warehouse"].label}
          {lot.custodyLocation ? ` · ${lot.custodyLocation}` : ""}. Open the asset record for supporting evidence and inspection history.</p>
      </section>
    );
  }

  const term = filter.trim().toLowerCase();
  const results = quotes.filter(({ lot, latest }) => (category === "all" || lot.category === category)
    && [lot.assetName, lot.receiptNumber, latest.market, latest.source].some((value) => value.toLowerCase().includes(term)));

  return (
    <div className="market-grid">
      <section className="workspace-card market-list" aria-labelledby="market-quotes-title">
        <div className="market-list-heading">
          <div><h2 id="market-quotes-title">Reference quotes</h2>
            <p>Quotes recorded in your workspace</p></div>
          <label className="market-search">Find asset<input className="workspace-field" placeholder="Asset, reference, or market"
            value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
        </div>
        <div className="market-filters" aria-label="Asset categories">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>All assets</button>
          {Object.entries(inventoryCategories).map(([key, value]) => (
            <button key={key} type="button" aria-pressed={category === key}
              onClick={() => setCategory(key as Category)}>{value.label}</button>
          ))}
        </div>
        <div className="market-table-scroll">
          {results.length ? (
            <table className="inventory-table market-table">
              <thead><tr>{["Asset", "Reference price", "Change", "Recent quotes"].map((label) => (
                <th key={label} scope="col">{label}</th>
              ))}</tr></thead>
              <tbody>
                {results.map(({ lot, latest, series, change }) => {
                  const recent = series.slice(-5).map((quote) => quote.priceKoboPerUnit);
                  const low = Math.min(...recent);
                  const range = Math.max(...recent) - low;
                  const trendTone = change === null || change === 0 ? "" : change > 0 ? "up" : "down";
                  return (
                    <tr key={lot.id}>
                      <td>
                        <Link className="market-asset-link" aria-label={`${lot.assetName}, ${lot.receiptNumber}`}
                          to={`${marketUrl}&asset=${encodeURIComponent(lot.id)}`}>{lot.assetName}</Link>
                        <span className="market-row-secondary">{lot.receiptNumber} · {latest.market}</span>
                      </td>
                      <td><span className="market-price">{formatNaira(latest.priceKoboPerUnit)} / {lot.unit}</span>
                        <span className="market-row-secondary">{latest.observedOn}</span></td>
                      <td><span className={`market-change ${trendTone}`}>
                        {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`}
                      </span></td>
                      <td>{recent.length > 1 ? <span className={`market-trend ${trendTone}`} aria-hidden="true">
                        {recent.map((price, index) => <span key={index}
                          style={{ height: `${range ? 25 + (price - low) / range * 75 : 55}%` }} />)}
                      </span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="inventory-empty">{quotes.length ? "No quotes match your filters." : "No reference quotes have been recorded."}</p>}
        </div>
        <p className="market-data-note">Change compares the two latest dates for the same asset, market, and source. Quotes are entered manually.</p>
      </section>
    </div>
  );
}
