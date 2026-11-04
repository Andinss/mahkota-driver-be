import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyPaymentsController } from './daily-payments.controller';
import { DailyPaymentsService } from './daily-payments.service';
import { DailyPayment } from './entities/daily-payment.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { VendorVehicle } from '../vendor-vehicle/entities/vendor-vehicle.entity';
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { KoinTransaction } from '../koin/entities/koin-transaction.entity';
import { MethodPayment } from '../method-payment/entities/method-payment.entity';
import { LatePayment } from '../late-payments/entities/late-payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyPayment,
      Rental,
      Vehicle,
      Driver,
      VendorVehicle,
      DriverKoin,
      KoinTransaction,
      MethodPayment,
      LatePayment,
    ]),
  ],
  controllers: [DailyPaymentsController],
  providers: [DailyPaymentsService],
  exports: [DailyPaymentsService],
})
export class DailyPaymentsModule {}
