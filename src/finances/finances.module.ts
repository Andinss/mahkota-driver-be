import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { Finance } from './entities/finance.entity';
import { DriverModule } from '../drivers/driver.module';
import { RentalsModule } from '../rentals/rentals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Finance]),
    DriverModule,
    RentalsModule,
  ],
  controllers: [FinancesController],
  providers: [FinancesService],
  exports: [FinancesService],
})
export class FinancesModule {}