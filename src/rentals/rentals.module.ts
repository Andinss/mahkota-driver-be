import { Module } from '@nestjs/common';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rental } from './entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { DriverSaldo } from '../saldo/entities/driver-saldo.entity';
import { SaldoTransaction } from '../saldo/entities/saldo-transaction.entity';
import { Finance } from '../finances/entities/finance.entity';
import { SaldoModule } from '../saldo/saldo.module';

@Module({
  controllers: [RentalsController],
  providers: [RentalsService],
  imports: [
    TypeOrmModule.forFeature([Rental, Driver, Vehicle, DriverSaldo, SaldoTransaction, Finance]),
    SaldoModule,
  ],
  exports: [RentalsService],
})
export class RentalsModule {}
