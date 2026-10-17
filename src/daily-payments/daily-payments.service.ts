import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { DailyPayment } from './entities/daily-payment.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { VendorVehicle } from '../vendor-vehicle/entities/vendor-vehicle.entity';
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { KoinTransaction } from '../koin/entities/koin-transaction.entity';
import { PayDailyPaymentDto } from './dto/pay-daily-payment.dto';
import { MethodPayment } from '../method-payment/entities/method-payment.entity';
import { LatePayment } from '../late-payments/entities/late-payment.entity';
import { removeStoredFile, toStoredPath } from '../common/proof-upload.util';

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

@Injectable()
export class DailyPaymentsService {
  private readonly logger = new Logger(DailyPaymentsService.name);

  constructor(
    @InjectRepository(DailyPayment)
    private readonly dailyPaymentsRepository: Repository<DailyPayment>,
    @InjectRepository(Rental)
    private readonly rentalsRepository: Repository<Rental>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(VendorVehicle)
    private readonly vendorRepository: Repository<VendorVehicle>,
    @InjectRepository(LatePayment)
    private readonly latePaymentRepository: Repository<LatePayment>,
    private readonly dataSource: DataSource,
  ) {}

  private async findKoinForUpdate(
    queryRunner: QueryRunner,
    driverId: string,
  ): Promise<DriverKoin | null> {
    const rows = await queryRunner.query(
      'SELECT id, driver_id, balance, created_at, updated_at FROM driver_saldo WHERE driver_id = $1 FOR UPDATE',
      [driverId],
    );
    if (!rows || rows.length === 0) return null;
    return queryRunner.manager.create(
      DriverKoin,
      rows[0] as Partial<DriverKoin>,
    );
  }

  @Cron('5 0 * * *')
  async handleDailyPayments() {
    this.logger.log('Cron: generating daily payments for active rentals...');
    const today = getTodayStart();
    const todayStr = toLocalDateString(today);

    try {
      const activeRentals = await this.rentalsRepository
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.vehicle', 'vehicle')
        .leftJoinAndSelect('r.driver', 'driver')
        .where('r.status = :activeStatus', { activeStatus: 'active' })
        .andWhere('r.start_date <= :today', { today: todayStr })
        .andWhere('r.end_date >= :today', { today: todayStr })
        .andWhere('r.created_at < :dayStart', { dayStart: today })
        .getMany();

      this.logger.log(
        `Found ${activeRentals.length} active rentals for daily payment generation`,
      );

      for (const rental of activeRentals) {
        const existing = await this.dailyPaymentsRepository
          .createQueryBuilder('dp')
          .where('dp.rental_id = :rentalId', { rentalId: rental.id })
          .andWhere('dp.payment_date = :today', { today: todayStr })
          .getOne();

        if (existing) continue;

        const dailyAmount = Number(rental.daily_rate) || 0;
        const rentalNumber =
          rental.rental_number || `RENT-${rental.id.slice(0, 8)}`;

        const now = new Date();
        const ym = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastPayment = await this.dailyPaymentsRepository
          .createQueryBuilder('dp')
          .where('dp.reference_number LIKE :prefix', { prefix: `PAY-${ym}/%` })
          .orderBy('dp.reference_number', 'DESC')
          .getOne();
        let seq = 1;
        if (lastPayment) {
          const parts = lastPayment.reference_number.split('/');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum)) seq = lastNum + 1;
        }
        const refNumber = `PAY-${ym}/${String(seq).padStart(4, '0')}`;

        const dailyPayment = this.dailyPaymentsRepository.create({
          rental_id: rental.id,
          driver_id: rental.driver_id,
          vehicle_id: rental.vehicle_id,
          payment_date: todayStr,
          amount: dailyAmount,
          status: 'unpaid',
          reference_number: refNumber,
          notes: `Daily payment for rental ${rentalNumber}`,
        });

        await this.dailyPaymentsRepository.save(dailyPayment);
        this.logger.log(
          `Created daily payment: ${rental.rental_number} ${todayStr} Rp ${dailyAmount}`,
        );
      }

      this.logger.log('Daily payments generation completed');
    } catch (error) {
      this.logger.error('Failed to generate daily payments:', error);
    }
  }

  async getDailyPayments(query?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const today = getTodayStart();
    const todayStr = toLocalDateString(today);

    const qb = this.dailyPaymentsRepository
      .createQueryBuilder('dp')
      .leftJoinAndSelect('dp.driver', 'driver')
      .leftJoinAndSelect('dp.vehicle', 'vehicle')
      .leftJoinAndSelect('dp.rental', 'rental')
      .leftJoinAndSelect('vehicle.vendor', 'vendor')
      .leftJoinAndSelect('dp.method_payment', 'method_payment')
      .orderBy('dp.payment_date', 'DESC')
      .addOrderBy('dp.created_at', 'DESC');

    if (query?.status) {
      qb.where('dp.status = :status', { status: query.status });
    } else {
      // 'pending' (menunggu verifikasi) & 'rejected' (ditolak, menunggu
      // submit ulang driver) tetap muncul walau tanggal lampau.
      qb.where(
        '(dp.payment_date = :today OR (dp.payment_date < :today AND dp.status IN (:...pastStatuses)))',
        { today: todayStr, pastStatuses: ['unpaid', 'pending', 'rejected'] },
      );
    }

    if (query?.search) {
      qb.andWhere(
        `(driver.first_name ILIKE :search OR driver.last_name ILIKE :search OR dp.reference_number ILIKE :search OR vehicle.license_plate ILIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const items = data.map((dp) => ({
      id: dp.id,
      rental_id: dp.rental_id,
      rental_number: dp.rental?.rental_number || '-',
      driver_id: dp.driver_id,
      driver_name: dp.driver
        ? `${dp.driver.first_name} ${dp.driver.last_name}`
        : '-',
      vehicle_id: dp.vehicle_id,
      vehicle_name: dp.vehicle ? `${dp.vehicle.merk} ${dp.vehicle.model}` : '-',
      license_plate: dp.vehicle?.license_plate || '-',
      vendor_name: dp.vehicle?.vendor?.name || '-',
      payment_date: dp.payment_date,
      amount: Number(dp.amount),
      status: dp.status,
      payment_method: dp.payment_method,
      method_payment_id: dp.method_payment_id,
      method_payment: dp.method_payment
        ? {
            id: dp.method_payment.id,
            code: dp.method_payment.code,
            name: dp.method_payment.name,
            provider: dp.method_payment.provider,
            method: dp.method_payment.method,
            account_number: dp.method_payment.account_number,
            account_holder: dp.method_payment.account_holder,
          }
        : null,
      source_account: dp.source_account,
      proof_image: dp.proof_image,
      transaction_id: dp.transaction_id,
      payment_notes: dp.payment_notes,
      rejection_reason: dp.rejection_reason,
      paid_date: dp.paid_date,
      reference_number: dp.reference_number,
      notes: dp.notes,
      created_at: dp.created_at,
      updated_at: dp.updated_at,
    }));

    return {
      success: true,
      message: 'Daily payments retrieved successfully',
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminFeePayments(query?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;

    return {
      success: true,
      message: 'Use /finances/admin-fees endpoint instead',
      data: [],
      meta: { total: 0, page, limit, totalPages: 0 },
    };
  }

  async getMyDailyPayments(
    driverId: string,
    query?: { page?: number; limit?: number },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const qb = this.dailyPaymentsRepository
      .createQueryBuilder('dp')
      .leftJoinAndSelect('dp.vehicle', 'vehicle')
      .leftJoinAndSelect('dp.rental', 'rental')
      .leftJoinAndSelect('vehicle.vendor', 'vendor')
      .leftJoinAndSelect('dp.method_payment', 'method_payment')
      .where('dp.driver_id = :driverId', { driverId })
      .orderBy('dp.payment_date', 'DESC')
      .addOrderBy('dp.created_at', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const items = data.map((dp) => ({
      id: dp.id,
      rental_id: dp.rental_id,
      rental_number: dp.rental?.rental_number || '-',
      driver_id: dp.driver_id,
      vehicle_id: dp.vehicle_id,
      vehicle_name: dp.vehicle ? `${dp.vehicle.merk} ${dp.vehicle.model}` : '-',
      license_plate: dp.vehicle?.license_plate || '-',
      vendor_name: dp.vehicle?.vendor?.name || '-',
      payment_date: dp.payment_date,
      amount: Number(dp.amount),
      status: dp.status,
      payment_method: dp.payment_method,
      method_payment_id: dp.method_payment_id,
      method_payment: dp.method_payment
        ? {
            id: dp.method_payment.id,
            code: dp.method_payment.code,
            name: dp.method_payment.name,
            provider: dp.method_payment.provider,
            method: dp.method_payment.method,
            account_number: dp.method_payment.account_number,
            account_holder: dp.method_payment.account_holder,
          }
        : null,
      source_account: dp.source_account,
      proof_image: dp.proof_image,
      transaction_id: dp.transaction_id,
      payment_notes: dp.payment_notes,
      rejection_reason: dp.rejection_reason,
      paid_date: dp.paid_date,
      reference_number: dp.reference_number,
      notes: dp.notes,
      created_at: dp.created_at,
      updated_at: dp.updated_at,
    }));

    const ids = items.map((i) => i.id);
    const izins = ids.length
      ? await this.latePaymentRepository.find({
          where: { daily_payment_id: In(ids) },
        })
      : [];
    const izinByDp = new Map<string, LatePayment>();
    for (const izin of izins) {
      if (!izin.daily_payment_id) continue;
      const prev = izinByDp.get(izin.daily_payment_id);
      if (!prev || (prev.status === 'rejected' && izin.status !== 'rejected')) {
        izinByDp.set(izin.daily_payment_id, izin);
      }
    }

    return {
      success: true,
      message: 'Driver daily payments retrieved successfully',
      data: items.map((item) => {
        const izin = izinByDp.get(item.id);
        return {
          ...item,
          izin_id: izin?.id ?? null,
          izin_status: izin?.status ?? null,
          izin: izin
            ? {
                id: izin.id,
                status: izin.status,
                late_days: izin.late_days,
                justification: izin.justification,
                justification_reason: izin.justification_reason,
                message: izin.message,
                admin_note: izin.admin_note,
                due_date: izin.due_date,
                amount: Number(izin.amount),
                payment_date: izin.payment_date,
                created_at: izin.created_at,
                updated_at: izin.updated_at,
              }
            : null,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(id: string, status: string, reason?: string) {
    const allowed = ['paid', 'pending', 'unpaid', 'cancelled', 'rejected'];
    if (!allowed.includes(status)) {
      throw new BadRequestException('Status pembayaran tidak valid');
    }
    const payment = await this.dailyPaymentsRepository.findOne({
      where: { id },
    });
    if (!payment) {
      return { success: false, message: 'Daily payment not found' };
    }
    payment.status = status;
    // Alasan penolakan hanya relevan saat `rejected`, di status lain dibersihkan.
    payment.rejection_reason =
      status === 'rejected' ? reason?.trim() || null : null;
    await this.dailyPaymentsRepository.save(payment);
    return {
      success: true,
      message: 'Daily payment status updated',
      data: payment,
    };
  }

  async getMyDailyPayment(id: string, driverId: string) {
    const dp = await this.dailyPaymentsRepository
      .createQueryBuilder('dp')
      .leftJoinAndSelect('dp.vehicle', 'vehicle')
      .leftJoinAndSelect('dp.rental', 'rental')
      .leftJoinAndSelect('vehicle.vendor', 'vendor')
      .leftJoinAndSelect('dp.method_payment', 'method_payment')
      .where('dp.id = :id', { id })
      .getOne();

    if (!dp) {
      throw new NotFoundException('Tagihan harian tidak ditemukan');
    }
    if (dp.driver_id !== driverId) {
      throw new NotFoundException('Tagihan harian tidak ditemukan');
    }

    return {
      success: true,
      message: 'Daily payment retrieved successfully',
      data: {
        id: dp.id,
        rental_id: dp.rental_id,
        rental_number: dp.rental?.rental_number || '-',
        driver_id: dp.driver_id,
        vehicle_id: dp.vehicle_id,
        vehicle_name: dp.vehicle
          ? `${dp.vehicle.merk} ${dp.vehicle.model}`
          : '-',
        license_plate: dp.vehicle?.license_plate || '-',
        vendor_name: dp.vehicle?.vendor?.name || '-',
        payment_date: dp.payment_date,
        amount: Number(dp.amount),
        status: dp.status,
        payment_method: dp.payment_method,
        method_payment_id: dp.method_payment_id,
        method_payment: dp.method_payment
          ? {
              id: dp.method_payment.id,
              code: dp.method_payment.code,
              name: dp.method_payment.name,
              provider: dp.method_payment.provider,
              method: dp.method_payment.method,
              account_number: dp.method_payment.account_number,
              account_holder: dp.method_payment.account_holder,
            }
          : null,
        source_account: dp.source_account,
        proof_image: dp.proof_image,
        transaction_id: dp.transaction_id,
        payment_notes: dp.payment_notes,
        rejection_reason: dp.rejection_reason,
        paid_date: dp.paid_date,
        reference_number: dp.reference_number || '-',
        notes: dp.notes || '',
        created_at: dp.created_at,
        updated_at: dp.updated_at,
      },
    };
  }

  async payMyDailyPayment(
    id: string,
    dto: PayDailyPaymentDto,
    driverId: string,
    file?: Express.Multer.File,
  ) {
    const proofPath = file ? toStoredPath(file) : null;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const rows = (await queryRunner.query(
        'SELECT id, rental_id, driver_id, vehicle_id, payment_date, amount, status, reference_number, notes, proof_image FROM daily_payments WHERE id = $1 FOR UPDATE',
        [id],
      )) as Array<{
        id: string;
        rental_id: string;
        driver_id: string;
        vehicle_id: string;
        payment_date: Date;
        amount: number;
        status: string;
        reference_number: string | null;
        notes: string | null;
        proof_image: string | null;
      }>;
      if (!rows || rows.length === 0) {
        throw new NotFoundException('Tagihan harian tidak ditemukan');
      }
      const row = rows[0];
      if (row.driver_id !== driverId) {
        throw new NotFoundException('Tagihan harian tidak ditemukan');
      }
      if (row.status === 'paid') {
        throw new BadRequestException('Tagihan harian sudah lunas');
      }
      if (row.status === 'pending') {
        throw new BadRequestException(
          'Pembayaran sudah dikonfirmasi dan sedang menunggu verifikasi admin',
        );
      }
      if (row.status === 'cancelled') {
        throw new BadRequestException('Tagihan harian sudah dibatalkan');
      }

      // --- Rekening tujuan & bukti bayar ---
      let methodPayment: MethodPayment | null = null;
      if (dto.method_payment_id) {
        methodPayment = await queryRunner.manager.findOne(MethodPayment, {
          where: { id: dto.method_payment_id },
        });
        if (!methodPayment) {
          throw new BadRequestException('Rekening tujuan tidak ditemukan');
        }
        if (!methodPayment.is_active) {
          throw new BadRequestException('Rekening tujuan sudah tidak aktif');
        }
      }

      const paymentMethod = methodPayment
        ? methodPayment.method === 'e_wallet' || methodPayment.method === 'qris'
          ? 'e-wallet'
          : 'transfer'
        : dto.payment_method;
      const isTransferLike =
        paymentMethod === 'transfer' || paymentMethod === 'e-wallet';

      if (isTransferLike) {
        if (!methodPayment) {
          throw new BadRequestException('Rekening tujuan wajib dipilih');
        }
        if (!dto.transaction_id?.trim()) {
          throw new BadRequestException('ID transaksi wajib diisi');
        }
        if (!proofPath) {
          throw new BadRequestException('Bukti pembayaran wajib diunggah');
        }
      }

      // Transfer/e-wallet -> menunggu verifikasi admin; koin/tunai -> lunas.
      const nextStatus = isTransferLike ? 'pending' : 'paid';

      const total = Number(row.amount);
      const amount = Number(dto.amount);
      if (amount <= 0) {
        throw new BadRequestException('Nominal pembayaran harus lebih dari 0');
      }
      if (amount > total) {
        throw new BadRequestException(
          `Nominal pembayaran (Rp ${amount.toLocaleString('id-ID')}) melebihi tagihan (Rp ${total.toLocaleString('id-ID')}).`,
        );
      }

      if (paymentMethod === 'saldo') {
        const koin = await this.findKoinForUpdate(queryRunner, driverId);
        const balanceBefore = koin ? Number(koin.balance) : 0;
        const balanceAfter = balanceBefore - amount;
        if (balanceAfter < 0) {
          throw new BadRequestException(
            `Koin driver tidak mencukupi. Koin saat ini: Rp ${balanceBefore.toLocaleString('id-ID')}, diperlukan: Rp ${amount.toLocaleString('id-ID')}`,
          );
        }
        if (koin) {
          koin.balance = balanceAfter;
          await queryRunner.manager.save(koin);
        }
        const tx = queryRunner.manager.create(KoinTransaction, {
          driver_id: driverId,
          driver_saldo_id: koin?.id,
          type: 'rental_payment',
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_id: id,
          reference_number:
            dto.transaction_id?.trim() ||
            row.reference_number ||
            `PAY-${Date.now()}`,
          notes:
            dto.payment_notes ||
            `Koin berkurang untuk tagihan harian ${row.reference_number || id}`,
        });
        await queryRunner.manager.save(tx);
      }

      await queryRunner.manager.update(DailyPayment, id, {
        status: nextStatus,
        payment_method: paymentMethod,
        method_payment_id: methodPayment?.id ?? null,
        source_account: dto.source_account?.trim() || null,
        proof_image: proofPath,
        paid_date: new Date(dto.payment_date),
        // Submit ulang (mis. setelah ditolak) menimpa data driver lama;
        // alasan penolakan dihapus karena sudah diajukan ulang.
        rejection_reason: null,
        // Nomor tagihan (`reference_number`) & catatan tagihan (`notes`)
        // tidak ditimpa — data driver disimpan di kolom terpisah.
        transaction_id: dto.transaction_id?.trim() || null,
        payment_notes: dto.payment_notes?.trim() || null,
      });

      await queryRunner.commitTransaction();

      // Bukti lama diganti bukti baru — file sebelumnya dihapus dari disk
      // (dilakukan setelah commit supaya kalau gagal, file lama tetap ada).
      if (row.proof_image && row.proof_image !== proofPath) {
        removeStoredFile(row.proof_image);
      }

      return {
        success: true,
        message:
          nextStatus === 'pending'
            ? 'Konfirmasi pembayaran terkirim dan menunggu verifikasi admin'
            : paymentMethod === 'saldo'
              ? 'Tagihan harian berhasil dibayar menggunakan Koin'
              : 'Pembayaran tagihan harian berhasil dicatat',
        data: {
          id,
          amount,
          payment_method: paymentMethod,
          status: nextStatus,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to pay daily payment:', error);
      removeStoredFile(proofPath);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Gagal memproses pembayaran tagihan harian',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
