import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Express } from 'express';
import { Driver } from './entities/driver.entity';
import { AddDriverDto } from './dto/add-driver.dto';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
  ) {}
  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: Driver[];
  }> {
    const result = await this.driversRepository.find();
    return {
      success: true,
      message: 'Drivers retrieved successfully',
      data: result,
    };
  }

  async findByEmployeeId(employeeId: string): Promise<Driver | null> {
    let driver = await this.driversRepository.findOne({ where: { employee_id: employeeId } });
    if (!driver && /^[0-9a-f-]{36}$/i.test(employeeId)) {
      driver = await this.driversRepository.findOne({ where: { id: employeeId } });
    }
    return driver;
  }
  async create(data: AddDriverDto, files?: Express.Multer.File[]) {
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');

          if (originalName.includes('ktp')) {
            data.national_id_card = filePath;
          } else if (originalName.includes('sim')) {
            data.sim_card = filePath;
          } else if (
            originalName.includes('foto') ||
            originalName.includes('profil')
          ) {
            data.profile_photo = filePath;
          } else if (originalName.includes('rumah')) {
            data.garage_photo = filePath;
          } else {
            data.npwp_photo = filePath;
          }
        }
      }

      const driver = this.driversRepository.create(data);
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
          try {
            unlinkSync(file.path);
          } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to create driver');
    }
  }
  async update(
    employeeId: string,
    data: Partial<Driver>,
    files?: Express.Multer.File[],
  ) {
    try {
      // 1. Ambil data driver lama (by employee_id atau fallback id UUID)
      let existingDriver = await this.driversRepository.findOne({
        where: { employee_id: employeeId },
      });

      if (!existingDriver && /^[0-9a-f-]{36}$/i.test(employeeId)) {
        existingDriver = await this.driversRepository.findOne({
          where: { id: employeeId },
        });
      }

      if (!existingDriver) {
        throw new NotFoundException('Driver not found');
      }

      // 2. Jika ada file baru, proses upload dan hapus file lama
      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');
          let oldFilePath: string | null | undefined = null;

          // Tentukan field name dan old file path berdasarkan tipe file
          if (originalName.includes('ktp')) {
            oldFilePath = existingDriver.national_id_card;
            data.national_id_card = filePath;
          } else if (originalName.includes('sim')) {
            oldFilePath = existingDriver.sim_card;
            data.sim_card = filePath;
          } else if (
            originalName.includes('foto') ||
            originalName.includes('profil')
          ) {
            oldFilePath = existingDriver.profile_photo;
            data.profile_photo = filePath;
          } else if (originalName.includes('rumah')) {
            oldFilePath = existingDriver.garage_photo;
            data.garage_photo = filePath;
          } else {
            oldFilePath = existingDriver.npwp_photo;
            data.npwp_photo = filePath;
          }

          // Hapus file lama jika ada
          if (oldFilePath && oldFilePath !== filePath) {
            try {
              const fullPath = oldFilePath.startsWith('/')
                ? oldFilePath
                : `./${oldFilePath}`;
              if (existsSync(fullPath)) {
                unlinkSync(fullPath);
              }
            } catch (err) {
              console.error(`Failed to delete old file ${oldFilePath}:`, err);
            }
          }
        }
      }

      const result = await this.driversRepository.update(existingDriver.id, data);

      if (result.affected === 0) {
        throw new NotFoundException('Driver not found');
      }

      const driver = await this.findByEmployeeId(employeeId);

      return {
        success: true,
        message: 'Driver updated successfully',
        data: driver,
      };
    } catch (error) {
      console.error('Failed to update driver:', error);

      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (existsSync(file.path)) {
              unlinkSync(file.path);
            }
          } catch (err) {
            console.error('Failed to delete uploaded file:', err);
          }
        }
      }

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update driver');
    }
  }
  async delete(employeeId: string): Promise<{ success: boolean; message: string }> {
    let existingDriver = await this.driversRepository.findOne({
      where: { employee_id: employeeId },
    });

    if (!existingDriver && /^[0-9a-f-]{36}$/i.test(employeeId)) {
      existingDriver = await this.driversRepository.findOne({
        where: { id: employeeId },
      });
    }

    if (!existingDriver) {
      throw new NotFoundException('Driver not found');
    }

    // Hapus file-file terkait
    const fileFields = [
      existingDriver.profile_photo,
      existingDriver.national_id_card,
      existingDriver.sim_card,
      existingDriver.garage_photo,
      existingDriver.npwp_photo,
    ];

    for (const filePath of fileFields) {
      if (filePath) {
        try {
          const fullPath = filePath.startsWith('/') ? filePath : `./${filePath}`;
          if (existsSync(fullPath)) {
            unlinkSync(fullPath);
          }
        } catch (err) {
          console.error(`Failed to delete file ${filePath}:`, err);
        }
      }
    }

    await this.driversRepository.delete(existingDriver.id);

    return {
      success: true,
      message: 'Driver deleted successfully',
    };
  }
}
