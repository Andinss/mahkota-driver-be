import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import {
  CreateGpsTrackingDto,
  GpsTrackingQueryDto,
} from './dto/create-gps-tracking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

interface AuthedRequest {
  user?: { id?: string };
}

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  findAll(@Query() query: GpsTrackingQueryDto, @Req() req: AuthedRequest) {
    return this.monitoringService.findAll(query, req.user?.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  findById(@Param('id') id: string) {
    return this.monitoringService.findById(id);
  }

  // Route tulis tetap terbuka agar device GPS dapat mengirim data
  // tanpa token (lihat catatan di monitoring.service).
  @Post('create')
  create(@Body() dto: CreateGpsTrackingDto) {
    return this.monitoringService.create(dto);
  }

  @Put('vehicles/:id/engine')
  updateVehicleEngine(
    @Param('id') id: string,
    @Body('engine_status') engine_status: string,
  ) {
    return this.monitoringService.updateVehicleEngine(id, engine_status);
  }

  @Put('vehicles/:id/status')
  updateVehicleStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.monitoringService.updateVehicleStatus(id, status);
  }
}
