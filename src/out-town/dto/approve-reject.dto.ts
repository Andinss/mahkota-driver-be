import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ApproveRejectDto {
  @IsOptional()
  @IsString()
  admin_note?: string;

  /**
   * Biaya tambahan luar kota yang diinput admin saat menyetujui pengajuan.
   * Nominal bebas (>= 0); bila kosong/0 tidak ada biaya tambahan yang
   * dimasukkan ke daily payment.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee_amount?: number;
}
