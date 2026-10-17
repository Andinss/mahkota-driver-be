import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LatePaymentsController } from './late-payments.controller';
import { LatePaymentsService } from './late-payments.service';
import { LatePayment } from './entities/late-payment.entity';
import { DailyPayment } from '../daily-payments/entities/daily-payment.entity';
import { DriverModule } from '../drivers/driver.module';
import { RentalsModule } from '../rentals/rentals.module';
import { FinancesModule } from '../finances/finances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LatePayment, DailyPayment]),
    DriverModule,
    RentalsModule,
    FinancesModule,
  ],
  controllers: [LatePaymentsController],
  providers: [LatePaymentsService],
  exports: [LatePaymentsService],
})
export class LatePaymentsModule {}
