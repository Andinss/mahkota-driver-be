import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { GpsLocation } from './entities/gps-location.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Geofence } from './entities/geofence.entity';
import { Notification } from './entities/notification.entity';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GpsLocation, Vehicle, Geofence, Notification])],
  controllers: [MonitoringController, GeofenceController, NotificationController],
  providers: [MonitoringService, GeofenceService, NotificationService],
  exports: [MonitoringService, GeofenceService, NotificationService],
})
export class MonitoringModule {}
