import { IsEnum, IsNotEmpty } from 'class-validator';

/**
 * DTO untuk verifikasi/penolakan pembayaran:
 * - 'paid'      -> pembayaran disetujui, dihitung sebagai uang masuk
 * - 'cancelled' -> pembayaran ditolak/batal
 */
export class UpdateFinancePaymentDto {
  @IsEnum(['paid', 'cancelled'])
  @IsNotEmpty()
  status!: string;
}
