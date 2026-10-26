import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { Driver } from './entities/driver.entity';
import { DriverKoin } from '../koin/entities/driver-koin.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Finance } from '../finances/entities/finance.entity';
import { User } from '../users/entities/user.entity';

@Module({
  providers: [DriverService],
  controllers: [DriverController],
  imports: [
    TypeOrmModule.forFeature([Driver, DriverKoin, Membership, Finance, User]),
  ],
  exports: [DriverService],
})
export class DriverModule {}
