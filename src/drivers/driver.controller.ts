import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Delete,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { AddDriverDto } from './dto/add-driver.dto';
import { DriverService } from './driver.service';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { Express } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}
  @Get()
  @Permissions('driver.read')
  findAll() {
    return this.driverService.findAll();
  }

  @Post('create')
  @Permissions('driver.create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Tentukan direktori berdasarkan nama file
          let folder = 'image/driver';

          // Perbaiki: cek file.originalname
          if (file.originalname.toLowerCase().includes('ktp')) {
            folder = 'image/driver/ktp';
          } else if (file.originalname.toLowerCase().includes('sim')) {
            folder = 'image/driver/sim';
          } else if (
            file.originalname.toLowerCase().includes('foto') ||
            file.originalname.toLowerCase().includes('profil')
          ) {
            folder = 'image/driver/photo-driver';
          } else if (file.originalname.toLowerCase().includes('rumah')) {
            folder = 'image/driver/garage-photo';
          } else {
            folder = 'image/driver/npwp';
          }

          if (!existsSync(folder)) {
            mkdirSync(folder, { recursive: true });
          }

          callback(null, folder);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const nameWithoutExt = file.originalname.slice(0, -ext.length);
          callback(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /jpg|jpeg|png|gif/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png, gif)',
            ),
            false,
          );
        }
      },
      limits: {
        files: 5, // max 5 files total
        fileSize: 5 * 1024 * 1024, // 5MB per file
      },
    }),
  )
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() addDriverDto: AddDriverDto,
  ) {
    return this.driverService.create(addDriverDto, files);
  }

  @Put('update/:employeeId')
  @Permissions('driver.update')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Tentukan direktori berdasarkan nama file
          let folder = 'image/driver';

          if (file.originalname.toLowerCase().includes('ktp')) {
            folder = 'image/driver  /ktp';
          } else if (file.originalname.toLowerCase().includes('sim')) {
            folder = 'image/driver/sim';
          } else if (
            file.originalname.toLowerCase().includes('foto') ||
            file.originalname.toLowerCase().includes('profil')
          ) {
            folder = 'image/driver/photo-driver';
          } else if (file.originalname.toLowerCase().includes('rumah')) {
            folder = 'image/driver/garage-photo';
          } else {
            folder = 'image/driver/npwp';
          }

          if (!existsSync(folder)) {
            mkdirSync(folder, { recursive: true });
          }

          callback(null, folder);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const nameWithoutExt = file.originalname.slice(0, -ext.length);
          callback(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /jpg|jpeg|png|gif/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png, gif)',
            ),
            false,
          );
        }
      },
      limits: {
        files: 5,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async update(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() updateDriverDto: Partial<UpdateDriverDto>,
    @Req() req: any,
  ) {
    const employeeId = req.params.employeeId;
    return this.driverService.update(employeeId, updateDriverDto, files);
  }
  @Delete('delete/:employeeId')
  @Permissions('driver.delete')
  delete(@Req() req: any) {
    const employeeId = req.params.employeeId;
    return this.driverService.delete(employeeId);
  }
}
