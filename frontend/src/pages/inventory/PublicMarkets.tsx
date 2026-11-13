import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { inventoryCategories, type Category, type Lot } from "./inventoryClient";
import { formatNaira } from "./money";
import { formatSampleUsd, sampleNairaPerDollar, type QuoteCurrency } from "./preferences";
import { marketQuotes, trendingQuotes } from "./quotes";

import MarketHighlights from "./MarketHighlights";
import { categoryMarks, quoteChange, quoteTone } from "./quoteDisplay";

import useExploreWatchlist from "./useExploreWatchlist";

function MiniTrend({ prices, tone }: { prices: number[]; tone: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || prices.length < 2) return;
    const low = Math.min(...prices);
    const range = Math.max(...prices) - low;
    context.clearRect(0, 0, 184, 60);
    context.beginPath();
    prices.forEach((price, index) => {
      const x = 4 + index / (prices.length - 1) * 176;
      const y = range ? 53 - (price - low) / range * 46 : 30;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = tone === "up" ? "#16815d" : tone === "down" ? "#bd4058" : "#5670a4";
    context.lineWidth = 3.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  }, [prices, tone]);
  return prices.length > 1 ? <canvas className="public-sparkline" ref={canvas} width={184} height={60} aria-hidden="true" /> : "—";
}

export default function PublicMarkets({ lots, category, query, currency }: {
  currency: QuoteCurrency;
  lots: Lot[];
  category: Category | "all";
  query: string;
}) {
  const [params] = useSearchParams();
  const list = params.get("list");
  const formatQuote = currency === "USD" ? formatSampleUsd : formatNaira;
  const quotes = marketQuotes(lots);
  const { watchlist, toggleWatchlist } = useExploreWatchlist();

  const term = query.trim().toLowerCase();
  const displayedQuotes = list === "trending" ? trendingQuotes(quotes)
    : list === "watchlist" ? quotes.filter(({ lot }) => watchlist.includes(lot.id)) : quotes;
  const rows = displayedQuotes.filter(({ lot, latest }) => (category === "all" || lot.category === category)
    && [lot.assetName, lot.receiptNumber, inventoryCategories[lot.category].label, latest.market]
      .some((value) => value.toLowerCase().includes(term)));
  const categoryUrl = (id: string, search = query) => {
    const next = new URLSearchParams();
    if (list === "trending" || list === "watchlist") next.set("list", list);
    if (id !== "all") next.set("category", id);
    if (search) next.set("q", search);
    return next.size ? `/real-world-assets?${next}` : "/real-world-assets";
  };
  const listTitle = list === "trending" ? "Trending assets" : list === "watchlist" ? "Your watchlist" : null;

  return (
    <div className="public-market-content">
      <header className="public-page-heading">
        <h1>{listTitle ?? "Real-world assets"}</h1>
        {listTitle ? <Link className="public-metric-more" to="/real-world-assets">Back to Explore</Link>
          : <p>Explore reference prices and recent price history for inventory and equipment.</p>}
      </header>
      {!listTitle && <MarketHighlights quotes={quotes} watchlist={watchlist} formatQuote={formatQuote} />}
      <section className="public-quote-section" aria-labelledby="public-quotes-title">
        <nav className="public-category-tabs" id="asset-categories" aria-label="Asset categories">
          <Link to={categoryUrl("all")} aria-current={category === "all" ? "page" : undefined}>All assets</Link>
          {Object.entries(inventoryCategories).map(([id, item]) => (
            <Link key={id} to={categoryUrl(id)} aria-current={category === id ? "page" : undefined}>{item.label}</Link>
          ))}
          <Link to="/real-world-assets?category=tokenized-stocks">Tokenized stocks</Link>
        </nav>
        <div className="public-table-heading">
          <div>
            <h2 id="public-quotes-title">Reference quotes</h2>
            <p>Illustrative prices and trends{query ? ` · Results for “${query}”` : ""}</p>
          </div>
          {query && <Link to={categoryUrl(category, "")}>Clear search</Link>}
        </div>
        {rows.length ? (
          <div className="public-table-scroll" role="region" aria-label="Reference quotes table" tabIndex={0}>
            <table className="public-data-table public-quotes-table">
              <thead><tr>
                <th scope="col" className="quote-rank">#</th><th scope="col">Asset</th>
                <th scope="col" className="quote-numeric">Reference price</th>
                <th scope="col" className="quote-numeric">Change</th>
                <th scope="col" className="quote-numeric quote-optional">Est. value</th>
                <th scope="col" className="quote-optional">Market</th>
                <th scope="col" className="quote-numeric quote-trend">Recent quotes</th>
              </tr></thead>
              <tbody>{rows.map(({ lot, latest, series, change }, index) => (
                <tr key={lot.id}>
                  <td className="quote-rank">{index + 1}</td>
                  <td><div className="public-asset-cell">
                    <button className="quote-watch" type="button" aria-label={`Watch ${lot.assetName}`}
                      aria-pressed={watchlist.includes(lot.id)} onClick={() => toggleWatchlist(lot.id)}>
                      <span aria-hidden="true">{watchlist.includes(lot.id) ? "★" : "☆"}</span>
                    </button>
                    <span aria-hidden="true" className={`asset-mark ${lot.category}`}>{categoryMarks[lot.category]}</span>
                    <div>
                      <Link className="public-asset-link" aria-label={`${lot.assetName}, ${lot.receiptNumber}`}
                        to={`/real-world-assets/${encodeURIComponent(lot.id)}`}>{lot.assetName}</Link>
                      <span className="public-data-secondary">{lot.receiptNumber} · {inventoryCategories[lot.category].label}</span>
                    </div>
                  </div></td>
                  <td className="quote-numeric"><strong>{formatQuote(latest.priceKoboPerUnit)}</strong>
                    <span className="public-data-secondary">per {lot.unit}</span></td>
                  <td className="quote-numeric"><span className={`market-change ${quoteTone(change)}`}>{quoteChange(change)}</span></td>
                  <td className="quote-numeric quote-optional">{formatQuote(latest.estimatedValueKobo)}</td>
                  <td className="quote-optional">{latest.market}</td>
                  <td className="quote-numeric quote-trend">
                    <MiniTrend prices={series.slice(-7).map((quote) => quote.priceKoboPerUnit)} tone={quoteTone(change)} />
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="inventory-empty">{list === "watchlist" && !displayedQuotes.length ? "Your watchlist is empty. Star assets in Explore to save them here." : "No quotes match your filters."}</p>}
      </section>
      <section className="public-about" id="quote-methodology">
        <h2>About reference prices</h2>
        <p>These prices are illustrative. Change compares the latest two observations for the same asset, market, and source.
          USD quotes use an illustrative rate of ₦{sampleNairaPerDollar.toLocaleString("en-US")} per US dollar. Estimated value multiplies the reference price by the example asset quantity.</p>
      </section>
    </div>
  );
}
