import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { OutOfTownRequest } from './entities/out-of-town-request.entity';
import { CreateMyOutOfTownDto } from './dto/create-my-out-of-town.dto';
import { Driver } from '../drivers/entities/driver.entity';
import { Rental } from '../rentals/entities/rental.entity';

const ALLOWED_STATUS = ['pending', 'approved', 'rejected'];

/** Tanggal hari ini sebagai YYYY-MM-DD (zona waktu lokal server). */
function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ambil bagian YYYY-MM-DD dari nilai date/timestamp. */
function toDateOnly(value: Date | string): string {
  return String(value).slice(0, 10);
}

type OutOfTownResponse = {
  success: boolean;
  message: string;
  data: OutOfTownRequest | OutOfTownRequest[] | null;
};

@Injectable()
export class OutOfTownService {
  constructor(
    @InjectRepository(OutOfTownRequest)
    private readonly requestRepository: Repository<OutOfTownRequest>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Rental)
    private readonly rentalRepository: Repository<Rental>,
  ) {}

  private async findRawById(id: string): Promise<OutOfTownRequest | null> {
    return this.requestRepository.findOne({
      where: { id },
      relations: { driver: true, vehicle: true },
    });
  }

  /**
   * Pengajuan izin keluar kota oleh driver. Nama & telepon diambil dari
   * profil driver yang login; kendaraan ditentukan otomatis dari rental
   * aktif milik driver (satu kontrak = satu kendaraan), bukan dipilih manual.
   */
  async createForDriver(
    data: CreateMyOutOfTownDto,
    driverId: string,
  ): Promise<OutOfTownResponse> {
    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException('Profil driver tidak ditemukan');
    }

    // Satu driver hanya boleh punya satu pengajuan yang belum diproses.
    const pending = await this.requestRepository.findOne({
      where: { driver_id: driverId, status: 'pending' },
    });
    if (pending) {
      throw new BadRequestException(
        'Masih ada pengajuan luar kota yang menunggu persetujuan',
      );
    }

    // Rental yang masih berlaku hari ini (definisi sama dengan generator
    // tagihan harian): status active dan tanggal hari ini dalam rentang.
    const today = todayStr();
    const rentals = await this.rentalRepository.find({
      where: {
        driver_id: driverId,
        status: 'active',
        start_date: LessThanOrEqual(today as unknown as Date),
        end_date: MoreThanOrEqual(today as unknown as Date),
      },
      relations: { vehicle: true },
      order: { start_date: 'DESC' },
    });

    const rental = rentals.find((r) => r.vehicle);
    if (!rental || !rental.vehicle) {
      throw new BadRequestException(
        'Anda tidak memiliki kontrak rental aktif untuk mengajukan keluar kota',
      );
    }

    const vehicle = rental.vehicle;
    const contractStart = toDateOnly(rental.start_date);
    const contractEnd = toDateOnly(rental.end_date);

    const departure = data.departure_date.slice(0, 10);
    const ret = data.return_date.slice(0, 10);
    if (ret < departure) {
      throw new BadRequestException(
        'Tanggal kembali tidak boleh sebelum tanggal keluar',
      );
    }
    if (departure < contractStart || ret > contractEnd) {
      throw new BadRequestException(
        `Tanggal perjalanan harus berada dalam masa kontrak rental (${contractStart} s/d ${contractEnd})`,
      );
    }

    const driverName =
      `${driver.first_name ?? ''} ${driver.last_name ?? ''}`.trim() || 'driver';

    try {
      const request = this.requestRepository.create({
        driver_id: driver.id,
        driver_name: driverName,
        driver_phone: driver.phone,
        vehicle_id: vehicle.id,
        vehicle_name: `${vehicle.merk} ${vehicle.model}`.trim(),
        vehicle_plate: vehicle.license_plate,
        destination: data.destination.trim(),
        departure_date: new Date(departure),
        return_date: new Date(ret),
        reason: data.reason?.trim() || '-',
        status: 'pending',
      });

      const result = await this.requestRepository.save(request);
      const saved = await this.findRawById(result.id);

      return {
        success: true,
        message: 'Pengajuan keluar kota berhasil dikirim',
        data: saved,
      };
    } catch (error) {
      console.error('Failed to create out of town request:', error);
      throw new InternalServerErrorException(
        'Gagal membuat pengajuan keluar kota',
      );
    }
  }

  /** Daftar pengajuan milik driver yang sedang login. */
  async listMine(driverId: string): Promise<OutOfTownResponse> {
    const result = await this.requestRepository.find({
      where: { driver_id: driverId },
      relations: { vehicle: true },
      order: { created_at: 'DESC' },
    });
    return {
      success: true,
      message: 'Out of town requests retrieved successfully',
      data: result,
    };
  }

  /** Daftar semua pengajuan (halaman monitoring/persetujuan). */
  async findAll(status?: string): Promise<OutOfTownResponse> {
    const where = status && ALLOWED_STATUS.includes(status) ? { status } : {};
    const result = await this.requestRepository.find({
      where,
      relations: { driver: true, vehicle: true },
      order: { created_at: 'DESC' },
    });
    return {
      success: true,
      message: 'Out of town requests retrieved successfully',
      data: result,
    };
  }

  async getStats() {
    const [pending, approved, rejected, total] = await Promise.all([
      this.requestRepository.count({ where: { status: 'pending' } }),
      this.requestRepository.count({ where: { status: 'approved' } }),
      this.requestRepository.count({ where: { status: 'rejected' } }),
      this.requestRepository.count(),
    ]);

    return {
      success: true,
      message: 'Out of town stats retrieved successfully',
      data: { pending, approved, rejected, total },
    };
  }

  async findById(id: string): Promise<OutOfTownResponse> {
    const request = await this.findRawById(id);
    if (!request) {
      throw new NotFoundException('Pengajuan keluar kota tidak ditemukan');
    }
    return {
      success: true,
      message: 'Out of town request retrieved successfully',
      data: request,
    };
  }

  async approve(id: string, adminNote?: string, reviewedBy?: string) {
    return this.setStatus(id, 'approved', adminNote, reviewedBy);
  }

  async reject(id: string, adminNote?: string, reviewedBy?: string) {
    return this.setStatus(id, 'rejected', adminNote, reviewedBy);
  }

  private async setStatus(
    id: string,
    status: string,
    adminNote?: string,
    reviewedBy?: string,
  ): Promise<OutOfTownResponse> {
    const request = await this.findRawById(id);
    if (!request) {
      throw new NotFoundException('Pengajuan keluar kota tidak ditemukan');
    }

    request.status = status;
    if (adminNote !== undefined) request.admin_note = adminNote || null;
    if (reviewedBy) request.reviewed_by = reviewedBy;
    request.reviewed_at = new Date();

    const result = await this.requestRepository.save(request);
    const saved = await this.findRawById(result.id);

    return {
      success: true,
      message:
        status === 'approved'
          ? 'Pengajuan keluar kota disetujui'
          : 'Pengajuan keluar kota ditolak',
      data: saved,
    };
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.requestRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Pengajuan keluar kota tidak ditemukan');
    }
    return {
      success: true,
      message: 'Pengajuan keluar kota dihapus',
    };
  }
}
