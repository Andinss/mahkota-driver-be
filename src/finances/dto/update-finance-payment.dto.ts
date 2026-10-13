import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO untuk verifikasi/penolakan pembayaran:
 * - 'paid'      -> pembayaran disetujui, dihitung sebagai uang masuk
 * - 'cancelled' -> pembayaran ditolak/batal
 *
 * `reason` (opsional) hanya relevan saat menolak — disimpan sebagai
 * alasan penolakan dan ditampilkan ke driver untuk pengajuan ulang.
 */
export class UpdateFinancePaymentDto {
  @IsEnum(['paid', 'cancelled'])
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
