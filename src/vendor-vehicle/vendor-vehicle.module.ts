import { Module } from '@nestjs/common';
import { VendorVehicleController } from './vendor-vehicle.controller';
import { VendorVehicleService } from './vendor-vehicle.service';
import { VendorVehicle } from './entities/vendor-vehicle.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [VendorVehicleController],
  providers: [VendorVehicleService],
  imports: [TypeOrmModule.forFeature([VendorVehicle, Vehicle])],
  exports: [VendorVehicleService],
})
export class VendorVehicleModule {}
