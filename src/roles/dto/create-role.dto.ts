import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Administrator' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ADMIN' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional({ example: 'Role with full access' })
  @IsOptional()
  @IsString()
  description?: string;
}
