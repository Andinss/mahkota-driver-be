import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Put,
  Delete,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { Express } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { VendorVehicleService } from './vendor-vehicle.service';
import { CreateVendorVehicleDto } from './dto/create-vendor-vehicle.dto';
import { UpdateVendorVehicleDto } from './dto/update-vendor-vehicle.dto';
import { VendorVehicleQueryDto } from './dto/vendor-vehicle-query.dto';
import { VendorVehicleExportDto } from './dto/vendor-vehicle-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('vendor-vehicles')
export class VendorVehicleController {
  constructor(private readonly vendorVehicleService: VendorVehicleService) {}

  @Get()
  @Permissions('vendor.read')
  findAll(@Query() query: VendorVehicleQueryDto) {
    return this.vendorVehicleService.findAll(query);
  }

  @Get('export')
  @Permissions('vendor.read')
  async export(@Query() query: VendorVehicleExportDto) {
    const result = await this.vendorVehicleService.exportData(query);
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get('summary')
  @Permissions('vendor.read')
  getSummary() {
    return this.vendorVehicleService.getSummary();
  }

  @Get('detail/:id')
  @Permissions('vendor.read')
  findDetail(@Param('id') id: string) {
    return this.vendorVehicleService.findDetailById(id);
  }

  @Get(':id')
  @Permissions('vendor.read')
  findOne(@Param('id') id: string) {
    return this.vendorVehicleService.findById(id);
  }

  @Post('create')
  @Permissions('vendor.create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          let slug = 'unknown-vendor';

          if (req.body && req.body.name) {
            slug = req.body.name.toString().toLowerCase().replace(/\s+/g, '-');
          }

          const folder = `image/vendor-vehicle/${slug}/`;

          if (!existsSync(folder)) {
            mkdirSync(folder, { recursive: true });
          }

          callback(null, folder);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `vendor-logo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /jpg|jpeg|png|webp|svg/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png, webp, svg)',
            ),
            false,
          );
        }
      },
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createVendorVehicleDto: CreateVendorVehicleDto,
  ) {
    return this.vendorVehicleService.create(createVendorVehicleDto, files);
  }

  @Put('update/:id')
  @Permissions('vendor.update')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          let slug = 'unknown-vendor';

          if (req.body && req.body.name) {
            slug = req.body.name.toString().toLowerCase().replace(/\s+/g, '-');
          }

          const folder = `image/vendor-vehicle/${slug}/`;

          if (!existsSync(folder)) {
            mkdirSync(folder, { recursive: true });
          }

          callback(null, folder);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `vendor-logo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /jpg|jpeg|png|webp|svg/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png, webp, svg)',
            ),
            false,
          );
        }
      },
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async update(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() updateVendorVehicleDto: Partial<UpdateVendorVehicleDto>,
    @Param('id') id: string,
  ) {
    return this.vendorVehicleService.update(
      id,
      updateVendorVehicleDto,
      files,
    );
  }

  @Delete('delete/:id')
  @Permissions('vendor.delete')
  delete(@Param('id') id: string) {
    return this.vendorVehicleService.delete(id);
  }
}