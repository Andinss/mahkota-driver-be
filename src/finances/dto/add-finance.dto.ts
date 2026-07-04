import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsArray,
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

  @IsNumber()
  @IsNotEmpty()
  amount_received!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  payer!: string;

  @IsUUID()
  @IsNotEmpty()
  driver_id!: string;

  @IsOptional()
  @IsEnum(['manual', 'rental', 'late_payment'])
  finance_type?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  rental_ids?: string[];

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;
}