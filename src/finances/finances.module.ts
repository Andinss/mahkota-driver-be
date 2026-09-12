import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { Finance } from './entities/finance.entity';
import { FinancePayment } from './entities/finance-payment.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DriverSaldo } from '../saldo/entities/driver-saldo.entity';
import { SaldoTransaction } from '../saldo/entities/saldo-transaction.entity';
import { DriverModule } from '../drivers/driver.module';
import { RentalsModule } from '../rentals/rentals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Finance,
      FinancePayment,
      Rental,
      Driver,
      DriverSaldo,
      SaldoTransaction,
    ]),
    DriverModule,
    RentalsModule,
  ],
  controllers: [FinancesController],
  providers: [FinancesService],
  exports: [FinancesService],
})
export class FinancesModule {}
