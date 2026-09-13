import { IsString, IsOptional, IsEnum } from 'class-validator';

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