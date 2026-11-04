import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { Finance } from './entities/finance.entity';
import { FinancePayment } from './entities/finance-payment.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { KoinTransaction } from '../koin/entities/koin-transaction.entity';
import { DriverModule } from '../drivers/driver.module';
import { RentalsModule } from '../rentals/rentals.module';
import { MethodPayment } from '../method-payment/entities/method-payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Finance,
      FinancePayment,
      Rental,
      Driver,
      DriverKoin,
      KoinTransaction,
      MethodPayment,
    ]),
    DriverModule,
    RentalsModule,
  ],
  controllers: [FinancesController],
  providers: [FinancesService],
  exports: [FinancesService],
})
export class FinancesModule {}
