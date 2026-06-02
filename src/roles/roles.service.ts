import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: Role[];
  }> {
    const result = await this.rolesRepository.find();
    return {
      success: true,
      message: 'Roles retrieved successfully',
      data: result,
    };
  }

  async findById(id: string): Promise<Role | null> {
    return this.rolesRepository.findOne({ where: { id } });
  }

  async create(data: Partial<Role>): Promise<{
    success: boolean;
    message: string;
    data: Role;
  }> {
    try {
      const role = this.rolesRepository.create(data);
      const result = await this.rolesRepository.save(role);

      return {
        success: true,
        message: 'Role created successfully',
        data: result,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  async update(id: string, data: Partial<Role>): Promise<{
    success: boolean;
    message: string;
    data: Role | null;
  }> {
    const result = await this.rolesRepository.update(id, data);

    if (result.affected === 0) {
      throw new NotFoundException('Role not found');
    }

    const role = await this.findById(id);

    return {
      success: true,
      message: 'Role updated successfully',
      data: role,
    };
  }

  async delete(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const result = await this.rolesRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('Role not found');
    }

    return {
      success: true,
      message: 'Role deleted successfully',
    };
  }
}