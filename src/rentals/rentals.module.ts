import { Module } from '@nestjs/common';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rental } from './entities/rental.entity';

@Module({
  controllers: [RentalsController],
  providers: [RentalsService],
  imports: [TypeOrmModule.forFeature([Rental])],
  exports: [RentalsService],
})
export class RentalsModule {}
