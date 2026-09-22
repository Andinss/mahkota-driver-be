import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DriverModule } from './drivers/driver.module';
import { FinancesModule } from './finances/finances.module';
import { RentalsModule } from './rentals/rentals.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { RoleModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SupervisorModule } from './supervisor/supervisor.module';
import { VehicleAssignmentService } from './vehicle-assignment/vehicle-assignment.service';
import { VehicleAssignmentController } from './vehicle-assignment/vehicle-assignment.controller';
import { VehicleAssignmentModule } from './vehicle-assignment/vehicle-assignment.module';
import { FieldOfficerModule } from './field-officer/field-officer.module';
import { LatePaymentsModule } from './late-payments/late-payments.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { KoinModule } from './koin/koin.module';
import { GpsidModule } from './gpsid/gpsid.module';
import { VendorVehicleModule } from './vendor-vehicle/vendor-vehicle.module';
import { DailyPaymentsModule } from './daily-payments/daily-payments.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 30,
    }]),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      autoLoadEntities: true,
      synchronize: true,
    }),

    UsersModule,
    AuthModule,
    DriverModule,
    FinancesModule,
    RentalsModule,
    VehiclesModule,
    RoleModule,
    PermissionsModule,
    FieldOfficerModule,
    SupervisorModule,
    VehicleAssignmentModule,
    LatePaymentsModule,
    SettingsModule,
    AuditModule,
    MonitoringModule,
    KoinModule,
    VendorVehicleModule,
    GpsidModule,
    DailyPaymentsModule,
  ],
  controllers: [AppController, VehicleAssignmentController],
  providers: [AppService, VehicleAssignmentService, {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  }],
})
export class AppModule {}
