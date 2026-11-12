import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { InventoryActor, InventoryActors } from './inventory-actors';
import { InventoryWalletService } from './inventory-wallet.service';

export type { InventoryActor } from './inventory-actors';

export interface InventoryRequest extends Request {
  inventoryActor: InventoryActor;
}

@Injectable()
export class InventoryGuard implements CanActivate {
  constructor(private readonly actors: InventoryActors, private readonly wallet: InventoryWalletService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<InventoryRequest>();
    const authorization = request.headers.authorization ?? '';
    const key = authorization.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
    const token = authorization.match(/^Bearer (wallet_[a-f0-9]{64})$/)?.[1];
    const actor = key ? this.actors.byKey(key) : token ? await this.wallet.sessionActor(token) : undefined;
    if (!actor) throw new UnauthorizedException('Sign in with a valid workspace key or Stellar wallet.');

    request.inventoryActor = actor;
    return true;
  }
}
