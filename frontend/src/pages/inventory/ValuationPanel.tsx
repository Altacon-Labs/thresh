import {
  CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatNaira } from "./money";
import type { Valuation } from "./inventoryClient";

ChartJS.register(CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip);

export default function ValuationPanel({ valuations, grade, assetName, unit, verificationCurrent }: {
  valuations: Valuation[];
  grade: string;
  assetName: string;
  unit: "kg" | "unit";
  verificationCurrent: boolean;
}) {
  const ordered = [...valuations].sort((a, b) =>
    a.observedOn.localeCompare(b.observedOn) || a.recordedAt.localeCompare(b.recordedAt));
  const latest = ordered[ordered.length - 1];
  const approved = [...valuations].filter((entry) => entry.approvedValueKobo !== undefined)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

  if (!latest) return <p className="text-sm text-slate-600">No reference price has been recorded.</p>;

  const series = new Map<string, Valuation>();
  for (const entry of ordered) {
    if (entry.market.toLowerCase() === latest.market.toLowerCase()
      && entry.source.toLowerCase() === latest.source.toLowerCase()) {
      series.set(entry.observedOn, entry);
    }
  }

  return (
    <div className="space-y-4">
      {!verificationCurrent && <p className="text-amber-800">Historical valuations · verification is no longer current.</p>}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div><dt className="text-sm text-slate-600">Reference price</dt><dd className="font-semibold">{formatNaira(latest.priceKoboPerUnit)} / {unit}</dd></div>
        <div><dt className="text-sm text-slate-600">Estimated lot value</dt><dd className="font-semibold">{formatNaira(latest.estimatedValueKobo)}</dd></div>
        <div><dt className="text-sm text-slate-600">Lender-approved value</dt><dd className="font-semibold">
          {approved?.approvedValueKobo === undefined ? "No approved value" : formatNaira(approved.approvedValueKobo)}
        </dd>{approved && <dd className="text-sm text-slate-600">Recorded {new Date(approved.recordedAt).toLocaleString()}</dd>}</div>
      </dl>
      <p className="text-sm text-slate-600">{latest.market} · {grade} · {latest.source} · {latest.observedOn}</p>
      {series.size > 1 ? (
        <div className="h-48">
          <Line
            aria-label={`${assetName} reference price history for ${latest.market} from ${latest.source}`}
            role="img"
            data={{
              labels: [...series.keys()],
              datasets: [{
                label: `NGN per ${unit}`,
                data: [...series.values()].map((entry) => entry.priceKoboPerUnit / 100),
                borderColor: "#1d4ed8",
                backgroundColor: "#1d4ed8",
              }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
              scales: { y: { title: { display: true, text: `NGN per ${unit}` } } } }}
          />
        </div>
      ) : <p className="text-sm text-slate-600">The chart appears after two dates are recorded for this market and source.</p>}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Valuation history</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr>{["Price date", "Market", "Source", `Price / ${unit}`, "Estimate", "Approved"].map((label) =>
              <th className="border-b p-2" scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{[...ordered].reverse().map((entry) => (
              <tr key={entry.id} className="border-b border-slate-200">
                <td className="p-2">{entry.observedOn}</td>
                <td className="p-2">{entry.market}</td>
                <td className="p-2">{entry.source}</td>
                <td className="p-2">{formatNaira(entry.priceKoboPerUnit)}</td>
                <td className="p-2">{formatNaira(entry.estimatedValueKobo)}</td>
                <td className="p-2">{entry.approvedValueKobo === undefined ? "—" : formatNaira(entry.approvedValueKobo)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
