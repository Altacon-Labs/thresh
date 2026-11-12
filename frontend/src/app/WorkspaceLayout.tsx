import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import overviewIcon from "../assets/dashboard_icon.svg";
import overviewActiveIcon from "../assets/dashboard_active_icon.svg";
import inventoryIcon from "../assets/portfolio_icon.svg";
import inventoryActiveIcon from "../assets/portfolio_active_icon.svg";
import { roleLabels, type Role } from "../pages/inventory/inventoryClient";
import { workflow } from "../pages/inventory/workflow";

const navigation = [
  { id: "markets", label: "Markets", icon: overviewIcon, activeIcon: overviewActiveIcon },
  { id: "inventory", label: "Inventory", icon: inventoryIcon, activeIcon: inventoryActiveIcon },
] as const;

export default function WorkspaceLayout({
  children, context, view, role, showAssetLink, walletAddress, busy, onSignOut, onSettings,
}: {
  children: ReactNode;
  context: ReactNode;
  view: "markets" | "inventory";
  role: Role;
  showAssetLink?: boolean;
  walletAddress?: string;
  busy?: boolean;
  onSettings: () => void;
  onSignOut?: () => void;
}) {
  return (
    <div className="workspace">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <Link className="workspace-brand" to="?view=inventory">
            <span className="workspace-brand-mark" aria-hidden="true">T</span>
            <span>Thresh</span>
          </Link>
          <div className="workspace-header-actions">
            <span className="workspace-session-role">{roleLabels[role]}</span>
            {walletAddress && <span className="workspace-wallet" title={walletAddress}
              aria-label={`Connected Stellar wallet ${walletAddress}`}>
              {walletAddress.slice(0, 5)}…{walletAddress.slice(-4)}
            </span>}
            <button type="button" className="workspace-button secondary" aria-haspopup="dialog" onClick={onSettings}>Settings</button>
            <button type="button" className="workspace-button secondary" disabled={busy} onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </header>
      <div className="workspace-body">
        <aside className="workspace-sidebar">
          <nav className="workspace-navigation" aria-label="Workspace">
            {navigation.filter((item) => role === "lender" || item.id === "inventory").map((item) => {
              const active = view === item.id;
              return (
                <Link key={item.id} to={`?view=${item.id}`} className={active ? "workspace-link active" : "workspace-link"}
                  aria-current={active ? "page" : undefined}>
                  <img alt="" src={active ? item.activeIcon : item.icon} />
                  {item.id === "inventory" ? workflow[role].label : item.label}
                </Link>
              );
            })}
            {showAssetLink && <a className="workspace-link workspace-sublink" href="#lot-details">Asset details</a>}
          </nav>
        </aside>
        <main className="workspace-main">{children}</main>
        <aside className="workspace-context" aria-label="Asset context">
          <div className="workspace-context-inner">{context}</div>
        </aside>
      </div>
    </div>
  );
}
