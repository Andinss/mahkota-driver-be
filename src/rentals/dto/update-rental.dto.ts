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
  @IsString()
  document_contract?: string;

  @IsOptional()
  @IsString()
  checklist_pre?: string;

  @IsOptional()
  @IsString()
  checklist_post?: string;

  @IsOptional()
  @IsEnum(['harian', 'mingguan', 'bulanan', 'tahunan'])
  rental_duration!: string;

  @IsOptional()
  @IsEnum(['lepas kunci', 'pakai supir'])
  rental_service!: string;
}
