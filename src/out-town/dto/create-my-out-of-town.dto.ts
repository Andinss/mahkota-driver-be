import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * DTO pengajuan izin perjalanan luar kota oleh driver.
 * Data driver (nama/telepon) diambil server dari profil driver yang login,
 * sedangkan detail kendaraan diambil dari master kendaraan, sehingga tidak
 * dapat dipalsukan oleh driver.
 */
export class CreateMyOutOfTownDto {
  @IsUUID()
  vehicle_id!: string;

  @IsString()
  @MaxLength(120)
  destination!: string;

  @IsDateString()
  departure_date!: string;

  @IsDateString()
  return_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
