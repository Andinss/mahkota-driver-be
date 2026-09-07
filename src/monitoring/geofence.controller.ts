import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('geofences')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  findAll() {
    return this.geofenceService.findAll();
  }

  @Get('active')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  findActive() {
    return this.geofenceService.findActive();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  findById(@Param('id') id: string) {
    return this.geofenceService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  create(@Body() dto: CreateGeofenceDto) {
    return this.geofenceService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  update(@Param('id') id: string, @Body() dto: Partial<CreateGeofenceDto>) {
    return this.geofenceService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  remove(@Param('id') id: string) {
    return this.geofenceService.remove(id);
  }
}
