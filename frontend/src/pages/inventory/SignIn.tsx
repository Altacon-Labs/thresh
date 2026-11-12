import { useEffect, useRef, useState, type FormEvent } from "react";
import { connectInventory, roleLabels, type Actor, type Lot, type Role } from "./inventoryClient";
import { workflow } from "./workflow";
import { stellarWallet } from "./stellarWallet";
import { connectWalletInventory, revokeWalletSession, type WalletSessionInfo } from "./walletLogin";

const roles: Role[] = ["warehouse", "verifier", "lender"];

export default function SignIn({ api, initialRole, initialMode = "sign-in", contactEmail, onClose, onSignIn }: {
  api: string;
  initialRole?: Role;
  initialMode?: "sign-in" | "request";
  contactEmail?: string;
  onClose: () => void;
  onSignIn: (session: Actor, lots: Lot[], credential: string, walletSession?: WalletSessionInfo) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<Role | null>(initialRole ?? null);
  const [mode, setMode] = useState<"sign-in" | "request">(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accessEmail = contactEmail?.trim();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || busy || mode !== "sign-in") return;
    const accessKey = String(new FormData(event.currentTarget).get("key")).trim();
    setBusy(true);
    setError("");
    try {
      const { actor, lots } = await connectInventory(api, accessKey, role);
      if (dialog.current?.open) onSignIn(actor, lots, accessKey);
    } catch (cause) {
      if (dialog.current?.open) {
        setError(cause instanceof Error ? cause.message : "Could not sign in.");
        setBusy(false);
      }
    }
  }

  async function signInWithWallet() {
    if (!role || busy) return;
    setBusy(true);
    setError("");
    try {
      const { actor, lots, token, walletSession } = await connectWalletInventory(api, role, stellarWallet());
      if (dialog.current?.open) onSignIn(actor, lots, token, walletSession);
      else void revokeWalletSession(api, token).catch(() => {});
    } catch (cause) {
      if (dialog.current?.open) {
        setError(cause instanceof Error ? cause.message : "Could not sign in with your wallet.");
        setBusy(false);
      }
    }
  }

  return (
    <dialog className="access-dialog" ref={dialog} aria-labelledby="sign-in-title" onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
      <div className="access-dialog-inner">
      <header className="access-dialog-header">
        <div>
          <h2 id="sign-in-title">Access your workspace</h2>
          <p>Choose the role that matches your work.</p>
        </div>
        <button type="button" className="access-close" aria-label="Close access dialog" onClick={() => dialog.current?.close()}>×</button>
      </header>
      <div className="access-modes" aria-label="Access options">
        <button type="button" disabled={busy} aria-pressed={mode === "sign-in"} onClick={() => {
          setMode("sign-in");
          setError("");
        }}>Sign in</button>
        <button type="button" disabled={busy} aria-pressed={mode === "request"} onClick={() => {
          setMode("request");
          setError("");
        }}>Request access</button>
      </div>
      <form className="sign-in-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <legend className="sr-only">Workspace role</legend>
          <div className="sign-in-roles">
            {roles.map((value) => (
              <label className="workspace-card sign-in-role" key={value}>
                <input type="radio" name="role" value={value} checked={role === value} onChange={() => {
                  setRole(value);
                  setError("");
                }} required />
                <span>
                  <strong>{roleLabels[value]}</strong>
                  <span>{workflow[value].signInDescription}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {mode === "sign-in" ? (
          <div className="sign-in-credentials">
            <button type="button" className="workspace-button wallet-sign-in" disabled={busy || !role}
              onClick={() => void signInWithWallet()}>Continue with Stellar wallet</button>
            <p>Approve a sign-in message in Varial (formerly Freighter).</p>
            <div className="access-divider"><span>or use your workspace key</span></div>
            <label htmlFor="inventory-access-key">Access key</label>
            <input id="inventory-access-key" className="workspace-field" name="key" type="password"
              autoComplete="current-password" placeholder="Enter your workspace key"
              aria-describedby="access-key-hint" required disabled={busy || !role} />
            <p id="access-key-hint">{role ? `Use the key issued for the ${roleLabels[role]} role.` : "Select a role to enter your key."}</p>
            {error && <p className="sign-in-error" role="alert">{error}</p>}
            <button type="submit" className="workspace-button" disabled={busy || !role}>{busy ? "Signing in…" : "Sign in to workspace"}</button>
          </div>
        ) : (
          <div className="sign-in-credentials access-request">
            <h3>Get a workspace access key</h3>
            <p>Ask your workspace administrator to link your Stellar public address or issue an access key
              {role ? ` for the ${roleLabels[role]} role` : ""}.</p>
            {accessEmail && /^[a-z0-9._+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(accessEmail) && (
              <a className="workspace-button inline-flex items-center" href={`mailto:${accessEmail}?subject=${encodeURIComponent(
                role ? `Thresh access request – ${roleLabels[role]}` : "Thresh access request",
              )}`}>Email workspace administrator</a>
            )}
          </div>
        )}
      </form>
      </div>
    </dialog>
  );
}
