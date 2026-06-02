import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finance } from './entities/finance.entity';
import { AddFinanceDto } from './dto/add-finance.dto';

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Finance)
    private readonly financesRepository: Repository<Finance>,
  ) {}

  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: Finance[];
  }> {
    const result = await this.financesRepository.find();
    return {
      success: true,
      message: 'Finances retrieved successfully',
      data: result,
    };
  }

  async findByReferenceNumber(referenceNumber: string): Promise<Finance | null> {
    return this.financesRepository.findOne({
      where: { reference_number: referenceNumber },
    });
  }

  async findById(id: string): Promise<Finance | null> {
    return this.financesRepository.findOne({ where: { id } });
  }

  async create(data: AddFinanceDto) {
    try {
      const financeData = {
        ...data,
        payment_date: new Date(data.payment_date),
      };

      const finance = this.financesRepository.create(financeData);
      const result = await this.financesRepository.save(finance);

      return {
        success: true,
        message: 'Finance created successfully',
        data: result,
      };
    } catch (error) {
      console.error('Failed to create finance:', error);
      throw new InternalServerErrorException('Failed to create finance');
    }
  }

  async update(id: string, data: Partial<AddFinanceDto>) {
    const updateData: any = {
      ...data,
      payment_date: data.payment_date ? new Date(data.payment_date) : undefined,
    };

    const result = await this.financesRepository.update(id, updateData);

    if (result.affected === 0) {
      throw new NotFoundException('Finance not found');
    }

    const finance = await this.findById(id);

    return {
      success: true,
      message: 'Finance updated successfully',
      data: finance,
    };
  }

  async delete(employid: string): Promise<{ success: boolean; message: string }> {
    const result = await this.financesRepository.delete(employid);
    if (result.affected === 0) {
      throw new NotFoundException('Finance not found');
    }

    return {
      success: true,
      message: 'Finance deleted successfully',
    };
  }
}