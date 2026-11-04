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
import { DailyPaymentsService } from '../daily-payments/daily-payments.service';

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
    private readonly dailyPaymentsService: DailyPaymentsService,
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
        rental_id: rental.id,
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

  /**
   * Statistik pengajuan. Bila `driverId` diberikan, hanya menghitung
   * pengajuan milik driver tsb (dipakai halaman driver).
   */
  async getStats(driverId?: string) {
    const where = driverId ? { driver_id: driverId } : {};
    const [pending, approved, rejected, total] = await Promise.all([
      this.requestRepository.count({
        where: { ...where, status: 'pending' },
      }),
      this.requestRepository.count({
        where: { ...where, status: 'approved' },
      }),
      this.requestRepository.count({
        where: { ...where, status: 'rejected' },
      }),
      this.requestRepository.count({ where }),
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

  async approve(
    id: string,
    adminNote?: string,
    reviewedBy?: string,
    feeAmount?: number,
  ) {
    return this.setStatus(id, 'approved', adminNote, reviewedBy, feeAmount);
  }

  async reject(id: string, adminNote?: string, reviewedBy?: string) {
    return this.setStatus(id, 'rejected', adminNote, reviewedBy);
  }

  private async setStatus(
    id: string,
    status: string,
    adminNote?: string,
    reviewedBy?: string,
    feeAmount?: number,
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

    // Biaya tambahan (nominal bebas dari admin) hanya dikenakan saat
    // pengajuan DISETUJUI dan nominalnya > 0.
    if (status === 'approved' && feeAmount && feeAmount > 0) {
      await this.applyFee(request, feeAmount);
    }

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

  /**
   * Masukkan biaya tambahan ke daily payment pada tanggal keberangkatan
   * dan simpan jejaknya di pengajuan (untuk pembatalan).
   */
  private async applyFee(
    request: OutOfTownRequest,
    feeAmount: number,
  ): Promise<void> {
    try {
      const rental = await this.resolveRental(request);
      if (!rental) {
        console.warn(
          `Out of town ${request.id}: rental tidak ditemukan, biaya tambahan dilewati`,
        );
        return;
      }

      const paymentDate = toDateOnly(request.departure_date);
      const note = `Biaya izin luar kota: ${request.destination} (Rp ${feeAmount.toLocaleString('id-ID')})`;

      const payment = await this.dailyPaymentsService.addOutOfTownFee({
        rentalId: rental.id,
        driverId: request.driver_id,
        vehicleId: request.vehicle_id || rental.vehicle_id,
        paymentDate,
        fee: feeAmount,
        note,
      });

      request.rental_id = rental.id;
      request.fee_amount = feeAmount;
      request.daily_payment_id = payment?.id ?? null;
      await this.requestRepository.save(request);
    } catch (error) {
      console.error(
        `Failed to apply out of town fee for request ${request.id}:`,
        error,
      );
    }
  }

  /**
   * Rental yang mendasari pengajuan: pakai `rental_id` yang tersimpan,
   * atau cari rental aktif driver yang mencakup tanggal keberangkatan
   * (untuk data lama yang belum menyimpan rental_id).
   */
  private async resolveRental(
    request: OutOfTownRequest,
  ): Promise<Rental | null> {
    if (request.rental_id) {
      const linked = await this.rentalRepository.findOne({
        where: { id: request.rental_id },
      });
      if (linked) return linked;
    }

    const departure = toDateOnly(request.departure_date);
    const rentals = await this.rentalRepository.find({
      where: {
        driver_id: request.driver_id,
        status: 'active',
        start_date: LessThanOrEqual(departure as unknown as Date),
        end_date: MoreThanOrEqual(departure as unknown as Date),
      },
      order: { start_date: 'DESC' },
    });

    if (request.vehicle_id) {
      const match = rentals.find((r) => r.vehicle_id === request.vehicle_id);
      if (match) return match;
    }
    return rentals[0] || null;
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Pengajuan keluar kota tidak ditemukan');
    }

    // Batalkan biaya tambahan bila pengajuan yang dihapus sudah disetujui.
    if (request.status === 'approved' && request.fee_amount) {
      try {
        const note = `Biaya izin luar kota: ${request.destination} (Rp ${Number(
          request.fee_amount,
        ).toLocaleString('id-ID')})`;
        if (request.daily_payment_id) {
          await this.dailyPaymentsService.removeOutOfTownFee(
            request.daily_payment_id,
            Number(request.fee_amount),
            note,
          );
        } else {
          // Jejak daily payment tidak tersimpan (data lama): cari baris
          // pada tanggal keberangkatan untuk mengurangi biaya.
          const rental = await this.resolveRental(request);
          if (rental) {
            await this.findAndRemoveFee(
              rental.id,
              toDateOnly(request.departure_date),
              Number(request.fee_amount),
              note,
            );
          }
        }
      } catch (error) {
        console.error(
          `Failed to reverse out of town fee for request ${request.id}:`,
          error,
        );
      }
    }

    await this.requestRepository.delete(id);
    return {
      success: true,
      message: 'Pengajuan keluar kota dihapus',
    };
  }

  /** Cari baris daily payment pada tanggal tertentu lalu kurangi biayanya. */
  private async findAndRemoveFee(
    rentalId: string,
    paymentDate: string,
    fee: number,
    note: string,
  ): Promise<void> {
    const payment = await this.requestRepository.manager
      .createQueryBuilder()
      .select('dp.id', 'id')
      .from('daily_payments', 'dp')
      .where('dp.rental_id = :rentalId', { rentalId })
      .andWhere('dp.payment_date = :paymentDate', { paymentDate })
      .orderBy('dp.created_at', 'ASC')
      .getRawOne<{ id: string }>();

    if (payment?.id) {
      await this.dailyPaymentsService.removeOutOfTownFee(payment.id, fee, note);
    }
  }
}
