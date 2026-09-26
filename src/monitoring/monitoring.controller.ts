import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import {
  CreateGpsTrackingDto,
  GpsTrackingQueryDto,
} from './dto/create-gps-tracking.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { PermissionGuard } from '../auth/guards/permission.guard';
// import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  // @UseGuards(JwtAuthGuard, PermissionGuard)
  // @Permissions('monitoring.read')
  findAll(@Query() query: GpsTrackingQueryDto) {
    return this.monitoringService.findAll(query);
  }

  @Get(':id')
  // @UseGuards(JwtAuthGuard, PermissionGuard)
  // @Permissions('monitoring.read')
  findById(@Param('id') id: string) {
    return this.monitoringService.findById(id);
  }

  @Post('create')
  // @UseGuards(JwtAuthGuard, PermissionGuard)
  // @Permissions('monitoring.update')
  create(@Body() dto: CreateGpsTrackingDto) {
    return this.monitoringService.create(dto);
  }

  @Put('vehicles/:id/engine')
  // @UseGuards(JwtAuthGuard, PermissionGuard)
  // @Permissions('monitoring.update')
  updateVehicleEngine(
    @Param('id') id: string,
    @Body('engine_status') engine_status: string,
  ) {
    return this.monitoringService.updateVehicleEngine(id, engine_status);
  }

  @Put('vehicles/:id/status')
  // @UseGuards(JwtAuthGuard, PermissionGuard)
  // @Permissions('monitoring.update')
  updateVehicleStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.monitoringService.updateVehicleStatus(id, status);
  }
}
