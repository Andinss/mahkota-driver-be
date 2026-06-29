import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

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
  ],
  controllers: [AppController, VehicleAssignmentController],
  providers: [AppService, VehicleAssignmentService],
})
export class AppModule {}
