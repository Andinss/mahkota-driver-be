import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AddFinanceDto {
  @IsDateString()
  @IsNotEmpty()
  payment_date!: string;

  @IsString()
  @IsNotEmpty()
  reference_number!: string;

  @IsEnum(['cash', 'transfer', 'e-wallet'])
  @IsNotEmpty()
  payment_method!: string;

  @IsString()
  @IsNotEmpty()
  amount_received!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  payer!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;
}