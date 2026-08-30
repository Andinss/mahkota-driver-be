import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { Driver } from './entities/driver.entity';
import { DriverSaldo } from '../saldo/entities/driver-saldo.entity';

@Module({
  providers: [DriverService],
  controllers: [DriverController],
  imports: [TypeOrmModule.forFeature([Driver, DriverSaldo])],
  exports: [DriverService],
})
export class DriverModule {}
