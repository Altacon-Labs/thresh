import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Request } from 'express';

const roles = ['warehouse', 'verifier', 'lender'] as const;

export interface InventoryActor {
  id: string;
  workspaceId: string;
  role: typeof roles[number];
  stellarAccount?: string;
}

export interface InventoryRequest extends Request {
  inventoryActor: InventoryActor;
}

@Injectable()
export class InventoryGuard implements CanActivate {
  private readonly actors = new Map<string, InventoryActor>();

  constructor(config: ConfigService) {
    const configured = config.get<string>('INVENTORY_ACTORS_JSON');
    if (!configured) return;

    const entries: Array<InventoryActor & { tokenHash: string }> = JSON.parse(configured);
    if (!Array.isArray(entries)) throw new Error('Invalid inventory actor configuration');

    const ids = new Set<string>();
    const warehouses = new Set<string>();
    for (const { id, workspaceId, role, tokenHash, stellarAccount } of entries) {
      if (typeof id !== 'string' || !id.trim() || typeof workspaceId !== 'string' || !workspaceId.trim()
        || !roles.includes(role) || typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(tokenHash)
        || ids.has(id) || this.actors.has(tokenHash) || (role === 'warehouse' && warehouses.has(workspaceId))
        || (stellarAccount !== undefined && (
          role !== 'verifier' || typeof stellarAccount !== 'string' || !/^G[A-Z2-7]{55}$/.test(stellarAccount)
        ))) {
        throw new Error('Invalid or duplicate inventory actor configuration');
      }
      ids.add(id);
      if (role === 'warehouse') warehouses.add(workspaceId);
      this.actors.set(tokenHash, { id, workspaceId, role, stellarAccount });
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InventoryRequest>();
    const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
    const actor = token && this.actors.get(createHash('sha256').update(token).digest('hex'));
    if (!actor) throw new UnauthorizedException('A valid inventory access key is required');

    request.inventoryActor = actor;
    return true;
  }
}
