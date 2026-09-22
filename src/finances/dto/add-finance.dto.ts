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

  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount_received?: number;

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
