import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsIn,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FinanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['cash', 'transfer', 'e-wallet', 'saldo'])
  payment_method?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @IsOptional()
  @IsUUID()
  rental_id?: string;

  @IsOptional()
  @IsEnum(['admin_join', 'membership_fee', 'additional_charge'])
  fee_kind?: string;

  /**
   * Kecualikan jenis fee tertentu. Dipakai tab "Fee Membership" di portal
   * driver supaya tagihan tambahan tidak tercampur di sana.
   */
  @IsOptional()
  @IsIn(['additional_charge'])
  exclude_fee_kind?: string;

  @IsOptional()
  @IsEnum(['unpaid', 'pending', 'paid', 'cancelled'])
  status?: string;
}
