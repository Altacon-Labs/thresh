import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import WorkspaceLayout from "../../app/WorkspaceLayout";
import PreferencesDialog from "../../app/PreferencesDialog";
import { parsePreferences, preferenceKey, type Preferences } from "./preferences";
import PublicMarketLayout from "../../app/PublicMarketLayout";
import ContextCard from "../../app/ContextCard";
import Markets from "./Markets";
import PublicMarkets from "./PublicMarkets";
import PublicAssetDetail from "./PublicAssetDetail";
import SignIn from "./SignIn";
import ValuationPanel from "./ValuationPanel";
import { parseNaira } from "./money";
import { marketQuotes } from "./quotes";
import { inRoleQueue, workflow } from "./workflow";
import { publicExploreLots } from "./publicExplore";
import { activeStellarAddress } from "./stellarWallet";
import { revokeWalletSession, type WalletSessionInfo } from "./walletLogin";
import {
  custodyOptions, inventoryCategories, InventoryRequestError, liveInventory,
  type Actor, type Category, type CustodyType, type Decision, type Lot, type Role, type StellarProof,
} from "./inventoryClient";

const api = import.meta.env.VITE_INVENTORY_API_URL || "http://localhost:3000/api";
const accessContact = import.meta.env.VITE_WORKSPACE_CONTACT_EMAIL;
const exploreLots = publicExploreLots();
const exploreQuotes = marketQuotes(exploreLots);
const field = "workspace-field";
const button = "workspace-button";

function lotStatus(lot: Lot) {
  return lot.status === "verified" && !lot.verificationCurrent ? "expired" : lot.status;
}

export default function Inventory() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { hash, pathname } = useLocation();
  const publicAssetId = useMatch("/real-world-assets/:assetId")?.params.assetId;
  const requestedLotId = params.get("lot");
  const requestedAssetId = publicAssetId ?? params.get("asset");
  const requestedCategory = params.get("category");
  const publicCategory = requestedCategory && Object.prototype.hasOwnProperty.call(inventoryCategories, requestedCategory)
    ? requestedCategory as Category : "all";
  const [key, setKey] = useState("");
  const [actor, setActor] = useState<Actor | null>(null);
  const [walletSession, setWalletSession] = useState<WalletSessionInfo | null>(null);
  const [accessDialog, setAccessDialog] = useState<{ role?: Role; mode?: "request" } | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<Category>("maize");
  const [custodyType, setCustodyType] = useState<CustodyType>("owner_site");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ lotId: string; data: StellarProof } | null>(null);
  const role = actor?.role ?? "warehouse";
  const currentWorkflow = workflow[role];
  const view = !actor || (role === "lender" && params.get("view") === "markets") ? "markets" : "inventory";
  const client = liveInventory(api, key);
  const selected = lots.find((lot) => lot.id === requestedLotId)
    ?? lots.find((lot) => lot.id === selectedId);
  const currentReview = selected?.reviews[selected.reviews.length - 1];
  const categoryDetails = inventoryCategories[category];
  const selectedCategory = selected ? inventoryCategories[selected.category] : null;
  const selectedCustody = selected ? custodyOptions[selected.custodyType ?? "warehouse"] : null;
  const custody = custodyOptions[custodyType];
  const search = filter.trim().toLowerCase();
  const queue = lots.filter((lot) => inRoleQueue(lot, role));
  const matchingLots = (showAll ? lots : queue).filter((lot) => [lot.receiptNumber, lot.assetName,
    lot.assetIdentifier, lot.custodyLocation, inventoryCategories[lot.category].label]
    .some((value) => value?.toLowerCase().includes(search)));
  const summary = [
    { label: "Registered lots", count: lots.length, tone: "total" },
    { label: "Currently verified", count: lots.filter((lot) => lot.verificationCurrent).length, tone: "verified" },
    { label: "Needs inspection", count: lots.filter((lot) => inRoleQueue(lot, "verifier")).length, tone: "pending" },
  ];

  const scrollToRequestedLot = view === "inventory" && requestedLotId && selected?.id === requestedLotId;
  useEffect(() => {
    const anchor = hash && document.getElementById(hash.slice(1));
    if (anchor) anchor.scrollIntoView({ block: "start" });
    else if (!hash) window.scrollTo(0, 0);
  }, [hash, pathname, view, requestedAssetId]);
  useEffect(() => {
    if (scrollToRequestedLot) document.getElementById("lot-details")?.scrollIntoView({ block: "start" });
  }, [scrollToRequestedLot, requestedLotId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (walletSession) {
        const address = await activeStellarAddress().catch(() => null);
        if (address !== walletSession.address) {
          signOut("Your Stellar wallet changed or disconnected. Sign in again to continue.");
          return;
        }
      }
      await action();
    } catch (cause) {
      if (walletSession && cause instanceof InventoryRequestError && cause.status === 401) {
        signOut("Your wallet session ended. Sign in again to continue.");
      } else {
        setError(cause instanceof Error ? cause.message : "Inventory request failed");
      }
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

  function selectLot(id: string) {
    setSelectedId(id);
    setProof(null);
    if (requestedLotId) setParams({ view: "inventory" }, { replace: true });
  }

  function openInventory(id?: string) {
    if (id) {
      setSelectedId(id);
      setFilter("");
      setProof(null);
      setShowAll(!queue.some((lot) => lot.id === id));
    }
    setParams(id ? { view: "inventory", lot: id } : { view: "inventory" });
  }

  const signOut = useCallback((message = "") => {
    if (walletSession) void revokeWalletSession(api, key).catch(() => {});
    setActor(null);
    setWalletSession(null);
    setKey("");
    setLots([]);
    setSelectedId("");
    setFilter("");
    setProof(null);
    setError("");
    setNotice(message);
    setCategory("maize");
    setCustodyType("owner_site");
    navigate("/real-world-assets", { replace: true });
  }, [key, navigate, walletSession]);

  useEffect(() => {
    if (!walletSession || busy) return;
    let stopped = false;
    let checking = false;
    const checkWallet = async () => {
      if (stopped || checking || document.visibilityState === "hidden") return;
      checking = true;
      const address = await activeStellarAddress().catch(() => null);
      checking = false;
      if (!stopped && address !== walletSession.address) {
        signOut("Your Stellar wallet changed or disconnected. Sign in again to continue.");
      }
    };
    const expiry = window.setTimeout(
      () => signOut("Your wallet session expired. Sign in again to continue."),
      Math.max(0, Date.parse(walletSession.expiresAt) - Date.now()),
    );
    const watcher = window.setInterval(() => void checkWallet(), 5000);
    const onFocus = () => void checkWallet();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void checkWallet();
    return () => {
      stopped = true;
      window.clearTimeout(expiry);
      window.clearInterval(watcher);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [busy, signOut, walletSession]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState(() => {
    try {
      return parsePreferences(window.localStorage.getItem(preferenceKey));
    } catch {
      return parsePreferences(null);
    }
  });
  const settings = settingsOpen && <PreferencesDialog preferences={preferences} onClose={() => setSettingsOpen(false)}
    onChange={(next: Preferences) => {
      setPreferences(next);
      try {
        window.localStorage.setItem(preferenceKey, JSON.stringify(next));
      } catch {
        // Keep preferences available for the current session.
      }
    }} />;

  if (!actor) {
    const quote = exploreQuotes.find(({ lot }) => lot.id === requestedAssetId);
    const query = params.get("q") ?? "";
    return (
      <PublicMarketLayout query={query} currency={preferences.currency} onSettings={() => setSettingsOpen(true)} onSignIn={() => setAccessDialog({})}
        onRequestAccess={() => setAccessDialog({ mode: "request" })}>
        {quote ? <PublicAssetDetail key={quote.lot.id} quote={quote} currency={preferences.currency} onSignIn={() => setAccessDialog({ role: "lender" })} />
          : <PublicMarkets currency={preferences.currency} lots={exploreLots} category={publicCategory} query={query} />}
        {settings}
        {notice && <p role="status" className="workspace-feedback">{notice}</p>}
        {accessDialog && <SignIn api={api} initialRole={accessDialog.role} initialMode={accessDialog.mode} contactEmail={accessContact}
          onClose={() => setAccessDialog(null)} onSignIn={(session, records, credential, wallet) => {
            setActor(session);
            setKey(credential);
            setWalletSession(wallet ?? null);
            setNotice("");
            setLots(records);
            setSelectedId(records.find((lot) => inRoleQueue(lot, session.role))?.id ?? "");
            setShowAll(false);
            setRegistrationOpen(session.role === "warehouse" && records.length === 0);
            setAccessDialog(null);
            navigate("/dashboard/inventory", { replace: true });
          }} />}
      </PublicMarketLayout>
    );
  }

  const contextAsset = view === "inventory" ? selected : lots.find((lot) => lot.id === requestedAssetId);
  const workspaceFacts = contextAsset ? [
    { label: "Asset", value: contextAsset.assetName },
    { label: "Reference", value: contextAsset.receiptNumber },
    { label: "Verification", value: <span className={`inventory-status ${lotStatus(contextAsset)}`}>{lotStatus(contextAsset)}</span> },
    { label: "Custody", value: custodyOptions[contextAsset.custodyType ?? "warehouse"].label },
    ...(contextAsset.custodyLocation ? [{ label: "Location", value: contextAsset.custodyLocation }] : []),
  ] : [
    { label: "Workspace", value: currentWorkflow.label },
    { label: currentWorkflow.queueLabel, value: queue.length },
  ];

  return (
    <WorkspaceLayout onSettings={() => setSettingsOpen(true)} view={view} role={actor.role} walletAddress={walletSession?.address} busy={busy}
      showAssetLink={view === "inventory" && Boolean(selected)} onSignOut={() => signOut()}
      context={<ContextCard title={contextAsset ? "Asset snapshot" : "Workspace snapshot"} facts={workspaceFacts}>
        {view === "markets" && contextAsset && <button type="button" className="workspace-button secondary context-action"
          onClick={() => openInventory(contextAsset.id)}>Review collateral</button>}
      </ContextCard>}>
    {settings}
    <section id="overview" className="workspace-overview">
      <header className={view === "markets" ? "workspace-heading market-hero" : "workspace-heading"}>
        <div>
          <h1>{view === "markets" ? "Collateral markets" : currentWorkflow.label}</h1>
          <p>{view === "markets" ? "Explore reference prices and trace each quote back to a specific asset."
            : currentWorkflow.description}</p>
        </div>
        {view === "markets" && (
          <button type="button" className="workspace-button market-hero-action" onClick={() => openInventory()}>
            Go to collateral review
          </button>
        )}
        {view === "inventory" && role === "warehouse" && (
          <button type="button" className={button} aria-expanded={registrationOpen} disabled={busy}
            onClick={() => setRegistrationOpen(!registrationOpen)}>
            {registrationOpen ? "Close registration" : "Register an asset"}
          </button>
        )}
      </header>
      {view === "markets" && <Markets lots={lots} assetId={requestedAssetId} onOpenInventory={openInventory} />}
      {view === "inventory" && (
        <>
          <dl className="workspace-stats" aria-label="Inventory summary">
            {summary.map(({ label, count, tone }) => (
              <div className="workspace-card workspace-stat" key={label}>
                <dt><span className={`stat-marker ${tone}`} aria-hidden="true" />{label}</dt>
                <dd>{count.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          {role === "warehouse" && registrationOpen && (
            <form className="workspace-card workspace-form space-y-4" onSubmit={(event) => {
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
                  custodyType,
                  custodyLocation: String(data.get("custodyLocation")),
                });
                setLots((current) => [lot, ...current]);
                selectLot(lot.id);
                setFilter("");
                setNotice("Lot registered.");
                form.reset();
                setCategory("maize");
                setCustodyType("owner_site");
                setRegistrationOpen(false);
              });
            }}>
              <h2>Register an asset</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Asset category<select className={field} value={category}
                  onChange={(event) => setCategory(event.target.value as Category)}>
                  {Object.entries(inventoryCategories).map(([value, details]) => (
                    <option key={value} value={value}>{details.label}</option>
                  ))}
                </select></label>
                <label>Where is the asset held?<select className={field} value={custodyType}
                  onChange={(event) => setCustodyType(event.target.value as CustodyType)}>
                  {Object.entries(custodyOptions).map(([value, details]) => (
                    <option key={value} value={value}>{details.label}</option>
                  ))}
                </select></label>
                <label>Site or facility<input className={field} name="custodyLocation"
                  placeholder="Site name and city" maxLength={120} required /></label>
                <label key={`reference-${custodyType}`}>{custody.reference}<input className={field} name="receiptNumber" maxLength={80} required /></label>
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
                <div key={`evidence-${custodyType}`}>
                  <label>{custody.evidence}<input className={field} name="receiptEvidenceId" maxLength={120}
                    aria-describedby="registration-evidence-hint" required /></label>
                  <p className="mt-1 text-xs text-slate-600" id="registration-evidence-hint">{custody.evidenceHint}</p>
                </div>
              </div>
              <button className={button} disabled={busy}>Register asset</button>
            </form>
          )}

          <div id="inventory" className="inventory-grid">
          <section className="workspace-card inventory-list" aria-labelledby="inventory-title">
            <div className="inventory-list-heading">
              <div><h2 id="inventory-title">{showAll ? "All assets" : currentWorkflow.queueLabel}</h2><p>{matchingLots.length} {matchingLots.length === 1 ? "asset" : "assets"}</p></div>
              <button type="button" className="workspace-button secondary" disabled={busy} onClick={() => void run(async () => {
                const refreshed = await client.list();
                setLots(refreshed);
                if (!refreshed.some((lot) => lot.id === selected?.id)) {
                  setSelectedId(refreshed.find((lot) => showAll || inRoleQueue(lot, role))?.id ?? "");
                }
                setProof(null);
                setNotice("Inventory refreshed.");
              })}>Refresh</button>
            </div>
            {role !== "warehouse" && (
              <div className="workspace-list-filters" aria-label="Asset scope">
                <button type="button" aria-pressed={!showAll} onClick={() => {
                  setShowAll(false);
                  if (selected && !inRoleQueue(selected, role)) selectLot(queue[0]?.id ?? "");
                }}>{currentWorkflow.queueLabel}</button>
                <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>All assets</button>
              </div>
            )}
            <label className="inventory-search">Find asset record<input className={field} value={filter} placeholder="Reference, asset, identifier, or location"
              onChange={(event) => setFilter(event.target.value)} /></label>
          <div className="inventory-table-scroll">
            {matchingLots.length === 0 ? (
              <p className="inventory-empty">{filter.trim() ? "No matching assets."
                : showAll ? "No assets are registered in this workspace." : currentWorkflow.empty}</p>
            ) : (
              <table className="inventory-table">
                <thead><tr>{["Reference", "Asset", "Quantity", "Verification"].map((label) => (
                  <th key={label} scope="col">{label}</th>
                ))}</tr></thead>
                <tbody>{matchingLots.map((lot) => (
                  <tr key={lot.id} className={selected?.id === lot.id ? "selected" : undefined}>
                    <td><button className="inventory-receipt" type="button" aria-pressed={selected?.id === lot.id}
                      onClick={() => {
                        selectLot(lot.id);
                        requestAnimationFrame(() => document.getElementById("lot-details")?.scrollIntoView({ block: "start" }));
                      }}>{lot.receiptNumber}</button></td>
                    <td>{lot.assetName}</td>
                    <td className="whitespace-nowrap">{lot.quantity.toLocaleString()} {lot.unit === "kg" ? "kg" : lot.quantity === 1 ? "unit" : "units"}</td>
                    <td><span className={`inventory-status ${lotStatus(lot)}`}>{lotStatus(lot)}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          </section>

          {selected && selectedCategory && selectedCustody && (
            <section id="lot-details" className="workspace-card inventory-detail space-y-4">
              <header className="inventory-detail-heading">
                <div>
                  <p>{selectedCategory.label}</p>
                  <h2>{selected.custodyType === "warehouse" || !selected.custodyType ? "Receipt" : "Asset"} {selected.receiptNumber}</h2>
                </div>
                <span className={`inventory-status ${lotStatus(selected)}`}>{lotStatus(selected)}</span>
              </header>
              <div className="inventory-meta">
              <p>{selected.assetName} · {selectedCategory.conditionLabel} {selected.grade}</p>
              {selected.assetIdentifier && "identifierLabel" in selectedCategory && (
                <p>{selectedCategory.identifierLabel} {selected.assetIdentifier}</p>
              )}
              <p>{selectedCustody.label}{selected.custodyLocation ? ` · ${selected.custodyLocation}` : ""}</p>
              <p>{selectedCustody.evidence} {selected.receiptEvidenceId}</p>
              {selected.verificationExpiresAt && <p>Verification expires {new Date(selected.verificationExpiresAt).toLocaleString()}</p>}
              </div>
              <section className="workspace-inset space-y-4">
                <h3 className="font-semibold">Asset valuation</h3>
                <ValuationPanel key={selected.id} valuations={selected.valuations ?? []} grade={selected.grade}
                  assetName={selected.assetName} unit={selected.unit} verificationCurrent={selected.verificationCurrent} />
                {actor.role === "lender" && selected.verificationCurrent && (
                  <form key={selected.id} className="workspace-action-form space-y-3" onSubmit={(event) => {
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
                  <li key={`${review.recordedAt}-${review.decision}`} className="inventory-review">
                    <p className="capitalize">{review.decision} by {review.actorId} on {new Date(review.recordedAt).toLocaleString()}</p>
                    <p>{review.reason}</p>
                    <p>Inspection evidence ID {review.inspectionEvidenceId} · {new Date(review.inspectedAt).toLocaleString()}</p>
                    {review.stellarTransactionHash && (
                      <a className="break-all text-blue-800 underline" target="_blank" rel="noreferrer"
                        href={`https://horizon-testnet.stellar.org/transactions/${review.stellarTransactionHash}`}>
                        View Stellar Testnet transaction
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {actor.stellarAccount && selected.verificationCurrent && currentReview?.actorId === actor.id
                && !currentReview.stellarTransactionHash && (
                  <section className="workspace-inset space-y-3">
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
                <form key={selected.id} className="workspace-action-form space-y-3" onSubmit={(event) => {
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
          </div>
        </>
      )}
      {error && <p role="alert" className="workspace-feedback error">{error}</p>}
      {notice && <p role="status" className="workspace-feedback success">{notice}</p>}
    </section>
    </WorkspaceLayout>
  );
}
