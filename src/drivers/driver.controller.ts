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
} from '@nestjs/common';
import { AddDriverDto } from './dto/add-driver.dto';
import { DriverService } from './driver.service';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { Express } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}
  @Get()
  findAll() {
    return this.driverService.findAll();
  }

  @Post('create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Tentukan direktori berdasarkan nama file
          let folder = 'image/';

          // Perbaiki: cek file.originalname
          if (file.originalname.toLowerCase().includes('ktp')) {
            folder = 'image/ktp';
          } else if (file.originalname.toLowerCase().includes('sim')) {
            folder = 'image/sim';
          } else if (
            file.originalname.toLowerCase().includes('foto') ||
            file.originalname.toLowerCase().includes('profil')
          ) {
            folder = 'image/photo-driver';
          } else if (file.originalname.toLowerCase().includes('rumah')) {
            folder = 'image/garage-photo';
          } else {
            folder = 'image/npwp';
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
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Tentukan direktori berdasarkan nama file
          let folder = 'image/';

          if (file.originalname.toLowerCase().includes('ktp')) {
            folder = 'image/ktp';
          } else if (file.originalname.toLowerCase().includes('sim')) {
            folder = 'image/sim';
          } else if (
            file.originalname.toLowerCase().includes('foto') ||
            file.originalname.toLowerCase().includes('profil')
          ) {
            folder = 'image/photo-driver';
          } else if (file.originalname.toLowerCase().includes('rumah')) {
            folder = 'image/garage-photo';
          } else {
            folder = 'image/npwp';
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
  delete(@Req() req: any) {
    const employeeId = req.params.employeeId;
    return this.driverService.delete(employeeId);
  }
}
