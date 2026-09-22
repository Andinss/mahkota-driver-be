import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GpsLocation } from './entities/gps-location.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Geofence } from './entities/geofence.entity';
import { Notification } from './entities/notification.entity';
import { UpdateGpsDto } from './dto/update-gps.dto';
import { GpsQueryDto } from './dto/gps-query.dto';

export interface TaskItem {
  id: string;
  priority: 'High' | 'Normal';
  vehicle_name: string;
  plate: string;
  location: string;
  time_window: string;
  status: 'Pending' | 'Scheduled' | 'In Progress' | 'Completed';
}

export interface TaskDetail {
  id: string;
  vehicle: {
    name: string;
    year: string;
    plateNumber: string;
    imageUrl: string;
    odometerOut: number;
    fuelLevel: number;
  };
  location: {
    address: string;
    mapUrl: string;
    reportedIssue: string;
  };
  customer: {
    name: string;
    initials: string;
    contractNumber: string;
    phoneNumber: string;
  };
}

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(GpsLocation)
    private readonly gpsRepository: Repository<GpsLocation>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Geofence)
    private readonly geofenceRepository: Repository<Geofence>,
    @InjectRepository(Notification)
    private readonly notifRepository: Repository<Notification>,
  ) {}

  async getTasks() {
    const vehicles = await this.vehicleRepository.find({
      order: { created_at: 'DESC' },
    });

    const tasks: TaskItem[] = await Promise.all(
      vehicles.map(async (v) => {
        const latestGps = await this.gpsRepository.findOne({
          where: { vehicle_id: v.id },
          order: { recorded_at: 'DESC' },
        });

        return {
          id: v.id,
          priority: latestGps?.status === 'emergency' ? 'High' : 'Normal',
          vehicle_name: `${v.merk} ${v.model}`,
          plate: v.license_plate,
          location: latestGps
            ? `${Number(latestGps.latitude).toFixed(4)}, ${Number(latestGps.longitude).toFixed(4)}`
            : 'No GPS data',
          time_window: latestGps
            ? new Date(latestGps.recorded_at).toLocaleString('id-ID')
            : 'N/A',
          status: latestGps
            ? latestGps.status === 'emergency' ? 'Pending'
              : latestGps.status === 'moving' ? 'In Progress'
              : 'Scheduled'
            : 'Scheduled',
        };
      }),
    );

    return {
      success: true,
      message: 'Tasks retrieved successfully',
      data: tasks,
    };
  }

  async getTaskById(id: string) {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Task not found');

    const location = await this.gpsRepository.findOne({
      where: { vehicle_id: id },
      order: { recorded_at: 'DESC' },
    });

    const task: TaskDetail = {
      id: vehicle.id,
      vehicle: {
        name: `${vehicle.merk} ${vehicle.model}`,
        year: vehicle.launching_year?.getFullYear().toString() || '',
        plateNumber: vehicle.license_plate,
        imageUrl: '',
        odometerOut: 0,
        fuelLevel: location?.fuel_level ?? 0,
      },
      location: {
        address: location
          ? `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}`
          : 'Unknown',
        mapUrl: '',
        reportedIssue: 'Vehicle requires retrieval',
      },
      customer: {
        name: 'Unknown',
        initials: '--',
        contractNumber: '',
        phoneNumber: '',
      },
    };

    return {
      success: true,
      message: 'Task retrieved successfully',
      data: task,
    };
  }

  async getFleetLocations(query?: GpsQueryDto) {
    const qb = this.gpsRepository
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.vehicle', 'vehicle')
      .orderBy('g.recorded_at', 'DESC');

    if (query?.status) {
      qb.andWhere('g.status = :status', { status: query.status });
    }

    const allLocations = await qb.getMany();

    const latestPerVehicle = new Map<string, GpsLocation>();
    for (const loc of allLocations) {
      if (!latestPerVehicle.has(loc.vehicle_id)) {
        latestPerVehicle.set(loc.vehicle_id, loc);
      }
    }

    const fleet = Array.from(latestPerVehicle.values()).map((loc) => ({
      id: loc.id,
      vehicle_id: loc.vehicle_id,
      plate: loc.vehicle?.license_plate || '',
      vehicle_name: loc.vehicle
        ? `${loc.vehicle.merk} ${loc.vehicle.model}`
        : '',
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      speed: Number(loc.speed),
      fuel_level: loc.fuel_level !== null ? Number(loc.fuel_level) : null,
      status: loc.status,
      engine_status: loc.engine_status || 'off',
      last_updated: loc.recorded_at,
    }));

    if (query?.vehicle_id) {
      const filtered = fleet.filter(
        (v) => v.vehicle_id === query.vehicle_id,
      );
      return {
        success: true,
        message: 'Fleet locations retrieved successfully',
        data: filtered,
      };
    }

    return {
      success: true,
      message: 'Fleet locations retrieved successfully',
      data: fleet,
    };
  }

  async getVehicleLocation(vehicleId: string) {
    const location = await this.gpsRepository.findOne({
      where: { vehicle_id: vehicleId },
      order: { recorded_at: 'DESC' },
      relations: { vehicle: true },
    });

    if (!location) {
      throw new NotFoundException('Vehicle location not found');
    }

    return {
      success: true,
      message: 'Vehicle location retrieved successfully',
      data: {
        id: location.id,
        vehicle_id: location.vehicle_id,
        plate: location.vehicle?.license_plate || '',
        vehicle_name: location.vehicle
          ? `${location.vehicle.merk} ${location.vehicle.model}`
          : '',
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        speed: Number(location.speed),
        fuel_level: location.fuel_level !== null
          ? Number(location.fuel_level)
          : null,
        status: location.status,
        engine_status: location.engine_status || 'off',
        last_updated: location.recorded_at,
      },
    };
  }

  async getLocationHistory(vehicleId: string, limit = 50) {
    const locations = await this.gpsRepository.find({
      where: { vehicle_id: vehicleId },
      order: { recorded_at: 'DESC' },
      take: limit,
      relations: { vehicle: true },
    });

    return {
      success: true,
      message: 'Location history retrieved successfully',
      data: locations.map((loc) => ({
        id: loc.id,
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        speed: Number(loc.speed),
        fuel_level: loc.fuel_level !== null ? Number(loc.fuel_level) : null,
        status: loc.status,
        engine_status: loc.engine_status || 'off',
        recorded_at: loc.recorded_at,
      })),
    };
  }

  async updateLocation(dto: UpdateGpsDto) {
    const location = new GpsLocation();
    location.vehicle_id = dto.vehicle_id;
    location.latitude = dto.latitude;
    location.longitude = dto.longitude;
    location.speed = dto.speed ?? 0;
    location.fuel_level = dto.fuel_level ?? null;
    location.status = dto.status ?? 'idle';
    location.engine_status = dto.engine_status ?? 'off';

    const saved = await this.gpsRepository.save(location);

    if (dto.engine_status) {
      await this.vehicleRepository.update(dto.vehicle_id, {
        engine_status: dto.engine_status,
      });
    }

    // Check geofence violation
    const { inside, violatedGeofence } = await this.isPointInsideAnyGeofence(
      dto.latitude,
      dto.longitude,
    );

    if (!inside) {
      // Get vehicle info
      const vehicle = await this.vehicleRepository.findOne({
        where: { id: dto.vehicle_id },
      });

      // Update status to emergency if outside geofence
      location.status = 'emergency';
      await this.gpsRepository.save(location);

      // Create notification for geofence violation
      const notif = this.notifRepository.create({
        type: 'geofence_violation',
        title: `Geofence Violation: ${vehicle ? `${vehicle.merk} ${vehicle.model}` : 'Unknown Vehicle'}`,
        message: `Vehicle ${vehicle?.license_plate || 'Unknown'} has exited the operational area "${violatedGeofence?.name || 'Unknown Zone'}" at coordinates ${dto.latitude.toFixed(6)}, ${dto.longitude.toFixed(6)}. Immediate action required.`,
        vehicle_id: dto.vehicle_id,
        status: 'unread',
        is_read: false,
        metadata: {
          latitude: dto.latitude,
          longitude: dto.longitude,
          geofence_name: violatedGeofence?.name,
          geofence_id: violatedGeofence?.id,
          speed: dto.speed,
        },
      });
      await this.notifRepository.save(notif);
    }

    return {
      success: true,
      message: 'GPS location updated successfully',
      data: {
        id: saved.id,
        vehicle_id: saved.vehicle_id,
        latitude: Number(saved.latitude),
        longitude: Number(saved.longitude),
        speed: Number(saved.speed),
        fuel_level: saved.fuel_level !== null ? Number(saved.fuel_level) : null,
        status: saved.status,
        engine_status: saved.engine_status,
        recorded_at: saved.recorded_at,
        geofence_status: inside ? 'inside' : 'outside',
      },
    };
  }

  async updateVehicleStatus(vehicleId: string, status: string) {
    const allowedStatuses = ['Available', 'Maintenance', 'Service', 'Reserved', 'rented', 'retrieved'];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
    }

    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.vehicleRepository.update(vehicleId, { status });

    const updated = await this.vehicleRepository.findOne({ where: { id: vehicleId } });

    return {
      success: true,
      message: `Vehicle status updated to ${status}`,
      data: updated,
    };
  }

  async updateVehicleEngine(vehicleId: string, engineStatus: string) {
    if (!['on', 'off'].includes(engineStatus)) {
      throw new BadRequestException(`Invalid engine status. Must be one of: on, off`);
    }

    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.vehicleRepository.update(vehicleId, {
      engine_status: engineStatus,
    });

    const latestGps = await this.gpsRepository.findOne({
      where: { vehicle_id: vehicleId },
      order: { recorded_at: 'DESC' },
    });

    if (latestGps) {
      latestGps.engine_status = engineStatus;
      await this.gpsRepository.save(latestGps);
    }

    const updated = await this.vehicleRepository.findOne({ where: { id: vehicleId } });

    return {
      success: true,
      message: `Vehicle engine turned ${engineStatus === 'on' ? 'ON' : 'OFF'}`,
      data: {
        vehicle_id: vehicleId,
        engine_status: updated?.engine_status || engineStatus,
      },
    };
  }

  private async isPointInsideAnyGeofence(
    lat: number,
    lng: number,
  ): Promise<{ inside: boolean; violatedGeofence: Geofence | null }> {
    const geofences = await this.geofenceRepository.find({
      where: { is_active: true },
    });

    if (geofences.length === 0) {
      return { inside: true, violatedGeofence: null };
    }

    const R = 6371000;
    for (const g of geofences) {
      const dLat = this.toRad(lat - Number(g.center_lat));
      const dLng = this.toRad(lng - Number(g.center_lng));
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(Number(g.center_lat))) *
          Math.cos(this.toRad(lat)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance <= g.radius) {
        return { inside: true, violatedGeofence: null };
      }
    }

    return { inside: false, violatedGeofence: geofences[0] };
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
