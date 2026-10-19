import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutOfTownController } from './out-town.controller';
import { OutOfTownService } from './out-town.service';
import { OutOfTownRequest } from './entities/out-of-town-request.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OutOfTownRequest, Driver, Vehicle])],
  controllers: [OutOfTownController],
  providers: [OutOfTownService],
  exports: [OutOfTownService],
})
export class OutTownModule {}
