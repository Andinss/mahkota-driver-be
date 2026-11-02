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

  /**
   * GET /api/gpsid/alert
   * Query:
   * - start  : YYYY-MM-DD atau "YYYY-MM-DD HH:mm:ss" (default hari ini 00:00:00)
   * - end    : YYYY-MM-DD atau "YYYY-MM-DD HH:mm:ss" (default sekarang)
   * - device : IMEI, boleh dipisah koma / diulang (default semua kendaraan)
   * - refresh: 1/true untuk bypass cache
   */
  @Get('alert')
  async getAlerts(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('device') device?: string | string[],
    @Query('refresh') refresh?: string,
  ) {
    const deviceParam = Array.isArray(device) ? device.join(',') : device;
    const devices = (deviceParam ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return this.gpsidService.fetchAlerts({
      start,
      end,
      devices,
      forceRefresh: refresh === '1' || refresh === 'true',
    });
  }

  /**
   * GET /api/gpsid/alert-code
   * Referensi kode alert GPSID (value → label).
   * Query: refresh=1/true untuk bypass cache.
   */
  @Get('alert-code')
  async getAlertCodes(@Query('refresh') refresh?: string) {
    return this.gpsidService.fetchAlertCodes({
      forceRefresh: refresh === '1' || refresh === 'true',
    });
  }

  @Get('refresh')
  async refresh() {
    const token = await this.gpsidService.refreshToken();
    this.gpsidService.invalidateVehicleCache();
    this.gpsidService.invalidateAlertCache();
    this.gpsidService.invalidateAlertCodeCache();
    return {
      status: true,
      message: { data: { token } },
    };
  }
}
