import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from './entities/membership.entity';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}

  async findAll(isActive: string = 'true') {
    const where: { is_active?: boolean } = {};
    if (isActive !== 'all') {
      where.is_active = isActive !== 'false';
    }

    const memberships = await this.membershipRepository.find({
      where,
      order: { level: 'ASC' },
    });

    return {
      success: true,
      message: 'Memberships retrieved successfully',
      data: memberships,
    };
  }

  async findById(id: string) {
    const membership = await this.membershipRepository.findOne({
      where: { id },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return {
      success: true,
      message: 'Membership retrieved successfully',
      data: membership,
    };
  }

  async create(dto: CreateMembershipDto) {
    await this.assertNameAvailable(dto.name);

    try {
      const nextLevel = await this.getNextLevel();
      const membership = this.membershipRepository.create({
        name: dto.name,
        level: nextLevel,
        fee: dto.fee,
        description: dto.description ?? '',
        benefits: dto.benefits ?? [],
        is_active: dto.is_active ?? true,
      });
      const saved = await this.membershipRepository.save(membership);

      return {
        success: true,
        message: 'Membership created successfully',
        data: saved,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Membership name already exists');
      }
      throw new InternalServerErrorException('Failed to create membership');
    }
  }

  async update(id: string, dto: UpdateMembershipDto) {
    const existing = await this.membershipRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Membership not found');
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameAvailable(dto.name, id);
    }

    try {
      Object.assign(existing, dto);
      const saved = await this.membershipRepository.save(existing);

      return {
        success: true,
        message: 'Membership updated successfully',
        data: saved,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Membership name already exists');
      }
      throw new InternalServerErrorException('Failed to update membership');
    }
  }

  async updateStatus(id: string, is_active: boolean) {
    const existing = await this.membershipRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Membership not found');
    }

    existing.is_active = is_active;
    const saved = await this.membershipRepository.save(existing);

    return {
      success: true,
      message: `Membership marked as ${is_active ? 'Active' : 'Inactive'} successfully`,
      data: saved,
    };
  }

  async delete(id: string) {
    const existing = await this.membershipRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Membership not found');
    }

    await this.membershipRepository.delete(id);

    return {
      success: true,
      message: 'Membership deleted successfully',
    };
  }

  private async getNextLevel(): Promise<number> {
    const result = await this.membershipRepository
      .createQueryBuilder('m')
      .select('MAX(m.level)', 'max')
      .getRawOne<{ max: string | number | null }>();
    return Number(result?.max ?? 0) + 1;
  }

  private async assertNameAvailable(name: string, excludeId?: string) {
    const duplicate = await this.membershipRepository.findOne({
      where: { name },
    });

    if (duplicate && duplicate.id !== excludeId) {
      throw new BadRequestException(`Membership name "${name}" already exists`);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === '23505';
  }
}
