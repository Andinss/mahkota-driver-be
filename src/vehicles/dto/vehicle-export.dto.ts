import { IsOptional, IsString, IsIn } from 'class-validator';

export class VehicleExportDto {
  @IsOptional()
  @IsString()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  columns?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsIn(['true', 'false', 'all'])
  is_active?: string;
}
