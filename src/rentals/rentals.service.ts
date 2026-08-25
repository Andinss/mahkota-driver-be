import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Express } from 'express';
import { Rental } from './entities/rental.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { AddRentalDto } from './dto/add-rental.dto';
import { RentalQueryDto } from './dto/rental-query.dto';
import { RentalExportDto } from './dto/rental-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(Rental)
    private readonly rentalsRepository: Repository<Rental>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    private readonly dataSource: DataSource,
  ) {}

  async autoSetLateStatus(): Promise<number> {
    const now = new Date();
    const overdue = await this.rentalsRepository
      .createQueryBuilder('r')
      .where('r.end_date < :now', { now })
      .andWhere('r.payment_status IN (:...statuses)', { statuses: ['unpaid', 'partial'] })
      .getMany();

    for (const rental of overdue) {
      rental.payment_status = 'late';
    }
    await this.rentalsRepository.save(overdue);

    return overdue.length;
  }

  async findAll(query?: RentalQueryDto) {
    await this.autoSetLateStatus();

    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.rentalsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.driver', 'driver')
      .leftJoinAndSelect('r.vehicle', 'vehicle')
      .orderBy('r.created_at', 'DESC');

    if (query?.search) {
      qb.where(
        '(r.rental_number ILIKE :search OR driver.first_name ILIKE :search OR driver.last_name ILIKE :search OR vehicle.license_plate ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Rentals retrieved successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string) {
    const rental = await this.rentalsRepository.findOne({
      where: { id },
      relations: { driver: true, vehicle: true },
    });

    if (!rental) {
      throw new NotFoundException('Rental not found');
    }

    return {
      success: true,
      message: 'Rental retrieved successfully',
      data: rental,
    };
  }

  async findDetailById(id: string) {
    const rental = await this.rentalsRepository.findOne({
      where: { id },
      relations: {
        driver: true,
        vehicle: true,
        finances: { driver: true },
        late_payments: true,
      },
    });

    if (!rental) {
      throw new NotFoundException('Rental not found');
    }

    return {
      success: true,
      message: 'Rental detail retrieved successfully',
      data: rental,
    };
  }

  async getSummary() {
    const totalActive = await this.rentalsRepository.count();
    const totalResult = await this.rentalsRepository
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.total_revenue), 0)', 'total_revenue')
      .addSelect('COALESCE(SUM(r.security_deposit), 0)', 'total_deposit')
      .addSelect('COALESCE(SUM(r.service_fee), 0)', 'total_service_fee')
      .addSelect('COALESCE(SUM(r.deposit_amount), 0)', 'total_deposit_amount')
      .addSelect('COALESCE(AVG(r.daily_rate), 0)', 'avg_daily_rate')
      .addSelect('COUNT(r.id)', 'total_rentals')
      .getRawOne();

    const byMethod = await this.rentalsRepository
      .createQueryBuilder('r')
      .select('r.method_payment', 'method')
      .addSelect('COALESCE(SUM(r.total_revenue), 0)', 'total')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('r.method_payment')
      .getRawMany();

    const amountByMethod: Record<string, number> = {};
    for (const row of byMethod) {
      amountByMethod[row.method] = Number(row.total);
    }

    return {
      success: true,
      message: 'Rental summary retrieved successfully',
      data: {
        total_rentals: Number(totalResult?.total_rentals || 0),
        total_revenue: Number(totalResult?.total_revenue || 0),
        total_deposit: Number(totalResult?.total_deposit || 0),
        total_service_fee: Number(totalResult?.total_service_fee || 0),
        total_deposit_amount: Number(totalResult?.total_deposit_amount || 0),
        avg_daily_rate: Number(totalResult?.avg_daily_rate || 0),
        amount_by_method: amountByMethod,
      },
    };
  }

  async findByRentalId(rentalId: string): Promise<Rental | null> {
    let rental = await this.rentalsRepository.findOne({
      where: { id: rentalId },
      relations: { driver: true, vehicle: true },
    });
    if (!rental && /^[0-9a-f-]{36}$/i.test(rentalId)) {
      rental = await this.rentalsRepository.findOne({
        where: { id: rentalId },
        relations: { driver: true, vehicle: true },
      });
    }
    return rental;
  }

  async create(data: AddRentalDto, files?: Express.Multer.File[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driversRepository.findOne({ where: { id: data.driver_id } });
      if (!driver) {
        throw new NotFoundException(`Driver with id ${data.driver_id} not found`);
      }

      const vehicle = await this.vehiclesRepository.findOne({ where: { id: data.vehicle_id } });
      if (!vehicle) {
        throw new NotFoundException(`Vehicle with id ${data.vehicle_id} not found`);
      }

      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');

          if (
            originalName.includes('kontrak') ||
            originalName.includes('contract')
          ) {
            data.document_contract = filePath;
          }
        }
      }

      const rental = this.rentalsRepository.create(data);
      const result = await queryRunner.manager.save(rental);

      await queryRunner.manager.update(Vehicle, data.vehicle_id, { status: 'rented' });

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Rental created successfully',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to create rental:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            unlinkSync(file.path);
          } catch {}
        }
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create rental');
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    rentalId: string,
    data: Partial<Rental>,
    files?: Express.Multer.File[],
  ) {
    try {
      let existingRental = await this.rentalsRepository.findOne({
        where: { id: rentalId },
      });

      if (!existingRental && /^[0-9a-f-]{36}$/i.test(rentalId)) {
        existingRental = await this.rentalsRepository.findOne({
          where: { id: rentalId },
        });
      }

      if (!existingRental) {
        throw new NotFoundException('Rental not found');
      }

      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');
          let oldFilePath: string | null | undefined = null;

          if (
            originalName.includes('kontrak') ||
            originalName.includes('contract')
          ) {
            oldFilePath = existingRental.document_contract;
            data.document_contract = filePath;
          }

          if (oldFilePath && oldFilePath !== filePath) {
            try {
              const fullPath = oldFilePath.startsWith('/')
                ? oldFilePath
                : `./${oldFilePath}`;
              if (existsSync(fullPath)) {
                unlinkSync(fullPath);
              }
            } catch (err) {
              console.error(`Failed to delete old file ${oldFilePath}:`, err);
            }
          }
        }
      }

      const result = await this.rentalsRepository.update(
        existingRental.id,
        data,
      );

      if (result.affected === 0) {
        throw new NotFoundException('Rental not found');
      }

      const rental = await this.findByRentalId(rentalId);

      return {
        success: true,
        message: 'Rental updated successfully',
        data: rental,
      };
    } catch (error) {
      console.error('Failed to update rental:', error);

      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (existsSync(file.path)) {
              unlinkSync(file.path);
            }
          } catch (err) {
            console.error('Failed to delete uploaded file:', err);
          }
        }
      }

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update rental');
    }
  }

  async updatePaymentStatus(rentalId: string, paymentStatus: string) {
    const validStatuses = ['paid', 'late', 'pending_confirmation', 'partial', 'unpaid'];
    if (!validStatuses.includes(paymentStatus)) {
      throw new BadRequestException(`Invalid payment status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const rental = await this.rentalsRepository.findOne({ where: { id: rentalId }, relations: { vehicle: true } });
    if (!rental) {
      throw new NotFoundException('Rental not found');
    }

    const allowedTransitions: Record<string, string[]> = {
      unpaid: ['paid', 'late', 'pending_confirmation', 'partial'],
      late: ['paid', 'pending_confirmation'],
      pending_confirmation: ['paid', 'late', 'unpaid'],
      partial: ['paid'],
      paid: [],
    };

    const allowed = allowedTransitions[rental.payment_status] || [];
    if (!allowed.includes(paymentStatus)) {
      throw new BadRequestException(
        `Cannot change status from '${rental.payment_status}' to '${paymentStatus}'. Allowed: ${allowed.join(', ') || 'none'}`
      );
    }

    rental.payment_status = paymentStatus;
    await this.rentalsRepository.save(rental);

    if (paymentStatus === 'paid' && rental.vehicle_id) {
      await this.vehiclesRepository.update(rental.vehicle_id, { status: 'Available' });
    }

    return {
      success: true,
      message: 'Payment status updated successfully',
      data: rental,
    };
  }

  async exportData(query: RentalExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : ['transactionId', 'driverName', 'driverId', 'vehicleName', 'vehiclePlate', 'rentalPeriod', 'duration', 'deposit', 'paymentStatus'];

    const qb = this.rentalsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.driver', 'driver')
      .leftJoinAndSelect('r.vehicle', 'vehicle');

    if (query.search) {
      qb.where(
        '(r.rental_number ILIKE :search OR driver.first_name ILIKE :search OR driver.last_name ILIKE :search OR vehicle.license_plate ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.start_date) {
      qb.andWhere('r.created_at >= :start', { start: query.start_date });
    }

    if (query.end_date) {
      qb.andWhere('r.created_at <= :end', { end: query.end_date });
    }

    const rentals = await qb.orderBy('r.created_at', 'DESC').getMany();

    const columnMap: Record<string, (r: Rental) => string> = {
      transactionId: (r) => r.rental_number || '-',
      driverName: (r) => [r.driver?.first_name, r.driver?.last_name].filter(Boolean).join(' ') || '-',
      driverId: (r) => r.driver?.employee_id || r.driver_id?.slice(0, 8) || '-',
      vehicleName: (r) => [r.vehicle?.merk, r.vehicle?.model].filter(Boolean).join(' ') || '-',
      vehiclePlate: (r) => r.vehicle?.license_plate || '-',
      rentalPeriod: (r) => `${r.start_date} to ${r.end_date}`,
      duration: (r) => String(r.total_duration) || '-',
      deposit: (r) => `Rp ${Number(r.deposit_amount).toLocaleString('id-ID')}`,
      paymentStatus: (r) => r.payment_status || '-',
      dailyRate: (r) => `Rp ${Number(r.daily_rate).toLocaleString('id-ID')}`,
      totalDailyRate: (r) => `Rp ${Number(r.total_daily_rate).toLocaleString('id-ID')}`,
      securityDeposit: (r) => `Rp ${Number(r.security_deposit).toLocaleString('id-ID')}`,
      serviceFee: (r) => `Rp ${Number(r.service_fee).toLocaleString('id-ID')}`,
      totalRevenue: (r) => `Rp ${Number(r.total_revenue).toLocaleString('id-ID')}`,
      methodPayment: (r) => r.method_payment || '-',
    };

    const headerLabels: Record<string, string> = {
      transactionId: 'Transaction ID',
      driverName: 'Driver Name',
      driverId: 'Driver ID',
      vehicleName: 'Vehicle Name',
      vehiclePlate: 'Vehicle Plate',
      rentalPeriod: 'Rental Period',
      duration: 'Duration (Days)',
      deposit: 'Deposit',
      paymentStatus: 'Payment Status',
      dailyRate: 'Daily Rate',
      totalDailyRate: 'Total Daily Rate',
      securityDeposit: 'Security Deposit',
      serviceFee: 'Service Fee',
      totalRevenue: 'Total Revenue',
      methodPayment: 'Payment Method',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = rentals.map((rental) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](rental) || '';
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
      filename: `rentals_export_${Date.now()}.csv`,
    };
  }

  private async generateXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rentals');

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
      filename: `rentals_export_${Date.now()}.xlsx`,
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
        { text: 'Rental Export Report', style: 'header' },
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
      filename: `rentals_export_${Date.now()}.pdf`,
    };
  }

  async delete(
    rentalId: string,
  ): Promise<{ success: boolean; message: string }> {
    let existingRental = await this.rentalsRepository.findOne({
      where: { id: rentalId },
    });

    if (!existingRental && /^[0-9a-f-]{36}$/i.test(rentalId)) {
      existingRental = await this.rentalsRepository.findOne({
        where: { id: rentalId },
      });
    }

    if (!existingRental) {
      throw new NotFoundException('Rental not found');
    }

    const fileFields = [existingRental.document_contract];

    for (const filePath of fileFields) {
      if (filePath) {
        try {
          const fullPath = filePath.startsWith('/')
            ? filePath
            : `./${filePath}`;
          if (existsSync(fullPath)) {
            unlinkSync(fullPath);
          }
        } catch (err) {
          console.error(`Failed to delete file ${filePath}:`, err);
        }
      }
    }

    await this.rentalsRepository.delete(existingRental.id);

    return {
      success: true,
      message: 'Rental deleted successfully',
    };
  }
}
