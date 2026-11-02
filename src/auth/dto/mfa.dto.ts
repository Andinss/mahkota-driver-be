import { IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class EnableMfaDto {
  @IsString()
  @Length(6, 6, { message: 'Kode verifikasi harus 6 digit' })
  code!: string;
}

export class VerifyMfaDto {
  @IsString()
  @IsNotEmpty()
  mfa_token!: string;

  @IsString()
  @Length(6, 32)
  code!: string;
}

export class DisableMfaDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @Length(6, 32)
  code!: string;
}

export class RegenerateRecoveryCodesDto {
  @IsString()
  @MinLength(1)
  password!: string;
}
