import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Express } from 'express';
import { existsSync, unlinkSync } from 'fs';
import { Driver } from '../drivers/entities/driver.entity';
import { AddDriverDto } from '../drivers/dto/add-driver.dto';

const MAX_DRIVERS = 10;

@Injectable()
export class SupervisorService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
  ) {}

  async findAll(userId: string) {
    const drivers = await this.driversRepository.find({
      where: { created_by_id: userId },
    });
    return {
      success: true,
      message: 'Drivers retrieved successfully',
      data: drivers,
    };
  }

  async findOne(driverId: string, userId: string) {
    const driver = await this.findOwnedDriver(driverId, userId);
    return {
      success: true,
      message: 'Driver retrieved successfully',
      data: driver,
    };
  }

  async create(data: AddDriverDto, userId: string, files?: Express.Multer.File[]) {
    const count = await this.driversRepository.count({
      where: { created_by_id: userId },
    });
    if (count >= MAX_DRIVERS) {
      throw new ForbiddenException(`Maximum ${MAX_DRIVERS} drivers allowed`);
    }

    try {
      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');
          if (originalName.includes('ktp')) data.national_id_card = filePath;
          else if (originalName.includes('sim')) data.sim_card = filePath;
          else if (originalName.includes('foto') || originalName.includes('profil')) data.profile_photo = filePath;
          else if (originalName.includes('rumah')) data.garage_photo = filePath;
          else data.npwp_photo = filePath;
        }
      }

      const driver = this.driversRepository.create({
        ...data,
        created_by_id: userId,
      } as unknown as Driver);
      const result = await this.driversRepository.save(driver);

      return {
        success: true,
        message: 'Driver created successfully',
        data: result,
      };
    } catch (error) {
      console.error('Failed to create driver:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try { unlinkSync(file.path); } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to create driver');
    }
  }

  async update(driverId: string, data: Partial<Driver>, userId: string, files?: Express.Multer.File[]) {
    const existingDriver = await this.findOwnedDriver(driverId, userId);

    try {
      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');
          let oldFilePath: string | null | undefined = null;

          if (originalName.includes('ktp')) { oldFilePath = existingDriver.national_id_card; data.national_id_card = filePath; }
          else if (originalName.includes('sim')) { oldFilePath = existingDriver.sim_card; data.sim_card = filePath; }
          else if (originalName.includes('foto') || originalName.includes('profil')) { oldFilePath = existingDriver.profile_photo; data.profile_photo = filePath; }
          else if (originalName.includes('rumah')) { oldFilePath = existingDriver.garage_photo; data.garage_photo = filePath; }
          else { oldFilePath = existingDriver.npwp_photo; data.npwp_photo = filePath; }

          if (oldFilePath && oldFilePath !== filePath) {
            try {
              const fullPath = oldFilePath.startsWith('/') ? oldFilePath : `./${oldFilePath}`;
              if (existsSync(fullPath)) unlinkSync(fullPath);
            } catch (err) {
              console.error(`Failed to delete old file ${oldFilePath}:`, err);
            }
          }
        }
      }

      const { created_by_id, ...safeData } = data as any;
      await this.driversRepository.update(existingDriver.id, safeData);
      const driver = await this.driversRepository.findOne({ where: { id: existingDriver.id } });

      return {
        success: true,
        message: 'Driver updated successfully',
        data: driver,
      };
    } catch (error) {
      console.error('Failed to update driver:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try { if (existsSync(file.path)) unlinkSync(file.path); } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to update driver');
    }
  }

  async delete(driverId: string, userId: string) {
    const existingDriver = await this.findOwnedDriver(driverId, userId);

    const fileFields = [
      existingDriver.profile_photo, existingDriver.national_id_card,
      existingDriver.sim_card, existingDriver.garage_photo, existingDriver.npwp_photo,
    ];
    for (const filePath of fileFields) {
      if (filePath) {
        try {
          const fullPath = filePath.startsWith('/') ? filePath : `./${filePath}`;
          if (existsSync(fullPath)) unlinkSync(fullPath);
        } catch (err) {
          console.error(`Failed to delete file ${filePath}:`, err);
        }
      }
    }

    await this.driversRepository.delete(existingDriver.id);
    return { success: true, message: 'Driver deleted successfully' };
  }

  async getCount(userId: string) {
    const count = await this.driversRepository.count({
      where: { created_by_id: userId },
    });
    return {
      success: true,
      message: 'Driver count retrieved successfully',
      data: { count, max: MAX_DRIVERS, remaining: MAX_DRIVERS - count },
    };
  }

  private async findOwnedDriver(driverId: string, userId: string): Promise<Driver> {
    const driver = await this.driversRepository.findOne({
      where: { id: driverId, created_by_id: userId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }
}
