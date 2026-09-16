import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AddUserDto {
  @IsEmail()
  email?: string;

  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  fullname?: string;

  @IsOptional()
  @IsUUID()
  role_id?: string;

  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsUUID()
  driver_id?: string;
}
