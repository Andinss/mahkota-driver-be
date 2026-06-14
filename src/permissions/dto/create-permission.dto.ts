import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 'user.create' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'user' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiPropertyOptional({ example: 'Create new users' })
  @IsOptional()
  @IsString()
  description?: string;
}
