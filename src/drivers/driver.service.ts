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
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Finance } from '../finances/entities/finance.entity';
import { AddDriverDto } from './dto/add-driver.dto';
import { DriverQueryDto } from './dto/driver-query.dto';
import { DriverExportDto } from './dto/driver-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';
import { resolveDriverFileField } from './utils/driver-file.util';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(DriverKoin)
    private readonly driverKoinRepository: Repository<DriverKoin>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(Finance)
    private readonly financesRepository: Repository<Finance>,
  ) {}

  async findAll(query?: DriverQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    // Count & id halaman tanpa join relasi: leftJoinAndSelect (d.rentals)
    // + take membatasi baris JOIN, bukan entity unik.
    const baseQb = this.driversRepository.createQueryBuilder('d');

    if (query?.search) {
      baseQb.where(
        '(d.first_name ILIKE :search OR d.last_name ILIKE :search OR d.employee_id ILIKE :search OR d.phone ILIKE :search OR d.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const total = await baseQb.getCount();

    const pageIds = (
      await baseQb
        .clone()
        .select('d.id', 'id')
        .orderBy('d.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getRawMany<{ id: string }>()
    ).map((row) => row.id);

    let data: Driver[] = [];
    if (pageIds.length > 0) {
      data = await this.driversRepository
        .createQueryBuilder('d')
        .leftJoinAndSelect('d.created_by', 'created_by')
        .leftJoinAndSelect('d.koin', 'koin')
        .leftJoinAndSelect('d.membership', 'membership')
        .leftJoinAndSelect('d.rentals', 'rentals')
        .leftJoinAndSelect('rentals.vehicle', 'vehicle')
        .whereInIds(pageIds)
        .orderBy('d.created_at', 'DESC')
        .getMany();
    }

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
      relations: {
        created_by: true,
        membership: true,
        rentals: { vehicle: true },
      },
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
      relations: {
        created_by: true,
        membership: true,
        rentals: { vehicle: true },
      },
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
    const activeDrivers = await this.driversRepository.count({
      where: { is_active: true },
    });
    const inactiveDrivers = await this.driversRepository.count({
      where: { is_active: false },
    });

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
        active_drivers: activeDrivers,
        inactive_drivers: inactiveDrivers,
        gender_breakdown: genderCount,
      },
    };
  }

  async findByEmployeeId(employeeId: string): Promise<Driver | null> {
    let driver = await this.driversRepository.findOne({
      where: { employee_id: employeeId },
      relations: { membership: true },
    });
    if (!driver && /^[0-9a-f-]{36}$/i.test(employeeId)) {
      driver = await this.driversRepository.findOne({
        where: { id: employeeId },
        relations: { membership: true },
      });
    }
    return driver;
  }

  private async resolveMembershipChange(
    currentMembershipId: string | null | undefined,
    targetMembershipId: string,
  ) {
    const target = await this.membershipRepository.findOne({
      where: { id: targetMembershipId },
    });
    if (!target) {
      throw new NotFoundException('Membership not found');
    }

    const current = currentMembershipId
      ? await this.membershipRepository.findOne({
          where: { id: currentMembershipId },
        })
      : null;

    // Aturan fee:
    // - tanpa membership sebelumnya → fee penuh (selisih dari 0)
    // - upgrade ke level lebih tinggi → selisih fee
    // - downgrade / level sama → tanpa fee (tanpa refund)
    let fee = 0;
    if (!current) {
      fee = Number(target.fee) || 0;
    } else if (target.level > current.level) {
      fee = Math.max(0, (Number(target.fee) || 0) - (Number(current.fee) || 0));
    }

    return { current, target, fee };
  }

  private async createMembershipFeeBill(
    driver: Driver,
    target: Membership,
    current: Membership | null,
    fee: number,
  ) {
    if (!(fee > 0)) return null;

    const now = new Date();
    const ym = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastBill = await this.financesRepository
      .createQueryBuilder('f')
      .where('f.reference_number LIKE :prefix', { prefix: `ADF-${ym}/%` })
      .orderBy('f.reference_number', 'DESC')
      .getOne();
    let seq = 1;
    if (lastBill) {
      const parts = lastBill.reference_number.split('/');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) seq = lastNum + 1;
    }

    const notes = current
      ? `Upgrade membership ${current.name} → ${target.name}`
      : `Join membership ${target.name}`;

    const bill = this.financesRepository.create({
      payment_date: now,
      reference_number: `ADF-${ym}/${String(seq).padStart(4, '0')}`,
      payment_method: 'cash',
      amount_received: 0,
      fee_admin_join: fee,
      fee_kind: 'membership_fee',
      notes,
      payer: [driver.first_name, driver.last_name].filter(Boolean).join(' '),
      driver_id: driver.id,
      finance_type: 'unpaid',
      status: 'unpaid',
      is_active: true,
    });
    return this.financesRepository.save(bill);
  }

  private async billMembershipFee(
    driver: Driver,
    currentMembershipId: string | null | undefined,
    targetMembershipId: string,
  ) {
    try {
      const { current, target, fee } = await this.resolveMembershipChange(
        currentMembershipId,
        targetMembershipId,
      );
      if (fee > 0) {
        await this.createMembershipFeeBill(driver, target, current, fee);
      }
    } catch (error) {
      console.error('Failed to create membership fee bill:', error);
    }
  }

  async create(
    data: AddDriverDto,
    userId: string,
    files?: Express.Multer.File[],
  ) {
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = file.path.replace(/\\/g, '/');
          (data as any)[resolveDriverFileField(file.originalname)] = filePath;
        }
      }

      const driver = this.driversRepository.create({
        ...data,
        created_by_id: userId,
      } as unknown as Driver);
      const result = await this.driversRepository.save(driver);

      const existingKoin = await this.driverKoinRepository.findOne({
        where: { driver_id: result.id },
      });
      if (!existingKoin) {
        const koin = this.driverKoinRepository.create({
          driver_id: result.id,
          balance: 0,
        });
        await this.driverKoinRepository.save(koin);
      }

      if (data.membership_id) {
        await this.billMembershipFee(result, null, data.membership_id);
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
          const field = resolveDriverFileField(file.originalname);
          const filePath = file.path.replace(/\\/g, '/');
          const oldFilePath = (existingDriver as any)[field] as
            | string
            | null
            | undefined;

          (data as any)[field] = filePath;

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
      const result = await this.driversRepository.update(
        existingDriver.id,
        safeData,
      );

      if (result.affected === 0) {
        throw new NotFoundException('Driver not found');
      }

      const newMembershipId = (data as Partial<Driver>).membership_id;
      if (newMembershipId && newMembershipId !== existingDriver.membership_id) {
        await this.billMembershipFee(
          existingDriver,
          existingDriver.membership_id,
          newMembershipId,
        );
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

  async updateStatus(employeeId: string, is_active: boolean) {
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

    await this.driversRepository.update(existingDriver.id, { is_active });

    const driver = await this.findByEmployeeId(employeeId);

    return {
      success: true,
      message: `Driver marked as ${is_active ? 'Active' : 'Inactive'} successfully`,
      data: driver,
    };
  }

  async delete(
    employeeId: string,
  ): Promise<{ success: boolean; message: string }> {
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
      existingDriver.kartu_keluarga,
      existingDriver.garage_photo,
      existingDriver.npwp_photo,
      existingDriver.skck,
    ];

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
      : ['name', 'employee_id', 'phone', 'email', 'koin'];

    const qb = this.driversRepository
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.koin', 'koin')
      .leftJoinAndSelect('d.membership', 'membership');

    if (query.search) {
      qb.where(
        '(d.first_name ILIKE :search OR d.last_name ILIKE :search OR d.employee_id ILIKE :search OR d.phone ILIKE :search OR d.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.start_date) {
      qb.andWhere('d.created_at >= :start', {
        start: query.start_date + ' 00:00:00',
      });
    }

    if (query.end_date) {
      qb.andWhere('d.created_at <= :end', {
        end: query.end_date + ' 23:59:59.999',
      });
    }

    const drivers = await qb.orderBy('d.created_at', 'DESC').getMany();

    const columnMap: Record<string, (d: Driver) => string | undefined> = {
      name: (d) => [d.first_name, d.last_name].filter(Boolean).join(' ') || '-',
      employeeId: (d) => d.employee_id || '-',
      employee_id: (d) => d.employee_id || '-',
      phoneNumber: (d) => d.phone || '-',
      phone: (d) => d.phone || '-',
      email: (d) => d.email || '-',
      koin: (d) => String(d.koin?.balance || 0),
      membership: (d) => (d.membership ? `${d.membership.name}` : '-'),
      gender: (d) => d.gender || '-',
      date_of_birth: (d) =>
        d.date_of_birth
          ? new Date(d.date_of_birth).toLocaleDateString('id-ID')
          : '-',
      citizenship: (d) => d.citizenship || '-',
      kartu_keluarga: (d) => d.kartu_keluarga || '-',
      house_type: (d) => d.house_type || '-',
      province_name: (d) => d.province_name || '-',
      city_name: (d) => d.city_name || '-',
      willing_to_be_survey: (d) => (d.willing_to_be_survey ? 'Yes' : 'No'),
      ready_sign_contract: (d) => (d.ready_sign_contract ? 'Yes' : 'No'),
      id: (d) => d.id || '-',
    };

    const headerLabels: Record<string, string> = {
      name: 'Driver Name',
      employeeId: 'Employee ID',
      employee_id: 'Employee ID',
      phoneNumber: 'Phone Number',
      phone: 'Phone Number',
      email: 'Email',
      koin: 'Koin',
      membership: 'Membership',
      gender: 'Gender',
      date_of_birth: 'Date of Birth',
      citizenship: 'Citizenship',
      kartu_keluarga: 'Kartu Keluarga',
      house_type: 'House Type',
      province_name: 'Province',
      city_name: 'City / Regency',
      willing_to_be_survey: 'Willing to be Surveyed',
      ready_sign_contract: 'Ready Sign Contract',
      id: 'Driver ID',
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
    const buffer = Buffer.from(writeResult);

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
