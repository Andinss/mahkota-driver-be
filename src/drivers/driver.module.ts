import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { Driver } from './entities/driver.entity';
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Finance } from '../finances/entities/finance.entity';
import { User } from '../users/entities/user.entity';
import { Rental } from 'src/rentals/entities/rental.entity';
import { FinancePayment } from 'src/finances/entities/finance-payment.entity';
import { LatePayment } from 'src/late-payments/entities/late-payment.entity';

@Module({
  providers: [DriverService],
  controllers: [DriverController],
  imports: [
    TypeOrmModule.forFeature([
      Driver,
      DriverKoin,
      Membership,
      Finance,
      User,
      Rental,
      FinancePayment,
      LatePayment,
    ]),
  ],
  exports: [DriverService],
})
export class DriverModule {}
