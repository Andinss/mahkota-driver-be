import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { PreviewContractDto } from './dto/preview-contract.dto';
import { nextRentalNumber } from '../rentals/rental-number.util';

export interface GeneratedDocument {
  buffer: Buffer;
  filename: string;
}

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const formatDate = (value?: Date | string | null): string => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const formatNumber = (value?: number | string | null): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('id-ID').format(num);
};

const dayDiff = (
  start?: Date | string | null,
  end?: Date | string | null,
): number => {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1);
};

@Injectable()
export class RentalContractService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Rental)
    private readonly rentalRepo: Repository<Rental>,
  ) {}

  // Generate dokumen kontrak (.docx) dari template di folder templates/
  // berdasarkan driver & kendaraan yang dipilih pada form rental.
  async generatePreview(dto: PreviewContractDto): Promise<GeneratedDocument> {
    const driver = await this.driverRepo.findOne({
      where: { id: dto.driver_id },
    });
    if (!driver) {
      throw new NotFoundException('Driver tidak ditemukan');
    }

    const vehicle = await this.vehicleRepo.findOne({
      where: { id: dto.vehicle_id },
    });
    if (!vehicle) {
      throw new NotFoundException('Kendaraan tidak ditemukan');
    }

    let rental: Rental | null = null;
    if (dto.rental_id) {
      rental = await this.rentalRepo.findOne({ where: { id: dto.rental_id } });
      if (!rental) {
        throw new NotFoundException('Rental tidak ditemukan');
      }
    }

    const startDate = dto.start_date ?? rental?.start_date ?? null;
    const endDate = dto.end_date ?? rental?.end_date ?? null;
    const totalDuration =
      dto.total_duration ??
      rental?.total_duration ??
      dayDiff(startDate, endDate);
    const dailyRate =
      dto.daily_rate ?? rental?.daily_rate ?? vehicle.daily_rate;
    const rentalService = dto.rental_service ?? rental?.rental_service ?? '-';
    // Sewa baru belum punya nomor (nomor resmi dibuat saat insert ke
    // database). Preview memakai perhitungan nomor urut yang sama persis
    // dengan saat submit, supaya kode kontrak di preview = yang tersimpan.
    const rentalNumber =
      rental?.rental_number ??
      (await nextRentalNumber(this.rentalRepo.manager));

    const data: Record<string, string> = {
      kode_rental: rentalNumber,
      nama_lengkap:
        `${driver.first_name ?? ''} ${driver.last_name ?? ''}`.trim() || '-',
      nomor_handphone: driver.phone ?? '-',
      provinsi: driver.province_name || driver.province || '-',
      kota: driver.city_name || driver.city || '-',
      kecamatan: driver.district_name || driver.district || '-',
      desa: driver.subdistrict_name || driver.subdistrict || '-',
      alamat_lengkap: driver.permanent_address || '-',
      merek: vehicle.merk || '-',
      model: vehicle.model || '-',
      plat_nomor: vehicle.license_plate || '-',
      nomor_rangka: vehicle.vin_number || '-',
      nomor_mesin: vehicle.engine_number || '-',
      warna: vehicle.color || '-',
      tahun: vehicle.launching_year
        ? String(new Date(vehicle.launching_year).getFullYear())
        : '-',
      harga_harian: formatNumber(dailyRate),
      tanggal_awal: formatDate(startDate),
      tanggal_akhir: formatDate(endDate),
      jumlah_hari: totalDuration ? `${totalDuration} hari` : '-',
      jenis_layanan: rentalService,
    };

    const buffer = this.renderTemplate(data);
    const filename = `kontrak-${rentalNumber.replace(/[^\w-]+/g, '_')}.docx`;

    return { buffer, filename };
  }

  private renderTemplate(data: Record<string, string>): Buffer {
    const template = readFileSync(this.resolveTemplatePath());

    const zip = new PizZip(template);
    const doc = new Docxtemplater(zip, {
      nullGetter: () => '-',
    });

    try {
      doc.render(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'template tidak valid';
      throw new BadRequestException(
        `Gagal memproses template kontrak: ${message}`,
      );
    }

    return doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
  }

  // Cari template.docx di folder templates/ (root project saat dev & production).
  private resolveTemplatePath(): string {
    const candidates = [
      join(process.cwd(), 'templates', 'template.docx'),
      join(__dirname, '..', '..', 'templates', 'template.docx'),
    ];

    const found = candidates.find((path) => existsSync(path));
    if (!found) {
      throw new BadRequestException(
        'Template kontrak (templates/template.docx) tidak ditemukan',
      );
    }
    return found;
  }
}
