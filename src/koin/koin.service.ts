import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QueryRunner } from 'typeorm';
import { DriverKoin } from './entities/driver-koin.entity';
import { KoinTransaction } from './entities/koin-transaction.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TopUpKoinDto } from './dto/top-up-koin.dto';
import { DeductKoinDto } from './dto/deduct-koin.dto';
import { RefundKoinDto } from './dto/refund-koin.dto';
import { KoinQueryDto } from './dto/koin-query.dto';
import { KoinExportDto } from './dto/koin-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class KoinService {
  constructor(
    @InjectRepository(DriverKoin)
    private readonly driverKoinRepository: Repository<DriverKoin>,
    @InjectRepository(KoinTransaction)
    private readonly transactionRepository: Repository<KoinTransaction>,
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
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
    return this.driverKoinRepository.create(rows[0] as Partial<DriverKoin>);
  }

  async getBalance(driverId: string) {
    const koin = await this.driverKoinRepository.findOne({
      where: { driver_id: driverId },
      relations: { driver: true },
    });

    if (!koin) {
      return {
        success: true,
        message: 'Driver koin not found, balance is 0',
        data: {
          driver_id: driverId,
          balance: 0,
        },
      };
    }

    return {
      success: true,
      message: 'Driver koin retrieved successfully',
      data: {
        id: koin.id,
        driver_id: koin.driver_id,
        driver_name: koin.driver
          ? `${koin.driver.first_name} ${koin.driver.last_name}`
          : '',
        balance: Number(koin.balance),
        updated_at: koin.updated_at,
      },
    };
  }

  async topUp(dto: TopUpKoinDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driversRepository.findOne({
        where: { id: dto.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(
          `Driver with id ${dto.driver_id} not found`,
        );
      }

      let koin = await this.findKoinForUpdate(queryRunner, dto.driver_id);

      const balanceBefore = koin ? Number(koin.balance) : 0;
      const balanceAfter = balanceBefore + dto.amount;

      if (!koin) {
        koin = this.driverKoinRepository.create({
          driver_id: dto.driver_id,
          balance: dto.amount,
        });
        koin = await queryRunner.manager.save(koin);
      } else {
        koin.balance = balanceAfter;
        await queryRunner.manager.save(koin);
      }

      const referenceNumber =
        dto.reference_number ||
        `KN-${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

      const transaction = this.transactionRepository.create({
        driver_id: dto.driver_id,
        driver_saldo_id: koin.id,
        type: 'top_up',
        amount: dto.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_number: referenceNumber,
        reason: dto.reason,
        notes:
          dto.notes || `Top up koin Rp ${dto.amount.toLocaleString('id-ID')}`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Koin top-up successful',
        data: {
          driver_id: dto.driver_id,
          amount: dto.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_id: transaction.id,
          reference_number: referenceNumber,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to top-up koin:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to top-up koin');
    } finally {
      await queryRunner.release();
    }
  }

  async deduct(dto: DeductKoinDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driversRepository.findOne({
        where: { id: dto.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(
          `Driver with id ${dto.driver_id} not found`,
        );
      }

      const koin = await this.findKoinForUpdate(queryRunner, dto.driver_id);

      if (!koin || Number(koin.balance) < dto.amount) {
        throw new BadRequestException(
          `Koin tidak mencukupi. Koin saat ini: Rp ${Number(koin?.balance || 0).toLocaleString('id-ID')}, dibutuhkan: Rp ${dto.amount.toLocaleString('id-ID')}`,
        );
      }

      const balanceBefore = Number(koin.balance);
      const balanceAfter = balanceBefore - dto.amount;

      koin.balance = balanceAfter;
      await queryRunner.manager.save(koin);

      const transaction = this.transactionRepository.create({
        driver_id: dto.driver_id,
        driver_saldo_id: koin.id,
        type: 'rental_payment',
        amount: dto.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: dto.rental_id || undefined,
        notes: dto.notes || `Pembayaran rental dari koin`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Koin deduction successful',
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
      console.error('Failed to deduct koin:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException('Failed to deduct koin');
    } finally {
      await queryRunner.release();
    }
  }

  async refund(dto: RefundKoinDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driversRepository.findOne({
        where: { id: dto.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(
          `Driver with id ${dto.driver_id} not found`,
        );
      }

      let koin = await this.findKoinForUpdate(queryRunner, dto.driver_id);

      const balanceBefore = koin ? Number(koin.balance) : 0;
      const balanceAfter = balanceBefore + dto.amount;

      if (!koin) {
        koin = this.driverKoinRepository.create({
          driver_id: dto.driver_id,
          balance: dto.amount,
        });
        koin = await queryRunner.manager.save(koin);
      } else {
        koin.balance = balanceAfter;
        await queryRunner.manager.save(koin);
      }

      const transaction = this.transactionRepository.create({
        driver_id: dto.driver_id,
        driver_saldo_id: koin.id,
        type: 'refund',
        amount: dto.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: dto.rental_id || undefined,
        notes: dto.notes || `Refund ke koin`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Koin refund successful',
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
      console.error('Failed to refund koin:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to refund koin');
    } finally {
      await queryRunner.release();
    }
  }

  async getAllTransactions(query?: KoinQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.driver', 'driver')
      .orderBy('t.created_at', 'DESC');

    if (query?.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Koin transactions retrieved successfully',
      data: data.map((tx) => ({
        id: tx.id,
        driver_id: tx.driver_id,
        driver_name: tx.driver
          ? `${tx.driver.first_name} ${tx.driver.last_name}`.trim()
          : '',
        driver_employee_id: tx.driver?.employee_id || null,
        type: tx.type,
        amount: Number(tx.amount),
        balance_before: Number(tx.balance_before),
        balance_after: Number(tx.balance_after),
        reference_id: tx.reference_id,
        reference_number: tx.reference_number,
        reason: tx.reason,
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

  async getTransactions(driverId: string, query?: KoinQueryDto) {
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

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Koin transactions retrieved successfully',
      data: data.map((tx) => ({
        id: tx.id,
        driver_id: tx.driver_id,
        driver_name: tx.driver
          ? `${tx.driver.first_name} ${tx.driver.last_name}`.trim()
          : '',
        driver_employee_id: tx.driver?.employee_id || null,
        type: tx.type,
        amount: Number(tx.amount),
        balance_before: Number(tx.balance_before),
        balance_after: Number(tx.balance_after),
        reference_id: tx.reference_id,
        reference_number: tx.reference_number,
        reason: tx.reason,
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

  async getKoinSummary() {
    const totalBalance = await this.driverKoinRepository
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.balance), 0)', 'total')
      .getRawOne();

    const totalDrivers = await this.driverKoinRepository.count();

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
      message: 'Koin summary retrieved successfully',
      data: {
        total_balance: Number(totalBalance?.total || 0),
        total_drivers_with_koin: totalDrivers,
        total_top_up: Number(totalTopUp?.total || 0),
        total_deductions: Number(totalDeductions?.total || 0),
        total_refunds: Number(totalRefunds?.total || 0),
      },
    };
  }

  async exportTransactions(query: KoinExportDto) {
    const format = query.format || 'csv';

    const defaultColumns = [
      'referenceNumber',
      'driverName',
      'type',
      'amount',
      'reason',
      'createdAt',
    ];

    const selectedColumns = query.columns
      ? Array.from(new Set(query.columns.split(',').map((c) => c.trim())))
      : defaultColumns;

    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.driver', 'driver');

    if (query.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }

    if (query.start_date) {
      qb.andWhere('t.created_at >= :start', {
        start: query.start_date + ' 00:00:00',
      });
    }
    if (query.end_date) {
      qb.andWhere('t.created_at <= :end', {
        end: query.end_date + ' 23:59:59.999',
      });
    }

    const transactions = await qb.orderBy('t.created_at', 'DESC').getMany();

    const typeLabels: Record<string, string> = {
      top_up: 'Top Up',
      rental_payment: 'Pembayaran Rental',
      refund: 'Refund',
      withdrawal: 'Penarikan',
    };

    const columnMap: Record<string, (t: KoinTransaction) => string> = {
      referenceNumber: (t) => t.reference_number || '-',
      driverName: (t) =>
        t.driver ? `${t.driver.first_name} ${t.driver.last_name}`.trim() : '-',
      driverEmployeeId: (t) => t.driver?.employee_id || '-',
      type: (t) => typeLabels[t.type] || t.type || '-',
      amount: (t) => {
        const prefix = t.type === 'top_up' || t.type === 'refund' ? '+' : '-';
        return `${prefix} Rp ${Number(t.amount || 0).toLocaleString('id-ID')}`;
      },
      balanceBefore: (t) =>
        `Rp ${Number(t.balance_before || 0).toLocaleString('id-ID')}`,
      balanceAfter: (t) =>
        `Rp ${Number(t.balance_after || 0).toLocaleString('id-ID')}`,
      reason: (t) => t.reason || '-',
      notes: (t) => t.notes || '-',
      createdAt: (t) => this.formatExportDateTime(t.created_at),
    };

    const headerLabels: Record<string, string> = {
      referenceNumber: 'No. Referensi',
      driverName: 'Driver',
      driverEmployeeId: 'ID Karyawan',
      type: 'Tipe',
      amount: 'Jumlah',
      balanceBefore: 'Saldo Sebelum',
      balanceAfter: 'Saldo Sesudah',
      reason: 'Alasan',
      notes: 'Catatan',
      createdAt: 'Tanggal',
    };

    const validColumns = selectedColumns.filter((c) => columnMap[c]);
    const activeColumns = validColumns.length ? validColumns : defaultColumns;

    const rows = transactions.map((tx) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](tx) || '';
      }
      return row;
    });

    if (format === 'csv') {
      return this.generateKoinCsv(rows, activeColumns, headerLabels);
    } else if (format === 'xlsx') {
      return this.generateKoinXlsx(rows, activeColumns, headerLabels);
    } else {
      return this.generateKoinPdf(rows, activeColumns, headerLabels);
    }
  }

  private formatExportDateTime(value?: Date | string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private generateKoinCsv(
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
      filename: `koin_transactions_export_${Date.now()}.csv`,
    };
  }

  private async generateKoinXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Koin Transactions');

    worksheet.columns = columns.map((col) => ({
      header: headerLabels[col] || col,
      key: col,
      width: 22,
    }));

    for (const row of rows) {
      worksheet.addRow(row);
    }

    worksheet.getRow(1).font = { bold: true };

    const writeResult = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(writeResult);

    return {
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `koin_transactions_export_${Date.now()}.xlsx`,
    };
  }

  private async generateKoinPdf(
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
        { text: 'Laporan Transaksi Koin', style: 'header' },
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
      filename: `koin_transactions_export_${Date.now()}.pdf`,
    };
  }
}
