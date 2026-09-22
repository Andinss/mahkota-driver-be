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

import { VehiclesService } from './vehicles.service';
import { AddVehicleDto } from './dto/add-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { VehicleExportDto } from './dto/vehicle-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicleService: VehiclesService) {}

  @Get()
  @Permissions('vehicle.read')
  findAll(@Query() query: VehicleQueryDto) {
    return this.vehicleService.findAll(query);
  }

  @Get('export')
  @Permissions('vehicle.read')
  async export(@Query() query: VehicleExportDto) {
    const result = await this.vehicleService.exportData(query);
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get('summary')
  @Permissions('vehicle.read')
  getSummary() {
    return this.vehicleService.getSummary();
  }

  @Get('detail/:id')
  @Permissions('vehicle.read')
  findDetail(@Param('id') id: string) {
    return this.vehicleService.findDetailById(id);
  }

  @Get(':id')
  @Permissions('vehicle.read')
  findOne(@Param('id') id: string) {
    return this.vehicleService.findById(id);
  }

  @Post('create')
  @Permissions('vehicle.create')
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

          const vehicleFolder =
            merk && model ? `${merk}-${model}` : 'unknown-vehicle';
          const folder = `image/vehicles/${vehicleFolder}/`;

          if (!existsSync(folder)) {
            mkdirSync(folder, { recursive: true });
          }

          callback(null, folder);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
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
        files: 10,
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
  @Permissions('vehicle.update')
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

          const vehicleFolder =
            merk && model ? `${merk}-${model}` : 'unknown-vehicle';
          const folder = `image/vehicles/${vehicleFolder}/`;

          if (!existsSync(folder)) {
            mkdirSync(folder, { recursive: true });
          }

          callback(null, folder);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
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
        files: 10,
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

  @Put('status/:id')
  @Permissions('vehicle.update')
  async updateStatus(
    @Param('id') id: string,
    @Body('is_active') is_active: boolean,
  ) {
    return this.vehicleService.updateStatus(id, is_active);
  }

  @Delete('delete/:id')
  @Permissions('vehicle.delete')
  delete(@Param('id') id: string) {
    return this.vehicleService.delete(id);
  }
}
