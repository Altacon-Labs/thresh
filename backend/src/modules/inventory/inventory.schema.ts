import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { categories, InventoryCategory } from './inventory-category';

@Schema({ _id: false })
export class InventoryReview {
  @Prop({ type: String, required: true, enum: ['verified', 'rejected', 'revoked'] })
  decision: 'verified' | 'rejected' | 'revoked';

  @Prop({ required: true })
  actorId: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ required: true })
  inspectionEvidenceId: string;

  @Prop({ required: true })
  inspectedAt: Date;

  @Prop({ required: true })
  recordedAt: Date;

  @Prop()
  stellarNonce?: string;

  @Prop()
  stellarTransactionHash?: string;
}

@Schema({ _id: false })
export class InventoryValuation {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  market: string;

  @Prop({ required: true })
  observedOn: string;

  @Prop()
  priceKoboPerKg?: number;

  @Prop()
  priceKoboPerUnit?: number;

  @Prop({ required: true })
  estimatedValueKobo: number;

  @Prop()
  approvedValueKobo?: number;

  @Prop({ required: true })
  actorId: string;

  @Prop({ required: true })
  recordedAt: Date;
}

@Schema({ timestamps: true })
export class InventoryLot {
  @Prop({ required: true })
  workspaceId: string;

  @Prop({ required: true })
  warehouseActorId: string;

  @Prop({ required: true })
  receiptNumber: string;

  @Prop({ type: String, enum: [...categories] })
  category?: InventoryCategory;

  @Prop({ type: String, enum: ['maize'] })
  commodity?: 'maize';

  @Prop()
  quantityKg?: number;

  @Prop()
  quantity?: number;

  @Prop()
  assetName?: string;

  @Prop()
  assetIdentifier?: string;

  @Prop({ required: true })
  grade: string;

  @Prop({ required: true })
  receiptEvidenceId: string;

  @Prop({ type: String, required: true, enum: ['pending', 'verified', 'rejected', 'revoked'], default: 'pending' })
  status: 'pending' | 'verified' | 'rejected' | 'revoked';

  @Prop()
  verificationExpiresAt?: Date;

  @Prop({ type: [SchemaFactory.createForClass(InventoryReview)], default: [] })
  reviews: InventoryReview[];

  @Prop({ type: [SchemaFactory.createForClass(InventoryValuation)], default: [] })
  valuations: InventoryValuation[];
}

export type InventoryLotDocument = HydratedDocument<InventoryLot>;
export const InventoryLotSchema = SchemaFactory.createForClass(InventoryLot);
InventoryLotSchema.index({ workspaceId: 1, receiptNumber: 1 }, { unique: true });
InventoryLotSchema.index(
  { workspaceId: 1, assetIdentifier: 1 },
  { unique: true, partialFilterExpression: { category: 'equipment' } },
);
