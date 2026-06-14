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
  @IsUUID()
  role_id?: string;

  @IsBoolean()
  is_active?: boolean;
}
