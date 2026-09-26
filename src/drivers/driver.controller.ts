import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Delete,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AddDriverDto } from './dto/add-driver.dto';
import { DriverService } from './driver.service';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverQueryDto } from './dto/driver-query.dto';
import { DriverExportDto } from './dto/driver-export.dto';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { Express } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { resolveDriverFileFolder } from './utils/driver-file.util';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get('me')
  @Permissions('driver.read.all')
  findMe(@Req() req: any) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return { success: true, message: 'No driver profile linked', data: null };
    }
    return this.driverService.findById(driverId);
  }

  @Get()
  @Permissions('driver.read.all')
  findAll(@Query() query: DriverQueryDto) {
    return this.driverService.findAll(query);
  }

  @Get('summary')
  @Permissions('driver.read.all')
  getSummary() {
    return this.driverService.getSummary();
  }

  @Get('export')
  @Permissions('driver.read.all')
  async export(@Query() query: DriverExportDto) {
    const result = await this.driverService.exportData(query);
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get('detail/:id')
  @Permissions('driver.read.all')
  findDetail(@Param('id') id: string) {
    return this.driverService.findDetailById(id);
  }

  @Get(':id')
  @Permissions('driver.read.all')
  findOne(@Param('id') id: string) {
    return this.driverService.findById(id);
  }

  @Post('create')
  @Permissions('driver.create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          const folder = resolveDriverFileFolder(file.originalname);

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
        files: 6,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() addDriverDto: AddDriverDto,
    @Req() req: any,
  ) {
    return this.driverService.create(addDriverDto, req.user.id, files);
  }

  @Put('update/:employeeId')
  @Permissions('driver.update.all')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          const folder = resolveDriverFileFolder(file.originalname);

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
        files: 6,
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

  @Put('status/:employeeId')
  @Permissions('driver.update.all')
  async updateStatus(
    @Param('employeeId') employeeId: string,
    @Body('is_active') is_active: boolean,
  ) {
    return this.driverService.updateStatus(employeeId, is_active);
  }

  @Delete('delete/:employeeId')
  @Permissions('driver.delete.all')
  delete(@Req() req: any) {
    const employeeId = req.params.employeeId;
    return this.driverService.delete(employeeId);
  }
}
