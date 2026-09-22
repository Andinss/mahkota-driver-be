import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';
import { VendorVehicle } from '../vendor-vehicle/entities/vendor-vehicle.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GpsidModule } from '../gpsid/gpsid.module';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService],
  imports: [TypeOrmModule.forFeature([Vehicle, VendorVehicle]), GpsidModule],
  exports: [VehiclesService],
})
export class VehiclesModule {}
