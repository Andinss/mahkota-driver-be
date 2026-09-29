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

  async findAll() {
    const memberships = await this.membershipRepository.find({
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
    await this.assertLevelAvailable(dto.level);
    await this.assertNameAvailable(dto.name);

    try {
      const membership = this.membershipRepository.create({
        name: dto.name,
        level: dto.level,
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
        throw new BadRequestException(
          'Membership name or level already exists',
        );
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

    if (dto.level !== undefined && dto.level !== existing.level) {
      await this.assertLevelAvailable(dto.level, id);
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
        throw new BadRequestException(
          'Membership name or level already exists',
        );
      }
      throw new InternalServerErrorException('Failed to update membership');
    }
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

  private async assertLevelAvailable(level: number, excludeId?: string) {
    const duplicate = await this.membershipRepository.findOne({
      where: { level },
    });

    if (duplicate && duplicate.id !== excludeId) {
      throw new BadRequestException(
        `Level ${level} is already used by membership "${duplicate.name}"`,
      );
    }
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
