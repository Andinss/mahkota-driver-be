import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaldoController } from './saldo.controller';
import { SaldoService } from './saldo.service';
import { DriverSaldo } from './entities/driver-saldo.entity';
import { SaldoTransaction } from './entities/saldo-transaction.entity';
import { Driver } from '../drivers/entities/driver.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DriverSaldo, SaldoTransaction, Driver])],
  controllers: [SaldoController],
  providers: [SaldoService],
  exports: [SaldoService],
})
export class SaldoModule {}
