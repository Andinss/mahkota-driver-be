import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { KoinService } from './koin.service';
import { TopUpKoinDto } from './dto/top-up-koin.dto';
import { DeductKoinDto } from './dto/deduct-koin.dto';
import { RefundKoinDto } from './dto/refund-koin.dto';
import { KoinQueryDto } from './dto/koin-query.dto';

@Controller('koin')
export class KoinController {
  constructor(private readonly koinService: KoinService) {}

  @Get('summary')
  getKoinSummary() {
    return this.koinService.getKoinSummary();
  }

  @Get('driver/:driverId')
  getBalance(@Param('driverId') driverId: string) {
    return this.koinService.getBalance(driverId);
  }

  @Post('top-up')
  topUp(@Body() dto: TopUpKoinDto) {
    return this.koinService.topUp(dto);
  }

  @Post('deduct')
  deduct(@Body() dto: DeductKoinDto) {
    return this.koinService.deduct(dto);
  }

  @Patch('refund')
  refund(@Body() dto: RefundKoinDto) {
    return this.koinService.refund(dto);
  }

  @Get('transactions/:driverId')
  getTransactions(
    @Param('driverId') driverId: string,
    @Query() query: KoinQueryDto,
  ) {
    return this.koinService.getTransactions(driverId, query);
  }

  @Get('transactions')
  getAllTransactions(@Query() query: KoinQueryDto) {
    return this.koinService.getAllTransactions(query);
  }
}