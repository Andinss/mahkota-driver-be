import { existsSync, unlinkSync } from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Express } from 'express';
import { Rental } from './entities/rental.entity';
import { AddRentalDto } from './dto/add-rental.dto';

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(Rental)
    private readonly rentalsRepository: Repository<Rental>,
  ) {}

  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: Rental[];
  }> {
    const result = await this.rentalsRepository.find({
      relations: { driver: true, vehicle: true },
    });
    return {
      success: true,
      message: 'Rentals retrieved successfully',
      data: result,
    };
  }

  async findByRentalId(rentalId: string): Promise<Rental | null> {
    let rental = await this.rentalsRepository.findOne({
      where: { id: rentalId },
      relations: { driver: true, vehicle: true },
    });
    if (!rental && /^[0-9a-f-]{36}$/i.test(rentalId)) {
      rental = await this.rentalsRepository.findOne({
        where: { id: rentalId },
        relations: { driver: true, vehicle: true },
      });
    }
    return rental;
  }

  async create(data: AddRentalDto, files?: Express.Multer.File[]) {
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');

          if (
            originalName.includes('kontrak') ||
            originalName.includes('contract')
          ) {
            data.document_contract = filePath;
          }
        }
      }

      const rental = this.rentalsRepository.create(data);
      const result = await this.rentalsRepository.save(rental);

      return {
        success: true,
        message: 'Rental created successfully',
        data: result,
      };
    } catch (error) {
      console.error('Failed to create rental:', error);
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            unlinkSync(file.path);
          } catch {}
        }
      }
      throw new InternalServerErrorException('Failed to create rental');
    }
  }

  async update(
    rentalId: string,
    data: Partial<Rental>,
    files?: Express.Multer.File[],
  ) {
    try {
      let existingRental = await this.rentalsRepository.findOne({
        where: { id: rentalId },
      });

      if (!existingRental && /^[0-9a-f-]{36}$/i.test(rentalId)) {
        existingRental = await this.rentalsRepository.findOne({
          where: { id: rentalId },
        });
      }

      if (!existingRental) {
        throw new NotFoundException('Rental not found');
      }

      if (files && files.length > 0) {
        for (const file of files) {
          const originalName = file.originalname.toLowerCase();
          const filePath = file.path.replace(/\\/g, '/');
          let oldFilePath: string | null | undefined = null;

          if (
            originalName.includes('kontrak') ||
            originalName.includes('contract')
          ) {
            oldFilePath = existingRental.document_contract;
            data.document_contract = filePath;
          }

          if (oldFilePath && oldFilePath !== filePath) {
            try {
              const fullPath = oldFilePath.startsWith('/')
                ? oldFilePath
                : `./${oldFilePath}`;
              if (existsSync(fullPath)) {
                unlinkSync(fullPath);
              }
            } catch (err) {
              console.error(`Failed to delete old file ${oldFilePath}:`, err);
            }
          }
        }
      }

      const result = await this.rentalsRepository.update(
        existingRental.id,
        data,
      );

      if (result.affected === 0) {
        throw new NotFoundException('Rental not found');
      }

      const rental = await this.findByRentalId(rentalId);

      return {
        success: true,
        message: 'Rental updated successfully',
        data: rental,
      };
    } catch (error) {
      console.error('Failed to update rental:', error);

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
      throw new InternalServerErrorException('Failed to update rental');
    }
  }

  async delete(
    rentalId: string,
  ): Promise<{ success: boolean; message: string }> {
    let existingRental = await this.rentalsRepository.findOne({
      where: { id: rentalId },
    });

    if (!existingRental && /^[0-9a-f-]{36}$/i.test(rentalId)) {
      existingRental = await this.rentalsRepository.findOne({
        where: { id: rentalId },
      });
    }

    if (!existingRental) {
      throw new NotFoundException('Rental not found');
    }

    const fileFields = [existingRental.document_contract];

    for (const filePath of fileFields) {
      if (filePath) {
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

    await this.rentalsRepository.delete(existingRental.id);

    return {
      success: true,
      message: 'Rental deleted successfully',
    };
  }
}
