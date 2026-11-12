import { IsIn, IsString, Matches } from 'class-validator';
import { inventoryRoles, InventoryActor } from './inventory-actors';

export class WalletChallengeDto {
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/)
  address: string;

  @IsIn(inventoryRoles)
  role: InventoryActor['role'];
}

export class WalletVerifyDto extends WalletChallengeDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  nonce: string;

  @IsString()
  @Matches(/^[A-Za-z0-9+/]{86}==$/)
  signature: string;
}
