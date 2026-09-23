import { Controller, Get, Query } from '@nestjs/common';
import { GpsidService } from './gpsid.service';

@Controller('gpsid')
export class GpsidController {
  constructor(private readonly gpsidService: GpsidService) {}

  @Get('token')
  async getToken() {
    const token = await this.gpsidService.getToken();
    return {
      status: true,
      message: { data: { token } },
    };
  }

  @Get('vehicles')
  async getVehicles(@Query('refresh') refresh?: string) {
    const forceRefresh = refresh === '1' || refresh === 'true';
    return this.gpsidService.fetchVehicles({ forceRefresh });
  }

  @Get('refresh')
  async refresh() {
    const token = await this.gpsidService.refreshToken();
    this.gpsidService.invalidateVehicleCache();
    return {
      status: true,
      message: { data: { token } },
    };
  }
}
