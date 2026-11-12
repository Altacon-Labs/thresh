import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { createHash, randomBytes } from 'node:crypto';
import { isObjectIdOrHexString, Model } from 'mongoose';
import { inventoryUnit } from './inventory-category';
import { RecordValuationDto, RegisterLotDto, ReviewLotDto } from './inventory.dto';
import { InventoryActor } from './inventory.guard';
import { InventoryLot, InventoryLotDocument } from './inventory.schema';

const inspectionValidityMs = 30 * 24 * 60 * 60 * 1000;
const stellarHorizon = 'https://horizon-testnet.stellar.org';
const stellarDataName = 'versei.inspection.v1';

@Injectable()
export class InventoryService {
  constructor(@InjectModel(InventoryLot.name) private readonly lots: Model<InventoryLot>) {}

  async list(actor: InventoryActor) {
    const lots = await this.lots.find({ workspaceId: actor.workspaceId }).sort({ createdAt: -1 }).exec();
    return lots.map((lot) => this.present(lot));
  }

  async register(actor: InventoryActor, dto: RegisterLotDto) {
    if (actor.role !== 'warehouse') throw new ForbiddenException('Asset operator access is required');

    const category = dto.category ?? 'maize';
    const quantity = dto.category === undefined ? dto.quantityKg : dto.quantity;
    if (dto.category === undefined ? dto.quantity !== undefined : dto.quantityKg !== undefined || dto.commodity !== undefined) {
      throw new BadRequestException('Use one inventory registration format');
    }
    if (category === 'maize' && (dto.assetName !== undefined || dto.assetIdentifier !== undefined)) {
      throw new BadRequestException('Use the receipt number to identify maize lots');
    }
    if (category === 'equipment' && quantity !== 1) {
      throw new BadRequestException('Register one equipment item per serial number');
    }

    try {
      await this.lots.init();
      const lot = await this.lots.create({
        ...(category === 'maize'
          ? { commodity: 'maize', quantityKg: quantity }
          : {
            category, quantity, assetName: dto.assetName.trim(),
            assetIdentifier: category === 'equipment'
              ? dto.assetIdentifier.trim().toUpperCase() : dto.assetIdentifier.trim(),
          }),
        receiptEvidenceId: dto.receiptEvidenceId,
        custodyType: dto.custodyType,
        custodyLocation: dto.custodyLocation?.trim(),
        workspaceId: actor.workspaceId,
        warehouseActorId: actor.id,
        receiptNumber: dto.receiptNumber.toUpperCase(),
        grade: dto.grade.trim(),
      });
      return this.present(lot);
    } catch (error) {
      if (error?.code === 11000 && error.keyPattern?.assetIdentifier) {
        throw new ConflictException('This equipment serial number is already registered');
      }
      if (error?.code === 11000) throw new ConflictException('This asset reference is already registered');
      throw error;
    }
  }

  async review(actor: InventoryActor, id: string, dto: ReviewLotDto) {
    if (actor.role !== 'verifier') throw new ForbiddenException('Verifier access is required');
    if (!isObjectIdOrHexString(id)) throw new NotFoundException('Inventory lot not found');

    const now = new Date();
    const inspectedAt = new Date(dto.inspectedAt);
    if (!Number.isFinite(inspectedAt.getTime()) || inspectedAt > now) {
      throw new BadRequestException('Inspection time must be in the past');
    }

    const expiresAt = new Date(inspectedAt.getTime() + inspectionValidityMs);
    if (dto.decision === 'verified' && expiresAt <= now) {
      throw new BadRequestException('Verification requires an inspection from the last 30 days');
    }

    const scope = { _id: id, workspaceId: actor.workspaceId };
    const update = {
      $set: {
        status: dto.decision,
        ...(dto.decision === 'verified' ? { verificationExpiresAt: expiresAt } : {}),
      },
      $push: {
        reviews: {
          decision: dto.decision,
          actorId: actor.id,
          reason: dto.reason.trim(),
          inspectionEvidenceId: dto.inspectionEvidenceId,
          inspectedAt,
          recordedAt: now,
          ...(dto.decision === 'verified' ? { stellarNonce: randomBytes(32).toString('hex') } : {}),
        },
      },
    };

    const allowedTransitions = {
      verified: { $or: [
        { status: 'pending' },
        { status: 'verified', verificationExpiresAt: { $lte: now } },
      ] },
      rejected: { status: 'pending' },
      revoked: { status: 'verified' },
    };
    const lot = await this.lots.findOneAndUpdate(
      { ...scope, ...allowedTransitions[dto.decision], warehouseActorId: { $ne: actor.id } },
      update,
      { new: true, runValidators: true },
    ).exec();

    if (lot) return this.present(lot);
    if (!(await this.lots.exists(scope))) throw new NotFoundException('Inventory lot not found');
    throw new ConflictException('This lot is no longer available for that review');
  }

  async prepareStellarProof(actor: InventoryActor, id: string) {
    return (await this.stellarProofContext(actor, id)).proof;
  }

  async recordValuation(actor: InventoryActor, id: string, dto: RecordValuationDto) {
    if (actor.role !== 'lender') throw new ForbiddenException('Lender access is required');
    if (!isObjectIdOrHexString(id)) throw new NotFoundException('Inventory lot not found');

    const now = new Date();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Lagos' }).format(now);
    if (dto.observedOn > today) throw new BadRequestException('The reference price date cannot be in the future');

    const scope = { _id: id, workspaceId: actor.workspaceId };
    const lot = await this.lots.findOne(scope).exec();
    if (!lot) throw new NotFoundException('Inventory lot not found');

    const source = dto.source.trim();
    const market = dto.market.trim();
    const category = lot.category ?? 'maize';
    if (dto.priceKoboPerKg !== undefined && (category !== 'maize' || dto.priceKoboPerUnit !== undefined)) {
      throw new BadRequestException('Use a price for the asset’s valuation unit');
    }
    const priceKoboPerUnit = dto.priceKoboPerUnit ?? dto.priceKoboPerKg;
    const quantity = lot.quantity ?? lot.quantityKg;
    const estimatedValueKobo = priceKoboPerUnit * quantity;
    if (!Number.isSafeInteger(estimatedValueKobo)) throw new BadRequestException('Estimated lot value is too large');

    const valuationId = createHash('sha256').update(JSON.stringify([
      actor.id, source, market, dto.observedOn, priceKoboPerUnit, dto.approvedValueKobo,
    ])).digest('hex');
    if (lot.valuations?.some((valuation) => valuation.id === valuationId)) return this.present(lot);

    const updated = await this.lots.findOneAndUpdate(
      { ...scope, status: 'verified', verificationExpiresAt: { $gt: new Date() }, 'valuations.id': { $ne: valuationId } },
      { $push: { valuations: {
        id: valuationId, source, market, observedOn: dto.observedOn, priceKoboPerUnit,
        approvedValueKobo: dto.approvedValueKobo, estimatedValueKobo, actorId: actor.id, recordedAt: now,
      } } },
      { new: true, runValidators: true },
    ).exec();
    if (updated) return this.present(updated);

    const current = await this.lots.findOne(scope).exec();
    if (current?.valuations?.some((valuation) => valuation.id === valuationId)) return this.present(current);
    throw new ConflictException('A current inventory verification is required to record a valuation');
  }

  async recordStellarProof(actor: InventoryActor, id: string, transactionHash: string) {
    const { lot, review, proof } = await this.stellarProofContext(actor, id);
    if (review.stellarTransactionHash === transactionHash) return this.present(lot);
    if (review.stellarTransactionHash) throw new ConflictException('This inspection already has a Stellar proof');

    const url = `${stellarHorizon}/transactions/${transactionHash}`;
    const [transaction, operations] = await Promise.all([
      axios.get(url, { timeout: 8000, maxRedirects: 0 }),
      axios.get(`${url}/operations?limit=2`, { timeout: 8000, maxRedirects: 0 }),
    ]).catch((error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new BadRequestException('Transaction was not found on Stellar Testnet');
      }
      throw new ServiceUnavailableException('Could not check Stellar Testnet. Keep the transaction hash and retry.');
    });

    const records = operations.data?._embedded?.records;
    const operation = records?.[0];
    const expectedValue = Buffer.from(proof.dataValue, 'utf8').toString('base64');
    if (transaction.data?.successful !== true || transaction.data?.source_account !== proof.account
      || transaction.data?.operation_count !== 1 || records?.length !== 1
      || operation?.type !== 'manage_data' || operation.source_account !== proof.account
      || operation.name !== proof.dataName || operation.value !== expectedValue) {
      throw new BadRequestException('Transaction does not match this inspection and verifier account');
    }

    const updated = await this.lots.findOneAndUpdate(
      {
        _id: lot._id,
        workspaceId: actor.workspaceId,
        status: 'verified',
        verificationExpiresAt: { $eq: lot.verificationExpiresAt, $gt: new Date() },
        reviews: { $elemMatch: { stellarNonce: review.stellarNonce, stellarTransactionHash: { $exists: false } } },
      },
      { $set: { 'reviews.$.stellarTransactionHash': transactionHash } },
      { new: true, runValidators: true },
    ).exec();

    if (updated) return this.present(updated);
    const current = await this.stellarProofContext(actor, id);
    if (current.review.stellarTransactionHash === transactionHash) return this.present(current.lot);
    throw new ConflictException('The inspection changed while the Stellar proof was being recorded');
  }

  private async stellarProofContext(actor: InventoryActor, id: string) {
    if (actor.role !== 'verifier' || !actor.stellarAccount) {
      throw new ForbiddenException('A verifier with a configured Stellar Testnet account is required');
    }
    if (!isObjectIdOrHexString(id)) throw new NotFoundException('Inventory lot not found');

    const lot = await this.lots.findOne({ _id: id, workspaceId: actor.workspaceId }).exec();
    if (!lot) throw new NotFoundException('Inventory lot not found');

    const review = lot.reviews[lot.reviews.length - 1];
    if (lot.status !== 'verified' || !lot.verificationExpiresAt
      || lot.verificationExpiresAt.getTime() <= Date.now() || !review?.stellarNonce) {
      throw new ConflictException('A current inspection recorded in the Stellar edition is required');
    }
    if (review.actorId !== actor.id) throw new ForbiddenException('Only the original verifier can anchor this inspection');

    const assetFields = !lot.category || lot.category === 'maize'
      ? [lot.commodity, lot.quantityKg, lot.grade]
      : [lot.category, lot.assetName, lot.assetIdentifier, lot.quantity, inventoryUnit(lot.category), lot.grade];
    const dataValue = createHash('sha256').update(JSON.stringify([
      stellarDataName, lot.id, lot.receiptNumber, ...assetFields,
      lot.receiptEvidenceId, review.inspectionEvidenceId, review.reason, review.inspectedAt.toISOString(),
      review.recordedAt.toISOString(), actor.stellarAccount, review.stellarNonce,
      ...(lot.custodyType ? [lot.custodyType, lot.custodyLocation] : []),
    ])).digest('hex');

    return {
      lot,
      review,
      proof: { account: actor.stellarAccount, dataName: stellarDataName, dataValue },
    };
  }

  private present(lot: InventoryLotDocument) {
    const category = lot.category ?? 'maize';
    const verificationCurrent = lot.status === 'verified'
      && Boolean(lot.verificationExpiresAt && lot.verificationExpiresAt.getTime() > Date.now());

    return {
      id: lot.id as string,
      receiptNumber: lot.receiptNumber,
      receiptEvidenceId: lot.receiptEvidenceId,
      custodyType: lot.custodyType ?? 'warehouse',
      custodyLocation: lot.custodyLocation,
      category,
      assetName: lot.assetName ?? 'Maize',
      assetIdentifier: lot.assetIdentifier,
      quantity: lot.quantity ?? lot.quantityKg,
      unit: inventoryUnit(category),
      commodity: lot.commodity,
      quantityKg: lot.quantityKg,
      grade: lot.grade,
      status: lot.status,
      verificationExpiresAt: lot.verificationExpiresAt,
      verificationCurrent,
      valuations: (lot.valuations ?? []).map((valuation) => {
        const price = valuation.priceKoboPerUnit ?? valuation.priceKoboPerKg;
        return {
          id: valuation.id, source: valuation.source, market: valuation.market, observedOn: valuation.observedOn,
          priceKoboPerUnit: price, ...(category === 'maize' ? { priceKoboPerKg: price } : {}),
          estimatedValueKobo: valuation.estimatedValueKobo, approvedValueKobo: valuation.approvedValueKobo,
          actorId: valuation.actorId, recordedAt: valuation.recordedAt,
        };
      }),
      reviews: lot.reviews.map(({ decision, actorId, reason, inspectionEvidenceId, inspectedAt,
        recordedAt, stellarTransactionHash }) => ({
        decision, actorId, reason, inspectionEvidenceId, inspectedAt, recordedAt, stellarTransactionHash,
      })),
    };
  }
}
