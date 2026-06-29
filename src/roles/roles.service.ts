import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsToRoleDto } from './dto/add-permissions-to-role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
  ) {}

  async findAll() {
    const roles = await this.rolesRepository.find({
      relations: { permissions: true },
    });
    return {
      success: true,
      message: 'Roles retrieved successfully',
      data: roles,
    };
  }

  async findById(id: string) {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    return { success: true, message: 'Role retrieved successfully', data: role };
  }

  async create(dto: CreateRoleDto) {
    try {
      const role = this.rolesRepository.create(dto);
      const saved = await this.rolesRepository.save(role);
      return {
        success: true,
        message: 'Role created successfully',
        data: saved,
      };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new BadRequestException('Role name or code already exists');
      }
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    Object.assign(role, dto);
    try {
      const saved = await this.rolesRepository.save(role);
      return {
        success: true,
        message: 'Role updated successfully',
        data: saved,
      };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new BadRequestException('Role name or code already exists');
      }
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  async delete(id: string) {
    const result = await this.rolesRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Role not found');
    return { success: true, message: 'Role deleted successfully' };
  }

  async assignPermissions(roleId: string, dto: AddPermissionsToRoleDto) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    const permissions = await this.permissionsRepository.find({
      where: { id: In(dto.permissionIds) },
    });

    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('Some permissions not found');
    }

    const existingIds = new Set(role.permissions.map((p) => p.id));
    const newIds = dto.permissionIds.filter((id) => !existingIds.has(id));
    if (newIds.length > 0) {
      const newPerms = permissions.filter((p) => newIds.includes(p.id));
      role.permissions = [...role.permissions, ...newPerms];
      await this.rolesRepository.save(role);
    }

    const saved = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });

    return {
      success: true,
      message: 'Permissions added successfully',
      data: saved,
    };
  }

  async removePermissions(roleId: string, dto: AddPermissionsToRoleDto) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    role.permissions = role.permissions.filter(
      (p) => !dto.permissionIds.includes(p.id),
    );
    const saved = await this.rolesRepository.save(role);

    return {
      success: true,
      message: 'Permissions removed successfully',
      data: saved,
    };
  }

  async getPermissions(roleId: string) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    return {
      success: true,
      message: 'Permissions retrieved successfully',
      data: role.permissions,
    };
  }
}
