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
  Param,
  Query,
} from '@nestjs/common';
import { AddDriverDto } from '../drivers/dto/add-driver.dto';
import { UpdateDriverDto } from '../drivers/dto/update-driver.dto';
import { SupervisorService } from './supervisor.service';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { Express } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('supervisor/drivers')
export class SupervisorController {
  constructor(private readonly supervisorService: SupervisorService) {}

  @Get()
  @Permissions('driver.read.own')
  findAll(@Req() req: any, @Query('is_active') is_active?: string) {
    return this.supervisorService.findAll(req.user.id, is_active);
  }

  @Get('count')
  @Permissions('driver.read.own')
  getCount(@Req() req: any) {
    return this.supervisorService.getCount(req.user.id);
  }

  @Get(':id')
  @Permissions('driver.read.own')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.supervisorService.findOne(id, req.user.id);
  }

  @Post('create')
  @Permissions('driver.create')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          let folder = 'image/driver';
          if (file.originalname.toLowerCase().includes('ktp'))
            folder = 'image/driver/ktp';
          else if (file.originalname.toLowerCase().includes('sim'))
            folder = 'image/driver/sim';
          else if (
            file.originalname.toLowerCase().includes('foto') ||
            file.originalname.toLowerCase().includes('profil')
          )
            folder = 'image/driver/photo-driver';
          else if (file.originalname.toLowerCase().includes('rumah'))
            folder = 'image/driver/garage-photo';
          else folder = 'image/driver/npwp';
          if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
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
        if (allowedMimes.test(ext)) callback(null, true);
        else
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png, gif)',
            ),
            false,
          );
      },
      limits: { files: 5, fileSize: 5 * 1024 * 1024 },
    }),
  )
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() addDriverDto: AddDriverDto,
    @Req() req: any,
  ) {
    return this.supervisorService.create(addDriverDto, req.user.id, files);
  }

  @Put('update/:id')
  @Permissions('driver.update.own')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, callback) => {
          let folder = 'image/driver';
          if (file.originalname.toLowerCase().includes('ktp'))
            folder = 'image/driver/ktp';
          else if (file.originalname.toLowerCase().includes('sim'))
            folder = 'image/driver/sim';
          else if (
            file.originalname.toLowerCase().includes('foto') ||
            file.originalname.toLowerCase().includes('profil')
          )
            folder = 'image/driver/photo-driver';
          else if (file.originalname.toLowerCase().includes('rumah'))
            folder = 'image/driver/garage-photo';
          else folder = 'image/driver/npwp';
          if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
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
        if (allowedMimes.test(ext)) callback(null, true);
        else
          callback(
            new BadRequestException(
              'Only image files are allowed! (jpg, jpeg, png, gif)',
            ),
            false,
          );
      },
      limits: { files: 5, fileSize: 5 * 1024 * 1024 },
    }),
  )
  async update(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() updateDriverDto: Partial<UpdateDriverDto>,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.supervisorService.update(
      id,
      updateDriverDto,
      req.user.id,
      files,
    );
  }

  @Delete('delete/:id')
  @Permissions('driver.delete.own')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.supervisorService.delete(id, req.user.id);
  }
}
