import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finance } from './entities/finance.entity';
import { AddFinanceDto } from './dto/add-finance.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { RentalsService } from '../rentals/rentals.service';

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Finance)
    private readonly financesRepository: Repository<Finance>,
    private readonly rentalsService: RentalsService,
  ) {}

  private async findRawById(id: string): Promise<Finance | null> {
    return this.financesRepository.findOne({
      where: { id },
      relations: { driver: true, rentals: true },
    });
  }

  async findAll(query?: FinanceQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.financesRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.driver', 'driver')
      .leftJoinAndSelect('f.rentals', 'rentals')
      .orderBy('f.created_at', 'DESC');

    if (query?.search) {
      qb.andWhere(
        '(f.reference_number ILIKE :search OR f.payer ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query?.payment_method) {
      qb.andWhere('f.payment_method = :method', {
        method: query.payment_method,
      });
    }

    if (query?.start_date) {
      qb.andWhere('f.payment_date >= :startDate', {
        startDate: query.start_date,
      });
    }

    if (query?.end_date) {
      qb.andWhere('f.payment_date <= :endDate', {
        endDate: query.end_date,
      });
    }

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Finances retrieved successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findByReferenceNumber(referenceNumber: string) {
    const finance = await this.financesRepository.findOne({
      where: { reference_number: referenceNumber },
      relations: { driver: true, rentals: true },
    });
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }
    return {
      success: true,
      message: 'Finance retrieved successfully',
      data: finance,
    };
  }

  async findById(id: string) {
    const finance = await this.findRawById(id);
    if (!finance) {
      throw new NotFoundException('Finance not found');
    }
    return {
      success: true,
      message: 'Finance retrieved successfully',
      data: finance,
    };
  }

  async findDetailById(id: string) {
    const finance = await this.financesRepository.findOne({
      where: { id },
      relations: {
        driver: true,
        rentals: { vehicle: true, driver: true },
      },
    });

    if (!finance) {
      throw new NotFoundException('Finance not found');
    }

    return {
      success: true,
      message: 'Finance detail retrieved successfully',
      data: finance,
    };
  }

  async getSummary() {
    const totalActive = await this.financesRepository.count({
      where: { is_active: true },
    });
    const totalInactive = await this.financesRepository.count({
      where: { is_active: false },
    });
    const totalRecords = await this.financesRepository.count();

    const totalResult = await this.financesRepository
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.amount_received), 0)', 'total')
      .getRawOne();

    const byMethod = await this.financesRepository
      .createQueryBuilder('f')
      .select('f.payment_method', 'method')
      .addSelect('COALESCE(SUM(f.amount_received), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .groupBy('f.payment_method')
      .getRawMany();

    const byType = await this.financesRepository
      .createQueryBuilder('f')
      .select('f.finance_type', 'type')
      .addSelect('COALESCE(SUM(f.amount_received), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .groupBy('f.finance_type')
      .getRawMany();

    const amountByMethod: Record<string, number> = {};
    for (const row of byMethod) {
      amountByMethod[row.method] = Number(row.total);
    }

    const amountByType: Record<string, number> = {};
    for (const row of byType) {
      amountByType[row.type] = Number(row.total);
    }

    return {
      success: true,
      message: 'Finance summary retrieved successfully',
      data: {
        total_amount_received: Number(totalResult?.total || 0),
        total_active: totalActive,
        total_inactive: totalInactive,
        total_records: totalRecords,
        amount_by_method: amountByMethod,
        amount_by_type: amountByType,
      },
    };
  }

  async create(data: AddFinanceDto) {
    try {
      const { rental_ids, ...financeData } = data;

      const finance = this.financesRepository.create({
        ...financeData,
        payment_date: new Date(data.payment_date),
      });

      if (rental_ids && rental_ids.length > 0) {
        finance.rentals = rental_ids.map((id) => ({ id } as any));
      }

      const result = await this.financesRepository.save(finance);
      const saved = await this.findRawById(result.id);

      if (rental_ids && rental_ids.length > 0) {
        for (const rentalId of rental_ids) {
          await this.updateRentalPaymentStatus(rentalId);
        }
      }

      return {
        success: true,
        message: 'Finance created successfully',
        data: saved,
      };
    } catch (error) {
      console.error('Failed to create finance:', error);
      throw new InternalServerErrorException('Failed to create finance');
    }
  }

  private async updateRentalPaymentStatus(rentalId: string): Promise<void> {
    const rentalRes = await this.rentalsService.findById(rentalId);
    const rental = rentalRes.data;
    if (!rental) return;

    const totalRevenue = Number(rental.total_revenue);

    const paidFinances = await this.financesRepository
      .createQueryBuilder('f')
      .leftJoin('f.rentals', 'r')
      .where('r.id = :rentalId', { rentalId })
      .select('COALESCE(SUM(f.amount_received), 0)', 'total')
      .getRawOne();

    const totalPaid = Number(paidFinances?.total || 0);

    if (totalPaid >= totalRevenue) {
      await this.rentalsService.updatePaymentStatus(rentalId, 'paid');
    } else if (totalPaid > 0) {
      await this.rentalsService.updatePaymentStatus(rentalId, 'partial');
    }
  }

  async update(id: string, data: Partial<AddFinanceDto>) {
    const { rental_ids, ...updateData } = data;

    const updatePayload: any = {
      ...updateData,
      payment_date: data.payment_date ? new Date(data.payment_date) : undefined,
      amount_received: data.amount_received !== undefined ? Number(data.amount_received) : undefined,
    };

    const result = await this.financesRepository.update(id, updatePayload);

    if (result.affected === 0) {
      throw new NotFoundException('Finance not found');
    }

    if (rental_ids !== undefined) {
      const finance = await this.financesRepository.findOne({ where: { id } });
      if (finance) {
        finance.rentals = rental_ids.map((rid) => ({ id: rid } as any));
        await this.financesRepository.save(finance);
      }
    }

    const finance = await this.findRawById(id);

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
