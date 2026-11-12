import { useEffect, useRef } from "react";
import type { Preferences } from "../pages/inventory/preferences";

export default function PreferencesDialog({ preferences, onChange, onClose }: {
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} className="access-dialog" aria-labelledby="preferences-title" onCancel={onClose}>
      <form className="access-dialog-inner workspace-form" onSubmit={(event) => { event.preventDefault(); onClose(); }}>
        <header className="access-dialog-header"><div>
          <h2 id="preferences-title">Settings</h2>
          <p>Preferences are saved in this browser.</p>
        </div></header>
        <label>Explore quote currency
          <select className="workspace-field" value={preferences.currency}
            onChange={(event) => onChange({ ...preferences, currency: event.target.value === "NGN" ? "NGN" : "USD" })}>
            <option value="USD">USD · US dollar</option>
            <option value="NGN">NGN · Nigerian naira</option>
          </select>
        </label>
        <label>Preferred Stellar stablecoin
          <select className="workspace-field" value={preferences.stablecoin}
            onChange={(event) => onChange({ ...preferences, stablecoin: event.target.value === "EURC" ? "EURC" : "USDC" })}>
            <option value="USDC">USDC · US dollar stablecoin</option>
            <option value="EURC">EURC · Euro stablecoin</option>
          </select>
        </label>
        <p className="text-sm text-slate-600">Stablecoin payments are not available yet.</p>
        <button type="submit" className="workspace-button">Done</button>
      </form>
    </dialog>
  );
}
