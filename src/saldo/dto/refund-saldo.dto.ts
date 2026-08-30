import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RefundSaldoDto {
  @IsUUID()
  driver_id!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsUUID()
  rental_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
