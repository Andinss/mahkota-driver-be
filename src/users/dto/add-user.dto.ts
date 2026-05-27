import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class AddUserDto {
  @IsEmail()
  email?: string;

  @IsString()
  username?: string;

  @MinLength(8)
  password?: string;

  @IsString()
  phone?: string;

  @IsString()
  profile_photo?: string;

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

  @IsEnum(['active', 'inactive', 'pending', 'suspended'])
  status?: string;
}
