import { IsOptional, IsString, IsEnum } from 'class-validator';

export class GpsQueryDto {
  @IsOptional()
  @IsString()
  vehicle_id?: string;

  @IsOptional()
  @IsEnum(['emergency', 'moving', 'idle'])
  status?: string;
}
