import { Link, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import type { FormEvent, ReactNode } from "react";
import { inventoryCategories } from "../pages/inventory/inventoryClient";

import type { QuoteCurrency } from "../pages/inventory/preferences";

const explorePath = "/real-world-assets";

export default function PublicMarketLayout({ children, query, currency, onSettings, onSignIn, onRequestAccess }: {
  children: ReactNode;
  query: string;
  currency: QuoteCurrency;
  onSettings: () => void;
  onSignIn: () => void;
  onRequestAccess: () => void;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const asset = useMatch("/real-world-assets/:assetId");

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get("query") ?? "").trim();
    const next = new URLSearchParams();
    if (params.get("category") === "tokenized-stocks" || asset?.params.assetId?.startsWith("stock-")) next.set("category", "tokenized-stocks");
    if (params.get("list") === "watchlist" && next.has("category")) next.set("list", "watchlist");
    if (term) next.set("q", term);
    navigate(next.size ? `${explorePath}?${next}` : explorePath);
  }

  return (
    <div className="public-market">
      <div className="market-tape">
        <div className="public-container market-tape-inner">
          <span>Network <strong>Stellar</strong></span>
          <span>Quote type <strong>Reference</strong></span>
          <span className="market-tape-status">Illustrative data</span>
          <button type="button" className="market-settings" aria-haspopup="dialog" onClick={onSettings}>Settings · {currency}</button>
        </div>
      </div>
      <header className="public-header">
        <div className="public-container public-header-inner">
          <Link className="workspace-brand" to={explorePath}>
            <span className="workspace-brand-mark" aria-hidden="true">T</span><span>Thresh</span>
          </Link>
          <nav className="public-nav" aria-label="Public navigation">
            <Link to={explorePath}>Explore</Link>
            <Link to={`${explorePath}#asset-categories`}>Categories</Link>
            <button type="button" className="public-sign-in" aria-haspopup="dialog" onClick={onSignIn}>Sign in</button>
          </nav>
          <div className="public-header-actions">
            <form className="public-search" role="search" onSubmit={search} key={query}>
              <input name="query" type="search" aria-label="Search assets" placeholder="Search assets" defaultValue={query} />
              <button type="submit" className="public-search-submit" aria-label="Submit asset search">Search</button>
            </form>
            <button type="button" className="workspace-button" aria-haspopup="dialog" onClick={onRequestAccess}>Sign up</button>
          </div>
        </div>
      </header>
      <main className="public-container public-main">{children}</main>
      <footer className="public-footer">
        <div className="public-container">
          <div className="public-footer-grid">
            <div className="public-footer-brand">
              <Link className="workspace-brand" to={explorePath}>
                <span className="workspace-brand-mark" aria-hidden="true">T</span><span>Thresh</span>
              </Link>
              <p>Asset verification and valuation for lenders.</p>
            </div>
            <nav aria-label="Explore footer links">
              <h2>Explore</h2>
              <Link to={explorePath}>All assets</Link>
              <Link to={explorePath + "?category=tokenized-stocks"}>Tokenized stocks</Link>
              {Object.entries(inventoryCategories).map(([category, details]) => (
                <Link key={category} to={`${explorePath}?category=${category}`}>{details.label}</Link>
              ))}
            </nav>
            <nav aria-label="Workspace footer links">
              <h2>Workspace</h2>
              <button type="button" aria-haspopup="dialog" onClick={onSignIn}>Sign in</button>
              <button type="button" aria-haspopup="dialog" onClick={onRequestAccess}>Request access</button>
            </nav>
            <nav aria-label="Resources footer links">
              <h2>Resources</h2>
              <Link to={`${explorePath}#quote-methodology`}>About reference prices</Link>
              <a href="https://stellar.org/" target="_blank" rel="noreferrer">Stellar</a>
            </nav>
          </div>
          <div className="public-footer-bottom">
            <span>Thresh</span>
            <span>Reference prices in {currency}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
