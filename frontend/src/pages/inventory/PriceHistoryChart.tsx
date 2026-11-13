import { CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { sampleQuoteAmount, type QuoteCurrency } from "./preferences";
import type { Valuation } from "./inventoryClient";

ChartJS.register(CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

export default function PriceHistoryChart({ series = [], assetName, unit, currency = "NGN", points }: {
  currency?: QuoteCurrency;
  series?: Valuation[];
  points?: { date: string; amount: number }[];
  assetName: string;
  unit: "kg" | "unit";
}) {
  const latest = series[series.length - 1];
  const observations = points ?? series.map((entry) => ({ date: entry.observedOn, amount: sampleQuoteAmount(entry.priceKoboPerUnit, currency) }));
  if (observations.length < 2) {
    return <p className="text-sm text-slate-600">The chart appears after two dates are recorded for this market and source.</p>;
  }
  return (
    <div className="valuation-chart">
      <Line
        aria-label={`${assetName} reference price history ${latest ? `for ${latest.market} from ${latest.source}` : ""}`}
        role="img"
        data={{
          labels: observations.map(({ date }) => date),
          datasets: [{
            label: `${currency} per ${unit}`,
            data: observations.map(({ amount }) => amount),
            borderColor: "#2258e7",
            backgroundColor: "#2258e716",
            pointBackgroundColor: "#2258e7",
            pointRadius: 3,
            fill: true,
            tension: 0.25,
          }],
        }}
        options={{
          responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 5, maxRotation: 0 } },
            y: { position: "right", grid: { color: "#e7ecf7" }, title: { display: true, text: `${currency} per ${unit}` } },
          },
        }}
      />
    </div>
  );
}
