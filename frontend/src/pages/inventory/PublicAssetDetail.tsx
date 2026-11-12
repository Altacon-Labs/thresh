import { useState } from "react";
import { Link } from "react-router-dom";
import { custodyOptions, inventoryCategories } from "./inventoryClient";
import { formatNaira } from "./money";
import { formatSampleUsd, type QuoteCurrency } from "./preferences";
import { marketQuotes, quotesWithinDays } from "./quotes";
import { categoryMarks, quoteChange, quoteTone } from "./quoteDisplay";
import PriceHistoryChart from "./PriceHistoryChart";

const ranges = [{ label: "1W", days: 7 }, { label: "1M", days: 30 }, { label: "All", days: null }] as const;
type Quote = ReturnType<typeof marketQuotes>[number];

export default function PublicAssetDetail({ quote, onSignIn, currency }: { currency: QuoteCurrency; quote: Quote; onSignIn: () => void }) {
  const formatQuote = currency === "USD" ? formatSampleUsd : formatNaira;
  const { lot, latest, series, change } = quote;
  const [range, setRange] = useState<(typeof ranges)[number]["label"]>("All");
  const [quantity, setQuantity] = useState(String(lot.quantity));
  const visibleSeries = quotesWithinDays(series, ranges.find(({ label }) => label === range)?.days ?? null);
  const values = visibleSeries.map(({ priceKoboPerUnit }) => priceKoboPerUnit);
  const estimate = /^\d+$/.test(quantity) ? Number(quantity) * latest.priceKoboPerUnit : NaN;
  const estimateText = Number.isSafeInteger(estimate) ? formatQuote(estimate) : "—";
  const unitName = lot.unit === "kg" ? "kg" : "units";

  return (
    <div className="public-market-content">
      <nav className="public-breadcrumb" aria-label="Breadcrumb">
        <Link to="/real-world-assets">Real-world assets</Link><span aria-hidden="true">/</span><span>{lot.assetName}</span>
      </nav>
      <div className="public-asset-grid">
        <aside className="public-asset-identity" aria-label="Asset information">
          <header className="public-asset-heading">
            <span className={`asset-mark ${lot.category}`} aria-hidden="true">{categoryMarks[lot.category]}</span>
            <div><h1>{lot.assetName}</h1><p>{lot.receiptNumber}</p></div>
          </header>
          <div className="public-asset-price">
            <strong>{formatQuote(latest.priceKoboPerUnit)}</strong>
            <span> / {lot.unit}</span>
          </div>
          <p className="public-price-caption">
            <span className={`market-change ${quoteTone(change)}`}>{quoteChange(change)}</span>
            <span>{latest.observedOn} · Illustrative quote</span>
          </p>
          <section className="public-asset-facts">
            <h2>Asset info</h2>
            <dl>
              <div><dt>Category</dt><dd>{inventoryCategories[lot.category].label}</dd></div>
              <div><dt>Market</dt><dd>{latest.market}</dd></div>
              <div><dt>Grade or condition</dt><dd>{lot.grade}</dd></div>
              <div><dt>Custody type</dt><dd>{custodyOptions[lot.custodyType].label}</dd></div>
              <div><dt>Example quantity</dt><dd>{lot.quantity.toLocaleString()} {unitName}</dd></div>
            </dl>
          </section>
        </aside>
        <section className="public-chart-panel" id="price-chart" aria-labelledby="public-chart-title">
          <nav className="public-chart-nav" aria-label="Asset detail sections">
            <a href="#price-chart">Chart</a><a href="#price-history">Price history</a><a href="#about-asset">About</a>
          </nav>
          <div className="public-chart-toolbar">
            <h2 id="public-chart-title">Reference price chart</h2>
            <div className="public-chart-ranges" role="group" aria-label="Chart range">
              {ranges.map(({ label }) => (
                <button type="button" key={label} aria-pressed={range === label} onClick={() => setRange(label)}>{label}</button>
              ))}
            </div>
          </div>
          <PriceHistoryChart series={visibleSeries} assetName={lot.assetName} unit={lot.unit} currency={currency} />
        </section>
        <aside className="public-asset-context" aria-label="Asset context">
          <section className="public-tool-card">
            <h2>Price performance</h2>
            <p>{range === "All" ? "All recorded observations" : range === "1W" ? "Last 7 days of observations" : "Last 30 days of observations"}</p>
            <dl><div><dt>Low</dt><dd>{formatQuote(Math.min(...values))}</dd></div>
              <div><dt>High</dt><dd>{formatQuote(Math.max(...values))}</dd></div></dl>
          </section>
          <section className="public-tool-card">
            <h2>Estimate value</h2>
            <label>Quantity ({unitName})<input className="workspace-field" type="text" inputMode="numeric"
              value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <output aria-label="Estimated value">{estimateText}</output>
            <p>Based on the latest reference price.</p>
          </section>
          <button type="button" className="workspace-button public-detail-access" aria-haspopup="dialog" onClick={onSignIn}>
            Sign in to review collateral
          </button>
        </aside>
        <section className="public-price-history" id="price-history">
          <h2>Price history</h2>
          <div className="public-table-scroll" role="region" aria-label="Price observations" tabIndex={0}>
            <table className="public-data-table">
              <thead><tr><th scope="col">Date</th><th scope="col">Market</th><th scope="col" className="quote-numeric">Price / {lot.unit}</th></tr></thead>
              <tbody>{[...series].reverse().map((entry) => (
                <tr key={entry.id}><td>{entry.observedOn}</td><td>{entry.market}</td>
                  <td className="quote-numeric">{formatQuote(entry.priceKoboPerUnit)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        <section className="public-about public-asset-about" id="about-asset">
          <h2>About this asset</h2>
          <p>This example shows how Thresh presents a reference price for {lot.assetName.toLowerCase()}. The chart uses illustrative
            observations from {latest.market} and the same source. Workspace members can sign in to review actual collateral records and inspection evidence.</p>
        </section>
      </div>
    </div>
  );
}
