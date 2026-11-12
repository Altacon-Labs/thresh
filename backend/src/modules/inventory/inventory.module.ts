import { Body, Controller, Get, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordStellarProofDto, RecordValuationDto, RegisterLotDto, ReviewLotDto } from './inventory.dto';
import { InventoryGuard, InventoryRequest } from './inventory.guard';
import { InventoryLot, InventoryLotSchema } from './inventory.schema';
import { InventoryService } from './inventory.service';

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
  imports: [MongooseModule.forFeature([{ name: InventoryLot.name, schema: InventoryLotSchema }])],
  controllers: [InventoryController],
  providers: [InventoryGuard, InventoryService],
})
export class InventoryModule {}
