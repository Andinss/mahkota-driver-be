import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { LatePaymentsService } from './late-payments.service';
import { ApproveRejectDto } from './dto/approve-reject.dto';
import { CreateLatePaymentDto } from './dto/create-late-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('late-payments')
export class LatePaymentsController {
  constructor(private readonly latePaymentsService: LatePaymentsService) {}

  @Post('create')
  @Permissions('finance.create')
  create(@Body() dto: CreateLatePaymentDto) {
    return this.latePaymentsService.create(dto);
  }

  @Get()
  @Permissions('finance.read')
  findAll() {
    return this.latePaymentsService.findAll();
  }

  @Get('stats')
  @Permissions('finance.read')
  getStats() {
    return this.latePaymentsService.getStats();
  }

  @Get(':id')
  @Permissions('finance.read')
  findOne(@Param('id') id: string) {
    return this.latePaymentsService.findById(id);
  }

  @Post(':id/approve')
  @Permissions('finance.approve')
  approve(@Param('id') id: string, @Body() dto: ApproveRejectDto) {
    return this.latePaymentsService.approve(id, dto.admin_note);
  }

  @Post(':id/reject')
  @Permissions('finance.approve')
  reject(@Param('id') id: string, @Body() dto: ApproveRejectDto) {
    return this.latePaymentsService.reject(id, dto.admin_note);
  }

  @Delete('delete/:id')
  @Permissions('finance.delete')
  delete(@Param('id') id: string) {
    return this.latePaymentsService.delete(id);
  }
}
