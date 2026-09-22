import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { VendorVehicle } from '../vendor-vehicle/entities/vendor-vehicle.entity';
import { AddVehicleDto } from './dto/add-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { VehicleExportDto } from './dto/vehicle-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';
import { GpsidService } from '../gpsid/gpsid.service';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    private readonly gpsidService: GpsidService,
  ) {}

  async findAll(query?: VehicleQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.vehiclesRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.vendor', 'vendor')
      .orderBy('v.created_at', 'DESC');

    if (query?.search) {
      qb.where(
        '(v.merk ILIKE :search OR v.model ILIKE :search OR v.license_plate ILIKE :search OR v.vin_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query?.status) {
      qb.andWhere('v.status = :status', { status: query.status });
    }

    if (query?.vendor_id) {
      qb.andWhere('v.vendor_id = :vendorId', { vendorId: query.vendor_id });
    }

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Vehicles retrieved successfully',
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
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
      relations: { vendor: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return {
      success: true,
      message: 'Vehicle retrieved successfully',
      data: vehicle,
    };
  }

  async findDetailById(id: string) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
      relations: { vendor: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const rentalCount = 0;

    return {
      success: true,
      message: 'Vehicle detail retrieved successfully',
      data: {
        ...vehicle,
        rental_count: rentalCount,
      },
    };
  }

  async getSummary() {
    const totalVehicles = await this.vehiclesRepository.count();

    const statusCounts = await this.vehiclesRepository
      .createQueryBuilder('v')
      .select('v.status', 'status')
      .addSelect('COUNT(v.id)', 'count')
      .groupBy('v.status')
      .getRawMany();

    const statusBreakdown: Record<string, number> = {};
    for (const row of statusCounts) {
      statusBreakdown[row.status] = Number(row.count);
    }

    const totalRented = statusBreakdown['Reserved'] || 0;
    const totalAvailable = statusBreakdown['Available'] || 0;
    const totalMaintenance = statusBreakdown['Maintenance'] || 0;
    const totalService = statusBreakdown['Service'] || 0;
    const totalRetrieved = statusBreakdown['retrieved'] || 0;

    return {
      success: true,
      message: 'Vehicle summary retrieved successfully',
      data: {
        total_vehicles: totalVehicles,
        rented: totalRented,
        available: totalAvailable,
        maintenance: totalMaintenance,
        service: totalService,
        retrieved: totalRetrieved,
        status_breakdown: statusBreakdown,
      },
    };
  }

  async findByVehicleId(vehicleId: string): Promise<Vehicle | null> {
    let vehicle = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
      relations: { vendor: true },
    });
    if (!vehicle && /^[0-9a-f-]{36}$/i.test(vehicleId)) {
      vehicle = await this.vehiclesRepository.findOne({
        where: { id: vehicleId },
        relations: { vendor: true },
      });
    }
    return vehicle;
  }

  async fetchVehiclesFromGpsid() {
    const data = await this.gpsidService.fetchVehicles();
    return data;
  }

  async create(data: AddVehicleDto, files?: Express.Multer.File[]) {
    try {
      if (data.vendor_id) {
        await this.validateVendor(data.vendor_id);
      }

      if (files && files.length > 0) {
        data.vehicle_photo = files.map((file) => file.path.replace(/\\/g, '/'));
      }

      const vehicle = this.vehiclesRepository.create(data);
      const result = await this.vehiclesRepository.save(vehicle);

      return {
        success: true,
        message: 'Vehicle created successfully',
        data: result,
      };
    } catch (error) {
      console.error('Failed to create vehicle:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            unlinkSync(file.path);
          } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to create vehicle');
    }
  }

  async update(
    vehicleId: string,
    data: Partial<Vehicle>,
    files?: Express.Multer.File[],
  ) {
    try {
      let existingVehicle = await this.vehiclesRepository.findOne({
        where: { id: vehicleId },
      });

      if (!existingVehicle && /^[0-9a-f-]{36}$/i.test(vehicleId)) {
        existingVehicle = await this.vehiclesRepository.findOne({
          where: { id: vehicleId },
        });
      }

      if (!existingVehicle) {
        throw new NotFoundException('Vehicle not found');
      }

      if (data.vendor_id) {
        await this.validateVendor(data.vendor_id);
      }

      if (files && files.length > 0) {
        if (existingVehicle.vehicle_photo) {
          for (const oldPath of existingVehicle.vehicle_photo) {
            try {
              const fullPath = oldPath.startsWith('/')
                ? oldPath
                : `./${oldPath}`;
              if (existsSync(fullPath)) {
                unlinkSync(fullPath);
              }
            } catch (err) {
              console.error(`Failed to delete old file ${oldPath}:`, err);
            }
          }
        }

        data.vehicle_photo = files.map((file) => file.path.replace(/\\/g, '/'));
      }

      const result = await this.vehiclesRepository.update(
        existingVehicle.id,
        data,
      );

      if (result.affected === 0) {
        throw new NotFoundException('Vehicle not found');
      }

      const vehicle = await this.findByVehicleId(vehicleId);

      return {
        success: true,
        message: 'Vehicle updated successfully',
        data: vehicle,
      };
    } catch (error) {
      console.error('Failed to update vehicle:', error);

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
      throw new InternalServerErrorException('Failed to update vehicle');
    }
  }

  async updateStatus(id: string, is_active: boolean) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.vehiclesRepository.update(id, { is_active });

    const updated = await this.findByVehicleId(id);

    return {
      success: true,
      message: `Vehicle marked as ${is_active ? 'Active' : 'Inactive'} successfully`,
      data: updated,
    };
  }

  async exportData(query: VehicleExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : ['name', 'year', 'licensePlate', 'vendor', 'dailyRate', 'pricingCategory', 'status'];
    const qb = this.vehiclesRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.vendor', 'vendor');

    if (query.search) {
      qb.where(
        '(v.merk ILIKE :search OR v.model ILIKE :search OR v.license_plate ILIKE :search OR v.vin_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.start_date) {
      qb.andWhere('v.created_at >= :start', { start: query.start_date + ' 00:00:00' });
    }

    if (query.end_date) {
      qb.andWhere('v.created_at <= :end', { end: query.end_date + ' 23:59:59.999' });
    }

    const vehicles = await qb.orderBy('v.created_at', 'DESC').getMany();

    const columnMap: Record<string, (v: Vehicle) => string> = {
      name: (v) => `${v.merk} ${v.model}`.trim() || '-',
      year: (v) => v.launching_year ? new Date(v.launching_year).getFullYear().toString() : '-',
      licensePlate: (v) => v.license_plate || '-',
      dailyRate: (v) => `Rp ${Number(v.daily_rate).toLocaleString('id-ID')}`,
      pricingCategory: (v) => v.pricing_category || '-',
      status: (v) => v.status || '-',
      is_active: (v) => (v.is_active ? 'Active' : 'Inactive'),
      color: (v) => v.color || '-',
      vinNumber: (v) => v.vin_number || '-',
      engineNumber: (v) => v.engine_number || '-',
      id: (v) => v.id || '-',
      vendor: (v) => v.vendor?.name || '-',
    };

    const headerLabels: Record<string, string> = {
      name: 'Car Name',
      year: 'Year',
      licensePlate: 'License Plate',
      dailyRate: 'Daily Rate',
      pricingCategory: 'Pricing Category',
      status: 'Status',
      is_active: 'Active Status',
      color: 'Color',
      vinNumber: 'VIN Number',
      engineNumber: 'Engine Number',
      id: 'Vehicle ID',
      vendor: 'Vendor',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = vehicles.map((vehicle) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](vehicle) || '';
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
      filename: `vehicles_export_${Date.now()}.csv`,
    };
  }

  private async generateXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Vehicles');

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
      filename: `vehicles_export_${Date.now()}.xlsx`,
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
        { text: 'Vehicle Export Report', style: 'header' },
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
      filename: `vehicles_export_${Date.now()}.pdf`,
    };
  }

  private async validateVendor(vendorId: string) {
    const vendor = await this.vehiclesRepository.manager.findOne(
      VendorVehicle,
      { where: { id: vendorId } },
    );

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
  }

  async delete(
    vehicleId: string,
  ): Promise<{ success: boolean; message: string }> {
    let existingVehicle = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });

    if (!existingVehicle && /^[0-9a-f-]{36}$/i.test(vehicleId)) {
      existingVehicle = await this.vehiclesRepository.findOne({
        where: { id: vehicleId },
      });
    }

    if (!existingVehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (existingVehicle.vehicle_photo) {
      for (const filePath of existingVehicle.vehicle_photo) {
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

    await this.vehiclesRepository.delete(existingVehicle.id);

    return {
      success: true,
      message: 'Vehicle deleted successfully',
    };
  }
}
