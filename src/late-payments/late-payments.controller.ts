import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { LatePaymentsService } from './late-payments.service';
import { ApproveRejectDto } from './dto/approve-reject.dto';
import { CreateLatePaymentDto } from './dto/create-late-payment.dto';
import { CreateMyLatePaymentDto } from './dto/create-my-late-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

interface AuthedRequest {
  user?: { driver?: { id?: string }; driver_id?: string };
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('late-payments')
export class LatePaymentsController {
  constructor(private readonly latePaymentsService: LatePaymentsService) {}

  @Post('create')
  @Permissions('finance.create')
  create(@Body() dto: CreateLatePaymentDto) {
    return this.latePaymentsService.create(dto);
  }

  /** Pengajuan izin telat bayar oleh driver (per tagihan harian). */
  @Post('my')
  @Permissions('finance.create')
  createMine(@Body() dto: CreateMyLatePaymentDto, @Req() req: AuthedRequest) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      throw new BadRequestException('No driver profile linked to this account');
    }
    return this.latePaymentsService.createForDriver(dto, driverId);
  }

  @Get()
  @Permissions('late_payment.read')
  findAll() {
    return this.latePaymentsService.findAll();
  }

  @Get('stats')
  @Permissions('late_payment.read')
  getStats() {
    return this.latePaymentsService.getStats();
  }

  /** Daftar izin telat milik driver yang login. */
  @Get('my')
  @Permissions('finance.read')
  listMine(@Req() req: AuthedRequest) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return { success: true, message: 'No driver', data: [] };
    }
    return this.latePaymentsService.listMine(driverId);
  }

  /** Ringkasan keterlambatan (dasar limit hutang, izin approved dikecualikan). */
  @Get('my-late-summary')
  @Permissions('finance.read')
  myLateSummary(@Req() req: AuthedRequest) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return {
        success: true,
        message: 'No driver',
        data: null,
      };
    }
    return this.latePaymentsService.getLateSummary(driverId);
  }

  /** Daftar pengajuan izin untuk halaman persetujuan. */
  @Get('requests')
  @Permissions('late_payment.read')
  listRequests(@Query('status') status?: string) {
    return this.latePaymentsService.listRequests(status);
  }

  @Get(':id')
  @Permissions('late_payment.read')
  findOne(@Param('id') id: string) {
    return this.latePaymentsService.findById(id);
  }

  @Post(':id/approve')
  @Permissions('late_payment.approve')
  approve(@Param('id') id: string, @Body() dto: ApproveRejectDto) {
    return this.latePaymentsService.approve(id, dto.admin_note);
  }

  @Post(':id/reject')
  @Permissions('late_payment.approve')
  reject(@Param('id') id: string, @Body() dto: ApproveRejectDto) {
    return this.latePaymentsService.reject(id, dto.admin_note);
  }

  @Delete('delete/:id')
  @Permissions('finance.delete')
  delete(@Param('id') id: string) {
    return this.latePaymentsService.delete(id);
  }
}
