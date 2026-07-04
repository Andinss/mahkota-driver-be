import { IsString, IsOptional } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
