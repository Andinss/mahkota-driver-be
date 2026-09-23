import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KoinController } from './koin.controller';
import { KoinService } from './koin.service';
import { DriverKoin } from './entities/driver-koin.entity';
import { KoinTransaction } from './entities/koin-transaction.entity';
import { Driver } from '../drivers/entities/driver.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DriverKoin, KoinTransaction, Driver])],
  controllers: [KoinController],
  providers: [KoinService],
  exports: [KoinService],
})
export class KoinModule {}
