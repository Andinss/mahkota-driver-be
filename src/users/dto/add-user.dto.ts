import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
} from 'class-validator';

export class AddUserDto {
  @IsEmail()
  email?: string;

  @IsString()
  username?: string;

  @IsEnum([
    'owner',
    'finance',
    'supervisor',
    'field_officer',
    'driver',
    'admin',
    'operator ',
  ])
  role?: string;

  @IsBoolean()
  is_active?: boolean;
}
