import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DailyPaymentsService } from './daily-payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PayDailyPaymentDto } from './dto/pay-daily-payment.dto';

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

  @Patch(':id/status')
  @Permissions('finance.update')
  updateStatus(@Param('id') id: string, @Query('status') status: string) {
    return this.dailyPaymentsService.updateStatus(id, status || 'paid');
  }

  @Get(':id')
  @Permissions('finance.read')
  findMine(@Param('id') id: string, @Req() req: any) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    return this.dailyPaymentsService.getMyDailyPayment(id, driverId);
  }

  @Post(':id/pay')
  @Permissions('finance.create')
  payMine(
    @Param('id') id: string,
    @Body() dto: PayDailyPaymentDto,
    @Req() req: any,
  ) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      throw new BadRequestException('No driver profile linked to this account');
    }
    return this.dailyPaymentsService.payMyDailyPayment(id, dto, driverId);
  }
}
