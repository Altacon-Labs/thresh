import { useState, type FormEvent } from "react";
import ValuationPanel from "./ValuationPanel";
import { parseNaira } from "./money";
import { createDemoInventory, demoActor } from "./demoInventory";
import { inventoryCategories, liveInventory, type Actor, type Category, type Decision, type Lot, type Role, type StellarProof } from "./inventoryClient";

const api = import.meta.env.VITE_INVENTORY_API_URL || "http://localhost:3000/api";
const demoEnabled = import.meta.env.VITE_ENABLE_DEMO !== "false";
const field = "block w-full rounded border border-slate-300 px-3 py-2";
const button = "rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50";

export default function Inventory() {
  const [demo] = useState(createDemoInventory);
  const [role, setRole] = useState<Role>("lender");
  const [showLogin, setShowLogin] = useState(!demoEnabled);
  const [key, setKey] = useState("");
  const [liveActor, setLiveActor] = useState<Actor | null>(null);
  const [lots, setLots] = useState<Lot[]>(() => demoEnabled ? demo.initialLots() : []);
  const [selectedId, setSelectedId] = useState(demoEnabled ? "demo-001" : "");
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<Category>("maize");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ lotId: string; data: StellarProof } | null>(null);
  const isDemo = !liveActor && demoEnabled;
  const actor = isDemo ? demoActor(role) : liveActor;
  const client = isDemo ? demo.client(role) : liveInventory(api, key);
  const selected = lots.find((lot) => lot.id === selectedId);
  const currentReview = selected?.reviews[selected.reviews.length - 1];
  const categoryDetails = inventoryCategories[category];
  const selectedCategory = selected ? inventoryCategories[selected.category] : null;
  const search = filter.trim().toLowerCase();
  const matchingLots = lots.filter((lot) => [lot.receiptNumber, lot.assetName, lot.assetIdentifier,
    inventoryCategories[lot.category].label].some((value) => value?.toLowerCase().includes(search)));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inventory request failed");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    return run(() => action(data));
  }

  function updateLot(lot: Lot) {
    setLots((current) => current.map((item) => item.id === lot.id ? lot : item));
  }

  return (
    <section className="space-y-6 pb-12 text-slate-900">
      <header>
        <p className="text-sm font-medium text-slate-600">Thresh · Stellar Testnet</p>
        <h1 className="text-2xl font-semibold">Warehouse inventory</h1>
      </header>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded bg-green-50 p-3 text-green-900">{notice}</p>}
      {isDemo && (
        <div className="flex flex-wrap items-center gap-4 rounded border border-amber-200 bg-amber-50 p-4">
          <p><strong>Demo workspace</strong> · Sample records and simulated actions</p>
          <label>Demo role <select className="rounded border border-slate-300 px-2 py-1" value={role} disabled={busy}
            onChange={(event) => {
              setRole(event.target.value as Role);
              setError("");
              setNotice("");
            }}>
            <option value="lender">Lender</option>
            <option value="warehouse">Warehouse</option>
            <option value="verifier">Verifier</option>
          </select></label>
          <button type="button" className="underline" disabled={busy} onClick={() => {
            demo.reset();
            setLots(demo.initialLots());
            setSelectedId("demo-001");
            setCategory("maize");
            setFilter("");
            setError("");
            setNotice("Demo reset.");
          }}>Reset demo</button>
          <button type="button" className="underline" disabled={busy} onClick={() => setShowLogin(!showLogin)}>
            {showLogin ? "Hide live sign-in" : "Connect live workspace"}
          </button>
        </div>
      )}
      {!liveActor && showLogin && (
        <form className="max-w-sm space-y-3" onSubmit={(event) => void submit(event, async (data) => {
          const accessKey = String(data.get("key")).trim();
          const nextClient = liveInventory(api, accessKey);
          const session = await nextClient.session();
          const liveLots = await nextClient.list();
          setLots(liveLots);
          setSelectedId(liveLots[0]?.id ?? "");
          setFilter("");
          setKey(accessKey);
          setLiveActor(session);
          setShowLogin(false);
          setProof(null);
          setNotice("Connected to the live workspace.");
        })}>
          <label>Inventory access key<input className={field} name="key" type="password" autoComplete="off" required /></label>
          <button className={button} disabled={busy}>Open live inventory</button>
        </form>
      )}
      {actor && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {!isDemo && <p>Live workspace · {actor.role}</p>}
            <button type="button" className="underline" disabled={busy} onClick={() => void run(async () => {
              const refreshed = await client.list();
              setLots(refreshed);
              if (!refreshed.some((lot) => lot.id === selectedId)) setSelectedId(refreshed[0]?.id ?? "");
              setProof(null);
              setNotice("Inventory refreshed.");
            })}>Refresh inventory</button>
            {!isDemo && <button type="button" className="underline" disabled={busy} onClick={() => {
              setLiveActor(null);
              setKey("");
              setLots(demoEnabled ? demo.initialLots() : []);
              setSelectedId(demoEnabled ? "demo-001" : "");
              setCategory("maize");
              setShowLogin(!demoEnabled);
              setFilter("");
              setProof(null);
              setError("");
              setNotice("");
            }}>Sign out</button>}
          </div>
          {actor.role === "warehouse" && (
            <form className="space-y-3 rounded border border-slate-200 p-4" onSubmit={(event) => {
              const form = event.currentTarget;
              void submit(event, async (data) => {
                const lot = await client.register({
                  receiptNumber: String(data.get("receiptNumber")),
                  category,
                  quantity: category === "equipment" ? 1 : Number(data.get("quantity")),
                  ...(category === "maize" ? {} : {
                    assetName: String(data.get("assetName")),
                    assetIdentifier: String(data.get("assetIdentifier")),
                  }),
                  grade: String(data.get("grade")),
                  receiptEvidenceId: String(data.get("receiptEvidenceId")),
                });
                setLots((current) => [lot, ...current]);
                setSelectedId(lot.id);
                setFilter("");
                setNotice("Lot registered.");
                form.reset();
                setCategory("maize");
              });
            }}>
              <h2 className="font-semibold">Register inventory</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Asset category<select className={field} value={category}
                  onChange={(event) => setCategory(event.target.value as Category)}>
                  {Object.entries(inventoryCategories).map(([value, details]) => (
                    <option key={value} value={value}>{details.label}</option>
                  ))}
                </select></label>
                <label>Receipt number<input className={field} name="receiptNumber" maxLength={80} required /></label>
                {"identifierLabel" in categoryDetails && (
                  <>
                    <label>Asset name<input className={field} name="assetName" maxLength={120} required /></label>
                    <label key={category}>{categoryDetails.identifierLabel}<input className={field} name="assetIdentifier" maxLength={120} required /></label>
                  </>
                )}
                {category === "equipment" ? <p className="self-end text-sm text-slate-600">Register one item per serial number.</p>
                  : <label>Quantity ({categoryDetails.unit === "kg" ? "kg" : "units"})<input className={field}
                    key={categoryDetails.unit} name="quantity" type="number" min="1" step="1" required /></label>}
                <label key={categoryDetails.conditionLabel}>{categoryDetails.conditionLabel}<input className={field} name="grade" maxLength={80} required /></label>
                <label>Receipt evidence ID<input className={field} name="receiptEvidenceId" maxLength={120} required /></label>
              </div>
              <button className={button} disabled={busy}>Register lot</button>
            </form>
          )}

          <label className="block max-w-sm">Find receipt<input className={field} value={filter} placeholder="Receipt, asset, or identifier"
            onChange={(event) => setFilter(event.target.value)} /></label>
          <div className="max-h-64 overflow-auto">
            {lots.length === 0 ? <p>No lots registered.</p> : matchingLots.length === 0 ? <p>No matching receipts.</p> : (
              <table className="w-full text-left">
                <thead><tr>{["Receipt", "Asset", "Quantity", "Verification"].map((label) => (
                  <th key={label} scope="col" className="border-b p-2">{label}</th>
                ))}</tr></thead>
                <tbody>{matchingLots.map((lot) => (
                  <tr key={lot.id} className="border-b border-slate-200">
                    <td className="p-2"><button className="text-blue-800 underline" type="button" aria-pressed={selectedId === lot.id}
                      onClick={() => {
                        setSelectedId(lot.id);
                        setProof(null);
                      }}>{lot.receiptNumber}</button></td>
                    <td className="p-2">{lot.assetName}</td>
                    <td className="p-2">{lot.quantity.toLocaleString()} {lot.unit === "kg" ? "kg" : lot.quantity === 1 ? "unit" : "units"}</td>
                    <td className="p-2 capitalize">{lot.status === "verified" && !lot.verificationCurrent ? "expired" : lot.status}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>

          {selected && selectedCategory && (
            <section className="space-y-3 rounded border border-slate-200 p-4">
              <h2 className="font-semibold">Receipt {selected.receiptNumber}</h2>
              <p>{selected.assetName} · {selectedCategory.label} · {selectedCategory.conditionLabel} {selected.grade}</p>
              {selected.assetIdentifier && "identifierLabel" in selectedCategory && (
                <p>{selectedCategory.identifierLabel} {selected.assetIdentifier}</p>
              )}
              <p>Receipt evidence ID {selected.receiptEvidenceId}</p>
              {selected.verificationExpiresAt && <p>Verification expires {new Date(selected.verificationExpiresAt).toLocaleString()}</p>}
              <section className="space-y-3 rounded border border-slate-200 p-4">
                <h3 className="font-semibold">Asset valuation</h3>
                <ValuationPanel key={selected.id} valuations={selected.valuations ?? []} grade={selected.grade}
                  assetName={selected.assetName} unit={selected.unit} verificationCurrent={selected.verificationCurrent} />
                {actor.role === "lender" && selected.verificationCurrent && (
                  <form key={selected.id} className="space-y-3" onSubmit={(event) => {
                    const form = event.currentTarget;
                    void submit(event, async (data) => {
                      const approved = String(data.get("approvedValue") ?? "").trim();
                      const lot = await client.value(selected.id, {
                        market: String(data.get("market")),
                        source: String(data.get("source")),
                        observedOn: String(data.get("observedOn")),
                        priceKoboPerUnit: parseNaira(String(data.get("price"))),
                        ...(approved ? { approvedValueKobo: parseNaira(approved) } : {}),
                      });
                      updateLot(lot);
                      setNotice("Valuation recorded.");
                      form.reset();
                    });
                  }}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>Market<input className={field} name="market" maxLength={120} required /></label>
                      <label>Price source<input className={field} name="source" maxLength={120} required /></label>
                      <label>Price date<input className={field} name="observedOn" type="date" required /></label>
                      <label>Price per {selectedCategory.priceUnit} (₦)<input className={field} name="price" inputMode="decimal" required /></label>
                      <label>Lender-approved lot value (₦, optional)<input className={field} name="approvedValue" inputMode="decimal" /></label>
                    </div>
                    <button className={button} disabled={busy}>Record valuation</button>
                  </form>
                )}
              </section>
              <h3 className="font-semibold">Review history</h3>
              {selected.reviews.length === 0 && <p>Awaiting independent review.</p>}
              <ul className="space-y-2">
                {selected.reviews.map((review) => (
                  <li key={`${review.recordedAt}-${review.decision}`} className="border-l-2 border-slate-200 pl-3">
                    <p className="capitalize">{review.decision} by {review.actorId} on {new Date(review.recordedAt).toLocaleString()}</p>
                    <p>{review.reason}</p>
                    <p>Inspection evidence ID {review.inspectionEvidenceId} · {new Date(review.inspectedAt).toLocaleString()}</p>
                    {review.demoProofRecorded && <p>Simulated Stellar proof</p>}
                    {review.stellarTransactionHash && (
                      <a className="break-all text-blue-800 underline" target="_blank" rel="noreferrer"
                        href={`https://horizon-testnet.stellar.org/transactions/${review.stellarTransactionHash}`}>
                        View Stellar Testnet transaction
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {isDemo && actor.role === "verifier" && selected.verificationCurrent && !currentReview?.demoProofRecorded && (
                <button type="button" className={button} disabled={busy} onClick={() => void run(async () => {
                  updateLot(await client.recordProof(selected.id, ""));
                  setNotice("Simulated proof recorded. No Stellar transaction was sent.");
                })}>Simulate Stellar proof</button>
              )}
              {actor.stellarAccount && selected.verificationCurrent && currentReview?.actorId === actor.id
                && !currentReview.stellarTransactionHash && (
                  <section className="space-y-3 rounded border border-slate-200 p-4">
                    <h3 className="font-semibold">Anchor this inspection on Stellar Testnet</h3>
                    <form onSubmit={(event) => void submit(event, async () => {
                      const data = await client.prepareProof(selected.id);
                      setProof({ lotId: selected.id, data });
                    })}>
                      <button className={button} disabled={busy}>Get Stellar transaction details</button>
                    </form>
                    {proof?.lotId === selected.id && (
                      <div className="space-y-2">
                        <p>In Stellar Lab, select Testnet and build a transaction with one Manage Data operation. Use the verifier account as the transaction source and leave the operation source blank. Enter the value as text.</p>
                        <dl className="space-y-1 break-all">
                          <div><dt className="font-semibold">Source account</dt><dd>{proof.data.account}</dd></div>
                          <div><dt className="font-semibold">Data name</dt><dd>{proof.data.dataName}</dd></div>
                          <div><dt className="font-semibold">Data value</dt><dd>{proof.data.dataValue}</dd></div>
                        </dl>
                        <a className="text-blue-800 underline" href="https://lab.stellar.org/transaction/build" target="_blank" rel="noreferrer">Build in Stellar Lab</a>
                      </div>
                    )}
                    <form key={selected.id} className="space-y-2" onSubmit={(event) => void submit(event, async (data) => {
                      const lot = await client.recordProof(selected.id, String(data.get("transactionHash")).trim());
                      updateLot(lot);
                      setProof(null);
                      setNotice("Stellar proof verified and saved.");
                    })}>
                      <label>Submitted transaction hash<input className={field} name="transactionHash" pattern="[0-9a-fA-F]{64}" required /></label>
                      <button className={button} disabled={busy}>Verify and save proof</button>
                    </form>
                  </section>
                )}
              {actor.role === "verifier" && (selected.status === "pending" || selected.status === "verified") && (
                <form key={selected.id} className="space-y-3" onSubmit={(event) => {
                  const form = event.currentTarget;
                  void submit(event, async (data) => {
                    const inspectedAt = new Date(String(data.get("inspectedAt"))).toISOString();
                    const lot = await client.review(selected.id, {
                      decision: String(data.get("decision")) as Decision,
                      reason: String(data.get("reason")),
                      inspectionEvidenceId: String(data.get("inspectionEvidenceId")),
                      inspectedAt,
                    });
                    updateLot(lot);
                    setProof(null);
                    setNotice("Inspection decision recorded.");
                    form.reset();
                  });
                }}>
                  <label>Decision<select className={field} name="decision" required>
                    {selected.status === "verified" ? (
                      <>
                        {!selected.verificationCurrent && <option value="verified">Verify again</option>}
                        <option value="revoked">Revoke</option>
                      </>
                    ) : (
                      <><option value="verified">Verify</option><option value="rejected">Reject</option></>
                    )}
                  </select></label>
                  <label>Inspection time<input className={field} name="inspectedAt" type="datetime-local" required /></label>
                  <label>Inspection evidence ID<input className={field} name="inspectionEvidenceId" maxLength={120} required /></label>
                  <label>Reason<textarea className={field} name="reason" maxLength={500} required /></label>
                  <button className={button} disabled={busy}>Record decision</button>
                </form>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
