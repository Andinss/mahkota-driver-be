import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { SaldoService } from './saldo.service';
import { TopUpSaldoDto } from './dto/top-up-saldo.dto';
import { DeductSaldoDto } from './dto/deduct-saldo.dto';
import { RefundSaldoDto } from './dto/refund-saldo.dto';
import { SaldoQueryDto } from './dto/saldo-query.dto';

@Controller('saldo')
export class SaldoController {
  constructor(private readonly saldoService: SaldoService) {}

  @Get('summary')
  getSaldoSummary() {
    return this.saldoService.getSaldoSummary();
  }

  @Get('driver/:driverId')
  getBalance(@Param('driverId') driverId: string) {
    return this.saldoService.getBalance(driverId);
  }

  @Post('top-up')
  topUp(@Body() dto: TopUpSaldoDto) {
    return this.saldoService.topUp(dto);
  }

  @Post('deduct')
  deduct(@Body() dto: DeductSaldoDto) {
    return this.saldoService.deduct(dto);
  }

  @Patch('refund')
  refund(@Body() dto: RefundSaldoDto) {
    return this.saldoService.refund(dto);
  }

  @Get('transactions/:driverId')
  getTransactions(
    @Param('driverId') driverId: string,
    @Query() query: SaldoQueryDto,
  ) {
    return this.saldoService.getTransactions(driverId, query);
  }
}
