import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, QueryRunner } from 'typeorm';
import { Finance } from './entities/finance.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DriverSaldo } from '../saldo/entities/driver-saldo.entity';
import { SaldoTransaction } from '../saldo/entities/saldo-transaction.entity';
import { AddFinanceDto } from './dto/add-finance.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { FinanceExportDto } from './dto/finance-export.dto';
import { RentalsService } from '../rentals/rentals.service';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Finance)
    private readonly financesRepository: Repository<Finance>,
    @InjectRepository(Rental)
    private readonly rentalsRepository: Repository<Rental>,
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(DriverSaldo)
    private readonly driverSaldoRepository: Repository<DriverSaldo>,
    @InjectRepository(SaldoTransaction)
    private readonly saldoTransactionRepository: Repository<SaldoTransaction>,
    private readonly rentalsService: RentalsService,
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

  private async findRawById(id: string): Promise<Finance | null> {
    return this.financesRepository.findOne({
      where: { id },
      relations: { driver: true, rentals: true },
    });
  }

  async findAll(query?: FinanceQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals')
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

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Finances retrieved successfully',
      data,
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
      relations: { driver: true, rentals: true },
    });
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }
    return {
      success: true,
      message: 'Finance retrieved successfully',
      data: finance,
    };
  }

  async findById(id: string) {
    const finance = await this.findRawById(id);
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }
    return {
      success: true,
      message: 'Finance retrieved successfully',
      data: finance,
    };
  }

  async findDetailById(id: string) {
    const finance = await this.financesRepository.findOne({
      where: { id },
      relations: {
        driver: true,
        rentals: { vehicle: true, driver: true },
      },
    });

    if (!finance) {
      throw new NotFoundException('Finance not found');
    }

    return {
      success: true,
      message: 'Finance detail retrieved successfully',
      data: finance,
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

    const totalResult = await this.financesRepository
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.amount_received), 0)', 'total')
      .getRawOne();

    const byMethod = await this.financesRepository
      .createQueryBuilder('f')
      .select('f.payment_method', 'method')
      .addSelect('COALESCE(SUM(f.amount_received), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .groupBy('f.payment_method')
      .getRawMany();

    const byType = await this.financesRepository
      .createQueryBuilder('f')
      .select('f.finance_type', 'type')
      .addSelect('COALESCE(SUM(f.amount_received), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .groupBy('f.finance_type')
      .getRawMany();

    const amountByMethod: Record<string, number> = {};
    for (const row of byMethod) {
      amountByMethod[row.method] = Number(row.total);
    }

    const amountByType: Record<string, number> = {};
    for (const row of byType) {
      amountByType[row.type] = Number(row.total);
    }

    return {
      success: true,
      message: 'Finance summary retrieved successfully',
      data: {
        total_amount_received: Number(totalResult?.total || 0),
        total_active: totalActive,
        total_inactive: totalInactive,
        total_records: totalRecords,
        amount_by_method: amountByMethod,
        amount_by_type: amountByType,
      },
    };
  }

  async create(data: AddFinanceDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { rental_ids, ...financeData } = data;

      const driver = await this.driversRepository.findOne({ where: { id: data.driver_id } });
      if (!driver) {
        throw new NotFoundException(`Driver with id ${data.driver_id} not found`);
      }

      if (rental_ids && rental_ids.length > 0) {
        const foundRentals = await this.rentalsRepository.find({ where: { id: In(rental_ids) } });
        if (foundRentals.length !== rental_ids.length) {
          const foundIds = foundRentals.map((r) => r.id);
          const missingIds = rental_ids.filter((id) => !foundIds.includes(id));
          throw new NotFoundException(`Rentals not found: ${missingIds.join(', ')}`);
        }
      }

      const finance = this.financesRepository.create({
        ...financeData,
        payment_date: new Date(data.payment_date),
      });

      if (rental_ids && rental_ids.length > 0) {
        finance.rentals = rental_ids.map((id) => ({ id } as any));
      }

      const result = await queryRunner.manager.save(finance);
      const saved = await this.findRawById(result.id);

      if (finance.payment_method !== 'saldo' && Number(finance.amount_received) > 0 && finance.driver_id) {
        const saldo = await this.findSaldoForUpdate(queryRunner, finance.driver_id);

        const balanceBefore = saldo ? Number(saldo.balance) : 0;
        const balanceAfter = balanceBefore + Number(finance.amount_received);

        if (saldo) {
          saldo.balance = balanceAfter;
          await queryRunner.manager.save(saldo);
        } else {
          const newSaldo = queryRunner.manager.create(DriverSaldo, {
            driver_id: finance.driver_id,
            balance: balanceAfter,
          });
          await queryRunner.manager.save(newSaldo);
        }

        const tx = queryRunner.manager.create(SaldoTransaction, {
          driver_id: finance.driver_id,
          type: 'top_up',
          amount: Number(finance.amount_received),
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_id: finance.id,
          reference_number: finance.reference_number,
          notes: `Saldo bertambah dari finance ${finance.reference_number}`,
        });
        await queryRunner.manager.save(tx);
      } else if (finance.payment_method === 'saldo' && Number(finance.amount_received) > 0 && finance.driver_id) {
        const saldo = await this.findSaldoForUpdate(queryRunner, finance.driver_id);

        const balanceBefore = saldo ? Number(saldo.balance) : 0;
        const balanceAfter = balanceBefore - Number(finance.amount_received);

        if (balanceAfter < 0) {
          throw new BadRequestException(
            `Saldo driver tidak mencukupi. Saldo saat ini: Rp ${balanceBefore.toLocaleString('id-ID')}, diperlukan: Rp ${Number(finance.amount_received).toLocaleString('id-ID')}`,
          );
        }

        if (saldo) {
          saldo.balance = balanceAfter;
          await queryRunner.manager.save(saldo);
        }

        const tx = queryRunner.manager.create(SaldoTransaction, {
          driver_id: finance.driver_id,
          type: 'rental_payment',
          amount: Number(finance.amount_received),
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_id: finance.id,
          reference_number: finance.reference_number,
          notes: `Saldo berkurang dari finance ${finance.reference_number}`,
        });
        await queryRunner.manager.save(tx);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Finance created successfully',
        data: saved,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to create finance:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
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

    const { rental_ids, ...updateData } = data;

    const updatePayload: any = {
      ...updateData,
      payment_date: data.payment_date ? new Date(data.payment_date) : undefined,
      amount_received: data.amount_received !== undefined ? Number(data.amount_received) : undefined,
    };

    const result = await this.financesRepository.update(id, updatePayload);

    if (result.affected === 0) {
      throw new NotFoundException('Finance not found');
    }

    if (rental_ids !== undefined) {
      if (rental_ids.length > 0) {
        const foundRentals = await this.rentalsRepository.find({ where: { id: In(rental_ids) } });
        if (foundRentals.length !== rental_ids.length) {
          const foundIds = foundRentals.map((r) => r.id);
          const missingIds = rental_ids.filter((rid) => !foundIds.includes(rid));
          throw new NotFoundException(`Rentals not found: ${missingIds.join(', ')}`);
        }
      }
      const finance = await this.financesRepository.findOne({ where: { id } });
      if (finance) {
        finance.rentals = rental_ids.map((rid) => ({ id: rid } as any));
        await this.financesRepository.save(finance);
      }
    }

    const finance = await this.findRawById(id);

    return {
      success: true,
      message: 'Finance updated successfully',
      data: finance,
    };
  }

  async exportData(query: FinanceExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : ['reference_number', 'payer', 'amount_received', 'deposit_amount', 'payment_date', 'status', 'payment_method'];

    const qb = this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals');

    if (query.search) {
      qb.andWhere(
        '(f.reference_number ILIKE :search OR f.payer ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.start_date) {
      qb.andWhere('f.payment_date >= :startDate', {
        startDate: query.start_date,
      });
    }

    if (query.end_date) {
      qb.andWhere('f.payment_date <= :endDate', {
        endDate: query.end_date,
      });
    }

    const finances = await qb.orderBy('f.created_at', 'DESC').getMany();

    const columnMap: Record<string, (f: Finance) => string> = {
      reference_number: (f) => f.reference_number || '-',
      payer: (f) => f.payer || '-',
      amount_received: (f) => `Rp ${Number(f.amount_received).toLocaleString('id-ID')}`,
      deposit_amount: (f) => `Rp ${Number(f.deposit_amount).toLocaleString('id-ID')}`,
      payment_date: (f) => f.payment_date ? new Date(f.payment_date).toLocaleDateString('id-ID') : '-',
      status: (f) => f.finance_type || '-',
      payment_method: (f) => f.payment_method || '-',
      driverName: (f) => f.driver ? `${f.driver.first_name} ${f.driver.last_name}`.trim() : '-',
      notes: (f) => f.notes || '-',
      id: (f) => f.id || '-',
    };

    const headerLabels: Record<string, string> = {
      reference_number: 'Reference Number',
      payer: 'Payer',
      amount_received: 'Amount Received',
      deposit_amount: 'Deposit Amount',
      payment_date: 'Payment Date',
      status: 'Status',
      payment_method: 'Payment Method',
      driverName: 'Driver Name',
      notes: 'Notes',
      id: 'Finance ID',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = finances.map((finance) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](finance) || '';
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

    tableBody.push(columns.map((col) => ({ text: headerLabels[col] || col, style: 'tableHeader' })));

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

  async delete(employid: string): Promise<{ success: boolean; message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finance = await queryRunner.manager.findOne(Finance, {
        where: { id: employid },
        relations: { driver: true, rentals: true },
      });

      if (!finance) {
        throw new NotFoundException('Finance not found');
      }

      const linkedRentalIds = finance.rentals?.map((r) => r.id) || [];

      if (finance.payment_method === 'saldo' && Number(finance.amount_received) > 0 && finance.driver_id) {
        const saldo = await this.findSaldoForUpdate(queryRunner, finance.driver_id);

        if (saldo) {
          const balanceBefore = Number(saldo.balance);
          const balanceAfter = balanceBefore + Number(finance.amount_received);

          saldo.balance = balanceAfter;
          await queryRunner.manager.save(saldo);

          const tx = queryRunner.manager.create(SaldoTransaction, {
            driver_id: finance.driver_id,
            driver_saldo_id: saldo.id,
            type: 'refund',
            amount: Number(finance.amount_received),
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference_id: finance.id,
            notes: `Refund karena finance ${finance.reference_number} dihapus`,
          });
          await queryRunner.manager.save(tx);
        }
      } else if (finance.payment_method !== 'saldo' && Number(finance.amount_received) > 0 && finance.driver_id) {
        const saldo = await this.findSaldoForUpdate(queryRunner, finance.driver_id);

        if (saldo) {
          const balanceBefore = Number(saldo.balance);
          const balanceAfter = balanceBefore - Number(finance.amount_received);

          if (balanceAfter < 0) {
            throw new BadRequestException(
              `Saldo tidak mencukupi untuk membatalkan finance. Saldo saat ini: Rp ${balanceBefore.toLocaleString('id-ID')}, perlu dikurangi: Rp ${Number(finance.amount_received).toLocaleString('id-ID')}`,
            );
          }

          saldo.balance = balanceAfter;
          await queryRunner.manager.save(saldo);

          const tx = queryRunner.manager.create(SaldoTransaction, {
            driver_id: finance.driver_id,
            driver_saldo_id: saldo.id,
            type: 'rental_payment',
            amount: Number(finance.amount_received),
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference_id: finance.id,
            notes: `Saldo dikurangi karena finance ${finance.reference_number} dihapus`,
          });
          await queryRunner.manager.save(tx);
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
