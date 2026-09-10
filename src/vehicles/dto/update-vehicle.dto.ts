import { Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdateVehicleDto {
  //step 1
  @IsOptional()
  vehicle_photo!: string[];

  @IsOptional()
  @IsString()
  merk!: string;

  @IsOptional()
  @IsString()
  model!: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  launching_year!: Date;

  @IsOptional()
  @IsString()
  license_plate!: string;

  @IsOptional()
  @IsString()
  vin_number!: string;

  @IsOptional()
  @IsString()
  color!: string;

  @IsOptional()
  @IsEnum(['Available', 'Maintenance', 'Service', 'Reserved'])
  status!: string;

  @IsOptional()
  @IsString()
  engine_number!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  daily_rate!: number;

  @IsOptional()
  @IsEnum(['Reguler', 'Premium'])
  pricing_category!: string;
}
