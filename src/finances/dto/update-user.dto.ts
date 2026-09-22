import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateFinanceDto {
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @IsOptional()
  @IsString()
  reference_number?: string;

  @IsOptional()
  @IsEnum(['cash', 'transfer', 'e-wallet', 'saldo'])
  payment_method?: string;

  @IsOptional()
  @IsString()
  amount_received?: string;

  @IsOptional()
  @IsEnum(['paid', 'unpaid', 'pending'])
  finance_type?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  payer?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;
}
