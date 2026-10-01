import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';

const toIdArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  return undefined;
};

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
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost_price!: number;

  @IsOptional()
  @IsEnum(['Reguler', 'Premium'])
  pricing_category!: string;

  @IsOptional()
  @Transform(toIdArray)
  @IsUUID('4', { each: true })
  membership_ids?: string[];

  @IsOptional()
  vendor_id!: string;

  @IsOptional()
  @IsString()
  imei!: string;

  @IsOptional()
  @IsString()
  device_name!: string;
}
