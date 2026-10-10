import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Delete,
  Patch,
  StreamableFile,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { FinancesService } from './finances.service';
import { AddFinanceDto } from './dto/add-finance.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { FinanceExportDto } from './dto/finance-export.dto';
import { CreateFinancePaymentDto } from './dto/create-finance-payment.dto';
import { UpdateFinancePaymentDto } from './dto/update-finance-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { extractRequestMeta } from '../audit/audit.utils';
import { proofImageUpload } from '../common/proof-upload.util';
import { ProofCleanupInterceptor } from '../common/proof-cleanup.interceptor';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('finances')
export class FinancesController {
  constructor(
    private readonly financesService: FinancesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Permissions('finance.read')
  findAll(@Query() query: FinanceQueryDto) {
    return this.financesService.findAll(query);
  }

  @Get('my-finances')
  @Permissions('finance.read')
  findMyFinances(@Req() req: any, @Query() query: FinanceQueryDto) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return {
        success: true,
        message: 'No driver profile linked to this account',
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
    }
    return this.financesService.findMyFinances(driverId, query);
  }

  @Get('my-admin-fee')
  @Permissions('finance.read')
  findMyAdminFee(@Req() req: any) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return { success: true, data: null };
    }
    return this.financesService.getMyAdminFee(driverId);
  }

  @Get('monthly-summary')
  @Permissions('finance.read')
  getMonthlySummary(@Query('year') year?: string) {
    return this.financesService.getMonthlySummary(
      year ? Number(year) : undefined,
    );
  }

  @Get('export')
  @Permissions('finance.read')
  async export(@Query() query: FinanceExportDto) {
    const result = await this.financesService.exportData(query);
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get('summary')
  @Permissions('finance.read')
  getSummary() {
    return this.financesService.getSummary();
  }

  @Get('admin-fees')
  @Permissions('finance.read')
  getAdminFees(@Query() query: FinanceQueryDto) {
    return this.financesService.getAdminFees(query);
  }

  @Get('driver/:driverId/summary')
  @Permissions('finance.read')
  getDriverSummary(@Param('driverId') driverId: string) {
    return this.financesService.getDriverSummary(driverId);
  }

  @Get('detail/:id')
  @Permissions('finance.read')
  findDetail(@Param('id') id: string) {
    return this.financesService.findDetailById(id);
  }

  @Get(':id/payments')
  @Permissions('finance.read')
  listPayments(@Param('id') id: string) {
    return this.financesService.listPayments(id);
  }

  @Post(':id/payments')
  @Permissions('finance.create')
  async createPayment(
    @Param('id') id: string,
    @Body() dto: CreateFinancePaymentDto,
    @Req() req: any,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.financesService.createPayment(id, dto);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'CREATE_FINANCE_PAYMENT',
        target: `finance/${id}`,
        details: `Recorded payment Rp ${dto.amount} for finance ${id}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Post('my-finances/:id/payments')
  @Permissions('finance.create')
  @UseInterceptors(
    FileInterceptor('proof_image', proofImageUpload),
    new ProofCleanupInterceptor(),
  )
  async createMyPayment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateFinancePaymentDto,
    @Req() req: any,
  ) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      throw new BadRequestException('No driver profile linked to this account');
    }
    const meta = extractRequestMeta(req);
    const result = await this.financesService.createPaymentForDriver(
      id,
      dto,
      driverId,
      file,
    );
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'CREATE_DRIVER_PAYMENT',
        target: `finance/${id}`,
        details: `Driver recorded payment Rp ${dto.amount} for finance ${id}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Patch(':financeId/payments/:paymentId')
  @Permissions('finance.update')
  async updatePaymentStatus(
    @Param('financeId') financeId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: UpdateFinancePaymentDto,
    @Req() req: any,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.financesService.updatePaymentStatus(
      financeId,
      paymentId,
      dto,
    );
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'VERIFY_FINANCE_PAYMENT',
        target: `finance/${financeId}/payments/${paymentId}`,
        details: `Updated payment status to ${dto.status}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Patch(':id/cancel')
  @Permissions('finance.update')
  async cancel(@Param('id') id: string, @Req() req: any) {
    const meta = extractRequestMeta(req);
    const result = await this.financesService.cancel(id);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'CANCEL_FINANCE',
        target: `finance/${id}`,
        details: `Cancelled finance ${id}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Get(':id')
  @Permissions('finance.read')
  findOne(@Param('id') id: string) {
    return this.financesService.findById(id);
  }

  @Post('create')
  @Permissions('finance.create')
  async create(@Body() addFinanceDto: AddFinanceDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    const result = await this.financesService.create(addFinanceDto);
    const finance = result?.data || result;
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'CREATE_FINANCE',
        target: `finance/${(finance as any)?.id || ''}`,
        details: `Created finance ${addFinanceDto.reference_number}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Put('update/:id')
  @Permissions('finance.update')
  async update(
    @Body() updateFinanceDto: Partial<AddFinanceDto>,
    @Req() req: any,
  ) {
    const financeId = req.params.id;
    const meta = extractRequestMeta(req);
    const result = await this.financesService.update(
      financeId,
      updateFinanceDto,
    );
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'UPDATE_FINANCE',
        target: `finance/${financeId}`,
        details: `Updated finance ${financeId}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Delete('delete/:employid')
  @Permissions('finance.delete')
  async delete(@Req() req: any) {
    const financeId = req.params.employid;
    const meta = extractRequestMeta(req);
    const result = await this.financesService.delete(financeId);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'DELETE_FINANCE',
        target: `finance/${financeId}`,
        details: `Deleted finance ${financeId}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }
}
