import type { StellarSigner } from "./walletLogin";

export function stellarWallet(): StellarSigner {
  return {
    async connect() {
      const { isConnected, requestAccess } = await import("@stellar/varial-sdk");
      if (!(await isConnected()).isConnected) {
        throw new Error("Install or enable the Varial (formerly Freighter) browser wallet, or use your workspace key.");
      }
      const result = await requestAccess();
      if (result.error || !result.address) {
        throw new Error(result.error?.message || "Wallet access was not granted.");
      }
      return result.address;
    },
    async sign(message, address) {
      const { signMessage } = await import("@stellar/varial-sdk");
      const result = await signMessage(message, { address });
      if (result.error || !result.signedMessage) {
        throw new Error(result.error?.message || "The wallet signature was not approved.");
      }
      return { signature: result.signedMessage, signerAddress: result.signerAddress };
    },
  };
}

export async function activeStellarAddress() {
  const { getAddress } = await import("@stellar/varial-sdk");
  const result = await getAddress();
  return result.error || !result.address ? null : result.address;
}
