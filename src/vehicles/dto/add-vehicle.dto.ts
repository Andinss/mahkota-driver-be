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
