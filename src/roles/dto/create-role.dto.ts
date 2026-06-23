import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
