import { Link } from "react-router-dom";
import MetricCard from "../../app/MetricCard";
import { quoteChange, quoteTone } from "./quoteDisplay";
import { marketActivity, trendingQuotes, type MarketQuote } from "./quotes";

function MarketStatusCard({ quotes, formatQuote }: { quotes: MarketQuote[]; formatQuote: (kobo: number) => string }) {
  const { estimatedValueKobo, observations } = marketActivity(quotes);
  const peak = Math.max(1, ...observations.map(({ count }) => count));
  return (
    <MetricCard title="Market status">
      <p>Estimated inventory value</p>
      <strong className="public-market-value">{formatQuote(estimatedValueKobo)}</strong>
      <figure className="public-market-activity">
        {observations.length > 0 && (
          <svg viewBox={`0 0 ${observations.length * 12} 40`} preserveAspectRatio="none" role="img"
            aria-label={`Illustrative quote observations by date. ${observations.map(({ date, count }) => `${date}: ${count}`).join(", ")}`}>
            {observations.map(({ date, count }, index) => {
              const height = count / peak * 40;
              return <rect key={date} x={index * 12 + 2} y={40 - height} width={8} height={height} rx={1} />;
            })}
          </svg>
        )}
        <figcaption>{observations.length ? "Sample quote observations by date" : "No quote observations yet"}</figcaption>
      </figure>
    </MetricCard>
  );
}

export default function MarketHighlights({ quotes, watchlist, formatQuote }: {
  quotes: MarketQuote[];
  watchlist: string[];
  formatQuote: (kobo: number) => string;
}) {
  const trending = trendingQuotes(quotes).slice(0, 4);
  const savedQuotes = quotes.filter(({ lot }) => watchlist.includes(lot.id));
  return (
      <section className="public-metric-grid" aria-label="Market highlights" tabIndex={0}>
        <MetricCard title="Trending">
          <p>Biggest reference price moves</p>
          <ol className="public-metric-list" aria-label="Trending assets">
            {trending.map(({ lot, change }) => (
              <li key={lot.id}>
                <Link to={"/real-world-assets/" + encodeURIComponent(lot.id)}>{lot.assetName}</Link>
                <span className={`market-change ${quoteTone(change)}`}>{quoteChange(change)}</span>
              </li>
            ))}
          </ol>
          <Link className="public-metric-more" to="/real-world-assets?list=trending" aria-label="More trending assets">More</Link>
        </MetricCard>
        <MetricCard title="Watchlist">
          {savedQuotes.length ? (
            <><p>{savedQuotes.length} saved</p>
              <ul className="public-metric-list" aria-label="Saved assets">
                {savedQuotes.slice(0, 4).map(({ lot, latest }) => (
                  <li key={lot.id}>
                    <Link to={"/real-world-assets/" + encodeURIComponent(lot.id)}>{lot.assetName}</Link>
                    <span>{formatQuote(latest.priceKoboPerUnit)}</span>
                  </li>
                ))}
              </ul></>
          ) : <div className="public-watchlist-empty"><span aria-hidden="true">☆</span>
              <p>Select the star next to an asset to save it here.</p></div>}
          <Link className="public-metric-more" to="/real-world-assets?list=watchlist" aria-label="More watched assets">More</Link>
        </MetricCard>
        <MarketStatusCard quotes={quotes} formatQuote={formatQuote} />
        <MetricCard title="Advertisement" className="public-ad-card">
          <p>Ad space available</p>
        </MetricCard>
      </section>
  );
}
