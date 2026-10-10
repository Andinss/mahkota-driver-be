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
 * DTO untuk menambah pembayaran/cicilan terhadap sebuah Finance.
 * Pembayaran tidak boleh melebihi sisa tagihan. Pembayaran berstatus
 * 'pending' tidak dihitung sebagai uang masuk sampai diverifikasi.
 *
 * Kirim sebagai multipart (bila menyertakan bukti bayar):
 * - field `proof_image` = file gambar bukti transfer.
 */
export class CreateFinancePaymentDto {
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

  @IsOptional()
  @IsString()
  reference_number?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Rekening tujuan (method_payments) yang dipilih driver. */
  @IsOptional()
  @IsUUID()
  method_payment_id?: string;

  /** Rekening asal milik driver yang dipakai bayar (mis. "BCA 1234 a.n Joko"). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source_account?: string;

  @IsOptional()
  @IsEnum(['paid', 'pending'])
  status?: string;
}
