import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEnum([
    'owner',
    'finance',
    'supervisor',
    'field_officer',
    'driver',
    'admin',
    'customer',
    'operator ',
  ])
  role?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
