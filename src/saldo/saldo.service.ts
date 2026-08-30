import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QueryRunner } from 'typeorm';
import { DriverSaldo } from './entities/driver-saldo.entity';
import { SaldoTransaction } from './entities/saldo-transaction.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TopUpSaldoDto } from './dto/top-up-saldo.dto';
import { DeductSaldoDto } from './dto/deduct-saldo.dto';
import { RefundSaldoDto } from './dto/refund-saldo.dto';
import { SaldoQueryDto } from './dto/saldo-query.dto';

@Injectable()
export class SaldoService {
  constructor(
    @InjectRepository(DriverSaldo)
    private readonly driverSaldoRepository: Repository<DriverSaldo>,
    @InjectRepository(SaldoTransaction)
    private readonly transactionRepository: Repository<SaldoTransaction>,
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    private readonly dataSource: DataSource,
  ) {}

  private async findSaldoForUpdate(
    queryRunner: QueryRunner,
    driverId: string,
  ): Promise<DriverSaldo | null> {
    const rows = await queryRunner.query(
      'SELECT id, driver_id, balance, created_at, updated_at FROM driver_saldo WHERE driver_id = $1 FOR UPDATE',
      [driverId],
    );
    if (!rows || rows.length === 0) return null;
    return this.driverSaldoRepository.create(rows[0] as Partial<DriverSaldo>);
  }

  async getBalance(driverId: string) {
    const saldo = await this.driverSaldoRepository.findOne({
      where: { driver_id: driverId },
      relations: { driver: true },
    });

    if (!saldo) {
      return {
        success: true,
        message: 'Driver saldo not found, balance is 0',
        data: {
          driver_id: driverId,
          balance: 0,
        },
      };
    }

    return {
      success: true,
      message: 'Driver balance retrieved successfully',
      data: {
        id: saldo.id,
        driver_id: saldo.driver_id,
        driver_name: saldo.driver
          ? `${saldo.driver.first_name} ${saldo.driver.last_name}`
          : '',
        balance: Number(saldo.balance),
        updated_at: saldo.updated_at,
      },
    };
  }

  async topUp(dto: TopUpSaldoDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driversRepository.findOne({
        where: { id: dto.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(`Driver with id ${dto.driver_id} not found`);
      }

      let saldo = await this.findSaldoForUpdate(queryRunner, dto.driver_id);

      const balanceBefore = saldo ? Number(saldo.balance) : 0;
      const balanceAfter = balanceBefore + dto.amount;

      if (!saldo) {
        saldo = this.driverSaldoRepository.create({
          driver_id: dto.driver_id,
          balance: dto.amount,
        });
        saldo = await queryRunner.manager.save(saldo);
      } else {
        saldo.balance = balanceAfter;
        await queryRunner.manager.save(saldo);
      }

      const transaction = this.transactionRepository.create({
        driver_id: dto.driver_id,
        driver_saldo_id: saldo.id,
        type: 'top_up',
        amount: dto.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_number: dto.reference_number || undefined,
        notes: dto.notes || `Top up saldo Rp ${dto.amount.toLocaleString('id-ID')}`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Saldo top-up successful',
        data: {
          driver_id: dto.driver_id,
          amount: dto.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_id: transaction.id,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to top-up saldo:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to top-up saldo');
    } finally {
      await queryRunner.release();
    }
  }

  async deduct(dto: DeductSaldoDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driversRepository.findOne({
        where: { id: dto.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(`Driver with id ${dto.driver_id} not found`);
      }

      const saldo = await this.findSaldoForUpdate(queryRunner, dto.driver_id);

      if (!saldo || Number(saldo.balance) < dto.amount) {
        throw new BadRequestException(
          `Saldo tidak mencukupi. Saldo saat ini: Rp ${Number(saldo?.balance || 0).toLocaleString('id-ID')}, dibutuhkan: Rp ${dto.amount.toLocaleString('id-ID')}`,
        );
      }

      const balanceBefore = Number(saldo.balance);
      const balanceAfter = balanceBefore - dto.amount;

      saldo.balance = balanceAfter;
      await queryRunner.manager.save(saldo);

      const transaction = this.transactionRepository.create({
        driver_id: dto.driver_id,
        driver_saldo_id: saldo.id,
        type: 'rental_payment',
        amount: dto.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: dto.rental_id || undefined,
        notes: dto.notes || `Pembayaran rental dari saldo`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Saldo deduction successful',
        data: {
          driver_id: dto.driver_id,
          amount: dto.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_id: transaction.id,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to deduct saldo:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to deduct saldo');
    } finally {
      await queryRunner.release();
    }
  }

  async refund(dto: RefundSaldoDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driversRepository.findOne({
        where: { id: dto.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(`Driver with id ${dto.driver_id} not found`);
      }

      let saldo = await this.findSaldoForUpdate(queryRunner, dto.driver_id);

      const balanceBefore = saldo ? Number(saldo.balance) : 0;
      const balanceAfter = balanceBefore + dto.amount;

      if (!saldo) {
        saldo = this.driverSaldoRepository.create({
          driver_id: dto.driver_id,
          balance: dto.amount,
        });
        saldo = await queryRunner.manager.save(saldo);
      } else {
        saldo.balance = balanceAfter;
        await queryRunner.manager.save(saldo);
      }

      const transaction = this.transactionRepository.create({
        driver_id: dto.driver_id,
        driver_saldo_id: saldo.id,
        type: 'refund',
        amount: dto.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: dto.rental_id || undefined,
        notes: dto.notes || `Refund ke saldo`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Saldo refund successful',
        data: {
          driver_id: dto.driver_id,
          amount: dto.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_id: transaction.id,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to refund saldo:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to refund saldo');
    } finally {
      await queryRunner.release();
    }
  }

  async getTransactions(driverId: string, query?: SaldoQueryDto) {
    const driver = await this.driversRepository.findOne({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException(`Driver with id ${driverId} not found`);
    }

    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.driver', 'driver')
      .where('t.driver_id = :driverId', { driverId })
      .orderBy('t.created_at', 'DESC');

    if (query?.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Saldo transactions retrieved successfully',
      data: data.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        balance_before: Number(tx.balance_before),
        balance_after: Number(tx.balance_after),
        reference_id: tx.reference_id,
        reference_number: tx.reference_number,
        notes: tx.notes,
        created_at: tx.created_at,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async getSaldoSummary() {
    const totalBalance = await this.driverSaldoRepository
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.balance), 0)', 'total')
      .getRawOne();

    const totalDrivers = await this.driverSaldoRepository.count();

    const totalTopUp = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.type = :type', { type: 'top_up' })
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .getRawOne();

    const totalDeductions = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.type = :type', { type: 'rental_payment' })
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .getRawOne();

    const totalRefunds = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.type = :type', { type: 'refund' })
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .getRawOne();

    return {
      success: true,
      message: 'Saldo summary retrieved successfully',
      data: {
        total_balance: Number(totalBalance?.total || 0),
        total_drivers_with_saldo: totalDrivers,
        total_top_up: Number(totalTopUp?.total || 0),
        total_deductions: Number(totalDeductions?.total || 0),
        total_refunds: Number(totalRefunds?.total || 0),
      },
    };
  }
}
