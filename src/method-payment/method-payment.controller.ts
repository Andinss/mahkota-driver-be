import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { MethodPaymentService } from './method-payment.service';
import { CreateMethodPaymentDto } from './dto/create-method-payment.dto';
import { UpdateMethodPaymentDto } from './dto/update-method-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AuditService } from '../audit/audit.service';
import { extractRequestMeta } from '../audit/audit.utils';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    username?: string;
  };
}

/** Simpan gambar QRIS ke `image/method-payment/<slug-nama>/` (pola vendor-vehicle). */
const qrisImageUpload = {
  storage: diskStorage({
    destination: (
      req: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, destination: string) => void,
    ) => {
      let slug = 'general';
      const bodyName = (req.body as { name?: string } | undefined)?.name;

      if (bodyName) {
        slug =
          String(bodyName)
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') || 'general';
      }

      const folder = `image/method-payment/${slug}/`;

      if (!existsSync(folder)) {
        mkdirSync(folder, { recursive: true });
      }

      callback(null, folder);
    },
    filename: (
      req: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      callback(null, `qris-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => {
    const allowedMimes = /jpg|jpeg|png|webp|svg/;
    const ext = extname(file.originalname).toLowerCase();
    if (allowedMimes.test(ext)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Only image files are allowed! (jpg, jpeg, png, webp, svg)',
        ),
      );
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
};

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('method-payments')
export class MethodPaymentController {
  constructor(
    private readonly methodPaymentService: MethodPaymentService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll(@Query('is_active') is_active?: string) {
    return this.methodPaymentService.findAll(is_active);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.methodPaymentService.findById(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', qrisImageUpload))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateMethodPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.methodPaymentService.create(dto, file);
    const methodPayment = result?.data || result;
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'CREATE_METHOD_PAYMENT',
        target: `method-payment/${methodPayment?.id || ''}`,
        details: `Created method payment ${methodPayment?.code || ''} ${methodPayment?.name || dto.name} (${dto.method})`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', qrisImageUpload))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpdateMethodPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.methodPaymentService.update(id, dto, file);
    const methodPayment = result?.data || result;
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'UPDATE_METHOD_PAYMENT',
        target: `method-payment/${id}`,
        details: `Updated method payment ${methodPayment?.code || id} ${methodPayment?.name || ''}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('is_active') is_active: string | boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    const activeValue =
      typeof is_active === 'boolean'
        ? is_active
        : String(is_active).toLowerCase() === 'true';
    const meta = extractRequestMeta(req);
    const result = await this.methodPaymentService.updateStatus(
      id,
      activeValue,
    );
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'UPDATE_METHOD_PAYMENT',
        target: `method-payment/${id}`,
        details: `Method payment ${id} marked as ${activeValue ? 'Active' : 'Inactive'}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.methodPaymentService.delete(id);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'DELETE_METHOD_PAYMENT',
        target: `method-payment/${id}`,
        details: `Deleted method payment ${id}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }
}
