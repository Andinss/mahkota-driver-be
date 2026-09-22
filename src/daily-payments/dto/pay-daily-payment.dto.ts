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
 * DTO untuk pembayaran tagihan harian (daily_payments) oleh driver.
 * - payment_method 'saldo' -> koin driver dikurangi
 * - metode lain            -> pembayaran dicatat tanpa memotong koin
 */
export class PayDailyPaymentDto {
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
}