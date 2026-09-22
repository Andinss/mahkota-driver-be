import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, QueryRunner, QueryFailedError } from 'typeorm';
import { Finance } from './entities/finance.entity';
import { FinancePayment } from './entities/finance-payment.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { VendorVehicle } from '../vendor-vehicle/entities/vendor-vehicle.entity';
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { KoinTransaction } from '../koin/entities/koin-transaction.entity';
import { AddFinanceDto } from './dto/add-finance.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { FinanceExportDto } from './dto/finance-export.dto';
import { CreateFinancePaymentDto } from './dto/create-finance-payment.dto';
import { UpdateFinancePaymentDto } from './dto/update-finance-payment.dto';
import { RentalsService } from '../rentals/rentals.service';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

const FINANCE_STATUS = [
  'unpaid',
  'pending',
  'paid',
  'cancelled',
];

interface PaymentTotals {
  paid: number;
  pending: number;
  count: number;
}

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Finance)
    private readonly financesRepository: Repository<Finance>,
    @InjectRepository(FinancePayment)
    private readonly financePaymentRepository: Repository<FinancePayment>,
    @InjectRepository(Rental)
    private readonly rentalsRepository: Repository<Rental>,
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(DriverKoin)
    private readonly driverSaldoRepository: Repository<DriverKoin>,
    @InjectRepository(KoinTransaction)
    private readonly saldoTransactionRepository: Repository<KoinTransaction>,
    private readonly rentalsService: RentalsService,
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
    return this.driverSaldoRepository.create(rows[0] as Partial<DriverKoin>);
  }

  private async lockFinance(
    queryRunner: QueryRunner,
    id: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      'SELECT id FROM finances WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Finance not found');
    }
  }

  private async findRawById(id: string): Promise<Finance | null> {
    return this.financesRepository.findOne({
      where: { id },
      relations: { driver: true, rentals: true, payments: true },
    });
  }

  /**
   * Admin fee join (PER MOBIL/RENTAL yang pertama kali dibiayai).
   * - Reguler  -> Rp 500.000
   * - Premium  -> Rp 700.000
   * Fee hanya dikenakan saat sebuah rental/mobil BARU pertama kali dipakai
   * dalam finance. Jika rental sudah pernah terhubung finance manapun,
   * tidak dikenakan biaya lagi.
   */
  private async computeAdminJoinFee(
    driverId: string,
    rentalIds?: string[],
    queryRunner?: QueryRunner,
  ): Promise<number> {
    if (!rentalIds || rentalIds.length === 0) return 0;

    const manager = queryRunner?.manager ?? this.dataSource.manager;

    const rentals = await manager.find(Rental, {
      where: { id: In(rentalIds), driver_id: driverId },
      relations: { vehicle: true },
    });
    if (rentals.length === 0) return 0;

    const foundIds = rentals.map((r) => r.id);

    // Rental yang sudah pernah terhubung finance manapun = sudah 'join' ->
    // tidak dikenakan fee lagi.
    const raw = (await manager.query(
      'SELECT DISTINCT rental_id FROM finance_rentals WHERE rental_id = ANY($1)',
      [foundIds],
    )) as { rental_id: string }[];
    const joinedIds = new Set(raw.map((row) => row.rental_id));

    let fee = 0;
    for (const rental of rentals) {
      if (joinedIds.has(rental.id)) continue;
      const category = rental.vehicle?.pricing_category;
      if (category === 'Premium') fee += 700_000;
      else if (category === 'Reguler') fee += 500_000;
    }
    return fee;
  }

  private getPaymentTotals(
    payments: FinancePayment[] | undefined,
  ): PaymentTotals {
    const list = payments || [];
    let paid = 0;
    let pending = 0;
    for (const p of list) {
      const amount = Number(p.amount) || 0;
      if (p.status === 'paid') paid += amount;
      else if (p.status === 'pending') pending += amount;
    }
    return { paid, pending, count: list.length };
  }

  private resolveTotalAmount(finance: Finance): number {
    return Number(finance.fee_admin_join) || 0;
  }

  private deriveStatus(
    total: number,
    paid: number,
    pending: number,
    currentStatus?: string,
  ): string {
    if (currentStatus === 'cancelled') return 'cancelled';
    if (total > 0 && paid >= total) return 'paid';
    if (pending > 0 && paid === 0) return 'pending';
    return 'unpaid';
  }

  private paymentView(payment: FinancePayment) {
    return {
      id: payment.id,
      finance_id: payment.finance_id,
      driver_id: payment.driver_id,
      amount: Number(payment.amount),
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      reference_number: payment.reference_number,
      notes: payment.notes,
      status: payment.status,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
    };
  }

  private buildFinanceView(
    finance: Finance,
    totals?: PaymentTotals,
    fallback?: { vehicle?: Vehicle; vendor?: VendorVehicle },
  ) {
    const t = totals || this.getPaymentTotals(finance.payments);
    const total = this.resolveTotalAmount(finance);
    const paidAmount = Math.min(t.paid, total);
    const remainingAmount = Math.max(0, total - paidAmount);
    const status = this.deriveStatus(total, t.paid, t.pending, finance.status);

    const rentals = finance.rentals || [];
    const firstRental = rentals[0];
    const vehicle = firstRental?.vehicle ?? fallback?.vehicle;
    const vendor = vehicle?.vendor ?? fallback?.vendor;

    return {
      id: finance.id,
      payment_date: finance.payment_date,
      reference_number: finance.reference_number,
      payment_method: finance.payment_method,
      amount_received: paidAmount,
      fee_admin_join: Number(finance.fee_admin_join) || 0,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      payments_count:
        finance.payments?.length ??
        (typeof t.count === 'number' ? t.count : 0),
      notes: finance.notes,
      payer: finance.payer,
      driver_id: finance.driver_id,
      driver: finance.driver,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            merk: vehicle.merk,
            model: vehicle.model,
            license_plate: vehicle.license_plate,
            engine_status: vehicle.engine_status,
          }
        : undefined,
      vendor: vendor
        ? {
            id: vendor.id,
            name: vendor.name,
            owner_name: vendor.owner_name,
          }
        : undefined,
      finance_type: status,
      status,
      rentals: rentals,
      payments: finance.payments
        ? finance.payments
            .slice()
            .sort(
              (a, b) =>
                new Date(a.payment_date).getTime() -
                  new Date(b.payment_date).getTime() ||
                new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
            )
            .map((p) => this.paymentView(p))
        : undefined,
      is_active: finance.is_active,
      created_at: finance.created_at,
      updated_at: finance.updated_at,
    };
  }

  private async attachTotals(
    finances: Finance[],
  ): Promise<Record<string, PaymentTotals>> {
    const ids = finances.map((f) => f.id);
    const result: Record<string, PaymentTotals> = {};
    if (ids.length === 0) return result;

    const rows: any[] = await this.financesRepository
      .createQueryBuilder('f')
      .select('p.finance_id', 'finance_id')
      .addSelect(
        `COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0)`,
        'paid',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0)`,
        'pending',
      )
      .addSelect('COUNT(p.id)', 'count')
      .leftJoin('f.payments', 'p')
      .where('f.id IN (:...ids)', { ids })
      .groupBy('p.finance_id')
      .getRawMany();

    for (const row of rows) {
      result[row.finance_id] = {
        paid: Number(row.paid) || 0,
        pending: Number(row.pending) || 0,
        count: Number(row.count) || 0,
      };
    }
    return result;
  }

  private async getFallbackVehicleMap(
    finances: Finance[],
  ): Promise<Map<string, { vehicle?: Vehicle; vendor?: VendorVehicle }>> {
    const missing = finances.filter(
      (f) => !f.rentals || f.rentals.length === 0 || !f.rentals[0]?.vehicle,
    );
    if (missing.length === 0) return new Map();

    const driverIds = [
      ...new Set(missing.map((f) => f.driver_id).filter(Boolean)),
    ];
    if (driverIds.length === 0) return new Map();

    const rows = await this.rentalsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.vendor', 'vendor')
      .where('r.driver_id IN (:...driverIds)', { driverIds })
      .orderBy('r.created_at', 'DESC')
      .getMany();

    const map = new Map<string, { vehicle?: Vehicle; vendor?: VendorVehicle }>();
    for (const r of rows) {
      if (!map.has(r.driver_id) && r.vehicle) {
        map.set(r.driver_id, {
          vehicle: r.vehicle,
          vendor: r.vehicle.vendor,
        });
      }
    }
    return map;
  }

  async findAll(query?: FinanceQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals')
      .leftJoinAndSelect('rentals.vehicle', 'rental_vehicle')
      .leftJoinAndSelect('rental_vehicle.vendor', 'rental_vehicle_vendor')
      .orderBy('f.created_at', 'DESC');

    if (query?.search) {
      qb.andWhere(
        '(f.reference_number ILIKE :search OR f.payer ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query?.payment_method) {
      qb.andWhere('f.payment_method = :method', {
        method: query.payment_method,
      });
    }

    if (query?.driver_id) {
      qb.andWhere('f.driver_id = :driverId', { driverId: query.driver_id });
    }

    if (query?.rental_id) {
      qb.innerJoin(
        'f.rentals',
        'filter_rentals',
        'filter_rentals.id = :rentalId',
        { rentalId: query.rental_id },
      );
    }

    if (query?.status) {
      qb.andWhere('f.status IN (:...statuses)', {
        statuses: Array.isArray(query.status) ? query.status : [query.status],
      });
    }

    if (query?.start_date) {
      qb.andWhere('f.payment_date >= :startDate', {
        startDate: query.start_date,
      });
    }

    if (query?.end_date) {
      qb.andWhere('f.payment_date <= :endDate', {
        endDate: query.end_date,
      });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const fallbackMap = await this.getFallbackVehicleMap(data);

    const totals = await this.attachTotals(data);

    const items = data.map((f) =>
      this.buildFinanceView(
        f,
        totals[f.id] || { paid: 0, pending: 0, count: 0 },
        fallbackMap.get(f.driver_id),
      ),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Finances retrieved successfully',
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findByReferenceNumber(referenceNumber: string) {
    const finance = await this.financesRepository.findOne({
      where: { reference_number: referenceNumber },
      relations: {
        driver: true,
        rentals: { vehicle: { vendor: true }, driver: true },
        payments: true,
      },
    });
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }
    return {
      success: true,
      message: 'Finance retrieved successfully',
      data: this.buildFinanceView(finance),
    };
  }

  async findById(id: string) {
    const finance = await this.financesRepository.findOne({
      where: { id },
      relations: {
        driver: true,
        rentals: { vehicle: { vendor: true }, driver: true },
        payments: true,
      },
    });
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }
    return {
      success: true,
      message: 'Finance retrieved successfully',
      data: this.buildFinanceView(finance),
    };
  }

  async findDetailById(id: string) {
    const finance = await this.financesRepository.findOne({
      where: { id },
      relations: {
        driver: true,
        rentals: { vehicle: { vendor: true }, driver: true },
        payments: true,
      },
    });

    if (!finance) {
      throw new NotFoundException('Finance not found');
    }

    return {
      success: true,
      message: 'Finance detail retrieved successfully',
      data: this.buildFinanceView(finance),
    };
  }

  async getSummary() {
    const totalActive = await this.financesRepository.count({
      where: { is_active: true },
    });
    const totalInactive = await this.financesRepository.count({
      where: { is_active: false },
    });
    const totalRecords = await this.financesRepository.count();

    // Uang masuk hanya dihitung dari pembayaran berstatus 'paid'
    const totalResult = await this.financesRepository
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.amount_received), 0)', 'total')
      .where('f.status != :cancelled', { cancelled: 'cancelled' })
      .getRawOne();

    // Total bulan ini 
    const monthResult = await this.financesRepository
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.amount_received), 0)', 'total')
      .where('f.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        'EXTRACT(MONTH FROM f.payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)',
      )
      .andWhere(
        'EXTRACT(YEAR FROM f.payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)',
      )
      .getRawOne();

    // Total hari ini 
    const todayResult = await this.financesRepository
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.amount_received), 0)', 'total')
      .where('f.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('f.payment_date = CURRENT_DATE')
      .getRawOne();

    const byMethod = await this.financesRepository
      .createQueryBuilder('f')
      .select('f.payment_method', 'method')
      .addSelect('COALESCE(SUM(f.amount_received), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .where('f.status != :cancelled', { cancelled: 'cancelled' })
      .groupBy('f.payment_method')
      .getRawMany();

    const byType = await this.financesRepository
      .createQueryBuilder('f')
      .select('f.status', 'type')
      .addSelect('COALESCE(SUM(f.amount_received), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .groupBy('f.status')
      .getRawMany();

    const amountByMethod: Record<string, number> = {};
    for (const row of byMethod) {
      amountByMethod[row.method] = Number(row.total);
    }

    const amountByType: Record<string, number> = {};
    const countByType: Record<string, number> = {};
    for (const status of FINANCE_STATUS) {
      amountByType[status] = 0;
      countByType[status] = 0;
    }
    for (const row of byType) {
      amountByType[row.type || 'unpaid'] = Number(row.total);
      countByType[row.type || 'unpaid'] = Number(row.count);
    }

    return {
      success: true,
      message: 'Finance summary retrieved successfully',
      data: {
        total_amount_received: Number(totalResult?.total || 0),
        total_this_month: Number(monthResult?.total || 0),
        total_today: Number(todayResult?.total || 0),
        total_active: totalActive,
        total_inactive: totalInactive,
        total_records: totalRecords,
        amount_by_method: amountByMethod,
        amount_by_type: amountByType,
        count_by_type: countByType,
      },
    };
  }

  async getAdminFees(query?: FinanceQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals')
      .leftJoinAndSelect('rentals.vehicle', 'rental_vehicle')
      .leftJoinAndSelect('rental_vehicle.vendor', 'rental_vehicle_vendor')
      .where('f.fee_admin_join > 0')
      .orderBy('f.created_at', 'DESC');

    if (query?.search) {
      qb.andWhere(
        '(f.reference_number ILIKE :search OR f.payer ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const totals = await this.attachTotals(data);

    const items = data.map((f) =>
      this.buildFinanceView(
        f,
        totals[f.id] || { paid: 0, pending: 0, count: 0 },
      ),
    );

    return {
      success: true,
      message: 'Admin fees retrieved successfully',
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMonthlySummary(year?: number) {
    const currentYear = year || new Date().getFullYear();

    const rows = await this.financesRepository
      .createQueryBuilder('f')
      .select('EXTRACT(MONTH FROM f.payment_date)', 'month')
      .addSelect('COALESCE(SUM(f.amount_received), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .where('EXTRACT(YEAR FROM f.payment_date) = :year', { year: currentYear })
      .andWhere('f.status != :cancelled', { cancelled: 'cancelled' })
      .groupBy('EXTRACT(MONTH FROM f.payment_date)')
      .orderBy('month', 'ASC')
      .getRawMany();

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const found = rows.find((r) => Number(r.month) === month);
      return {
        month,
        total: found ? Number(found.total) : 0,
        count: found ? Number(found.count) : 0,
      };
    });

    return {
      success: true,
      message: 'Monthly finance summary retrieved successfully',
      data: {
        year: currentYear,
        months: monthlyData,
      },
    };
  }

  /**
   * Menerapkan pengaruh koin untuk pembayaran yang valid/paid.
   * - payment_method 'saldo'  -> koin driver berkurang (dibayar dari koin)
   * - metode lain             -> tanpa efek koin; hanya mengurangi tagihan
   */
  private async applyPaidPayment(
    queryRunner: QueryRunner,
    finance: Finance,
    payment: FinancePayment,
  ): Promise<void> {
    const amount = Number(payment.amount);
    if (!(amount > 0) || !finance.driver_id) return;
    if (payment.payment_method !== 'saldo') return;
    const driverId = finance.driver_id;

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
      type: 'rental_payment',
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: finance.id,
      reference_number: payment.reference_number || finance.reference_number,
      notes: `Koin berkurang dari finance ${finance.reference_number}`,
    });
    await queryRunner.manager.save(tx);
  }

  /**
   * Membalik pengaruh uang masuk saat finance dihapus:
   * - payment_method 'saldo'  -> refund (kembalikan koin ke driver)
   * - metode lain             -> tanpa efek koin; pembayaran hanya mengurangi tagihan
   */
  private async reversePaidPayment(
    queryRunner: QueryRunner,
    finance: Finance,
    payment: FinancePayment,
  ): Promise<void> {
    const amount = Number(payment.amount);
    if (!(amount > 0) || !finance.driver_id) return;
    if (payment.payment_method !== 'saldo') return;
    const driverId = finance.driver_id;

    const koin = await this.findKoinForUpdate(queryRunner, driverId);
    const balanceBefore = koin ? Number(koin.balance) : 0;
    const balanceAfter = balanceBefore + amount;

    if (koin) {
      koin.balance = balanceAfter;
      await queryRunner.manager.save(koin);
    } else {
      const newKoin = queryRunner.manager.create(DriverKoin, {
        driver_id: driverId,
        balance: balanceAfter,
      });
      await queryRunner.manager.save(newKoin);
    }

    const tx = queryRunner.manager.create(KoinTransaction, {
      driver_id: driverId,
      driver_saldo_id: koin?.id,
      type: 'refund',
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: finance.id,
      notes: `Refund karena finance ${finance.reference_number} dihapus`,
    });
    await queryRunner.manager.save(tx);
  }

  async create(data: AddFinanceDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { rental_ids, finance_type, ...financeData } = data;

      const driver = await this.driversRepository.findOne({
        where: { id: data.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(
          `Driver with id ${data.driver_id} not found`,
        );
      }

      if (rental_ids && rental_ids.length > 0) {
        const foundRentals = await this.rentalsRepository.find({
          where: { id: In(rental_ids) },
        });
        if (foundRentals.length !== rental_ids.length) {
          const foundIds = foundRentals.map((r) => r.id);
          const missingIds = rental_ids.filter((id) => !foundIds.includes(id));
          throw new NotFoundException(
            `Rentals not found: ${missingIds.join(', ')}`,
          );
        }
      }

      // Admin fee join otomatis per mobil/rental yang baru pertama kali dibiayai
      // (Reguler Rp 500.000, Premium Rp 700.000).
      const autoJoinFee = await this.computeAdminJoinFee(
        data.driver_id,
        rental_ids,
        queryRunner,
      );
      const joinFee = autoJoinFee;

      if (!(joinFee > 0)) {
        throw new BadRequestException(
          'Admin fee harus lebih dari 0',
        );
      }

      const initialAmount = Number(data.amount_received) || 0;

      // Tentukan status pembayaran awal.
      let initialPaymentStatus: 'paid' | 'pending' | null = null;
      if (initialAmount > 0) {
        if (initialAmount > joinFee) {
          throw new BadRequestException(
            'Nominal pembayaran awal tidak boleh melebihi admin fee',
          );
        }
        if (finance_type === 'pending') {
          initialPaymentStatus = 'pending';
        } else if (finance_type === 'unpaid') {
          initialPaymentStatus = null;
        } else {
          initialPaymentStatus = 'paid';
        }
      }

      // Cek duplikasi No. Referensi sebelum simpan (cepat + friendly error).
      const existingRefCount = await this.financesRepository.count({
        where: { reference_number: data.reference_number },
      });
      if (existingRefCount > 0) {
        throw new BadRequestException(
          'No. referensi sudah pernah digunakan. Gunakan nomor lain.',
        );
      }

      const finance = queryRunner.manager.create(Finance, {
        ...financeData,
        amount_received: 0,
        payment_date: new Date(data.payment_date),
        fee_admin_join: joinFee,
        payments: [],
      });

      if (rental_ids && rental_ids.length > 0) {
        finance.rentals = rental_ids.map((id) => ({ id }) as any);
      }

      const savedFinance = await queryRunner.manager.save(finance);

      if (initialPaymentStatus) {
        const payment = queryRunner.manager.create(FinancePayment, {
          finance_id: savedFinance.id,
          driver_id: data.driver_id,
          amount: initialAmount,
          payment_method: data.payment_method,
          payment_date: new Date(data.payment_date),
          reference_number: data.reference_number,
          notes: data.notes
            ? `Pembayaran awal. ${data.notes}`
            : 'Pembayaran awal',
          status: initialPaymentStatus,
        });
        await queryRunner.manager.save(payment);
      }

      const saved = await queryRunner.manager.findOne(Finance, {
        where: { id: savedFinance.id },
        relations: { driver: true, rentals: true, payments: true },
      });

      if (!saved) {
        throw new InternalServerErrorException('Failed to reload finance');
      }

      const totals = this.getPaymentTotals(saved.payments);
      saved.amount_received = totals.paid;
      saved.status = this.deriveStatus(
        joinFee,
        totals.paid,
        totals.pending,
      );
      await queryRunner.manager.save(saved);

      for (const payment of saved.payments) {
        if (payment.status === 'paid') {
          await this.applyPaidPayment(queryRunner, saved, payment);
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Finance created successfully',
        data: this.buildFinanceView(saved),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to create finance:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code: string }).code === '23505'
      ) {
        throw new BadRequestException(
          'No. referensi sudah pernah digunakan. Gunakan nomor lain.',
        );
      }
      throw new InternalServerErrorException('Failed to create finance');
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, data: Partial<AddFinanceDto>) {
    const existingFinance = await this.findRawById(id);
    if (!existingFinance) {
      throw new NotFoundException('Finance not found');
    }

    const oldRentalIds = existingFinance.rentals?.map((r) => r.id) || [];
    const { rental_ids, amount_received, finance_type, ...updateData } = data;

    const updatePayload: any = {
      ...updateData,
      payment_date: data.payment_date ? new Date(data.payment_date) : undefined,
    };

    // Cek duplikasi No. Referensi (abaikan jika tidak berubah dari yang lama).
    if (
      updateData.reference_number &&
      updateData.reference_number !== existingFinance.reference_number
    ) {
      const existingRefCount = await this.financesRepository.count({
        where: { reference_number: updateData.reference_number },
      });
      if (existingRefCount > 0) {
        throw new BadRequestException(
          'No. referensi sudah pernah digunakan. Gunakan nomor lain.',
        );
      }
    }

    try {
      const result = await this.financesRepository.update(id, updatePayload);

      if (result.affected === 0) {
        throw new NotFoundException('Finance not found');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code: string }).code === '23505'
      ) {
        throw new BadRequestException(
          'No. referensi sudah pernah digunakan. Gunakan nomor lain.',
        );
      }
      throw error;
    }

    if (rental_ids !== undefined) {
      if (rental_ids.length > 0) {
        const foundRentals = await this.rentalsRepository.find({
          where: { id: In(rental_ids) },
        });
        if (foundRentals.length !== rental_ids.length) {
          const foundIds = foundRentals.map((r) => r.id);
          const missingIds = rental_ids.filter(
            (rid) => !foundIds.includes(rid),
          );
          throw new NotFoundException(
            `Rentals not found: ${missingIds.join(', ')}`,
          );
        }
      }
      const finance = await this.financesRepository.findOne({ where: { id } });
      if (finance) {
        finance.rentals = rental_ids.map((rid) => ({ id: rid }) as any);
        await this.financesRepository.save(finance);
      }
    }

    const finance = await this.findRawById(id);
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }

    // amount_received dan status selalu dihitung ulang dari pembayaran valid
    const paymentTotals = this.getPaymentTotals(finance.payments);
    finance.amount_received = paymentTotals.paid;
    finance.status = this.deriveStatus(
      this.resolveTotalAmount(finance),
      paymentTotals.paid,
      paymentTotals.pending,
    );
    await this.financesRepository.save(finance);

    return {
      success: true,
      message: 'Finance updated successfully',
      data: this.buildFinanceView(finance),
    };
  }

  async createPayment(financeId: string, dto: CreateFinancePaymentDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.lockFinance(queryRunner, financeId);

      const finance = await queryRunner.manager.findOne(Finance, {
        where: { id: financeId },
        relations: { payments: true },
      });
      if (!finance) {
        throw new NotFoundException('Finance not found');
      }

      if (finance.status === 'cancelled') {
        throw new BadRequestException(
          'Finance sudah dibatalkan dan tidak dapat menerima pembayaran',
        );
      }
      if (finance.status === 'paid') {
        throw new BadRequestException(
          'Finance sudah lunas dan tidak dapat menerima pembayaran lagi',
        );
      }

      const total = this.resolveTotalAmount(finance);
      const totals = this.getPaymentTotals(finance.payments);
      const remaining = Math.max(0, total - totals.paid);

      const amount = Number(dto.amount);
      if (amount <= 0) {
        throw new BadRequestException('Nominal pembayaran harus lebih dari 0');
      }
      if (amount > remaining) {
        throw new BadRequestException(
          `Nominal pembayaran (Rp ${amount.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')}).`,
        );
      }

      const paymentStatus: 'paid' | 'pending' =
        dto.status === 'pending' ? 'pending' : 'paid';

      const payment = queryRunner.manager.create(FinancePayment, {
        finance_id: financeId,
        driver_id: finance.driver_id,
        amount,
        payment_method: dto.payment_method,
        payment_date: new Date(dto.payment_date),
        reference_number: dto.reference_number,
        notes: dto.notes,
        status: paymentStatus,
      });
      await queryRunner.manager.save(payment);

      if (paymentStatus === 'paid') {
        await this.applyPaidPayment(queryRunner, finance, payment);
      }

      const reloaded = await queryRunner.manager.findOne(Finance, {
        where: { id: financeId },
        relations: { driver: true, rentals: true, payments: true },
      });
      if (!reloaded) {
        throw new InternalServerErrorException('Failed to reload finance');
      }

      const newTotals = this.getPaymentTotals(reloaded.payments);
      reloaded.amount_received = newTotals.paid;
      reloaded.status = this.deriveStatus(
        total,
        newTotals.paid,
        newTotals.pending,
      );
      await queryRunner.manager.save(reloaded);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message:
          paymentStatus === 'paid'
            ? 'Pembayaran berhasil dicatat dan agregat ke uang masuk'
            : 'Pembayaran dicatat sebagai pending dan menunggu verifikasi',
        data: this.buildFinanceView(reloaded),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to create finance payment:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create finance payment',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async createPaymentForDriver(
    financeId: string,
    dto: CreateFinancePaymentDto,
    driverId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.lockFinance(queryRunner, financeId);

      const finance = await queryRunner.manager.findOne(Finance, {
        where: { id: financeId },
        relations: { payments: true },
      });
      if (!finance) {
        throw new NotFoundException('Finance not found');
      }

      if (finance.driver_id !== driverId) {
        throw new BadRequestException(
          'Anda tidak memiliki akses untuk membayar tagihan ini',
        );
      }

      if (finance.status === 'cancelled') {
        throw new BadRequestException(
          'Finance sudah dibatalkan dan tidak dapat menerima pembayaran',
        );
      }
      if (finance.status === 'paid') {
        throw new BadRequestException(
          'Finance sudah lunas dan tidak dapat menerima pembayaran lagi',
        );
      }

      const total = this.resolveTotalAmount(finance);
      const totals = this.getPaymentTotals(finance.payments);
      const remaining = Math.max(0, total - totals.paid);

      const amount = Number(dto.amount);
      if (amount <= 0) {
        throw new BadRequestException('Nominal pembayaran harus lebih dari 0');
      }
      if (amount > remaining) {
        throw new BadRequestException(
          `Nominal pembayaran (Rp ${amount.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')}).`,
        );
      }

      const paymentStatus: 'paid' | 'pending' =
        dto.status === 'pending' ? 'pending' : 'paid';

      const payment = queryRunner.manager.create(FinancePayment, {
        finance_id: financeId,
        driver_id: driverId,
        amount,
        payment_method: dto.payment_method,
        payment_date: new Date(dto.payment_date),
        reference_number: dto.reference_number,
        notes: dto.notes,
        status: paymentStatus,
      });
      await queryRunner.manager.save(payment);

      if (paymentStatus === 'paid') {
        await this.applyPaidPayment(queryRunner, finance, payment);
      }

      const reloaded = await queryRunner.manager.findOne(Finance, {
        where: { id: financeId },
        relations: { driver: true, rentals: true, payments: true },
      });
      if (!reloaded) {
        throw new InternalServerErrorException('Failed to reload finance');
      }

      const newTotals = this.getPaymentTotals(reloaded.payments);
      reloaded.amount_received = newTotals.paid;
      reloaded.status = this.deriveStatus(
        total,
        newTotals.paid,
        newTotals.pending,
      );
      await queryRunner.manager.save(reloaded);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message:
          paymentStatus === 'paid'
            ? 'Pembayaran berhasil dicatat'
            : 'Pembayaran dicatat sebagai pending dan menunggu verifikasi',
        data: this.buildFinanceView(reloaded),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to create driver payment:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create driver payment',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async listPayments(financeId: string) {
    const finance = await this.financesRepository.findOne({
      where: { id: financeId },
      select: { id: true },
    });
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }

    const payments = await this.financePaymentRepository.find({
      where: { finance_id: financeId },
      order: {
        payment_date: 'ASC',
        created_at: 'ASC',
      },
    });

    return {
      success: true,
      message: 'Finance payments retrieved successfully',
      data: payments.map((p) => this.paymentView(p)),
    };
  }

  async updatePaymentStatus(
    financeId: string,
    paymentId: string,
    dto: UpdateFinancePaymentDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.lockFinance(queryRunner, financeId);

      const payment = await queryRunner.manager.findOne(FinancePayment, {
        where: { id: paymentId, finance_id: financeId },
      });
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }
      if (payment.status !== 'pending') {
        throw new BadRequestException(
          'Hanya pembayaran berstatus pending yang dapat diverifikasi atau dibatalkan',
        );
      }

      const finance = await queryRunner.manager.findOne(Finance, {
        where: { id: financeId },
        relations: { payments: true },
      });
      if (!finance) {
        throw new NotFoundException('Finance not found');
      }

      payment.status = dto.status;
      await queryRunner.manager.save(payment);

      if (dto.status === 'paid') {
        const total = this.resolveTotalAmount(finance);
        const totals = this.getPaymentTotals(finance.payments);
        if (totals.paid > total) {
          throw new BadRequestException(
            'Verifikasi ini membuat total pembayaran melebihi tagihan',
          );
        }
        await this.applyPaidPayment(queryRunner, finance, payment);
      }

      const reloaded = await queryRunner.manager.findOne(Finance, {
        where: { id: financeId },
        relations: { driver: true, rentals: true, payments: true },
      });
      if (!reloaded) {
        throw new InternalServerErrorException('Failed to reload finance');
      }

      const total = this.resolveTotalAmount(reloaded);
      const newTotals = this.getPaymentTotals(reloaded.payments);
      reloaded.amount_received = newTotals.paid;
      reloaded.status = this.deriveStatus(
        total,
        newTotals.paid,
        newTotals.pending,
      );
      await queryRunner.manager.save(reloaded);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message:
          dto.status === 'paid'
            ? 'Pembayaran berhasil diverifikasi dan dihitung sebagai uang masuk'
            : 'Pembayaran berhasil dibatalkan',
        data: this.buildFinanceView(reloaded),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to update finance payment:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update payment status');
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(financeId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.lockFinance(queryRunner, financeId);

      const finance = await queryRunner.manager.findOne(Finance, {
        where: { id: financeId },
        relations: { driver: true, rentals: true, payments: true },
      });
      if (!finance) {
        throw new NotFoundException('Finance not found');
      }
      if (finance.status === 'cancelled') {
        throw new BadRequestException('Finance sudah dibatalkan');
      }
      if (finance.status === 'paid') {
        throw new BadRequestException(
          'Finance yang sudah lunas tidak dapat dibatalkan',
        );
      }

      finance.status = 'cancelled';
      await queryRunner.manager.save(finance);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message:
          'Finance berhasil dibatalkan dan tidak lagi menjadi tagihan aktif',
        data: this.buildFinanceView(finance),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to cancel finance:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to cancel finance');
    } finally {
      await queryRunner.release();
    }
  }

  async findMyFinances(driverId: string, query?: FinanceQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals')
      .leftJoinAndSelect('rentals.vehicle', 'rental_vehicle')
      .leftJoinAndSelect('rental_vehicle.vendor', 'rental_vehicle_vendor')
      .where('f.driver_id = :driverId', { driverId })
      .andWhere('f.is_active = :isActive', { isActive: true })
      .orderBy('f.created_at', 'DESC');

    if (query?.search) {
      qb.andWhere(
        '(f.reference_number ILIKE :search OR f.payer ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query?.status) {
      qb.andWhere('f.status IN (:...statuses)', {
        statuses: Array.isArray(query.status) ? query.status : [query.status],
      });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const fallbackMap = await this.getFallbackVehicleMap(data);
    const totals = await this.attachTotals(data);

    const items = data.map((f) =>
      this.buildFinanceView(
        f,
        totals[f.id] || { paid: 0, pending: 0, count: 0 },
        fallbackMap.get(f.driver_id),
      ),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Driver finances retrieved successfully',
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async getMyAdminFee(driverId: string) {
    const finance = await this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals')
      .leftJoinAndSelect('rentals.vehicle', 'rental_vehicle')
      .leftJoinAndSelect('rental_vehicle.vendor', 'rental_vehicle_vendor')
      .where('f.driver_id = :driverId', { driverId })
      .andWhere('f.fee_admin_join > 0')
      .andWhere('f.is_active = :isActive', { isActive: true })
      .orderBy('f.created_at', 'DESC')
      .getOne();

    if (!finance) {
      return {
        success: true,
        message: 'No admin fee found',
        data: null,
      };
    }

    const totals = await this.attachTotals([finance]);
    const view = this.buildFinanceView(
      finance,
      totals[finance.id] || { paid: 0, pending: 0, count: 0 },
    );

    return {
      success: true,
      message: 'Admin fee retrieved successfully',
      data: view,
    };
  }

  async getDriverSummary(driverId: string) {
    const driver = await this.driversRepository.findOne({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException(`Driver with id ${driverId} not found`);
    }

    const finances = await this.financesRepository.find({
      where: { driver_id: driverId, is_active: true },
      relations: { payments: true },
    });

    let totalTagihan = 0;
    let totalDibayar = 0;
    let totalPending = 0;

    const openFinances: any[] = [];
    const countByStatus: Record<string, number> = {
      unpaid: 0,
      pending: 0,
      paid: 0,
      cancelled: 0,
    };

    for (const finance of finances) {
      if (finance.status === 'cancelled') continue;
      const total = this.resolveTotalAmount(finance);
      const totals = this.getPaymentTotals(finance.payments);
      const remaining = Math.max(0, total - totals.paid);

      totalTagihan += total;
      totalDibayar += totals.paid;
      totalPending += totals.pending;

      const derivedStatus = this.deriveStatus(
        total,
        totals.paid,
        totals.pending,
        finance.status,
      );
      countByStatus[derivedStatus] = (countByStatus[derivedStatus] || 0) + 1;

      openFinances.push({
        id: finance.id,
        reference_number: finance.reference_number,
        payment_date: finance.payment_date,
        fee_admin_join: Number(finance.fee_admin_join) || 0,
        paid_amount: totals.paid,
        pending_amount: totals.pending,
        remaining_amount: remaining,
        status: derivedStatus,
      });
    }

    return {
      success: true,
      message: 'Driver finance summary retrieved successfully',
      data: {
        driver_id: driverId,
        driver_name: `${driver.first_name} ${driver.last_name}`.trim(),
        employee_id: driver.employee_id,
        total_tagihan: totalTagihan,
        total_dibayar: totalDibayar,
        total_pending_pembayaran: totalPending,
        sisa_tagihan: Math.max(0, totalTagihan - totalDibayar),
        count_by_status: countByStatus,
        open_finances: openFinances,
      },
    };
  }

  async exportData(query: FinanceExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
        : [
          'reference_number',
          'payer',
          'paid_amount',
          'remaining_amount',
          'status',
          'payment_date',
          'payment_method',
          'fee_admin_join',
          'created_at',
          'vehicle',
          'vendor',
          'rental_period',
        ];

    const qb = this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals')
      .leftJoinAndSelect('rentals.vehicle', 'rental_vehicle')
      .leftJoinAndSelect('rental_vehicle.vendor', 'rental_vehicle_vendor')
      .leftJoinAndSelect('f.payments', 'payments');

    if (query.search) {
      qb.andWhere(
        '(f.reference_number ILIKE :search OR f.payer ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.payment_method) {
      qb.andWhere('f.payment_method = :method', {
        method: query.payment_method,
      });
    }

    if (query.start_date) {
      qb.andWhere('f.payment_date >= :startDate', {
        startDate: query.start_date + ' 00:00:00',
      });
    }

    if (query.end_date) {
      qb.andWhere('f.payment_date <= :endDate', {
        endDate: query.end_date + ' 23:59:59.999',
      });
    }

    const finances = await qb.orderBy('f.created_at', 'DESC').getMany();

    const views = finances.map((f) => this.buildFinanceView(f));

    const columnMap: Record<string, (v: any) => string> = {
      reference_number: (v) => v.reference_number || '-',
      payer: (v) => v.payer || '-',
      paid_amount: (v) => `Rp ${Number(v.paid_amount).toLocaleString('id-ID')}`,
      remaining_amount: (v) =>
        `Rp ${Number(v.remaining_amount).toLocaleString('id-ID')}`,
      amount_received: (v) =>
        `Rp ${Number(v.amount_received).toLocaleString('id-ID')}`,
      payment_date: (v) =>
        v.payment_date
          ? new Date(v.payment_date).toLocaleDateString('id-ID')
          : '-',
      created_at: (v) =>
        v.created_at
          ? new Date(v.created_at).toLocaleDateString('id-ID')
          : '-',
      fee_admin_join: (v) =>
        Number(v.fee_admin_join) > 0
          ? `Rp ${Number(v.fee_admin_join).toLocaleString('id-ID')}`
          : '0',
      status: (v) => v.status || '-',
      payment_method: (v) => v.payment_method || '-',
      driverName: (v) =>
        v.driver ? `${v.driver.first_name} ${v.driver.last_name}`.trim() : '-',
      notes: (v) => v.notes || '-',
      id: (v) => v.id || '-',
      vehicle: (v) => v.vehicle ? `${v.vehicle.merk} ${v.vehicle.model}`.trim() : '-',
      vendor: (v) => v.vendor ? v.vendor.name || '-' : '-',
      rental_period: (v) => {
        const rentals = v.rentals || [];
        if (rentals.length > 0) {
          return `${new Date(rentals[0].start_date).toLocaleDateString('id-ID')} to ${new Date(rentals[0].end_date).toLocaleDateString('id-ID')}`;
        }
        return '-';
      },
    };

    const headerLabels: Record<string, string> = {
      reference_number: 'Reference Number',
      payer: 'Payer',
      paid_amount: 'Paid Amount',
      remaining_amount: 'Remaining Amount',
      amount_received: 'Amount Received',
      payment_date: 'Payment Date',
      created_at: 'Tanggal Dibuat',
      fee_admin_join: 'Admin Fee Join',
      status: 'Status',
      payment_method: 'Payment Method',
      driverName: 'Driver Name',
      notes: 'Notes',
      id: 'Finance ID',
      vehicle: 'Vehicle',
      vendor: 'Vendor',
      rental_period: 'Rental Period',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = views.map((view) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](view) || '';
      }
      return row;
    });

    if (format === 'csv') {
      return this.generateCsv(rows, activeColumns, headerLabels);
    } else if (format === 'xlsx') {
      return this.generateXlsx(rows, activeColumns, headerLabels);
    } else {
      return this.generatePdf(rows, activeColumns, headerLabels);
    }
  }

  private generateCsv(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const header = columns.map((col) => ({
      id: col,
      title: headerLabels[col] || col,
    }));

    const csvStringifier = createObjectCsvStringifier({ header });
    const csv =
      csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);

    return {
      buffer: Buffer.from(csv, 'utf-8'),
      contentType: 'text/csv',
      filename: `finances_export_${Date.now()}.csv`,
    };
  }

  private async generateXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Finances');

    const xlsxColumns = columns.map((col) => ({
      header: headerLabels[col] || col,
      key: col,
      width: 25,
    }));
    worksheet.columns = xlsxColumns;

    for (const row of rows) {
      worksheet.addRow(row);
    }

    worksheet.getRow(1).font = { bold: true };

    const writeResult = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(writeResult as ArrayBuffer);

    return {
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `finances_export_${Date.now()}.xlsx`,
    };
  }

  private async generatePdf(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const PdfPrinter = require('pdfmake');
    const roboto = require('pdfmake/fonts/Roboto');
    PdfPrinter.addFonts(roboto);

    const tableBody: any[][] = [];

    tableBody.push(
      columns.map((col) => ({
        text: headerLabels[col] || col,
        style: 'tableHeader',
      })),
    );

    for (const row of rows) {
      tableBody.push(columns.map((col) => row[col] || ''));
    }

    const docDefinition: any = {
      content: [
        { text: 'Finance Export Report', style: 'header' },
        {
          table: {
            headerRows: 1,
            widths: columns.map(() => '*'),
            body: tableBody,
          },
          layout: 'headerLineOnly',
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 10] },
        tableHeader: { bold: true, fontSize: 10, fillColor: '#e2e8f0' },
      },
      defaultStyle: { fontSize: 9 },
      pageOrientation: 'landscape',
    };

    const pdfDoc = PdfPrinter.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    return {
      buffer,
      contentType: 'application/pdf',
      filename: `finances_export_${Date.now()}.pdf`,
    };
  }

  async delete(
    employid: string,
  ): Promise<{ success: boolean; message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finance = await queryRunner.manager.findOne(Finance, {
        where: { id: employid },
        relations: { driver: true, rentals: true, payments: true },
      });

      if (!finance) {
        throw new NotFoundException('Finance not found');
      }

      // Balik pengaruh uang masuk untuk SEMUA pembayaran yang sudah paid
      for (const payment of finance.payments || []) {
        if (payment.status === 'paid') {
          await this.reversePaidPayment(queryRunner, finance, payment);
        }
      }

      await queryRunner.manager.delete(Finance, employid);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Finance deleted successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to delete finance:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete finance');
    } finally {
      await queryRunner.release();
    }
  }
}
