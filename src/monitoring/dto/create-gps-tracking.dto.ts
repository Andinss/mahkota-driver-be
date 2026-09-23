import { IsOptional } from 'class-validator';

export class CreateGpsTrackingDto {
  @IsOptional()
  VehicleId?: string;

  @IsOptional()
  VehicleNumber?: string;

  @IsOptional()
  DatetimeUTC?: string;

  @IsOptional()
  GpsLocation?: string;

  @IsOptional()
  Lon?: string;

  @IsOptional()
  Lat?: string;

  @IsOptional()
  Speed?: string;

  @IsOptional()
  Direction?: string;

  @IsOptional()
  Engine?: string;

  @IsOptional()
  Odometer?: string;

  @IsOptional()
  Car_Status?: string;

  @IsOptional()
  VehicleType?: string;

  @IsOptional()
  Alarm?: string;
}

export class GpsTrackingQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  search?: string;

  @IsOptional()
  VehicleId?: string;
}
