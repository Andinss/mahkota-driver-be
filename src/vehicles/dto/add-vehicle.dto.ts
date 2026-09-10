import { Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';

export class AddVehicleDto {
  //step 1
  @IsOptional()
  vehicle_photo!: string[];

  @IsString()
  merk!: string;

  @IsString()
  model!: string;

  @IsDate()
  @Type(() => Date)
  launching_year!: Date;

  @IsString()
  license_plate!: string;

  @IsString()
  vin_number!: string;

  @IsString()
  color!: string;

  @IsEnum(['Available', 'Maintenance', 'Service', 'Reserved'])
  status!: string;

  @IsString()
  engine_number!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  daily_rate!: number;

  @IsEnum(['Reguler', 'Premium'])
  pricing_category!: string;
}
