import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MethodPaymentService } from './method-payment.service';
import { MethodPaymentController } from './method-payment.controller';
import { MethodPayment } from './entities/method-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MethodPayment])],
  providers: [MethodPaymentService],
  controllers: [MethodPaymentController],
  exports: [MethodPaymentService],
})
export class MethodPaymentModule {}
