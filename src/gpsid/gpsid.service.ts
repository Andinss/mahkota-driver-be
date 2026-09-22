import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { OnModuleInit } from '@nestjs/common';

interface GpsidLoginResponse {
  status: boolean;
  message: {
    data: {
      username: string;
      fullname: string;
      email: string;
      phone: string;
      token: string;
    };
  };
}

export interface GpsidVehicle {
  imei: string;
  owner: string;
  device_name: string;
  plate: string;
  gsm_no: string;
  activation_time: string;
  expired_gsm: string;
  gps_type: string;
  vehicle_type: string;
  nomesin: string | null;
  norangka: string | null;
  acc: string;
  longitude: string;
  latitude: string;
  angle: number;
  altitude: string | null;
  speed: number;
  mileage: number;
  address: string | null;
  door: string;
  temperature: string | null;
  last_positioning: string;
  last_update: string;
  satellite: number;
  gsm_signal: number;
  battery: string;
  accu: number;
}

export interface GpsidVehicleResponse {
  status: boolean;
  message: {
    total: number;
    data: GpsidVehicle[];
  };
}

@Injectable()
export class GpsidService implements OnModuleInit {
  private readonly logger = new Logger(GpsidService.name);
  private token: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      await this.refreshToken();
      this.logger.log('GPSID token fetched on startup');
    } catch (error) {
      this.logger.error('Failed to fetch GPSID token on startup', error.message);
    }
  }

  @Cron('58 23 * * *')
  async handleTokenRefresh() {
    this.logger.log('Cron: refreshing GPSID token at 23:58...');
    try {
      await this.refreshToken();
      this.logger.log('Cron: GPSID token refreshed successfully');
    } catch (error) {
      this.logger.error('Cron: failed to refresh GPSID token', error.message);
    }
  }

  async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    return this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    const username = this.configService.get<string>('GPSID_USERNAME');
    const password = this.configService.get<string>('GPSID_PASSWORD');

    if (!username || !password) {
      throw new Error('GPSID credentials not configured');
    }

    const url = 'https://portal.gps.id/backend/seen/public/login';

    this.logger.log('Requesting new GPSID token...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GPSID login failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data: GpsidLoginResponse = await response.json();

    if (!data.status || !data.message?.data?.token) {
      throw new Error('GPSID token not found in response');
    }

    this.token = data.message.data.token;

    this.logger.log(`GPSID token refreshed for user: ${data.message.data.username}`);

    return this.token;
  }

  async fetchVehicles(): Promise<GpsidVehicleResponse> {
    const token = await this.getToken();
    const url = 'https://portal.gps.id/backend/seen/public/vehicle';

    this.logger.log('Fetching vehicles from GPSID...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GPSID vehicle fetch failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data: GpsidVehicleResponse = await response.json();
    this.logger.log(`Fetched ${data.message?.total ?? 0} vehicles from GPSID`);

    return data;
  }
}
