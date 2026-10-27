import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DailyPaymentsService } from './daily-payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PayDailyPaymentDto } from './dto/pay-daily-payment.dto';
import { DailyPaymentExportDto } from './dto/daily-payment-export.dto';
import { proofImageUpload } from '../common/proof-upload.util';
import { ProofCleanupInterceptor } from '../common/proof-cleanup.interceptor';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('daily-payments')
export class DailyPaymentsController {
  constructor(private readonly dailyPaymentsService: DailyPaymentsService) {}

  @Get()
  @Permissions('finance.read')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.dailyPaymentsService.getDailyPayments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      search,
      status,
    });
  }

  @Get('my-daily-payments')
  @Permissions('finance.read')
  findMyDailyPayments(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
      };
    }
    return this.dailyPaymentsService.getMyDailyPayments(driverId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('my-daily-payments/export')
  @Permissions('finance.read')
  async exportMyDailyPayments(
    @Req() req: any,
    @Query() query: DailyPaymentExportDto,
  ) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      throw new BadRequestException('No driver profile linked to this account');
    }
    const result = await this.dailyPaymentsService.exportMyDailyPayments(
      driverId,
      query,
    );
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  /**
   * Export daily payments (mode admin — semua driver).
   */
  @Get('export')
  @Permissions('finance.read')
  async exportDailyPayments(@Query() query: DailyPaymentExportDto) {
    const result = await this.dailyPaymentsService.exportDailyPayments(
      null,
      query,
    );
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Patch(':id/status')
  @Permissions('finance.update')
  updateStatus(
    @Param('id') id: string,
    @Query('status') status: string,
    @Query('reason') reason?: string,
  ) {
    return this.dailyPaymentsService.updateStatus(id, status || 'paid', reason);
  }

  @Get(':id')
  @Permissions('finance.read')
  findMine(@Param('id') id: string, @Req() req: any) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    return this.dailyPaymentsService.getMyDailyPayment(id, driverId);
  }

  @Post(':id/pay')
  @Permissions('finance.create')
  @UseInterceptors(
    FileInterceptor('proof_image', proofImageUpload),
    new ProofCleanupInterceptor(),
  )
  payMine(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PayDailyPaymentDto,
    @Req()
    req: {
      user?: { driver?: { id?: string }; driver_id?: string };
    },
  ) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      throw new BadRequestException('No driver profile linked to this account');
    }
    return this.dailyPaymentsService.payMyDailyPayment(id, dto, driverId, file);
  }
}
