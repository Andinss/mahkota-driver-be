import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateGeofenceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  center_lat!: number;

  @IsNumber()
  center_lng!: number;

  @IsNumber()
  @Min(1)
  radius!: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
