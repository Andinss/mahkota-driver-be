import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import {
  MethodPayment,
  MethodPaymentMethod,
} from './entities/method-payment.entity';
import { CreateMethodPaymentDto } from './dto/create-method-payment.dto';
import { UpdateMethodPaymentDto } from './dto/update-method-payment.dto';

interface MethodPaymentPayload {
  method?: MethodPaymentMethod;
  name?: string;
  provider?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
  image_url?: string | null;
  description?: string;
  is_active?: boolean;
}

@Injectable()
export class MethodPaymentService {
  constructor(
    @InjectRepository(MethodPayment)
    private readonly methodPaymentRepository: Repository<MethodPayment>,
  ) {}

  async findAll(isActive: string = 'all') {
    const where: { is_active?: boolean } = {};
    if (isActive !== 'all') {
      where.is_active = isActive !== 'false';
    }

    const methods = await this.methodPaymentRepository.find({
      where,
      order: { code: 'ASC' },
    });

    return {
      success: true,
      message: 'Method payments retrieved successfully',
      data: methods,
    };
  }

  async findById(id: string) {
    const method = await this.methodPaymentRepository.findOne({
      where: { id },
    });

    if (!method) {
      throw new NotFoundException('Method payment not found');
    }

    return {
      success: true,
      message: 'Method payment retrieved successfully',
      data: method,
    };
  }

  async create(dto: CreateMethodPaymentDto, file?: Express.Multer.File) {
    try {
      await this.assertNameAvailable(dto.name);

      const normalized = this.normalize(dto);
      normalized.image_url = this.resolveImage(
        normalized.image_url,
        file,
        dto.method,
      );

      const saved = await this.methodPaymentRepository.save(
        this.methodPaymentRepository.create({
          ...normalized,
          method: dto.method,
          code: await this.generateCode(),
        }),
      );

      return {
        success: true,
        message: 'Method payment created successfully',
        data: saved,
      };
    } catch (error) {
      this.removeFile(file?.path);
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Method payment code already exists');
      }
      throw new InternalServerErrorException('Failed to create method payment');
    }
  }

  async update(
    id: string,
    dto: UpdateMethodPaymentDto,
    file?: Express.Multer.File,
  ) {
    const existing = await this.methodPaymentRepository.findOne({
      where: { id },
    });

    if (!existing) {
      this.removeFile(file?.path);
      throw new NotFoundException('Method payment not found');
    }

    const method = dto.method ?? existing.method;
    const oldImagePath = existing.image_url;

    try {
      if (dto.name !== undefined && dto.name !== existing.name) {
        await this.assertNameAvailable(dto.name, id);
      }

      let imageUrl: string | null;
      if (file) {
        imageUrl = file.path.replace(/\\/g, '/');
      } else if (dto.image_url !== undefined) {
        // "" / null = gambar dihapus, selain itu pertahankan path yang dikirim.
        imageUrl = dto.image_url || null;
      } else {
        imageUrl = existing.image_url;
      }
      if (method !== 'qris') {
        imageUrl = null;
      }

      // File baru terbuang kalau akhirnya tidak dipakai (mis. metode bukan QRIS).
      if (file && file.path.replace(/\\/g, '/') !== imageUrl) {
        this.removeFile(file.path);
      }

      // Merge eksplisit: field yang tidak dikirim dipertahankan (update parsial).
      const merged: MethodPaymentPayload = {
        method,
        name: dto.name !== undefined ? dto.name : existing.name,
        provider: dto.provider !== undefined ? dto.provider : existing.provider,
        account_number:
          dto.account_number !== undefined
            ? dto.account_number
            : existing.account_number,
        account_holder:
          dto.account_holder !== undefined
            ? dto.account_holder
            : existing.account_holder,
        image_url: imageUrl,
        description:
          dto.description !== undefined
            ? dto.description
            : existing.description,
        is_active:
          dto.is_active !== undefined ? dto.is_active : existing.is_active,
      };

      Object.assign(existing, this.normalize(merged), {
        method,
        image_url: imageUrl,
      });
      const saved = await this.methodPaymentRepository.save(existing);

      // Buang file lama jika diganti / dikosongkan / metode berpindah dari QRIS.
      if (oldImagePath && oldImagePath !== imageUrl) {
        this.removeFile(oldImagePath);
      }

      return {
        success: true,
        message: 'Method payment updated successfully',
        data: saved,
      };
    } catch (error) {
      this.removeFile(file?.path);
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Method payment code already exists');
      }
      throw new InternalServerErrorException('Failed to update method payment');
    }
  }

  async updateStatus(id: string, is_active: boolean) {
    const existing = await this.methodPaymentRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Method payment not found');
    }

    existing.is_active = is_active;
    const saved = await this.methodPaymentRepository.save(existing);

    return {
      success: true,
      message: `Method payment marked as ${is_active ? 'Active' : 'Inactive'} successfully`,
      data: saved,
    };
  }

  async delete(id: string) {
    const existing = await this.methodPaymentRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Method payment not found');
    }

    await this.methodPaymentRepository.delete(id);
    this.removeFile(existing.image_url);

    return {
      success: true,
      message: 'Method payment deleted successfully',
    };
  }

  /** Pastikan field yang tidak relevan dengan metode selalu kosong. */
  private normalize(payload: MethodPaymentPayload): MethodPaymentPayload {
    const method = payload.method ?? 'bank';
    const isQris = method === 'qris';

    return {
      method,
      name: payload.name?.trim(),
      provider: isQris ? null : payload.provider || null,
      account_number: isQris ? null : payload.account_number || null,
      account_holder: isQris ? null : payload.account_holder || null,
      image_url: isQris ? payload.image_url || null : null,
      description: payload.description ?? '',
      is_active: payload.is_active ?? true,
    };
  }

  /** File baru menang; kalau bukan QRIS file langsung dibuang. */
  private resolveImage(
    current: string | null | undefined,
    file: Express.Multer.File | undefined,
    method: MethodPaymentMethod,
  ): string | null {
    if (method !== 'qris') {
      this.removeFile(file?.path);
      return null;
    }

    if (file) {
      return file.path.replace(/\\/g, '/');
    }

    return current || null;
  }

  private removeFile(path?: string | null) {
    if (!path) return;
    // Lewati data-URL base64 lama / URL absolut / path eksternal.
    if (path.startsWith('data:') || path.startsWith('http')) return;

    try {
      const fullPath = path.startsWith('/') ? path : `./${path}`;
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
      }
    } catch (err) {
      console.error(`Failed to delete file ${path}:`, err);
    }
  }

  private async generateCode(): Promise<string> {
    const result = await this.methodPaymentRepository
      .createQueryBuilder('m')
      .select('MAX(m.code)', 'max')
      .getRawOne<{ max: string | null }>();

    const max = Number(String(result?.max ?? '').replace(/\D/g, '')) || 0;
    return `RKN-${String(max + 1).padStart(3, '0')}`;
  }

  private async assertNameAvailable(name: string, excludeId?: string) {
    const duplicate = await this.methodPaymentRepository.findOne({
      where: { name },
    });

    if (duplicate && duplicate.id !== excludeId) {
      throw new BadRequestException(`Method payment "${name}" already exists`);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === '23505';
  }
}
