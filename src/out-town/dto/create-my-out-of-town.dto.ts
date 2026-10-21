import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO pengajuan izin perjalanan luar kota oleh driver.
 * Data driver dan kendaraan TIDAK dikirim dari klien: nama/telepon diambil
 * dari profil driver yang login, sedangkan kendaraan diambil otomatis dari
 * rental aktif milik driver (satu kontrak = satu kendaraan).
 */
export class CreateMyOutOfTownDto {
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
