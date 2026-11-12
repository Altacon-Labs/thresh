import { connectInventory, type Role } from "./inventoryClient.ts";

export type WalletSessionInfo = { address: string; expiresAt: string };

export type StellarSigner = {
  connect(): Promise<string>;
  sign(message: string, address: string): Promise<{ signature: string; signerAddress: string }>;
};

async function walletPost<T>(api: string, path: string, body: object, token?: string): Promise<T> {
  const response = await fetch(`${api.replace(/\/$/, "")}/inventory/wallet/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = Array.isArray(data?.message) ? data.message.join(". ") : data?.message;
    throw new Error(message || "Wallet sign-in failed. Try again or use your workspace key.");
  }
  return data as T;
}

export async function connectWalletInventory(api: string, role: Role, signer: StellarSigner) {
  const address = await signer.connect();
  const { nonce, message } = await walletPost<{ nonce: string; message: string }>(api, "challenge", { address, role });
  const { signature, signerAddress } = await signer.sign(message, address);
  if (signerAddress !== address) throw new Error("Your wallet account changed. Select the linked account and try again.");
  const { token, expiresAt } = await walletPost<{ token: string; expiresAt: string }>(api, "verify", { address, role, nonce, signature });

  try {
    const result = await connectInventory(api, token, role);
    if (result.actor.walletAddress !== address) throw new Error("This session belongs to a different wallet.");
    return { ...result, token, walletSession: { address, expiresAt } };
  } catch (error) {
    void revokeWalletSession(api, token).catch(() => {});
    throw error;
  }
}

export function revokeWalletSession(api: string, token: string) {
  return walletPost<void>(api, "logout", {}, token);
}
