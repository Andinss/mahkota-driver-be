import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FinanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['cash', 'transfer', 'e-wallet', 'saldo'])
  payment_method?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @IsOptional()
  @IsUUID()
  rental_id?: string;

  @IsOptional()
  @IsEnum(['unpaid', 'pending', 'paid', 'cancelled'])
  status?: string;
}
