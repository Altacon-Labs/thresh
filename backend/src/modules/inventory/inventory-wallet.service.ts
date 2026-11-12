import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { hashCredential, InventoryActor, InventoryActors } from './inventory-actors';
import { WalletChallengeDto, WalletVerifyDto } from './inventory-wallet.dto';
import { WalletChallenge, WalletSession } from './inventory-wallet.schema';
import { verifyStellarSignature } from './stellar-signature';

const challengeLifetimeMs = 5 * 60 * 1000;
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const roleNames = { warehouse: 'Asset operator', verifier: 'Verifier', lender: 'Lender' } as const;

@Injectable()
export class InventoryWalletService {
  private readonly origin?: string;

  constructor(
    config: ConfigService,
    private readonly actors: InventoryActors,
    @InjectModel(WalletChallenge.name) private readonly challenges: Model<WalletChallenge>,
    @InjectModel(WalletSession.name) private readonly sessions: Model<WalletSession>,
  ) {
    const configured = config.get<string>('THRESH_APP_ORIGIN')?.trim();
    if (configured) {
      const url = new URL(configured);
      const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (configured !== url.origin || (url.protocol !== 'https:' && !localHttp)) {
        throw new Error('THRESH_APP_ORIGIN must be an HTTPS origin or an HTTP localhost origin without a path');
      }
      this.origin = url.origin;
    }
  }

  async challenge(origin: string | undefined, dto: WalletChallengeDto) {
    this.requireOrigin(origin);
    const actor = this.requireActor(dto);
    const now = new Date();
    const active = { _id: dto.address, expiresAt: { $gt: now } };
    let challenge = await this.challenges.findOne(active).lean().exec();
    if (!challenge) {
      try {
        challenge = await this.challenges.findOneAndUpdate(
          { _id: dto.address, expiresAt: { $lte: now } },
          { $set: { nonce: randomBytes(32).toString('hex'), expiresAt: new Date(now.getTime() + challengeLifetimeMs) } },
          { upsert: true, new: true },
        ).lean().exec();
      } catch (error) {
        if (error?.code !== 11000) throw error;
        challenge = await this.challenges.findOne(active).lean().exec();
      }
    }
    if (!challenge) throw new ConflictException('Could not prepare a wallet challenge. Try again.');
    return { nonce: challenge.nonce, message: this.message(actor, challenge) };
  }

  async authenticate(origin: string | undefined, dto: WalletVerifyDto) {
    this.requireOrigin(origin);
    const actor = this.requireActor(dto);
    const filter = { _id: dto.address, nonce: dto.nonce, expiresAt: { $gt: new Date() } };
    const challenge = await this.challenges.findOne(filter).lean().exec();
    if (!challenge || !verifyStellarSignature(dto.address, this.message(actor, challenge), dto.signature)) {
      throw new UnauthorizedException('The wallet signature is invalid or the sign-in request expired. Try again.');
    }

    const consumed = await this.challenges.deleteOne({ ...filter, expiresAt: { $gt: new Date() } }).exec();
    if (consumed.deletedCount !== 1) throw new UnauthorizedException('This wallet challenge was already used or expired.');

    const token = `wallet_${randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    await this.sessions.create({
      _id: hashCredential(token), address: dto.address, actorId: actor.id,
      workspaceId: actor.workspaceId, role: actor.role, expiresAt,
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async sessionActor(token: string) {
    const session = await this.sessions.findOne({ _id: hashCredential(token), expiresAt: { $gt: new Date() } }).lean().exec();
    const actor = session && this.actors.byWallet(session.address);
    return actor && actor.id === session.actorId && actor.workspaceId === session.workspaceId
      && actor.role === session.role ? actor : undefined;
  }

  async signOut(origin: string | undefined, authorization?: string) {
    this.requireOrigin(origin);
    const token = authorization?.match(/^Bearer (wallet_[a-f0-9]{64})$/)?.[1];
    if (token) await this.sessions.deleteOne({ _id: hashCredential(token) }).exec();
  }

  private requireOrigin(origin?: string) {
    if (!this.origin) throw new ServiceUnavailableException('Wallet sign-in is unavailable for this workspace. Use your access key.');
    if (origin !== this.origin) throw new ForbiddenException('Wallet sign-in is unavailable from this site.');
  }

  private requireActor(dto: WalletChallengeDto): InventoryActor {
    const actor = this.actors.byWallet(dto.address);
    if (!actor || actor.role !== dto.role) {
      throw new ForbiddenException('This wallet is not linked to the selected role. Ask your workspace administrator.');
    }
    return actor;
  }

  private message(actor: InventoryActor, challenge: WalletChallenge) {
    return [
      'Sign in to Thresh', `Site: ${this.origin}`, `Wallet: ${actor.walletAddress}`,
      `Workspace: ${actor.workspaceId}`, `Role: ${roleNames[actor.role]}`,
      `Nonce: ${challenge.nonce}`, `Expires: ${challenge.expiresAt.toISOString()}`,
    ].join('\n');
  }
}
