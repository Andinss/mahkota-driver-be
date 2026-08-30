import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserExportDto } from './dto/user-export.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async getSummary() {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository.count({ where: { is_active: true } });

    return {
      success: true,
      message: 'User summary retrieved successfully',
      data: {
        total_users: totalUsers,
        active_users: activeUsers,
      },
    };
  }

  async findAll(query?: UserQueryDto): Promise<{
    success: boolean;
    message: string;
    data: User[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .orderBy('u.created_at', 'DESC');

    if (query?.search) {
      qb.andWhere(
        '(u.username ILIKE :search OR u.fullname ILIKE :search OR u.email ILIKE :search)',
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
      message: 'Users retrieved successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: { role: { permissions: true } },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: { role: { permissions: true } },
    });
  }

  async findBySetPasswordToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { set_password_token: token },
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { reset_password_token: token },
    });
  }

  async update(id: string, data: Partial<User>) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const result = await this.usersRepository.update(id, data);

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    const user = await this.findById(id);

    return {
      success: true,
      message: 'User updated successfully',
      data: user,
    };
  }

  async create(data: Partial<User>) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      data.password = null;
      data.set_password_token = token;
      data.set_password_expires_at = expiresAt;

      const user = this.usersRepository.create(data);
      const result = await this.usersRepository.save(user);

      try {
        await this.sendSetPasswordEmail(result.email, token);
      } catch (emailError) {
        console.error('Failed to send set-password email:', emailError);
      }

      return {
        success: true,
        message: 'User created successfully, please check email to set password',
        data: { ...result, set_password_token: token },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  private async sendSetPasswordEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const setPasswordLink = `${frontendUrl}/auth/set-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Buat Password Akun - Mahkota Drive',
      template: 'set-password',
      context: { setPasswordLink, year: new Date().getFullYear() },
    });
  }

  async delete(
    employid: string,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.usersRepository.delete(employid);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  async exportData(query: UserExportDto) {
    const format = query.format || 'csv';
    const selectedColumns = query.columns
      ? query.columns.split(',')
      : ['username', 'email', 'role', 'is_active'];

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role');

    if (query.search) {
      qb.where(
        '(u.username ILIKE :search OR u.fullname ILIKE :search OR u.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const users = await qb.orderBy('u.created_at', 'DESC').getMany();

    const columnMap: Record<string, (u: User) => string> = {
      username: (u) => u.username || '-',
      email: (u) => u.email || '-',
      role: (u) => u.role?.name || '-',
      is_active: (u) => (u.is_active ? 'Active' : 'Inactive'),
      id: (u) => u.id || '-',
    };

    const headerLabels: Record<string, string> = {
      username: 'Username',
      email: 'Email',
      role: 'Role',
      is_active: 'Status',
      id: 'User ID',
    };

    const activeColumns = selectedColumns.filter((c) => columnMap[c]);

    const rows = users.map((user) => {
      const row: Record<string, string> = {};
      for (const col of activeColumns) {
        row[col] = columnMap[col](user) || '';
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
      filename: `users_export_${Date.now()}.csv`,
    };
  }

  private async generateXlsx(
    rows: Record<string, string>[],
    columns: string[],
    headerLabels: Record<string, string>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

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
      filename: `users_export_${Date.now()}.xlsx`,
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
      columns.map((col) => ({ text: headerLabels[col] || col, style: 'tableHeader' })),
    );

    for (const row of rows) {
      tableBody.push(columns.map((col) => row[col] || ''));
    }

    const docDefinition: any = {
      content: [
        { text: 'User Export Report', style: 'header' },
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
      filename: `users_export_${Date.now()}.pdf`,
    };
  }
}
