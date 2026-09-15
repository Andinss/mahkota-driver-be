import { IsOptional, IsString, IsIn } from 'class-validator';

export class RoleExportDto {
  @IsOptional()
  @IsString()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  columns?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
