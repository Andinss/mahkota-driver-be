import {
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLatePaymentDto {
  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @IsOptional()
  @IsString()
  driver_name?: string;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsOptional()
  @IsString()
  plate?: string;

  /** Tagihan harian yang diajukan izin telat (menentukan due_date & amount). */
  @IsOptional()
  @IsUUID()
  daily_payment_id?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsString()
  justification_reason?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  proof_image?: string;

  @IsOptional()
  @IsString()
  driver_image?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  rental_ids?: string[];
}
