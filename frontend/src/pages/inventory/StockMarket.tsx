import { Link } from "react-router-dom";
import PriceHistoryChart from "./PriceHistoryChart";
import { quoteChange, quoteTone } from "./quoteDisplay";
import { tokenizedStocks, type TokenizedStock } from "./tokenizedStocks";
import useExploreWatchlist from "./useExploreWatchlist";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const price = (cents: number) => usd.format(cents / 100);
const listingPath = "/real-world-assets?category=tokenized-stocks";

export default function StockMarket({ stock, query, savedOnly = false }: {
  stock?: TokenizedStock;
  query: string;
  savedOnly?: boolean;
}) {
  const { watchlist, toggleWatchlist } = useExploreWatchlist();
  const term = query.trim().toLowerCase();
  const rows = tokenizedStocks.filter((item) => (!savedOnly || watchlist.includes(item.id))
    && [item.name, item.symbol, item.sector].some((value) => value.toLowerCase().includes(term)));

  function watchButton(item: TokenizedStock) {
    const saved = watchlist.includes(item.id);
    return <button className="quote-watch" type="button" aria-label={`Watch ${item.name}`}
      aria-pressed={saved} onClick={() => toggleWatchlist(item.id)}><span aria-hidden="true">{saved ? "★" : "☆"}</span></button>;
  }

  return (
    <div className="public-market-content">
      <nav className="public-breadcrumb" aria-label="Stock navigation">
        <Link to="/real-world-assets">Explore</Link>
        {stock || savedOnly
          ? <Link to={listingPath}>Tokenized stocks</Link>
          : <Link to={listingPath + "&list=watchlist"}>Stock watchlist</Link>}
      </nav>
      <header className="public-page-heading">
        <h1>{stock?.name ?? (savedOnly ? "Stock watchlist" : "Tokenized stocks")}</h1>
        <p>Fictional listings and illustrative USD prices. Trading is unavailable.</p>
      </header>
      {stock ? (
        <>
          <section className="public-chart-panel" aria-label="Stock price">
            <div className="public-chart-toolbar">
              <h2>{stock.symbol} · {stock.sector}</h2>{watchButton(stock)}
            </div>
            <strong className="public-market-value">{price(stock.priceCents)}</strong>
            <p className={`market-change ${quoteTone(stock.change)}`}>{quoteChange(stock.change)}</p>
            <PriceHistoryChart assetName={stock.name} unit="unit" currency="USD"
              points={stock.history.map(({ date, priceCents }) => ({ date, amount: priceCents / 100 }))} />
          </section>
          <section className="public-about"><h2>About this listing</h2>
            <p>{stock.symbol} is a fictional stock token example. It has no Stellar issuer or associated shareholding rights.</p>
          </section>
        </>
      ) : rows.length ? (
        <div className="public-table-scroll" role="region" aria-label="Stock reference quotes" tabIndex={0}>
          <table className="public-data-table">
            <thead><tr><th scope="col">Stock</th><th scope="col">Price (USD)</th><th scope="col">Change</th></tr></thead>
            <tbody>{rows.map((item) => (
              <tr key={item.id}>
                <td><div className="public-asset-cell">{watchButton(item)}
                  <div><Link className="public-asset-link" to={`/real-world-assets/${item.id}`}>{item.name}</Link>
                    <span className="public-data-secondary">{item.symbol} · {item.sector}</span>
                  </div>
                </div></td>
                <td>{price(item.priceCents)}</td>
                <td><span className={`market-change ${quoteTone(item.change)}`}>{quoteChange(item.change)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="inventory-empty">{savedOnly && !term ? "No stocks saved yet." : "No stocks match your search."}</p>}
    </div>
  );
}
