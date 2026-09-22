import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Patch,
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
import { RentalsService } from './rentals.service';
import { AddRentalDto } from './dto/add-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { RentalQueryDto } from './dto/rental-query.dto';
import { RentalExportDto } from './dto/rental-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalService: RentalsService) {}

  @Get()
  @Permissions('rental.read')
  findAll(@Query() query: RentalQueryDto) {
    return this.rentalService.findAll(query);
  }

  @Get('export')
  @Permissions('rental.read')
  async export(@Query() query: RentalExportDto) {
    const result = await this.rentalService.exportData(query);
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get('summary')
  @Permissions('rental.read')
  getSummary() {
    return this.rentalService.getSummary();
  }

  @Get('driver/:driverId/rental-count')
  @Permissions('rental.read')
  getDriverRentalCount(@Param('driverId') driverId: string) {
    return this.rentalService.getDriverRentalCount(driverId);
  }

  @Get('detail/:id')
  @Permissions('rental.read')
  findDetail(@Param('id') id: string) {
    return this.rentalService.findDetailById(id);
  }

  @Get(':id')
  @Permissions('rental.read')
  findOne(@Param('id') id: string) {
    return this.rentalService.findById(id);
  }

  @Post('create')
  @Permissions('rental.create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          const folder = 'uploads/kontrak/';

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
          callback(null, `contract-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /pdf/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only PDF files are allowed! (pdf)'),
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
    @Body() addRentalDto: AddRentalDto,
  ) {
    return this.rentalService.create(addRentalDto, files);
  }

  @Put('update/:id')
  @Permissions('rental.update')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          const folder = 'uploads/kontrak/';

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
          callback(null, `contract-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = /pdf/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only PDF files are allowed! (pdf)'),
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
    @Body() updateRentalDto: Partial<UpdateRentalDto>,
    @Param('id') id: string,
  ) {
    return this.rentalService.update(id, updateRentalDto, files);
  }

  @Delete('delete/:id')
  @Permissions('rental.delete')
  delete(@Param('id') id: string) {
    return this.rentalService.delete(id);
  }
}
