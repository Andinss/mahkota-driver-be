import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
  ) {}

  async findAll() {
    const permissions = await this.permissionsRepository.find();
    return {
      success: true,
      message: 'Permissions retrieved successfully',
      data: permissions,
    };
  }

  async findById(id: string) {
    const permission = await this.permissionsRepository.findOne({
      where: { id },
    });
    if (!permission) throw new NotFoundException('Permission not found');
    return {
      success: true,
      message: 'Permission retrieved successfully',
      data: permission,
    };
  }

  async create(dto: CreatePermissionDto) {
    try {
      const permission = this.permissionsRepository.create(dto);
      const saved = await this.permissionsRepository.save(permission);
      return {
        success: true,
        message: 'Permission created successfully',
        data: saved,
      };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new BadRequestException('Permission name already exists');
      }
      throw new InternalServerErrorException('Failed to create permission');
    }
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const permission = await this.permissionsRepository.findOne({
      where: { id },
    });
    if (!permission) throw new NotFoundException('Permission not found');

    Object.assign(permission, dto);
    try {
      const saved = await this.permissionsRepository.save(permission);
      return {
        success: true,
        message: 'Permission updated successfully',
        data: saved,
      };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new BadRequestException('Permission name already exists');
      }
      throw new InternalServerErrorException('Failed to update permission');
    }
  }

  async delete(id: string) {
    const result = await this.permissionsRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Permission not found');
    return { success: true, message: 'Permission deleted successfully' };
  }
}
