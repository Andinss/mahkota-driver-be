import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class RentalQueryDto {
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
  @IsEnum(['harian', 'mingguan', 'bulanan', 'tahunan'])
  rental_duration?: string;

  @IsOptional()
  @IsEnum(['lepas kunci', 'pakai supir'])
  rental_service?: string;
}