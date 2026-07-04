import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupervisorController } from './supervisor.controller';
import { SupervisorService } from './supervisor.service';
import { Driver } from '../drivers/entities/driver.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Driver])],
  controllers: [SupervisorController],
  providers: [SupervisorService],
})
export class SupervisorModule {}
