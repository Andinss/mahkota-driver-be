import { IsOptional, IsString, IsIn } from 'class-validator';

export class FinanceExportDto {
  @IsOptional()
  @IsString()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  columns?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin_join', 'membership_fee', 'additional_charge'])
  fee_kind?: string;

  @IsOptional()
  @IsString()
  @IsIn(['additional_charge'])
  exclude_fee_kind?: string;
}
