import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVendorVehicleDto {
  @IsOptional()
  logo!: string;

  @IsOptional()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  owner_name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  harga_pokok?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  harga_jual?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
