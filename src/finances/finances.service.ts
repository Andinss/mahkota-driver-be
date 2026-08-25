import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Finance } from './entities/finance.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
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
    private readonly rentalsService: RentalsService,
  ) {}

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

      const result = await this.financesRepository.save(finance);
      const saved = await this.findRawById(result.id);

      if (rental_ids && rental_ids.length > 0) {
        for (const rentalId of rental_ids) {
          await this.updateRentalPaymentStatus(rentalId);
        }
      }

      return {
        success: true,
        message: 'Finance created successfully',
        data: saved,
      };
    } catch (error) {
      console.error('Failed to create finance:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create finance');
    }
  }

  private async updateRentalPaymentStatus(rentalId: string): Promise<void> {
    const rentalRes = await this.rentalsService.findById(rentalId);
    const rental = rentalRes.data;
    if (!rental) return;

    const totalRevenue = Number(rental.total_revenue);

    const paidFinances = await this.financesRepository
      .createQueryBuilder('f')
      .leftJoin('f.rentals', 'r')
      .where('r.id = :rentalId', { rentalId })
      .select('COALESCE(SUM(f.amount_received), 0)', 'total')
      .getRawOne();

    const totalPaid = Number(paidFinances?.total || 0);

    if (totalPaid >= totalRevenue) {
      await this.rentalsService.updatePaymentStatus(rentalId, 'paid');
    } else if (totalPaid > 0) {
      await this.rentalsService.updatePaymentStatus(rentalId, 'partial');
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

    const allRentalIdsToRecalc = new Set([...oldRentalIds, ...(rental_ids || [])]);
    for (const rentalId of allRentalIdsToRecalc) {
      await this.updateRentalPaymentStatus(rentalId);
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
      : ['reference_number', 'payer', 'amount_received', 'payment_date', 'status', 'payment_method', 'finance_type'];

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
      payment_date: (f) => f.payment_date ? new Date(f.payment_date).toLocaleDateString('id-ID') : '-',
      status: (f) => f.is_active ? 'Active' : 'Inactive',
      payment_method: (f) => f.payment_method || '-',
      finance_type: (f) => f.finance_type || '-',
      driverName: (f) => f.driver ? `${f.driver.first_name} ${f.driver.last_name}`.trim() : '-',
      notes: (f) => f.notes || '-',
      id: (f) => f.id || '-',
    };

    const headerLabels: Record<string, string> = {
      reference_number: 'Reference Number',
      payer: 'Payer',
      amount_received: 'Amount Received',
      payment_date: 'Payment Date',
      status: 'Status',
      payment_method: 'Payment Method',
      finance_type: 'Finance Type',
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
    const finance = await this.findRawById(employid);
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }

    const linkedRentalIds = finance.rentals?.map((r) => r.id) || [];

    await this.financesRepository.delete(employid);

    for (const rentalId of linkedRentalIds) {
      await this.updateRentalPaymentStatus(rentalId);
    }

    return {
      success: true,
      message: 'Finance deleted successfully',
    };
  }
}
