import { Module } from '@nestjs/common';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rental } from './entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

@Module({
  controllers: [RentalsController],
  providers: [RentalsService],
  imports: [
    TypeOrmModule.forFeature([Rental, Driver, Vehicle]),
  ],
  exports: [RentalsService],
})
export class RentalsModule {}
