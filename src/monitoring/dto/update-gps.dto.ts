import { IsString, IsNumber, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGpsDto {
  @IsString()
  vehicle_id!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  @Type(() => Number)
  speed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  fuel_level?: number;

  @IsOptional()
  @IsEnum(['emergency', 'moving', 'idle'])
  status?: string;

  @IsOptional()
  @IsEnum(['on', 'off'])
  engine_status?: string;
}
