import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GpsTracking } from './entities/gps-tracking.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import {
  CreateGpsTrackingDto,
  GpsTrackingQueryDto,
} from './dto/create-gps-tracking.dto';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(GpsTracking)
    private readonly trackingRepository: Repository<GpsTracking>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  async findAll(query?: GpsTrackingQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const qb = this.trackingRepository
      .createQueryBuilder('t')
      .orderBy('t.DatetimeUTC', 'DESC')
      .addOrderBy('t.created_at', 'DESC');

    if (query?.id_imei) {
      qb.andWhere('t.id_imei = :idImei', { idImei: query.id_imei });
    }

    if (query?.search) {
      qb.andWhere(
        '(t.VehicleNumber ILIKE :search OR t.VehicleId ILIKE :search OR t.id_imei ILIKE :search OR t.GpsLocation ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      success: true,
      message: 'GPS tracking data retrieved successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const record = await this.trackingRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('GPS tracking record not found');
    }

    return {
      success: true,
      message: 'GPS tracking record retrieved successfully',
      data: record,
    };
  }

  async create(dto: CreateGpsTrackingDto) {
    const record = this.trackingRepository.create({
      id_imei: dto.id_imei != null ? String(dto.id_imei) : '',
      VehicleId: dto.VehicleId != null ? String(dto.VehicleId) : '',
      VehicleNumber: dto.VehicleNumber != null ? String(dto.VehicleNumber) : '',
      DatetimeUTC: dto.DatetimeUTC != null ? String(dto.DatetimeUTC) : '',
      GpsLocation: dto.GpsLocation != null ? String(dto.GpsLocation) : '',
      Lon: dto.Lon != null ? String(dto.Lon) : '',
      Lat: dto.Lat != null ? String(dto.Lat) : '',
      Speed: dto.Speed != null ? String(dto.Speed) : '',
      Direction: dto.Direction != null ? String(dto.Direction) : '',
      Engine: dto.Engine != null ? String(dto.Engine) : '',
      Odometer: dto.Odometer != null ? String(dto.Odometer) : '',
      Car_Status: dto.Car_Status != null ? String(dto.Car_Status) : '',
      VehicleType: dto.VehicleType != null ? String(dto.VehicleType) : '',
      Alarm: dto.Alarm != null ? String(dto.Alarm) : '',
    });

    const saved = await this.trackingRepository.save(record);

    return {
      success: true,
      message: 'GPS tracking record created successfully',
      data: saved,
    };
  }

  async updateVehicleEngine(vehicleId: string, engine_status: string) {
    if (!['on', 'off'].includes(engine_status)) {
      throw new BadRequestException('Invalid engine status. Must be: on, off');
    }

    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.vehicleRepository.update(vehicleId, {
      engine_status: engine_status as 'on' | 'off',
    });

    await this.trackingRepository.update(
      { VehicleId: vehicleId },
      { Engine: engine_status },
    );

    return {
      success: true,
      message: `Vehicle engine turned ${engine_status === 'on' ? 'ON' : 'OFF'}`,
      data: {
        vehicle_id: vehicleId,
        engine_status,
      },
    };
  }

  async updateVehicleStatus(vehicleId: string, status: string) {
    const allowed = [
      'Available',
      'Maintenance',
      'Service',
      'Reserved',
      'rented',
      'retrieved',
    ];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${allowed.join(', ')}`,
      );
    }

    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.vehicleRepository.update(vehicleId, {
      status,
    });

    return {
      success: true,
      message: `Vehicle status updated to ${status}`,
      data: {
        vehicle_id: vehicleId,
        status,
      },
    };
  }
}
