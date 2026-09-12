import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsPositive,
} from 'class-validator';

/**
 * DTO untuk menambah pembayaran/cicilan terhadap sebuah Finance.
 * Pembayaran tidak boleh melebihi sisa tagihan. Pembayaran berstatus
 * 'pending' tidak dihitung sebagai uang masuk sampai diverifikasi.
 */
export class CreateFinancePaymentDto {
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

  @IsOptional()
  @IsEnum(['paid', 'pending'])
  status?: string;
}
