import { Controller, Get } from '@nestjs/common';
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
  async getVehicles() {
    return this.gpsidService.fetchVehicles();
  }

  @Get('refresh')
  async refresh() {
    const token = await this.gpsidService.refreshToken();
    return {
      status: true,
      message: { data: { token } },
    };
  }
}
