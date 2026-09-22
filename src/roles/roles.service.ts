import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsToRoleDto } from './dto/add-permissions-to-role.dto';
import { RoleExportDto } from './dto/role-export.dto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
  ) {}

  async findAll() {
    const roles = await this.rolesRepository.find({
      relations: { permissions: true },
    });
    return {
      success: true,
      message: 'Roles retrieved successfully',
      data: roles,
    };
  }

  async findById(id: string) {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    return { success: true, message: 'Role retrieved successfully', data: role };
  }

  async create(dto: CreateRoleDto) {
    try {
      const role = this.rolesRepository.create(dto);
      const saved = await this.rolesRepository.save(role);
      return {
        success: true,
        message: 'Role created successfully',
        data: saved,
      };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new BadRequestException('Role name or code already exists');
      }
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    Object.assign(role, dto);
    try {
      const saved = await this.rolesRepository.save(role);
      return {
        success: true,
        message: 'Role updated successfully',
        data: saved,
      };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new BadRequestException('Role name or code already exists');
      }
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  async delete(id: string) {
    const result = await this.rolesRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Role not found');
    return { success: true, message: 'Role deleted successfully' };
  }

  async assignPermissions(roleId: string, dto: AddPermissionsToRoleDto) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    const permissions = await this.permissionsRepository.find({
      where: { id: In(dto.permissionIds) },
    });

    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('Some permissions not found');
    }

    const existingIds = new Set(role.permissions.map((p) => p.id));
    const newIds = dto.permissionIds.filter((id) => !existingIds.has(id));
    if (newIds.length > 0) {
      const newPerms = permissions.filter((p) => newIds.includes(p.id));
      role.permissions = [...role.permissions, ...newPerms];
      await this.rolesRepository.save(role);
    }

    const saved = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });

    return {
      success: true,
      message: 'Permissions added successfully',
      data: saved,
    };
  }

  async removePermissions(roleId: string, dto: AddPermissionsToRoleDto) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    role.permissions = role.permissions.filter(
      (p) => !dto.permissionIds.includes(p.id),
    );
    const saved = await this.rolesRepository.save(role);

    return {
      success: true,
      message: 'Permissions removed successfully',
      data: saved,
    };
  }

  async getPermissions(roleId: string) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    return {
      success: true,
      message: 'Permissions retrieved successfully',
      data: role.permissions,
    };
  }

  async exportData(query: RoleExportDto) {
    const format = query.format || 'csv';
    const moduleKeys = [
      'driver',
      'vehicle',
      'monitoring',
      'vendor',
      'rental',
      'finance',
      'late_payment',
      'koin',
      'user',
      'role',
      'permission',
      'setting',
      'audit',
    ];
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : ['name', ...moduleKeys];

    const qb = this.rolesRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.permissions', 'permissions');

    if (query.search) {
      qb.where('(r.name ILIKE :search OR r.code ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const roles = await qb.orderBy('r.created_at', 'DESC').getMany();

    const moduleLabels: Record<string, string> = {
      driver: 'Drivers',
      vehicle: 'Vehicles',
      monitoring: 'Monitoring',
      vendor: 'Vendor Vehicles',
      rental: 'Rentals',
      finance: 'Finance',
      late_payment: 'Late Payment',
      koin: 'Driver Koin',
      user: 'Users',
      role: 'Roles',
      permission: 'Permissions',
      setting: 'Settings',
      audit: 'Audit Logs',
    };

    const getModuleActions = (r: Role, mod: string): string => {
      const perms = r.permissions || [];
      const actions = perms
        .filter(
          (p) =>
            p.module === mod ||
            p.name === mod ||
            p.name.startsWith(`${mod}.`),
        )
        .map((p) => {
          const parts = p.name.split('.');
          return parts.length > 1 ? parts.slice(1).join('.') : p.name;
        });
      return actions.length > 0 ? actions.join(', ') : '-';
    };

    const columnMap: Record<string, (r: Role) => string> = {
      name: (r) => r.name || '-',
      code: (r) => r.code || '-',
      description: (r) => r.description || '-',
      is_active: (r) => (r.is_active ? 'Active' : 'Inactive'),
      id: (r) => r.id || '-',
      created_at: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-',
    };
    for (const mod of moduleKeys) {
      columnMap[mod] = (r) => getModuleActions(r, mod);
    }

    const headerLabels: Record<string, string> = {
      name: 'Role Name',
      code: 'Code',
      description: 'Description',
      is_active: 'Status',
      id: 'Role ID',
      created_at: 'Created At',
      ...moduleLabels,
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);
    const rows = roles.map((role) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](role) || '';
      }
      return row;
    });

    if (format === 'csv') {
      const header = activeColumns.map((col) => ({ id: col, title: headerLabels[col] || col }));
      const csvStringifier = createObjectCsvStringifier({ header });
      const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);
      return { buffer: Buffer.from(csv, 'utf-8'), contentType: 'text/csv', filename: `roles_export_${Date.now()}.csv` };
    } else if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Roles');
      worksheet.columns = activeColumns.map((col) => ({ header: headerLabels[col] || col, key: col, width: 25 }));
      for (const row of rows) worksheet.addRow(row);
      worksheet.getRow(1).font = { bold: true };
      const writeResult = await workbook.xlsx.writeBuffer();
      return { buffer: Buffer.from(writeResult as ArrayBuffer), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `roles_export_${Date.now()}.xlsx` };
    } else {
      const PdfPrinter = require('pdfmake');
      const roboto = require('pdfmake/fonts/Roboto');
      PdfPrinter.addFonts(roboto);
      const tableBody: any[][] = [];
      tableBody.push(activeColumns.map((col) => ({ text: headerLabels[col] || col, style: 'tableHeader' })));
      for (const row of rows) tableBody.push(activeColumns.map((col) => row[col] || ''));
      const docDefinition: any = {
        content: [{ text: 'Role Export Report', style: 'header' }, { table: { headerRows: 1, widths: activeColumns.map(() => '*'), body: tableBody }, layout: 'headerLineOnly' }],
        styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 10] }, tableHeader: { bold: true, fontSize: 10, fillColor: '#e2e8f0' }, defaultStyle: { fontSize: 9 } },
        pageOrientation: 'landscape',
      };
      const pdfDoc = PdfPrinter.createPdf(docDefinition);
      const buffer = await pdfDoc.getBuffer();
      return { buffer, contentType: 'application/pdf', filename: `roles_export_${Date.now()}.pdf` };
    }
  }
}
