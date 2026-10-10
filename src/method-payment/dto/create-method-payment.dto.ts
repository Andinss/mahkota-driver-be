import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Multipart mengirim `is_active` sebagai string "true"/"false". */
const toBoolean = ({ value }: { value: unknown }): boolean | undefined =>
  value === undefined || value === null || value === ''
    ? undefined
    : value === true || value === 'true';

export type MethodPaymentMethodInput = 'bank' | 'qris' | 'e_wallet';

export class CreateMethodPaymentDto {
  @IsIn(['bank', 'qris', 'e_wallet'])
  method!: MethodPaymentMethodInput;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  provider?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  account_number?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  account_holder?: string | null;

  @IsOptional()
  @IsString()
  image_url?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_active?: boolean;
}
