import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { UpdateGpsDto } from './dto/update-gps.dto';
import { GpsQueryDto } from './dto/gps-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('locations')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  getFleetLocations(@Query() query: GpsQueryDto) {
    return this.monitoringService.getFleetLocations(query);
  }

  @Get('locations/:vehicleId')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  getVehicleLocation(@Param('vehicleId') vehicleId: string) {
    return this.monitoringService.getVehicleLocation(vehicleId);
  }

  @Get('locations/:vehicleId/history')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  getLocationHistory(
    @Param('vehicleId') vehicleId: string,
    @Query('limit') limit?: string,
  ) {
    return this.monitoringService.getLocationHistory(
      vehicleId,
      limit ? Number(limit) : 50,
    );
  }

  @Post('locations')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  updateLocation(@Body() dto: UpdateGpsDto) {
    return this.monitoringService.updateLocation(dto);
  }

  @Get('tasks')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  getTasks() {
    return this.monitoringService.getTasks();
  }

  @Get('tasks/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  getTaskById(@Param('id') id: string) {
    return this.monitoringService.getTaskById(id);
  }

  @Put('vehicles/:id/status')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  updateVehicleStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.monitoringService.updateVehicleStatus(id, status);
  }
}
