import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditExportDto } from './dto/audit-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async findAll(query: QueryAuditDto) {
    const { search, action, status, page = 1, limit = 10 } = query;
    const where: any = {};

    if (search) {
      where.username = Like(`%${search}%`);
    }
    if (action) {
      where.action = action;
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await this.auditRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      success: true,
      message: 'Audit logs retrieved successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const log = await this.auditRepository.findOne({ where: { id } });
    return { success: true, message: 'Audit log retrieved successfully', data: log };
  }

  async getStats() {
    const total = await this.auditRepository.count();
    const securityAlerts = await this.auditRepository.count({ where: { action: Like('security%') } });
    const userActions = await this.auditRepository.count({ where: { status: 'success' } });
    const failedRequests = await this.auditRepository.count({ where: { status: 'failed' } });

    return {
      success: true,
      message: 'Audit stats retrieved successfully',
      data: { totalEvents: total, securityAlerts, userActions, failedRequests },
    };
  }

  async exportData(query: AuditExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : ['timestamp', 'user', 'action', 'target', 'device', 'status'];

    const qb = this.auditRepository.createQueryBuilder('a');

    if (query.search) {
      qb.where('(a.username ILIKE :search OR a.action ILIKE :search OR a.target ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.start_date) {
      qb.andWhere('a.created_at >= :start', { start: query.start_date });
    }

    if (query.end_date) {
      qb.andWhere('a.created_at <= :end', { end: query.end_date });
    }

    const logs = await qb.orderBy('a.created_at', 'DESC').getMany();

    const columnMap: Record<string, (l: AuditLog) => string> = {
      timestamp: (l) => l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : '-',
      user: (l) => l.username || '-',
      action: (l) => l.action || '-',
      target: (l) => l.target || '-',
      device: (l) => l.user_agent || '-',
      status: (l) => l.status || '-',
      details: (l) => l.details || '-',
      ipAddress: (l) => l.ip_address || '-',
      id: (l) => l.id || '-',
    };

    const headerLabels: Record<string, string> = {
      timestamp: 'Timestamp',
      user: 'User',
      action: 'Action',
      target: 'Target',
      device: 'Device',
      status: 'Status',
      details: 'Details',
      ipAddress: 'IP Address',
      id: 'Log ID',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = logs.map((log) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](log) || '';
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
      filename: `audit_logs_export_${Date.now()}.csv`,
    };
  }

  private async generateXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('AuditLogs');

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
      filename: `audit_logs_export_${Date.now()}.xlsx`,
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
        { text: 'Audit Log Export Report', style: 'header' },
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
      filename: `audit_logs_export_${Date.now()}.pdf`,
    };
  }

  async create(data: Partial<AuditLog>) {
    const log = this.auditRepository.create(data);
    const saved = await this.auditRepository.save(log);
    return saved;
  }
}
