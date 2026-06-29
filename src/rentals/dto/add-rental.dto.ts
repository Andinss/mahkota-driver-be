import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';

export class AddRentalDto {
  @IsUUID()
  driver_id!: string;

  @IsUUID()
  vehicle_id!: string;

  @IsDate()
  @Type(() => Date)
  start_date!: Date;

  @IsDate()
  @Type(() => Date)
  end_date!: Date;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_duration!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  daily_rate!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deposit_amount!: number;

  @IsEnum(['Bank', 'Cash', 'E Wallet'])
  method_payment!: string;

  @IsOptional()
  @IsString()
  document_contract?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_daily_rate!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  security_deposit!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  service_fee!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_revenue!: number;
}
