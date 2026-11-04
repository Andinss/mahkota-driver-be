import { IsOptional, IsString, IsIn, Matches } from 'class-validator';

export class DailyPaymentExportDto {
  @IsOptional()
  @IsString()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: string;

  // Filter berdasarkan tanggal tagihan (payment_date), format YYYY-MM-DD
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

  // Daftar kolom dipisah koma, mis. "referenceNumber,vehicle,amount"
  @IsOptional()
  @IsString()
  columns?: string;
}
