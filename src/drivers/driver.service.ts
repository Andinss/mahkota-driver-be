import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { AddDriverDto } from './dto/add-driver.dto';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
  ) {}
  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: Driver[];
  }> {
    const result = await this.driversRepository.find();
    return {
      success: true,
      message: 'Drivers retrieved successfully',
      data: result,
    };
  }

  async findById(id: string): Promise<Driver | null> {
    return this.driversRepository.findOne({ where: { id } });
  }
  async create(data: AddDriverDto) {
    try {
      const driver = this.driversRepository.create({
        ...data,
        user: { id: data.user_id },
      });
      const result = await this.driversRepository.save(driver);

      return {
        success: true,
        message: 'Driver created successfully',
        data: result,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create driver');
    }
  }

  async update(id: string, data: Partial<Driver>) {
    const result = await this.driversRepository.update(id, data);

    if (result.affected === 0) {
      throw new NotFoundException('Driver not found');
    }

    const driver = await this.findById(id);
    return {
      success: true,
      message: 'Driver updated successfully',
      data: driver,
    };
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.driversRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Driver not found');
    }

    return {
      success: true,
      message: 'Driver deleted successfully',
    };
  }
}
