import { IsString, IsOptional, IsEnum } from 'class-validator';

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
  @IsEnum(['active', 'inactive'])
  status?: string;
}