import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { KoinService } from './koin.service';
import { TopUpKoinDto } from './dto/top-up-koin.dto';
import { DeductKoinDto } from './dto/deduct-koin.dto';
import { RefundKoinDto } from './dto/refund-koin.dto';
import { KoinQueryDto } from './dto/koin-query.dto';
import { KoinExportDto } from './dto/koin-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  @UseGuards(JwtAuthGuard)
  @Get('export')
  async exportTransactions(@Query() query: KoinExportDto) {
    const result = await this.koinService.exportTransactions(query);
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  /**
   * Riwayat koin milik pengguna yang sedang login (portal driver).
   *
   * Dideklarasikan sebelum `transactions/:driverId` supaya tidak tertelan
   * oleh route param. Hanya dijaga JWT (tanpa permission) karena datanya
   * milik sendiri — role Finance/Supervisor yang tidak punya `koin.read`
   * tidak terdampak.
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-transactions')
  getMyTransactions(
    @Req() req: { user?: { driver?: { id?: string }; driver_id?: string } },
    @Query() query: KoinQueryDto,
  ) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      throw new BadRequestException('No driver profile linked to this account');
    }
    return this.koinService.getTransactions(driverId, query);
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
