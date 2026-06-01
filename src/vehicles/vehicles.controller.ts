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
  Param,
} from '@nestjs/common';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { Express } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { VehiclesService } from './vehicles.service';
import { AddVehicleDto } from './dto/add-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicleService: VehiclesService) {}

  @Get()
  findAll() {
    return this.vehicleService.findAll();
  }

  @Post('create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          let merk = '';
          let model = '';

          if (req.body && req.body.merk) {
            merk = req.body.merk.toString().toLowerCase().replace(/\s+/g, '-');
          }
          if (req.body && req.body.model) {
            model = req.body.model
              .toString()
              .toLowerCase()
              .replace(/\s+/g, '-');
          }

          // Buat nama folder: merk-model
          const vehicleFolder =
            merk && model ? `${merk}-${model}` : 'unknown-vehicle';

          // Folder utama: uploads/vehicles/merk-model/
          const folder = `uploads/vehicles/${vehicleFolder}/`;

          if (!existsSync(folder)) {
            mkdirSync(folder, { recursive: true });
          }

          callback(null, folder);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          // Ubah nama file menjadi vehicle-photo-uniqueid.ext
          callback(null, `vehicle-photo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /jpg|jpeg|png/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png)',
            ),
            false,
          );
        }
      },
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() addVehicleDto: AddVehicleDto,
  ) {
    return this.vehicleService.create(addVehicleDto, files);
  }

  @Put('update/:id')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Folder untuk kontrak
          const folder = 'uploads/vehicles/';

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
          callback(null, `vehicle  -${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /jpg|jpeg|png/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png)',
            ),
            false,
          );
        }
      },
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async update(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() updateVehicleDto: Partial<UpdateVehicleDto>,
    @Param('id') id: string,
  ) {
    return this.vehicleService.update(id, updateVehicleDto, files);
  }

  @Delete('delete/:id')
  delete(@Param('id') id: string) {
    return this.vehicleService.delete(id);
  }
}
