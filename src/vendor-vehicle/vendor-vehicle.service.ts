import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorVehicle } from './entities/vendor-vehicle.entity';
import { Finance } from '../finances/entities/finance.entity';
import { FinancePayment } from '../finances/entities/finance-payment.entity';
import { DailyPayment } from '../daily-payments/entities/daily-payment.entity';
import { CreateVendorVehicleDto } from './dto/create-vendor-vehicle.dto';
import { VendorVehicleQueryDto } from './dto/vendor-vehicle-query.dto';
import { VendorVehicleExportDto } from './dto/vendor-vehicle-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class VendorVehicleService {
  constructor(
    @InjectRepository(VendorVehicle)
    private readonly vendorRepository: Repository<VendorVehicle>,
  ) {}

  async findAll(query?: VendorVehicleQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.vendorRepository
      .createQueryBuilder('v')
      .orderBy('v.created_at', 'DESC');

    if (query?.search) {
      qb.where('(v.name ILIKE :search OR v.owner_name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query?.status) {
      qb.andWhere('v.status = :status', { status: query.status });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    const ids = data.map((vendor) => vendor.id);
    const vehicleCounts = await this.getVehicleCounts(ids);
    const pendapatanMap = await this.getPaidPendapatan(ids);

    const mappedData = data.map((vendor) => ({
      ...vendor,
      total_kendaraan: vehicleCounts[vendor.id] || 0,
      pendapatan: pendapatanMap[vendor.id] || 0,
    }));

    return {
      success: true,
      message: 'Vendor vehicles retrieved successfully',
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  private async getVehicleCounts(
    ids: string[],
  ): Promise<Record<string, number>> {
    if (ids.length === 0) {
      return {};
    }

    const rows = await this.vendorRepository
      .createQueryBuilder('v')
      .select('vehicle.vendor_id', 'vendor_id')
      .addSelect('COUNT(vehicle.id)', 'count')
      .leftJoin('v.vehicles', 'vehicle')
      .where('v.id IN (:...ids)', { ids })
      .groupBy('vehicle.vendor_id')
      .getRawMany();

    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row.vendor_id) {
        counts[row.vendor_id] = Number(row.count) || 0;
      }
    }
    return counts;
  }

  private async getPaidPendapatan(
    vendorIds: string[],
  ): Promise<Record<string, number>> {
    if (vendorIds.length === 0) {
      return {};
    }

    const rows = await this.vendorRepository.manager
      .createQueryBuilder()
      .select('t.vendor_id', 'vendor_id')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'total')
      .from(
        (sub) =>
          sub
            .select('payment.id', 'payment_id')
            .addSelect('vehicle.vendor_id', 'vendor_id')
            .addSelect('payment.amount', 'amount')
            .distinct(true)
            .from(FinancePayment, 'payment')
            .innerJoin(Finance, 'finance', 'finance.id = payment.finance_id')
            .innerJoin('finance_rentals', 'fr', 'fr.finance_id = finance.id')
            .innerJoin('rentals', 'rental', 'rental.id = fr.rental_id')
            .innerJoin('vehicles', 'vehicle', 'vehicle.id = rental.vehicle_id')
            .where('payment.status = :status', { status: 'paid' })
            .andWhere('vehicle.vendor_id IN (:...vendorIds)', { vendorIds }),
        't',
      )
      .groupBy('t.vendor_id')
      .getRawMany();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.vendor_id] = Number(row.total) || 0;
    }

    const dailyRows = await this.vendorRepository.manager
      .createQueryBuilder()
      .select('vehicle.vendor_id', 'vendor_id')
      .addSelect('COALESCE(SUM(dp.amount), 0)', 'total')
      .from(DailyPayment, 'dp')
      .innerJoin('vehicles', 'vehicle', 'vehicle.id = dp.vehicle_id')
      .where('dp.status = :status', { status: 'paid' })
      .andWhere('vehicle.vendor_id IN (:...vendorIds)', { vendorIds })
      .groupBy('vehicle.vendor_id')
      .getRawMany();

    for (const row of dailyRows) {
      result[row.vendor_id] =
        (result[row.vendor_id] || 0) + (Number(row.total) || 0);
    }

    return result;
  }

  async findById(id: string) {
    const vendor = await this.vendorRepository.findOne({
      where: { id },
      relations: { vehicles: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    {
      const total = await this.getVehicleCount(id);
      const pendapatanMap = await this.getPaidPendapatan([id]);

      return {
        success: true,
        message: 'Vendor retrieved successfully',
        data: {
          ...vendor,
          total_kendaraan: total,
          pendapatan: pendapatanMap[id] || 0,
          vehicles: undefined,
        },
      };
    }
  }

  async findDetailById(id: string) {
    const vendor = await this.vendorRepository.findOne({
      where: { id },
      relations: { vehicles: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const pendapatanMap = await this.getPaidPendapatan([vendor.id]);
    const totalPendapatan = pendapatanMap[vendor.id] || 0;
    const vehicles = (vendor.vehicles || []).map((v) => ({
      id: v.id,
      merk: v.merk,
      model: v.model,
      license_plate: v.license_plate,
      status: v.status,
      daily_rate: Number(v.daily_rate) || 0,
    }));

    return {
      success: true,
      message: 'Vendor detail retrieved successfully',
      data: {
        ...vendor,
        pendapatan: totalPendapatan,
        total_kendaraan: vehicles.length,
        vehicles,
      },
    };
  }

  private async getVehicleCount(id: string): Promise<number> {
    return this.vendorRepository
      .createQueryBuilder('v')
      .leftJoin('v.vehicles', 'vehicle')
      .where('v.id = :id', { id })
      .select('COUNT(vehicle.id)', 'count')
      .getRawOne()
      .then((row) => Number(row?.count) || 0);
  }

  async getSummary() {
    const totalVendors = await this.vendorRepository.count();

    const statusCounts = await this.vendorRepository
      .createQueryBuilder('v')
      .select('v.status', 'status')
      .addSelect('COUNT(v.id)', 'count')
      .groupBy('v.status')
      .getRawMany();

    const statusBreakdown: Record<string, number> = {};
    for (const row of statusCounts) {
      statusBreakdown[row.status] = Number(row.count);
    }

    const totalActive = statusBreakdown['active'] || 0;
    const totalInactive = statusBreakdown['inactive'] || 0;

    const vendors = await this.vendorRepository.find({ select: { id: true } });
    const vendorIds = vendors.map((v) => v.id);
    const pendapatanMap = await this.getPaidPendapatan(vendorIds);
    const totalPendapatan = Object.values(pendapatanMap).reduce(
      (acc, value) => acc + value,
      0,
    );
    const averagePendapatan =
      totalVendors > 0 ? Math.round(totalPendapatan / totalVendors) : 0;

    return {
      success: true,
      message: 'Vendor vehicle summary retrieved successfully',
      data: {
        total_vendors: totalVendors,
        active: totalActive,
        inactive: totalInactive,
        total_pendapatan: totalPendapatan,
        average_pendapatan: averagePendapatan,
        status_breakdown: statusBreakdown,
      },
    };
  }

  async create(data: CreateVendorVehicleDto, files?: Express.Multer.File[]) {
    try {
      if (files && files.length > 0) {
        data.logo = files[0].path.replace(/\\/g, '/');
      }

      const vendor = await this.vendorRepository.save(
        this.vendorRepository.create({
          ...data,
          status: data.status ?? 'active',
        }),
      );

      return {
        success: true,
        message: 'Vendor created successfully',
        data: vendor,
      };
    } catch (error) {
      console.error('Failed to create vendor:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            unlinkSync(file.path);
          } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to create vendor');
    }
  }

  async update(
    vendorId: string,
    data: Partial<VendorVehicle>,
    files?: Express.Multer.File[],
  ) {
    try {
      const existingVendor = await this.vendorRepository.findOne({
        where: { id: vendorId },
      });

      if (!existingVendor) {
        throw new NotFoundException('Vendor not found');
      }

      if (files && files.length > 0) {
        if (existingVendor.logo) {
          try {
            const fullPath = existingVendor.logo.startsWith('/')
              ? existingVendor.logo
              : `./${existingVendor.logo}`;
            if (existsSync(fullPath)) {
              unlinkSync(fullPath);
            }
          } catch (err) {
            console.error(
              `Failed to delete old file ${existingVendor.logo}:`,
              err,
            );
          }
        }

        data.logo = files[0].path.replace(/\\/g, '/');
      }

      const result = await this.vendorRepository.update(
        existingVendor.id,
        data,
      );

      if (result.affected === 0) {
        throw new NotFoundException('Vendor not found');
      }

      const vendor = await this.findByVendorId(vendorId);

      return {
        success: true,
        message: 'Vendor updated successfully',
        data: vendor,
      };
    } catch (error) {
      console.error('Failed to update vendor:', error);

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
      throw new InternalServerErrorException('Failed to update vendor');
    }
  }

  async findByVendorId(vendorId: string): Promise<VendorVehicle | null> {
    return this.vendorRepository.findOne({ where: { id: vendorId } });
  }

  async exportData(query: VendorVehicleExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : [
          'name',
          'ownerName',
          'pendapatan',
          'totalKendaraan',
          'status',
          'createdAt',
        ];

    const qb = this.vendorRepository.createQueryBuilder('v');

    if (query.search) {
      qb.where('(v.name ILIKE :search OR v.owner_name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.status) {
      qb.andWhere('v.status = :status', { status: query.status });
    }

    if (query.start_date) {
      qb.andWhere('v.created_at >= :start', {
        start: query.start_date + ' 00:00:00',
      });
    }

    if (query.end_date) {
      qb.andWhere('v.created_at <= :end', {
        end: query.end_date + ' 23:59:59.999',
      });
    }

    const vendors = await qb.orderBy('v.created_at', 'DESC').getMany();

    const vendorIds = vendors.map((v) => v.id);
    const [vehicleCounts, pendapatanMap] = await Promise.all([
      this.getVehicleCounts(vendorIds),
      this.getPaidPendapatan(vendorIds),
    ]);

    const columnMap: Record<string, (v: VendorVehicle) => string> = {
      name: (v) => v.name || '-',
      ownerName: (v) => v.owner_name || '-',
      pendapatan: (v) =>
        `Rp ${Number(pendapatanMap[v.id] || 0).toLocaleString('id-ID')}`,
      totalKendaraan: (v) => String(Number(vehicleCounts[v.id] || 0)),
      status: (v) => (v.status === 'active' ? 'Aktif' : 'Nonaktif'),
      createdAt: (v) =>
        v.created_at ? new Date(v.created_at).toLocaleDateString('id-ID') : '-',
      id: (v) => v.id || '-',
    };

    const headerLabels: Record<string, string> = {
      name: 'Nama Vendor',
      ownerName: 'Nama Pemilik',
      pendapatan: 'Pendapatan',
      totalKendaraan: 'Total Kendaraan',
      status: 'Status',
      createdAt: 'Tanggal Bergabung',
      id: 'Vendor ID',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = vendors.map((vendor) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](vendor) || '';
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
      filename: `vendor_vehicles_export_${Date.now()}.csv`,
    };
  }

  private async generateXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Vendor Vehicles');

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
      filename: `vendor_vehicles_export_${Date.now()}.xlsx`,
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
        { text: 'Vendor Vehicle Export Report', style: 'header' },
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
      filename: `vendor_vehicles_export_${Date.now()}.pdf`,
    };
  }

  async delete(
    vendorId: string,
  ): Promise<{ success: boolean; message: string }> {
    const existingVendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
    });

    if (!existingVendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (existingVendor.logo) {
      try {
        const fullPath = existingVendor.logo.startsWith('/')
          ? existingVendor.logo
          : `./${existingVendor.logo}`;
        if (existsSync(fullPath)) {
          unlinkSync(fullPath);
        }
      } catch (err) {
        console.error(`Failed to delete file ${existingVendor.logo}:`, err);
      }
    }

    await this.vendorRepository.delete(existingVendor.id);

    return {
      success: true,
      message: 'Vendor deleted successfully',
    };
  }
}
