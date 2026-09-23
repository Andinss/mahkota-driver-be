import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, MoreThan } from 'typeorm';
import { Express } from 'express';
import { Rental } from './entities/rental.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Finance } from '../finances/entities/finance.entity';
import { FinancePayment } from '../finances/entities/finance-payment.entity';
import { DailyPayment } from '../daily-payments/entities/daily-payment.entity';
import { AddRentalDto } from './dto/add-rental.dto';

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
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
    @InjectRepository(Finance)
    private readonly financesRepository: Repository<Finance>,
    @InjectRepository(FinancePayment)
    private readonly financePaymentRepository: Repository<FinancePayment>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query?: RentalQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.rentalsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.driver', 'driver')
      .leftJoinAndSelect('r.vehicle', 'vehicle')
      .orderBy('r.created_at', 'DESC');

    if (query?.search) {
      qb.andWhere(
        `(
          r.rental_number ILIKE :search 
          OR driver.first_name ILIKE :search 
          OR driver.last_name ILIKE :search 
          OR vehicle.license_plate ILIKE :search
          OR vehicle.merk ILIKE :search
          OR vehicle.model ILIKE :search
        )`,
        { search: `%${query.search}%` },
      );
    }

    if (query?.rental_duration) {
      qb.andWhere('r.rental_duration = :dur', { dur: query.rental_duration });
    }

    if (query?.rental_service) {
      qb.andWhere('r.rental_service = :svc', { svc: query.rental_service });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

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

  async getDriverRentalCount(driverId: string) {
    const count = await this.rentalsRepository.count({
      where: { driver_id: driverId },
    });
    const hasAdminFee = !!(await this.financesRepository.findOne({
      where: { driver_id: driverId, fee_admin_join: MoreThan(0) },
    }));
    return {
      success: true,
      message: 'Driver rental count retrieved successfully',
      data: {
        driver_id: driverId,
        rental_count: count,
        is_first_rental: count <= 1,
        has_admin_fee: hasAdminFee,
      },
    };
  }

  async getSummary() {
    const totalResult = await this.rentalsRepository
      .createQueryBuilder('r')
      .select('COALESCE(AVG(r.daily_rate), 0)', 'avg_daily_rate')
      .addSelect('COUNT(r.id)', 'total_rentals')
      .addSelect(
        "COALESCE(SUM(CASE WHEN r.rental_service = 'lepas kunci' THEN 1 ELSE 0 END), 0)",
        'lepas_kunci',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN r.rental_service = 'pakai supir' THEN 1 ELSE 0 END), 0)",
        'pakai_supir',
      )
      .getRawOne();

    return {
      success: true,
      message: 'Rental summary retrieved successfully',
      data: {
        total_rentals: Number(totalResult?.total_rentals || 0),
        avg_daily_rate: Number(totalResult?.avg_daily_rate || 0),
        lepas_kunci: Number(totalResult?.lepas_kunci || 0),
        pakai_supir: Number(totalResult?.pakai_supir || 0),
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
      const driver = await this.driversRepository.findOne({
        where: { id: data.driver_id },
      });
      if (!driver) {
        throw new NotFoundException(
          `Driver with id ${data.driver_id} not found`,
        );
      }

      const vehicle = await this.vehiclesRepository.findOne({
        where: { id: data.vehicle_id },
      });
      if (!vehicle) {
        throw new NotFoundException(
          `Vehicle with id ${data.vehicle_id} not found`,
        );
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

      const rental = this.rentalsRepository.create({
        ...data,
      });
      const result = await queryRunner.manager.save(rental);

      await queryRunner.manager.update(Vehicle, data.vehicle_id, {
        status: 'rented',
      });

      // Auto-create Finance linked to this Rental
      const totalAmount = Number(data.daily_rate) * Number(data.total_duration);
      const dailyRate = Number(data.daily_rate) || 0;
      const totalDuration = Number(data.total_duration) || 0;

      // Compute admin fee: only charge if this driver has never had an admin fee before
      let adminFee = 0;
      const existingAdminFee = await queryRunner.manager.findOne(Finance, {
        where: { driver_id: data.driver_id, fee_admin_join: MoreThan(0) },
      });
      if (!existingAdminFee) {
        const pricingCategory = vehicle.pricing_category;
        if (pricingCategory === 'Premium') {
          adminFee = 700000;
        } else if (pricingCategory === 'Reguler') {
          adminFee = 500000;
        }
      }

      const rentalNumber = result.rental_number || `RENT-${Date.now()}`;

      let savedFinance: Finance | null = null;
      if (adminFee > 0) {
        const now = new Date();
        const ym = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastFinance = await queryRunner.manager
          .createQueryBuilder(Finance, 'f')
          .where('f.reference_number LIKE :prefix', { prefix: `ADF-${ym}/%` })
          .orderBy('f.reference_number', 'DESC')
          .getOne();
        let seq = 1;
        if (lastFinance) {
          const parts = lastFinance.reference_number.split('/');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum)) seq = lastNum + 1;
        }
        const refNumber = `ADF-${ym}/${String(seq).padStart(4, '0')}`;

        const finance = queryRunner.manager.create(Finance, {
          payment_date: new Date(),
          reference_number: refNumber,
          payment_method: 'transfer',
          amount_received: 0,
          fee_admin_join: adminFee,
          notes: `Admin Fee: ${vehicle.pricing_category} Rp ${adminFee.toLocaleString('id-ID')}`,
          payer: `${driver.first_name} ${driver.last_name}`,
          driver_id: data.driver_id,
          finance_type: 'unpaid',
          status: 'unpaid',
          rentals: [{ id: result.id } as any],
        });
        savedFinance = await queryRunner.manager.save(finance);
      }

      // Auto-create today's daily payment so it shows immediately in admin dashboard
      const today = new Date();
      const todayLocal = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const todayStr = toLocalDateString(todayLocal);

      const ymPay = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;
      const lastDailyPayment = await queryRunner.manager
        .createQueryBuilder(DailyPayment, 'dp')
        .where('dp.reference_number LIKE :prefix', { prefix: `PAY-${ymPay}/%` })
        .orderBy('dp.reference_number', 'DESC')
        .getOne();
      let seqPay = 1;
      if (lastDailyPayment) {
        const parts = lastDailyPayment.reference_number.split('/');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) seqPay = lastNum + 1;
      }
      const payRefNumber = `PAY-${ymPay}/${String(seqPay).padStart(4, '0')}`;

      const dailyPayment = queryRunner.manager.create(DailyPayment, {
        rental_id: result.id,
        driver_id: data.driver_id,
        vehicle_id: data.vehicle_id,
        payment_date: todayLocal,
        amount: dailyRate,
        status: 'unpaid',
        reference_number: payRefNumber,
        notes: `Daily payment for rental ${rentalNumber}`,
      });
      const savedDailyPayment = await queryRunner.manager.save(dailyPayment);
      if (!savedDailyPayment?.id) {
        throw new Error('Failed to save daily payment: no ID returned');
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Rental created successfully',
        data: result,
        finance: savedFinance
          ? {
              id: savedFinance.id,
              reference_number: savedFinance.reference_number,
              admin_fee: adminFee,
            }
          : null,
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
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
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

  async exportData(query: RentalExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : [
          'transactionId',
          'driverName',
          'driverId',
          'vehicleName',
          'vehiclePlate',
          'rentalPeriod',
          'duration',
          'rentalDuration',
          'rentalService',
          'engine',
        ];

    const qb = this.rentalsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.driver', 'driver')
      .leftJoinAndSelect('r.vehicle', 'vehicle');

    if (query.vehicle_id) {
      qb.andWhere('r.vehicle_id = :vehicleId', { vehicleId: query.vehicle_id });
    }

    if (query.driver_id) {
      qb.andWhere('r.driver_id = :driverId', { driverId: query.driver_id });
    }

    if (query.search) {
      qb.where(
        '(r.rental_number ILIKE :search OR driver.first_name ILIKE :search OR driver.last_name ILIKE :search OR vehicle.license_plate ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.start_date) {
      qb.andWhere('r.created_at >= :start', {
        start: query.start_date + ' 00:00:00',
      });
    }

    if (query.end_date) {
      qb.andWhere('r.created_at <= :end', {
        end: query.end_date + ' 23:59:59.999',
      });
    }

    const rentals = await qb.orderBy('r.created_at', 'DESC').getMany();

    const columnMap: Record<string, (r: Rental) => string> = {
      transactionId: (r) => r.rental_number || '-',
      driverName: (r) =>
        [r.driver?.first_name, r.driver?.last_name].filter(Boolean).join(' ') ||
        '-',
      driverId: (r) => r.driver?.employee_id || r.driver_id?.slice(0, 8) || '-',
      vehicleName: (r) =>
        [r.vehicle?.merk, r.vehicle?.model].filter(Boolean).join(' ') || '-',
      vehiclePlate: (r) => r.vehicle?.license_plate || '-',
      rentalPeriod: (r) => `${r.start_date} to ${r.end_date}`,
      duration: (r) => String(r.total_duration) || '-',
      dailyRate: (r) => `Rp ${Number(r.daily_rate).toLocaleString('id-ID')}`,
      rentalDuration: (r) => r.rental_duration || '-',
      rentalService: (r) => r.rental_service || '-',
      engine: (r) => r.vehicle?.engine_status || '-',
      totalDistance: (r) => '-',
      fuelEfficiency: (r) => '-',
      maintenance: (r) => '-',
      status: (r) => {
        try {
          const now = new Date();
          const start = r.start_date ? new Date(r.start_date) : null;
          const end = r.end_date ? new Date(r.end_date) : null;
          if (start && end && now >= start && now <= end) return 'Active';
          if (end && now > end) return 'Completed';
          if (start && now < start) return 'Upcoming';
        } catch {}
        return '-';
      },
    };

    const headerLabels: Record<string, string> = {
      transactionId: 'Transaction ID',
      driverName: 'Driver Name',
      driverId: 'Driver ID',
      vehicleName: 'Vehicle Name',
      vehiclePlate: 'Vehicle Plate',
      rentalPeriod: 'Rental Period',
      duration: 'Duration (Days)',
      dailyRate: 'Daily Rate',
      rentalDuration: 'Tipe Durasi',
      rentalService: 'Jenis Layanan',
      engine: 'Engine',
      totalDistance: 'Total Distance',
      fuelEfficiency: 'Fuel Efficiency',
      maintenance: 'Maintenance',
      status: 'Status',
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
    const buffer = Buffer.from(writeResult);

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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let existingRental = await queryRunner.manager.findOne(Rental, {
        where: { id: rentalId },
      });

      if (!existingRental && /^[0-9a-f-]{36}$/i.test(rentalId)) {
        existingRental = await queryRunner.manager.findOne(Rental, {
          where: { id: rentalId },
        });
      }

      if (!existingRental) {
        throw new NotFoundException('Rental not found');
      }

      if (existingRental.vehicle_id) {
        await queryRunner.manager.update(Vehicle, existingRental.vehicle_id, {
          status: 'Available',
        });
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

      await queryRunner.manager.delete(Rental, existingRental.id);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Rental deleted successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to delete rental:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete rental');
    } finally {
      await queryRunner.release();
    }
  }
}
