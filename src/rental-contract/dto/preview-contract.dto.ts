import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

// Data minimum untuk membuat preview kontrak sewa (.docx) dari
// form rental sebelum sewa disimpan ke database.
export class PreviewContractDto {
  @IsUUID()
  driver_id!: string;

  @IsUUID()
  vehicle_id!: string;

  // Diisi bila preview dibuat untuk sewa yang sudah ada (mode edit)
  // agar {kode_rental} pada template ikut terisi.
  @IsOptional()
  @IsUUID()
  rental_id?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end_date?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  daily_rate?: number;

  @IsOptional()
  @IsEnum(['harian', 'mingguan', 'bulanan', 'tahunan'])
  rental_duration?: string;

  @IsOptional()
  @IsEnum(['lepas kunci', 'pakai supir'])
  rental_service?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
