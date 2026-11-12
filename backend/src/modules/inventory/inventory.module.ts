import { Body, Controller, Get, Headers, HttpCode, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordStellarProofDto, RecordValuationDto, RegisterLotDto, ReviewLotDto } from './inventory.dto';
import { InventoryGuard, InventoryRequest } from './inventory.guard';
import { InventoryLot, InventoryLotSchema } from './inventory.schema';
import { InventoryService } from './inventory.service';
import { InventoryActors } from './inventory-actors';
import { WalletChallengeDto, WalletVerifyDto } from './inventory-wallet.dto';
import { WalletChallenge, WalletChallengeSchema, WalletSession, WalletSessionSchema } from './inventory-wallet.schema';
import { InventoryWalletService } from './inventory-wallet.service';

@ApiTags('Stellar wallet sign-in')
@Controller('inventory/wallet')
class InventoryWalletController {
  constructor(private readonly wallet: InventoryWalletService) {}

  @Post('challenge')
  @HttpCode(200)
  challenge(@Headers('origin') origin: string | undefined, @Body() dto: WalletChallengeDto) {
    return this.wallet.challenge(origin, dto);
  }

  @Post('verify')
  @HttpCode(200)
  verify(@Headers('origin') origin: string | undefined, @Body() dto: WalletVerifyDto) {
    return this.wallet.authenticate(origin, dto);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Headers('origin') origin: string | undefined, @Headers('authorization') authorization: string | undefined) {
    return this.wallet.signOut(origin, authorization);
  }
}

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(InventoryGuard)
class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('session')
  session(@Req() request: InventoryRequest) {
    return request.inventoryActor;
  }

  @Get('lots')
  list(@Req() request: InventoryRequest) {
    return this.inventory.list(request.inventoryActor);
  }

  @Post('lots')
  register(@Req() request: InventoryRequest, @Body() dto: RegisterLotDto) {
    return this.inventory.register(request.inventoryActor, dto);
  }

  @Post('lots/:id/reviews')
  review(@Req() request: InventoryRequest, @Param('id') id: string, @Body() dto: ReviewLotDto) {
    return this.inventory.review(request.inventoryActor, id, dto);
  }

  @Post('lots/:id/valuations')
  recordValuation(@Req() request: InventoryRequest, @Param('id') id: string, @Body() dto: RecordValuationDto) {
    return this.inventory.recordValuation(request.inventoryActor, id, dto);
  }

  @Get('lots/:id/stellar-proof')
  prepareProof(@Req() request: InventoryRequest, @Param('id') id: string) {
    return this.inventory.prepareStellarProof(request.inventoryActor, id);
  }

  @Post('lots/:id/stellar-proof')
  recordProof(@Req() request: InventoryRequest, @Param('id') id: string, @Body() dto: RecordStellarProofDto) {
    return this.inventory.recordStellarProof(request.inventoryActor, id, dto.transactionHash.toLowerCase());
  }
}

@Module({
  imports: [MongooseModule.forFeature([
    { name: InventoryLot.name, schema: InventoryLotSchema },
    { name: WalletChallenge.name, schema: WalletChallengeSchema },
    { name: WalletSession.name, schema: WalletSessionSchema },
  ])],
  controllers: [InventoryController, InventoryWalletController],
  providers: [InventoryActors, InventoryGuard, InventoryService, InventoryWalletService],
})
export class InventoryModule {}
