import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Delete,
  Param,
} from '@nestjs/common';

import { FinancesService } from './finances.service';
import { AddFinanceDto } from './dto/add-finance.dto';

@Controller('finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  @Get()
  findAll() {
    return this.financesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.financesService.findById(id);
  }

  @Post('create')
  create(@Body() addFinanceDto: AddFinanceDto) {
    return this.financesService.create(addFinanceDto);
  }

  @Put('update/:id')
  update(@Body() updateFinanceDto: Partial<AddFinanceDto>, @Req() req: any) {
    const financeId = req.params.id;
    return this.financesService.update(financeId, updateFinanceDto);
  }

  @Delete('delete/:employid')
  delete(@Req() req: any) {
    const financeId = req.params.employid;
    return this.financesService.delete(financeId);
  }
}