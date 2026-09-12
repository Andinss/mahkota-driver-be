import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsArray,
  IsPositive,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AddFinanceDto {
  @IsDateString()
  @IsNotEmpty()
  payment_date!: string;

  @IsString()
  @IsNotEmpty()
  reference_number!: string;

  @IsEnum(['cash', 'transfer', 'e-wallet', 'saldo'])
  @IsNotEmpty()
  payment_method!: string;

  /**
   * Jumlah pembayaran awal / cicilan pertama.
   * Dalam model tagihan baru, ini adalah nominal pertama yang dibayarkan saat
   * finance dibuat. Jika `total_amount` tidak diisi (backward compat), maka
   * dianggap total tagihan sama dengan `amount_received`.
   */
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount_received?: number;

  @IsOptional()
  @IsNumber()
  deposit_amount?: number;

  /**
   * Total nominal tagihan finance (kewajiban driver).
   * Backend menghitung `remaining = total_amount - sum(pembayaran paid)`.
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  total_amount?: number;

  /**
   * Opsi pembayaran/cicilan tagihan: 1, 2, atau 4 kali.
   */
  @IsOptional()
  @IsIn([1, 2, 4])
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : Number(value),
  )
  payment_terms?: number;

  /**
   * Admin fee join (biaya admin saat akun pertama kali melakukan sewa).
   * Jika finance terhubung rental yang merupakan sewa pertama akun tersebut,
   * backend otomatis menghitung dari jenis mobil (Reguler Rp 500.000, Premium Rp 700.000).
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  fee_admin_join?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  payer!: string;

  @IsUUID()
  @IsNotEmpty()
  driver_id!: string;

  /**
   * Kondisi awal yang diinginkan admin saat finance dibuat:
   * - 'unpaid'  -> tidak ada pembayaran awal
   * - 'paid'    -> `amount_received` tercatat sebagai pembayaran lunas (status paid)
   * - 'pending' -> `amount_received` tercatat sebagai pembayaran pending (menunggu verifikasi)
   * Backend tetap menghitung status final secara konsisten terhadap nominal.
   */
  @IsOptional()
  @IsEnum(['paid', 'unpaid', 'pending'])
  finance_type?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  rental_ids?: string[];

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;
}
