import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from './entities/geofence.entity';
import { CreateGeofenceDto } from './dto/create-geofence.dto';

@Injectable()
export class GeofenceService {
  constructor(
    @InjectRepository(Geofence)
    private readonly geofenceRepository: Repository<Geofence>,
  ) {}

  async findAll() {
    const geofences = await this.geofenceRepository.find({
      order: { created_at: 'DESC' },
    });

    return {
      success: true,
      message: 'Geofences retrieved successfully',
      data: geofences,
    };
  }

  async findActive() {
    const geofences = await this.geofenceRepository.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });

    return {
      success: true,
      message: 'Active geofences retrieved successfully',
      data: geofences,
    };
  }

  async findById(id: string) {
    const geofence = await this.geofenceRepository.findOne({ where: { id } });
    if (!geofence) throw new NotFoundException('Geofence not found');

    return {
      success: true,
      message: 'Geofence retrieved successfully',
      data: geofence,
    };
  }

  async create(dto: CreateGeofenceDto) {
    const geofence = this.geofenceRepository.create(dto);
    const saved = await this.geofenceRepository.save(geofence);

    return {
      success: true,
      message: 'Geofence created successfully',
      data: saved,
    };
  }

  async update(id: string, dto: Partial<CreateGeofenceDto>) {
    const geofence = await this.geofenceRepository.findOne({ where: { id } });
    if (!geofence) throw new NotFoundException('Geofence not found');

    Object.assign(geofence, dto);
    const saved = await this.geofenceRepository.save(geofence);

    return {
      success: true,
      message: 'Geofence updated successfully',
      data: saved,
    };
  }

  async remove(id: string) {
    const geofence = await this.geofenceRepository.findOne({ where: { id } });
    if (!geofence) throw new NotFoundException('Geofence not found');

    await this.geofenceRepository.remove(geofence);

    return {
      success: true,
      message: 'Geofence deleted successfully',
    };
  }

  checkPointInGeofence(lat: number, lng: number): { inside: boolean; geofence: Geofence | null } {
    const R = 6371000;
    const activeGeofences = this.geofenceRepository.find({
      where: { is_active: true },
    });

    return { inside: true, geofence: null };
  }

  async isPointInsideAnyGeofence(lat: number, lng: number): Promise<{ inside: boolean; violatedGeofence: Geofence | null }> {
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
