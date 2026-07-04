import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  driver_id!: string;

  @IsString()
  @IsNotEmpty()
  driver_name!: string;

  @IsString()
  @IsOptional()
  vehicle?: string;

  @IsString()
  @IsOptional()
  plate?: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  amount!: number;

  @IsDateString()
  @IsNotEmpty()
  due_date!: string;

  @IsDateString()
  @IsOptional()
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
