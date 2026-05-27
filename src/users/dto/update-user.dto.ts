import {
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
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  profile_photo?: string;

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
  @IsEnum(['active', 'inactive', 'pending', 'suspended'])
  status?: string;
}
