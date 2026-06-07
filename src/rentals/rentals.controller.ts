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
import { RentalsService } from './rentals.service';
import { AddRentalDto } from './dto/add-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalService: RentalsService) {}

  @Get()
  findAll() {
    return this.rentalService.findAll();
  }

  @Post('create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Folder untuk kontrak
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
        files: 1, // max 1 file (document contract)
        fileSize: 10 * 1024 * 1024, // 10MB per file
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
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Folder untuk kontrak
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
  delete(@Param('id') id: string) {
    return this.rentalService.delete(id);
  }
}
