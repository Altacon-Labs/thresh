import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { stellarPublicKey } from './stellar-signature';

export const inventoryRoles = ['warehouse', 'verifier', 'lender'] as const;

export interface InventoryActor {
  id: string;
  workspaceId: string;
  role: typeof inventoryRoles[number];
  stellarAccount?: string;
  walletAddress?: string;
}

export function hashCredential(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class InventoryActors {
  private readonly keys = new Map<string, InventoryActor>();
  private readonly wallets = new Map<string, InventoryActor>();

  constructor(config: ConfigService) {
    const entries: Array<InventoryActor & { tokenHash?: string }> = JSON.parse(config.get<string>('INVENTORY_ACTORS_JSON') || '[]');
    if (!Array.isArray(entries)) throw new Error('Invalid inventory actor configuration');

    const ids = new Set<string>();
    for (const entry of entries) {
      const { id, workspaceId, role, tokenHash, stellarAccount, walletAddress } = entry;
      const wallet = walletAddress ?? stellarAccount;
      if (typeof id !== 'string' || !id.trim() || /[\r\n]/.test(id)
        || typeof workspaceId !== 'string' || !workspaceId.trim() || /[\r\n]/.test(workspaceId)
        || !inventoryRoles.includes(role) || ids.has(id)
        || (tokenHash !== undefined && (typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(tokenHash) || this.keys.has(tokenHash)))
        || (stellarAccount !== undefined && (role !== 'verifier' || typeof stellarAccount !== 'string' || stellarAccount !== wallet))
        || (wallet !== undefined && (typeof wallet !== 'string' || !stellarPublicKey(wallet) || this.wallets.has(wallet)))
        || (!tokenHash && !wallet)) {
        throw new Error('Invalid or duplicate inventory actor configuration');
      }
      const actor = { id, workspaceId, role, walletAddress: wallet, stellarAccount: role === 'verifier' ? wallet : undefined };
      ids.add(id);
      if (tokenHash) this.keys.set(tokenHash, actor);
      if (wallet) this.wallets.set(wallet, actor);
    }
  }

  byKey(key: string) {
    return this.keys.get(hashCredential(key));
  }

  byWallet(address: string) {
    return this.wallets.get(address);
  }
}
