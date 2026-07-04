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
import { VehicleQueryDto } from './dto/vehicle-query.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
  ) {}

  async findAll(query?: VehicleQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.vehiclesRepository
      .createQueryBuilder('v')
      .orderBy('v.created_at', 'DESC');

    if (query?.search) {
      qb.where(
        '(v.merk ILIKE :search OR v.model ILIKE :search OR v.license_plate ILIKE :search OR v.vin_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query?.status) {
      qb.andWhere('v.status = :status', { status: query.status });
    }

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Vehicles retrieved successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return {
      success: true,
      message: 'Vehicle retrieved successfully',
      data: vehicle,
    };
  }

  async findDetailById(id: string) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const rentalCount = 0;

    return {
      success: true,
      message: 'Vehicle detail retrieved successfully',
      data: {
        ...vehicle,
        rental_count: rentalCount,
      },
    };
  }

  async getSummary() {
    const totalVehicles = await this.vehiclesRepository.count();

    const statusCounts = await this.vehiclesRepository
      .createQueryBuilder('v')
      .select('v.status', 'status')
      .addSelect('COUNT(v.id)', 'count')
      .groupBy('v.status')
      .getRawMany();

    const statusBreakdown: Record<string, number> = {};
    for (const row of statusCounts) {
      statusBreakdown[row.status] = Number(row.count);
    }

    const totalRented = statusBreakdown['Reserved'] || 0;
    const totalAvailable = statusBreakdown['Available'] || 0;
    const totalMaintenance = statusBreakdown['Maintenance'] || 0;
    const totalService = statusBreakdown['Service'] || 0;
    const totalRetrieved = statusBreakdown['retrieved'] || 0;

    return {
      success: true,
      message: 'Vehicle summary retrieved successfully',
      data: {
        total_vehicles: totalVehicles,
        rented: totalRented,
        available: totalAvailable,
        maintenance: totalMaintenance,
        service: totalService,
        retrieved: totalRetrieved,
        status_breakdown: statusBreakdown,
      },
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
        data.vehicle_photo = files.map((file) => file.path.replace(/\\/g, '/'));
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
        if (existingVehicle.vehicle_photo) {
          for (const oldPath of existingVehicle.vehicle_photo) {
            try {
              const fullPath = oldPath.startsWith('/')
                ? oldPath
                : `./${oldPath}`;
              if (existsSync(fullPath)) {
                unlinkSync(fullPath);
              }
            } catch (err) {
              console.error(`Failed to delete old file ${oldPath}:`, err);
            }
          }
        }

        data.vehicle_photo = files.map((file) => file.path.replace(/\\/g, '/'));
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

    if (existingVehicle.vehicle_photo) {
      for (const filePath of existingVehicle.vehicle_photo) {
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
