import { IsOptional, IsString, IsIn, Matches } from 'class-validator';

export class KoinExportDto {
  @IsOptional()
  @IsString()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: string;

  @IsOptional()
  @IsString()
  columns?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'start_date harus berformat YYYY-MM-DD',
  })
  start_date?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'end_date harus berformat YYYY-MM-DD',
  })
  end_date?: string;
}
