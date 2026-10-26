import {
  IsUUID,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TopUpKoinDto {
  @IsUUID()
  driver_id!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  /**
   * Alasan top up (wajib), mis. "Sebagai Reward" / "Bonus Kinerja".
   * Ditampilkan ke driver pada riwayat koinnya.
   */
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  reason!: string;

  /** Keterangan detail (opsional), mis. "Reward capai target 20 unit Juni". */
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsString()
  reference_number?: string;
}
