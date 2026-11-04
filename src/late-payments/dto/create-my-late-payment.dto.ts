import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * DTO pengajuan izin telat bayar oleh driver untuk satu tagihan harian.
 * Data lain (driver, kendaraan, nominal, tanggal jatuh tempo) diambil server
 * dari tagihan harian sehingga tidak dapat dipalsukan driver.
 */
export class CreateMyLatePaymentDto {
  @IsUUID()
  daily_payment_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
