import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';

import { FinancesService } from './finances.service';
import { AddFinanceDto } from './dto/add-finance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  @Get()
  @Permissions('finance.read')
  findAll() {
    return this.financesService.findAll();
  }

  @Get(':id')
  @Permissions('finance.read')
  findOne(@Param('id') id: string) {
    return this.financesService.findById(id);
  }

  @Post('create')
  @Permissions('finance.create')
  create(@Body() addFinanceDto: AddFinanceDto) {
    return this.financesService.create(addFinanceDto);
  }

  @Put('update/:id')
  @Permissions('finance.update')
  update(@Body() updateFinanceDto: Partial<AddFinanceDto>, @Req() req: any) {
    const financeId = req.params.id;
    return this.financesService.update(financeId, updateFinanceDto);
  }

  @Delete('delete/:employid')
  @Permissions('finance.delete')
  delete(@Req() req: any) {
    const financeId = req.params.employid;
    return this.financesService.delete(financeId);
  }
}