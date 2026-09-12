import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Express } from 'express';
import { Driver } from './entities/driver.entity';
import { DriverSaldo } from '../saldo/entities/driver-saldo.entity';
import { AddDriverDto } from './dto/add-driver.dto';
import { DriverQueryDto } from './dto/driver-query.dto';
import { DriverExportDto } from './dto/driver-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(DriverSaldo)
    private readonly driverSaldoRepository: Repository<DriverSaldo>,
  ) {}

  async findAll(query?: DriverQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.driversRepository
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.created_by', 'created_by')
      .leftJoinAndSelect('d.saldo', 'saldo')
      .leftJoinAndSelect('d.rentals', 'rentals')
      .leftJoinAndSelect('rentals.vehicle', 'vehicle')
      .orderBy('d.created_at', 'DESC');

    if (query?.search) {
      qb.where(
        '(d.first_name ILIKE :search OR d.last_name ILIKE :search OR d.employee_id ILIKE :search OR d.phone ILIKE :search OR d.email ILIKE :search)',
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
      message: 'Drivers retrieved successfully',
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
    const driver = await this.driversRepository.findOne({
      where: { id },
      relations: { created_by: true, rentals: { vehicle: true } },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return {
      success: true,
      message: 'Driver retrieved successfully',
      data: driver,
    };
  }

  async findDetailById(id: string) {
    const driver = await this.driversRepository.findOne({
      where: { id },
      relations: { created_by: true, rentals: { vehicle: true } },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return {
      success: true,
      message: 'Driver detail retrieved successfully',
      data: driver,
    };
  }

  async getSummary() {
    const totalDrivers = await this.driversRepository.count();

    const genderBreakdown = await this.driversRepository
      .createQueryBuilder('d')
      .select('d.gender', 'gender')
      .addSelect('COUNT(d.id)', 'count')
      .groupBy('d.gender')
      .getRawMany();

    const genderCount: Record<string, number> = {};
    for (const row of genderBreakdown) {
      genderCount[row.gender] = Number(row.count);
    }

    return {
      success: true,
      message: 'Driver summary retrieved successfully',
      data: {
        total_drivers: totalDrivers,
        gender_breakdown: genderCount,
      },
    };
  }

  async findByEmployeeId(employeeId: string): Promise<Driver | null> {
    let driver = await this.driversRepository.findOne({ where: { employee_id: employeeId } });
    if (!driver && /^[0-9a-f-]{36}$/i.test(employeeId)) {
      driver = await this.driversRepository.findOne({ where: { id: employeeId } });
    }
    return driver;
  }

  async create(data: AddDriverDto, userId: string, files?: Express.Multer.File[]) {
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');

          if (originalName.includes('ktp')) {
            data.national_id_card = filePath;
          } else if (originalName.includes('sim')) {
            data.sim_card = filePath;
          } else if (
            originalName.includes('foto') ||
            originalName.includes('profil')
          ) {
            data.profile_photo = filePath;
          } else if (originalName.includes('rumah')) {
            data.garage_photo = filePath;
          } else {
            data.npwp_photo = filePath;
          }
        }
      }

      const driver = this.driversRepository.create({
        ...data,
        created_by_id: userId,
      } as unknown as Driver);
      const result = await this.driversRepository.save(driver);

      const existingSaldo = await this.driverSaldoRepository.findOne({
        where: { driver_id: result.id },
      });
      if (!existingSaldo) {
        const saldo = this.driverSaldoRepository.create({
          driver_id: result.id,
          balance: 0,
        });
        await this.driverSaldoRepository.save(saldo);
      }

      return {
        success: true,
        message: 'Driver created successfully',
        data: result,
      };
    } catch (error) {
      console.error('Failed to create driver:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            unlinkSync(file.path);
          } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to create driver');
    }
  }

  async update(
    employeeId: string,
    data: Partial<Driver>,
    files?: Express.Multer.File[],
  ) {
    try {
      let existingDriver = await this.driversRepository.findOne({
        where: { employee_id: employeeId },
      });

      if (!existingDriver && /^[0-9a-f-]{36}$/i.test(employeeId)) {
        existingDriver = await this.driversRepository.findOne({
          where: { id: employeeId },
        });
      }

      if (!existingDriver) {
        throw new NotFoundException('Driver not found');
      }

      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');
          let oldFilePath: string | null | undefined = null;

          if (originalName.includes('ktp')) {
            oldFilePath = existingDriver.national_id_card;
            data.national_id_card = filePath;
          } else if (originalName.includes('sim')) {
            oldFilePath = existingDriver.sim_card;
            data.sim_card = filePath;
          } else if (
            originalName.includes('foto') ||
            originalName.includes('profil')
          ) {
            oldFilePath = existingDriver.profile_photo;
            data.profile_photo = filePath;
          } else if (originalName.includes('rumah')) {
            oldFilePath = existingDriver.garage_photo;
            data.garage_photo = filePath;
          } else {
            oldFilePath = existingDriver.npwp_photo;
            data.npwp_photo = filePath;
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

      const { created_by_id, ...safeData } = data as any;
      const result = await this.driversRepository.update(existingDriver.id, safeData);

      if (result.affected === 0) {
        throw new NotFoundException('Driver not found');
      }

      const driver = await this.findByEmployeeId(employeeId);

      return {
        success: true,
        message: 'Driver updated successfully',
        data: driver,
      };
    } catch (error) {
      console.error('Failed to update driver:', error);

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
      throw new InternalServerErrorException('Failed to update driver');
    }
  }

  async delete(employeeId: string): Promise<{ success: boolean; message: string }> {
    let existingDriver = await this.driversRepository.findOne({
      where: { employee_id: employeeId },
    });

    if (!existingDriver && /^[0-9a-f-]{36}$/i.test(employeeId)) {
      existingDriver = await this.driversRepository.findOne({
        where: { id: employeeId },
      });
    }

    if (!existingDriver) {
      throw new NotFoundException('Driver not found');
    }

    const fileFields = [
      existingDriver.profile_photo,
      existingDriver.national_id_card,
      existingDriver.sim_card,
      existingDriver.garage_photo,
      existingDriver.npwp_photo,
    ];

    for (const filePath of fileFields) {
      if (filePath) {
        try {
          const fullPath = filePath.startsWith('/') ? filePath : `./${filePath}`;
          if (existsSync(fullPath)) {
            unlinkSync(fullPath);
          }
        } catch (err) {
          console.error(`Failed to delete file ${filePath}:`, err);
        }
      }
    }

    await this.driversRepository.delete(existingDriver.id);

    return {
      success: true,
      message: 'Driver deleted successfully',
    };
  }

  async exportData(query: DriverExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : ['name', 'employeeId', 'phoneNumber', 'email'];

    const qb = this.driversRepository.createQueryBuilder('d');

    if (query.search) {
      qb.where(
        '(d.first_name ILIKE :search OR d.last_name ILIKE :search OR d.employee_id ILIKE :search OR d.phone ILIKE :search OR d.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.start_date) {
      qb.andWhere('d.created_at >= :start', { start: query.start_date });
    }

    if (query.end_date) {
      qb.andWhere('d.created_at <= :end', { end: query.end_date });
    }

    const drivers = await qb.orderBy('d.created_at', 'DESC').getMany();

    const columnMap: Record<string, (d: Driver) => string | undefined> = {
      name: (d) => [d.first_name, d.last_name].filter(Boolean).join(' ') || '-',
      employeeId: (d) => d.employee_id || '-',
      phoneNumber: (d) => d.phone || '-',
      email: (d) => d.email || '-',
    };

    const headerLabels: Record<string, string> = {
      name: 'Driver Name',
      employeeId: 'Employee ID',
      phoneNumber: 'Phone Number',
      email: 'Email',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = drivers.map((driver) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](driver) || '';
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
      filename: `drivers_export_${Date.now()}.csv`,
    };
  }

  private async generateXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Drivers');

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
      filename: `drivers_export_${Date.now()}.xlsx`,
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
        { text: 'Driver Export Report', style: 'header' },
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
      filename: `drivers_export_${Date.now()}.pdf`,
    };
  }
}
