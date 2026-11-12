import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { inventoryRoles, InventoryActor } from './inventory-actors';

@Schema()
export class WalletChallenge {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  nonce: string;

  @Prop({ required: true })
  expiresAt: Date;
}

@Schema()
export class WalletSession {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  actorId: string;

  @Prop({ required: true })
  workspaceId: string;

  @Prop({ type: String, enum: [...inventoryRoles], required: true })
  role: InventoryActor['role'];

  @Prop({ required: true })
  expiresAt: Date;
}

export const WalletChallengeSchema = SchemaFactory.createForClass(WalletChallenge);
export const WalletSessionSchema = SchemaFactory.createForClass(WalletSession);
WalletChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
WalletSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
