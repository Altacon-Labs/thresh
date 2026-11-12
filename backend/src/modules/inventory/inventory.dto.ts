import { Equals, IsIn, IsISO8601, IsInt, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { categories, custodyTypes, CustodyType, InventoryCategory } from './inventory-category';

export class RegisterLotDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9./_-]{0,79}$/)
  receiptNumber: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(categories)
  category?: InventoryCategory;

  @ValidateIf((dto, value) => dto.category === undefined || value !== undefined)
  @Equals('maize')
  commodity?: 'maize';

  @ValidateIf((dto, value) => dto.category === undefined || value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantityKg?: number;

  @ValidateIf((dto, value) => dto.category !== undefined || value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity?: number;

  @ValidateIf((dto, value) => (dto.category !== undefined && dto.category !== 'maize') || value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  assetName?: string;

  @ValidateIf((dto, value) => (dto.category !== undefined && dto.category !== 'maize') || value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  assetIdentifier?: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(80)
  grade: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/)
  receiptEvidenceId: string;

  @ValidateIf((dto, value) => dto.custodyLocation !== undefined || value !== undefined)
  @IsIn(custodyTypes)
  custodyType?: CustodyType;

  @ValidateIf((dto, value) => dto.custodyType !== undefined || value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  custodyLocation?: string;
}

export class ReviewLotDto {
  @IsIn(['verified', 'rejected', 'revoked'])
  decision: 'verified' | 'rejected' | 'revoked';

  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  reason: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/)
  inspectionEvidenceId: string;

  @IsISO8601({ strict: true })
  @Matches(/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/)
  inspectedAt: string;
}

export class RecordStellarProofDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  transactionHash: string;
}

export class RecordValuationDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  source: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  market: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  observedOn: string;

  @ValidateIf((dto, value) => dto.priceKoboPerUnit === undefined || value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  priceKoboPerKg?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  priceKoboPerUnit?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  approvedValueKobo?: number;
}
