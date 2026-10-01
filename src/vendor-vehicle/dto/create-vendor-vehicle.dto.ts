import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVendorVehicleDto {
  @IsOptional()
  logo!: string;

  @IsString()
  name!: string;

  @IsString()
  owner_name!: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
