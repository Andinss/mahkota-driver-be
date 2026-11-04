import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

/**
 * Payload pembuatan tagihan tambahan ke driver secara manual
 * (mis. ganti rugi kendaraan lecet, kecelakaan, kehilangan STNK).
 *
 * Nominal tagihan disimpan di kolom `fee_admin_join` dengan
 * `fee_kind = 'additional_charge'` agar mengikuti pipeline pembayaran
 * (cicilan / partial payment) yang sudah ada.
 */
export class CreateAdditionalChargeDto {
  @IsUUID()
  @IsNotEmpty()
  driver_id!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  charge_name!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  reason!: string;

  /** Tanggal tagihan dibuat. Default hari ini (waktu server). */
  @IsOptional()
  @IsDateString()
  payment_date?: string;
}
