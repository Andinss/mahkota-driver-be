import { Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';

export class UpdateRentalDto {
  @IsOptional()
  @IsUUID()
  driver_id!: string;

  @IsOptional()
  @IsUUID()
  vehicle_id!: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date!: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end_date!: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_duration!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  daily_rate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deposit_amount!: number;

  @IsOptional()
  @IsEnum(['Bank', 'Cash', 'E Wallet'])
  method_payment!: string;

  @IsOptional()
  @IsString()
  document_contract?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_daily_rate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  security_deposit!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  service_fee!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_revenue!: number;

  @IsOptional()
  @IsEnum(['harian', 'mingguan', 'bulanan', 'tahunan'])
  rental_duration!: string;

  @IsOptional()
  @IsEnum(['lepas kunci', 'pakai supir'])
  rental_service!: string;

  @IsOptional()
  @IsEnum(['paid', 'late', 'pending_confirmation', 'partial', 'unpaid'])
  payment_status!: string;
}
