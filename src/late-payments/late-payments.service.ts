import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LatePayment } from './entities/late-payment.entity';
import { CreateLatePaymentDto } from './dto/create-late-payment.dto';
import { FinancesService } from '../finances/finances.service';

@Injectable()
export class LatePaymentsService {
  constructor(
    @InjectRepository(LatePayment)
    private readonly latePaymentRepository: Repository<LatePayment>,
    private readonly financesService: FinancesService,
  ) {}

  private async findRawById(id: string): Promise<LatePayment | null> {
    return this.latePaymentRepository.findOne({
      where: { id },
      relations: { driver: true, rentals: true },
    });
  }

  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: LatePayment[];
  }> {
    const result = await this.latePaymentRepository.find({
      relations: { driver: true, rentals: true },
      order: { created_at: 'DESC' },
    });
    return {
      success: true,
      message: 'Late payments retrieved successfully',
      data: result,
    };
  }

  async findById(id: string) {
    const payment = await this.findRawById(id);
    if (!payment) {
      throw new NotFoundException('Late payment not found');
    }
    return {
      success: true,
      message: 'Late payment retrieved successfully',
      data: payment,
    };
  }

  async getStats(): Promise<{
    success: boolean;
    message: string;
    data: {
      pending: number;
      approved: number;
      rejected: number;
      total: number;
    };
  }> {
    const [pending, approved, rejected, total] = await Promise.all([
      this.latePaymentRepository.count({ where: { status: 'pending' } }),
      this.latePaymentRepository.count({ where: { status: 'approved' } }),
      this.latePaymentRepository.count({ where: { status: 'rejected' } }),
      this.latePaymentRepository.count(),
    ]);

    return {
      success: true,
      message: 'Late payment stats retrieved successfully',
      data: { pending, approved, rejected, total },
    };
  }

  async create(data: CreateLatePaymentDto) {
    try {
      const { rental_ids, ...paymentData } = data;

      const payment = this.latePaymentRepository.create({
        ...paymentData,
        payment_date: data.payment_date
          ? new Date(data.payment_date)
          : new Date(),
        status: 'pending',
      });

      if (rental_ids && rental_ids.length > 0) {
        payment.rentals = rental_ids.map((id) => ({ id }) as any);
      }

      const result = await this.latePaymentRepository.save(payment);
      const saved = await this.findRawById(result.id);

      return {
        success: true,
        message: 'Late payment created successfully',
        data: saved,
      };
    } catch (error) {
      console.error('Failed to create late payment:', error);
      throw new InternalServerErrorException('Failed to create late payment');
    }
  }

  async approve(
    id: string,
    adminNote?: string,
  ): Promise<{ success: boolean; message: string; data: LatePayment }> {
    const payment = await this.findRawById(id);
    if (!payment) {
      throw new NotFoundException('Late payment not found');
    }

    payment.status = 'approved';
    if (adminNote) payment.admin_note = adminNote;
    const result = await this.latePaymentRepository.save(payment);

    const saved = await this.findRawById(result.id);

    const rentalIds = saved?.rentals?.map((r) => r.id) || [];

    if (rentalIds.length > 0) {
      try {
        const refNumber = `LATE/${Date.now()}`;
        await this.financesService.create({
          payment_date: new Date().toISOString(),
          reference_number: refNumber,
          payment_method: 'transfer',
          amount_received: Number(payment.amount),
          payer: payment.driver_name || 'driver',
          driver_id: payment.driver_id,
          finance_type: 'paid',
          notes: adminNote || 'Auto-created from late payment approval',
          rental_ids: rentalIds,
        });
      } catch (err) {
        console.error('Failed to auto-create finance for late payment:', err);
      }
    }

    return {
      success: true,
      message: 'Late payment approved successfully',
      data: saved!,
    };
  }

  async reject(
    id: string,
    adminNote?: string,
  ): Promise<{ success: boolean; message: string; data: LatePayment }> {
    const payment = await this.findRawById(id);
    if (!payment) {
      throw new NotFoundException('Late payment not found');
    }

    payment.status = 'rejected';
    if (adminNote) payment.admin_note = adminNote;
    const result = await this.latePaymentRepository.save(payment);

    const saved = await this.findRawById(result.id);

    return {
      success: true,
      message: 'Late payment rejected successfully',
      data: saved!,
    };
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.latePaymentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Late payment not found');
    }
    return {
      success: true,
      message: 'Late payment deleted successfully',
    };
  }
}
