import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Delete,
  StreamableFile,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { FinancesService } from './finances.service';
import { AddFinanceDto } from './dto/add-finance.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { FinanceExportDto } from './dto/finance-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { extractRequestMeta } from '../audit/audit.utils';

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

  @Get('monthly-summary')
  @Permissions('finance.read')
  getMonthlySummary(@Query('year') year?: string) {
    return this.financesService.getMonthlySummary(year ? Number(year) : undefined);
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

  @Get('detail/:id')
  @Permissions('finance.read')
  findDetail(@Param('id') id: string) {
    return this.financesService.findDetailById(id);
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
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'CREATE_FINANCE',
      target: `finance/${(finance as any)?.id || ''}`,
      details: `Created finance ${addFinanceDto.reference_number}`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
  }

  @Put('update/:id')
  @Permissions('finance.update')
  async update(@Body() updateFinanceDto: Partial<AddFinanceDto>, @Req() req: any) {
    const financeId = req.params.id;
    const meta = extractRequestMeta(req);
    const result = await this.financesService.update(financeId, updateFinanceDto);
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'UPDATE_FINANCE',
      target: `finance/${financeId}`,
      details: `Updated finance ${financeId}`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
  }

  @Delete('delete/:employid')
  @Permissions('finance.delete')
  async delete(@Req() req: any) {
    const financeId = req.params.employid;
    const meta = extractRequestMeta(req);
    const result = await this.financesService.delete(financeId);
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'DELETE_FINANCE',
      target: `finance/${financeId}`,
      details: `Deleted finance ${financeId}`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
  }
}
