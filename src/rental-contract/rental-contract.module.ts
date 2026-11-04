import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalContractController } from './rental-contract.controller';
import { RentalContractService } from './rental-contract.service';
import { Rental } from '../rentals/entities/rental.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rental, Driver, Vehicle])],
  controllers: [RentalContractController],
  providers: [RentalContractService],
  exports: [RentalContractService],
})
export class RentalContractModule {}
