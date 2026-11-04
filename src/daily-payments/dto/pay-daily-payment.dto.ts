import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO untuk pembayaran tagihan harian (daily_payments) oleh driver.
 * - payment_method 'saldo' -> koin driver dikurangi
 * - metode lain            -> pembayaran dicatat tanpa memotong koin
 * - transfer / e-wallet    -> status 'pending' sampai diverifikasi admin
 *
 * Kirim sebagai multipart (bila menyertakan bukti bayar):
 * - field `proof_image` = file gambar bukti transfer.
 */
export class PayDailyPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  amount!: number;

  @IsEnum(['cash', 'transfer', 'e-wallet', 'saldo'])
  @IsNotEmpty()
  payment_method!: string;

  @IsDateString()
  @IsNotEmpty()
  payment_date!: string;

  /**
   * ID transaksi/kode yang muncul setelah transfer (dari mutasi bank/e-wallet).
   * Wajib untuk metode transfer/e-wallet (divalidasi di service).
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transaction_id?: string;

  /** Catatan dari driver saat konfirmasi pembayaran. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  payment_notes?: string;

  /** Rekening tujuan (method_payments) yang dipilih driver. */
  @IsOptional()
  @IsUUID()
  method_payment_id?: string;

  /** Rekening asal milik driver yang dipakai bayar (mis. "BCA 1234 a.n Joko"). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source_account?: string;
}
