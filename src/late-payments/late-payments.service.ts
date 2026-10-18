import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LatePayment } from './entities/late-payment.entity';
import { CreateLatePaymentDto } from './dto/create-late-payment.dto';
import { CreateMyLatePaymentDto } from './dto/create-my-late-payment.dto';
import { FinancesService } from '../finances/finances.service';
import { DailyPayment } from '../daily-payments/entities/daily-payment.entity';
import { toStoredPath } from '../common/proof-upload.util';
import type { Rental } from '../rentals/entities/rental.entity';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

@Injectable()
export class LatePaymentsService {
  constructor(
    @InjectRepository(LatePayment)
    private readonly latePaymentRepository: Repository<LatePayment>,
    @InjectRepository(DailyPayment)
    private readonly dailyPaymentRepository: Repository<DailyPayment>,
    private readonly financesService: FinancesService,
  ) {}

  private async findRawById(id: string): Promise<LatePayment | null> {
    return this.latePaymentRepository.findOne({
      where: { id },
      relations: { driver: true, rentals: true },
    });
  }

  /** Jumlah hari keterlambatan: selisih hari antara jatuh tempo & acuan. */
  private computeLateDays(paymentDate: Date, reference: Date): number {
    const due = new Date(paymentDate).getTime();
    const ref = new Date(reference).getTime();
    if (Number.isNaN(due) || Number.isNaN(ref)) return 0;
    return Math.max(0, Math.floor((ref - due) / 86400000));
  }

  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: LatePayment[];
  }> {
    const result = await this.latePaymentRepository.find({
      relations: { driver: true, rentals: true },
      order: { created_at: 'DESC' },
    });
    return {
      success: true,
      message: 'Late payments retrieved successfully',
      data: result,
    };
  }

  /** Daftar pengajuan izin (untuk halaman persetujuan Supervisor/Finance). */
  async listRequests(status?: string): Promise<{
    success: boolean;
    message: string;
    data: LatePayment[];
  }> {
    const allowed = ['pending', 'approved', 'rejected'];
    const where = status && allowed.includes(status) ? { status } : {};
    const result = await this.latePaymentRepository.find({
      where,
      relations: { driver: true, rentals: true },
      order: { created_at: 'DESC' },
    });
    return {
      success: true,
      message: 'Late payment requests retrieved successfully',
      data: result,
    };
  }

  async findById(id: string) {
    const payment = await this.findRawById(id);
    if (!payment) {
      throw new NotFoundException('Late payment not found');
    }
    return {
      success: true,
      message: 'Late payment retrieved successfully',
      data: payment,
    };
  }

  async getStats(): Promise<{
    success: boolean;
    message: string;
    data: {
      pending: number;
      approved: number;
      rejected: number;
      total: number;
    };
  }> {
    const [pending, approved, rejected, total] = await Promise.all([
      this.latePaymentRepository.count({ where: { status: 'pending' } }),
      this.latePaymentRepository.count({ where: { status: 'approved' } }),
      this.latePaymentRepository.count({ where: { status: 'rejected' } }),
      this.latePaymentRepository.count(),
    ]);

    return {
      success: true,
      message: 'Late payment stats retrieved successfully',
      data: { pending, approved, rejected, total },
    };
  }

  async create(data: CreateLatePaymentDto) {
    try {
      const { rental_ids, ...paymentData } = data;

      const payment = this.latePaymentRepository.create({
        ...paymentData,
        payment_date: data.payment_date
          ? new Date(data.payment_date)
          : new Date(),
        status: 'pending',
      });

      if (rental_ids && rental_ids.length > 0) {
        payment.rentals = rental_ids.map((id) => ({ id }) as unknown as Rental);
      }

      const result = await this.latePaymentRepository.save(payment);
      const saved = await this.findRawById(result.id);

      return {
        success: true,
        message: 'Late payment created successfully',
        data: saved,
      };
    } catch (error) {
      console.error('Failed to create late payment:', error);
      throw new InternalServerErrorException('Failed to create late payment');
    }
  }

  /**
   * Pengajuan izin telat bayar oleh driver untuk satu tagihan harian.
   * Data driver/kendaraan/nominal/tanggal diambil dari tagihan harian.
   */
  async createForDriver(
    data: CreateMyLatePaymentDto,
    driverId: string,
    file?: Express.Multer.File,
  ) {
    const daily = await this.dailyPaymentRepository.findOne({
      where: { id: data.daily_payment_id },
      relations: { vehicle: true, driver: true },
    });
    if (!daily) {
      throw new NotFoundException('Tagihan harian tidak ditemukan');
    }
    if (daily.driver_id !== driverId) {
      throw new BadRequestException(
        'Anda tidak memiliki akses untuk tagihan ini',
      );
    }
    if (daily.status === 'paid' || daily.status === 'cancelled') {
      throw new BadRequestException(
        'Tagihan harian ini tidak dapat diajukan izin telat',
      );
    }

    // Satu tagihan hanya boleh punya satu izin aktif (pending/approved).
    const existing = await this.latePaymentRepository.findOne({
      where: {
        daily_payment_id: daily.id,
        status: In(['pending', 'approved']),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Izin telat untuk tagihan ini sudah diajukan',
      );
    }

    const driverName = daily.driver
      ? `${daily.driver.first_name ?? ''} ${daily.driver.last_name ?? ''}`.trim()
      : 'driver';
    const vehicleName = daily.vehicle
      ? `${daily.vehicle.merk} ${daily.vehicle.model}`
      : undefined;

    const payment = this.latePaymentRepository.create({
      driver_id: daily.driver_id,
      driver_name: driverName || 'driver',
      vehicle: vehicleName,
      plate: daily.vehicle?.license_plate,
      amount: Number(daily.amount),
      due_date: daily.payment_date,
      payment_date: new Date(),
      daily_payment_id: daily.id,
      late_days: this.computeLateDays(
        daily.payment_date,
        daily.paid_date ?? new Date(),
      ),
      justification: data.justification?.trim() || 'Izin telat bayar',
      justification_reason: data.justification?.trim(),
      message: data.message?.trim(),
      proof_image: file ? toStoredPath(file) : undefined,
      status: 'pending',
    });

    const result = await this.latePaymentRepository.save(payment);
    const saved = await this.findRawById(result.id);

    return {
      success: true,
      message: 'Pengajuan izin telat berhasil dikirim',
      data: saved,
    };
  }

  /** Daftar izin telat milik driver yang sedang login. */
  async listMine(driverId: string) {
    const result = await this.latePaymentRepository.find({
      where: { driver_id: driverId },
      order: { created_at: 'DESC' },
    });
    return {
      success: true,
      message: 'Late payment requests retrieved successfully',
      data: result,
    };
  }

  /**
   * Ringkasan keterlambatan driver untuk dasar "limit hutang".
   * Hari telat yang sudah punya izin disetujui (approved) TIDAK dihitung.
   */
  async getLateSummary(driverId: string) {
    const rows = await this.dailyPaymentRepository.find({
      where: { driver_id: driverId },
      order: { payment_date: 'ASC' },
    });

    const today = startOfToday();
    const candidates = rows.filter(
      (r) =>
        r.status !== 'paid' &&
        r.status !== 'cancelled' &&
        new Date(r.payment_date).getTime() < today.getTime(),
    );

    const ids = candidates.map((c) => c.id);
    const izins = ids.length
      ? await this.latePaymentRepository.find({
          where: { daily_payment_id: In(ids) },
        })
      : [];

    // Pilih status izin paling relevan per tagihan (pending/approved diprioritaskan).
    const izinStatusByDp = new Map<string, string>();
    for (const izin of izins) {
      if (!izin.daily_payment_id) continue;
      const prev = izinStatusByDp.get(izin.daily_payment_id);
      if (!prev || (prev === 'rejected' && izin.status !== 'rejected')) {
        izinStatusByDp.set(izin.daily_payment_id, izin.status);
      }
    }

    let totalLateDays = 0;
    let countableLateDays = 0;
    let permittedLateDays = 0;

    const entries = candidates.map((c) => {
      const lateDays = this.computeLateDays(
        c.payment_date,
        c.paid_date ?? new Date(),
      );
      const izinStatus = izinStatusByDp.get(c.id) ?? null;
      const isPermitted = izinStatus === 'approved';

      totalLateDays += lateDays;
      if (isPermitted) permittedLateDays += lateDays;
      else countableLateDays += lateDays;

      return {
        daily_payment_id: c.id,
        payment_date: c.payment_date,
        amount: Number(c.amount),
        status: c.status,
        late_days: lateDays,
        izin_status: izinStatus,
        is_permitted: isPermitted,
      };
    });

    return {
      success: true,
      message: 'Late payment summary retrieved successfully',
      data: {
        driver_id: driverId,
        entries,
        total_late_days: totalLateDays,
        countable_late_days: countableLateDays,
        permitted_late_days: permittedLateDays,
      },
    };
  }

  async approve(
    id: string,
    adminNote?: string,
  ): Promise<{ success: boolean; message: string; data: LatePayment }> {
    const payment = await this.findRawById(id);
    if (!payment) {
      throw new NotFoundException('Late payment not found');
    }

    payment.status = 'approved';
    if (adminNote) payment.admin_note = adminNote;
    const result = await this.latePaymentRepository.save(payment);

    const saved = await this.findRawById(result.id);

    const rentalIds = saved?.rentals?.map((r) => r.id) || [];

    // Auto-create Finance hanya untuk pengajuan lama berbasis rental.
    // Izin telat (daily_payment_id) tidak membuat tagihan baru.
    if (!payment.daily_payment_id && rentalIds.length > 0) {
      try {
        const refNumber = `LATE/${Date.now()}`;
        await this.financesService.create({
          payment_date: new Date().toISOString(),
          reference_number: refNumber,
          payment_method: 'transfer',
          amount_received: Number(payment.amount),
          payer: payment.driver_name || 'driver',
          driver_id: payment.driver_id,
          finance_type: 'paid',
          notes: adminNote || 'Auto-created from late payment approval',
          rental_ids: rentalIds,
        });
      } catch (err) {
        console.error('Failed to auto-create finance for late payment:', err);
      }
    }

    return {
      success: true,
      message: 'Late payment approved successfully',
      data: saved!,
    };
  }

  async reject(
    id: string,
    adminNote?: string,
  ): Promise<{ success: boolean; message: string; data: LatePayment }> {
    const payment = await this.findRawById(id);
    if (!payment) {
      throw new NotFoundException('Late payment not found');
    }

    payment.status = 'rejected';
    if (adminNote) payment.admin_note = adminNote;
    const result = await this.latePaymentRepository.save(payment);

    const saved = await this.findRawById(result.id);

    return {
      success: true,
      message: 'Late payment rejected successfully',
      data: saved!,
    };
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.latePaymentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Late payment not found');
    }
    return {
      success: true,
      message: 'Late payment deleted successfully',
    };
  }
}
