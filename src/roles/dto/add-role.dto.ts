import {
  IsBoolean,
  IsString,
} from 'class-validator';

export class AddRoleDto {
  @IsString()
  name!: string;

  @IsString()
  description?: string;

  @IsBoolean()
  is_active?: boolean;
}