import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { Driver } from './entities/driver.entity';
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { Membership } from '../membership/entities/membership.entity';

@Module({
  providers: [DriverService],
  controllers: [DriverController],
  imports: [TypeOrmModule.forFeature([Driver, DriverKoin, Membership])],
  exports: [DriverService],
})
export class DriverModule {}