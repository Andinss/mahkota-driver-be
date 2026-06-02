import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { AddVehicleDto } from './dto/add-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
  ) {}

  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: Vehicle[];
  }> {
    const result = await this.vehiclesRepository.find();
    return {
      success: true,
      message: 'Vehicles retrieved successfully',
      data: result,
    };
  }

  async findByVehicleId(vehicleId: string): Promise<Vehicle | null> {
    let vehicle = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });
    if (!vehicle && /^[0-9a-f-]{36}$/i.test(vehicleId)) {
      vehicle = await this.vehiclesRepository.findOne({
        where: { id: vehicleId },
      });
    }
    return vehicle;
  }
  async create(data: AddVehicleDto, files?: Express.Multer.File[]) {
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');

          if (originalName.includes('vehicle_photo')) {
            data.vehicle_photo = filePath;
          }
        }
      }

      const vehicle = this.vehiclesRepository.create(data);
      const result = await this.vehiclesRepository.save(vehicle);

      return {
        success: true,
        message: 'Vehicle created successfully',
        data: result,
      };
    } catch (error) {
      console.error('Failed to create vehicle:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            unlinkSync(file.path);
          } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to create vehicle');
    }
  }
  async update(
    vehicleId: string,
    data: Partial<Vehicle>,
    files?: Express.Multer.File[],
  ) {
    try {
      let existingVehicle = await this.vehiclesRepository.findOne({
        where: { id: vehicleId },
      });

      if (!existingVehicle && /^[0-9a-f-]{36}$/i.test(vehicleId)) {
        existingVehicle = await this.vehiclesRepository.findOne({
          where: { id: vehicleId },
        });
      }

      if (!existingVehicle) {
        throw new NotFoundException('Vehicle not found');
      }

      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');
          let oldFilePath: string | null | undefined = null;

          if (
            originalName.includes('kontrak') ||
            originalName.includes('contract')
          ) {
            oldFilePath = existingVehicle.vehicle_photo;
            data.vehicle_photo = filePath;
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

      const result = await this.vehiclesRepository.update(
        existingVehicle.id,
        data,
      );

      if (result.affected === 0) {
        throw new NotFoundException('Vehicle not found');
      }

      const vehicle = await this.findByVehicleId(vehicleId);

      return {
        success: true,
        message: 'Vehicle updated successfully',
        data: vehicle,
      };
    } catch (error) {
      console.error('Failed to update vehicle:', error);

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
      throw new InternalServerErrorException('Failed to update vehicle');
    }
  }

  async delete(
    vehicleId: string,
  ): Promise<{ success: boolean; message: string }> {
    let existingVehicle = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });

    if (!existingVehicle && /^[0-9a-f-]{36}$/i.test(vehicleId)) {
      existingVehicle = await this.vehiclesRepository.findOne({
        where: { id: vehicleId },
      });
    }

    if (!existingVehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const fileFields = [existingVehicle.vehicle_photo];

    for (const filePath of fileFields) {
      if (filePath) {
        try {
          const fullPath = filePath.startsWith('/')
            ? filePath
            : `./${filePath}`;
          if (existsSync(fullPath)) {
            unlinkSync(fullPath);
          }
        } catch (err) {
          console.error(`Failed to delete file ${filePath}:`, err);
        }
      }
    }

    await this.vehiclesRepository.delete(existingVehicle.id);

    return {
      success: true,
      message: 'Vehicle deleted successfully',
    };
  }
}
