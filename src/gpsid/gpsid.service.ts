import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
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

export interface GpsidAlert {
  imei: string;
  lat: number;
  lon: number;
  speed: number;
  time: string;
  alert: number;
  alert_text: string;
  ref_alert: {
    alert_no: number;
    description: string;
  } | null;
  gps: {
    imei: string;
    plate: string;
    device_name: string;
  } | null;
}

export interface GpsidAlertResponse {
  status: boolean;
  message: {
    total: number;
    data: GpsidAlert[];
  };
}

export interface GpsidAlertCode {
  value: number;
  label: string;
}

export interface GpsidAlertCodeResponse {
  status: boolean;
  message: {
    total?: number;
    data: GpsidAlertCode[];
  };
}

export interface GpsidAlertQuery {
  /** YYYY-MM-DD atau YYYY-MM-DD HH:mm:ss (default: hari ini 00:00:00) */
  start?: string;
  /** YYYY-MM-DD atau YYYY-MM-DD HH:mm:ss (default: sekarang) */
  end?: string;
  /** Daftar IMEI. Kosong = semua kendaraan. */
  devices?: string[];
  forceRefresh?: boolean;
}

@Injectable()
export class GpsidService implements OnModuleInit {
  private readonly logger = new Logger(GpsidService.name);
  private token: string | null = null;
  private tokenInflight: Promise<string> | null = null;

  // Rate limit GPSID /vehicle: 5 attempts / 5 minutes
  private static readonly VEHICLE_CACHE_TTL_MS = 4 * 60 * 1000; // 4 menit
  private vehicleCache: {
    data: GpsidVehicleResponse;
    expiresAt: number;
  } | null = null;
  private vehicleInflight: Promise<GpsidVehicleResponse> | null = null;
  private lastVehicleFetchAt = 0;
  private static readonly VEHICLE_MIN_INTERVAL_MS = 30 * 1000; // min 30 dtk antar fetch asli

  // GPSID /alert/alert_data: maksimal rentang 7 hari per request
  private static readonly ALERT_CACHE_TTL_MS = 60 * 1000; // 1 menit
  private static readonly ALERT_MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 - 1000;
  private static readonly ALERT_CONCURRENCY = 4;
  private static readonly ALERT_CACHE_MAX_ENTRIES = 500;
  private alertCache = new Map<
    string,
    { data: GpsidAlertResponse; expiresAt: number }
  >();
  private alertInflight = new Map<string, Promise<GpsidAlertResponse>>();

  // Referensi kode alert (jarang berubah) → cache lebih lama
  private static readonly ALERT_CODE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam
  private alertCodeCache: {
    data: GpsidAlertCodeResponse;
    expiresAt: number;
  } | null = null;
  private alertCodeInflight: Promise<GpsidAlertCodeResponse> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      await this.refreshToken();
      this.logger.log('GPSID token fetched on startup');
    } catch (error) {
      this.logger.error(
        'Failed to fetch GPSID token on startup',
        error.message,
      );
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

    // Hindari login bersamaan (rate limit GPSID)
    if (!this.tokenInflight) {
      this.tokenInflight = this.refreshToken().finally(() => {
        this.tokenInflight = null;
      });
    }

    return this.tokenInflight;
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
      throw new Error(
        `GPSID login failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    const data: GpsidLoginResponse = await response.json();

    if (!data.status || !data.message?.data?.token) {
      throw new Error('GPSID token not found in response');
    }

    this.token = data.message.data.token;

    this.logger.log(
      `GPSID token refreshed for user: ${data.message.data.username}`,
    );

    return this.token;
  }

  async fetchVehicles(options?: {
    forceRefresh?: boolean;
  }): Promise<GpsidVehicleResponse> {
    const now = Date.now();
    const force = options?.forceRefresh === true;

    // 1. Serve dari cache jika masih valid
    if (!force && this.vehicleCache && this.vehicleCache.expiresAt > now) {
      this.logger.debug('Serving GPSID vehicles from cache');
      return this.vehicleCache.data;
    }

    // 2. Single-flight: jika ada request sedang berjalan, pinjam promise-nya
    if (this.vehicleInflight) {
      return this.vehicleInflight;
    }

    // 3. Throttle: jangan tembak API lebih sering dari interval minimum
    if (
      !force &&
      this.lastVehicleFetchAt > 0 &&
      now - this.lastVehicleFetchAt < GpsidService.VEHICLE_MIN_INTERVAL_MS
    ) {
      if (this.vehicleCache) {
        this.logger.warn('GPSID vehicle fetch throttled, serving stale cache');
        return this.vehicleCache.data;
      }
    }

    this.vehicleInflight = this.doFetchVehicles()
      .then((data) => {
        this.vehicleCache = {
          data,
          expiresAt: Date.now() + GpsidService.VEHICLE_CACHE_TTL_MS,
        };
        return data;
      })
      .finally(() => {
        this.vehicleInflight = null;
      });

    return this.vehicleInflight;
  }

  private async doFetchVehicles(): Promise<GpsidVehicleResponse> {
    const token = await this.getToken();
    const url = 'https://portal.gps.id/backend/seen/public/vehicle';

    this.lastVehicleFetchAt = Date.now();
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

      // Rate limited / server error → fallback ke cache lama bila ada
      if (this.vehicleCache) {
        this.logger.warn(
          `GPSID vehicle fetch failed (${response.status}), serving stale cache: ${text}`,
        );
        return this.vehicleCache.data;
      }

      throw new Error(
        `GPSID vehicle fetch failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    const data: GpsidVehicleResponse = await response.json();
    this.logger.log(`Fetched ${data.message?.total ?? 0} vehicles from GPSID`);

    return data;
  }

  /**
   * Ambil data alert GPSID.
   * - Tanpa `devices`: diambil untuk semua kendaraan (IMEI dari data /vehicle).
   * - Rentang > 7 hari otomatis dipecah karena GPSID membatasi 7 hari per request.
   */
  async fetchAlerts(query: GpsidAlertQuery = {}): Promise<GpsidAlertResponse> {
    const endDate = query.end
      ? this.parseGpsidDate(query.end, true)
      : new Date();
    const startDate = query.start
      ? this.parseGpsidDate(query.start, false)
      : this.startOfDay(endDate);

    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('start harus lebih awal dari end');
    }

    let devices = (query.devices ?? [])
      .map((device) => device.trim())
      .filter((device) => device.length > 0);

    if (devices.length === 0) {
      const vehicles = await this.fetchVehicles();
      devices = (vehicles.message?.data ?? []).map((vehicle) => vehicle.imei);
    }

    if (devices.length === 0) {
      return { status: true, message: { total: 0, data: [] } };
    }

    const windows = this.splitIntoWindows(startDate, endDate);
    const jobs: Array<{ imei: string; start: string; end: string }> = [];

    for (const device of devices) {
      for (const window of windows) {
        jobs.push({
          imei: device,
          start: this.formatGpsidDate(window.start),
          end: this.formatGpsidDate(window.end),
        });
      }
    }

    const results = await this.mapWithConcurrency(
      jobs,
      GpsidService.ALERT_CONCURRENCY,
      (job) =>
        this.fetchAlertChunk(
          job.imei,
          job.start,
          job.end,
          query.forceRefresh === true,
        ),
    );

    const merged = new Map<string, GpsidAlert>();
    let failed = 0;
    let lastError: Error | null = null;

    for (const result of results) {
      if (result.status === 'rejected') {
        failed += 1;
        lastError = result.reason as Error;
        continue;
      }

      for (const alert of result.value.message?.data ?? []) {
        merged.set(`${alert.imei}|${alert.time}|${alert.alert}`, alert);
      }
    }

    if (results.length > 0 && failed === results.length && lastError) {
      throw new BadGatewayException(
        `Gagal mengambil data alert dari GPSID: ${lastError.message}`,
      );
    }

    if (failed > 0) {
      this.logger.warn(
        `GPSID alert: ${failed}/${results.length} request gagal`,
      );
    }

    const data = Array.from(merged.values()).sort((a, b) =>
      b.time.localeCompare(a.time),
    );

    return { status: true, message: { total: data.length, data } };
  }

  private async fetchAlertChunk(
    imei: string,
    start: string,
    end: string,
    forceRefresh: boolean,
  ): Promise<GpsidAlertResponse> {
    const key = `${imei}|${start}|${end}`;
    const now = Date.now();
    const cached = this.alertCache.get(key);

    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    const inflight = this.alertInflight.get(key);
    if (inflight) {
      return inflight;
    }

    const promise = this.doFetchAlerts(imei, start, end)
      .then((data) => {
        this.putAlertCache(key, data);
        return data;
      })
      .catch((error: Error) => {
        // Fallback ke cache lama bila GPSID menolak / rate limit
        if (cached) {
          this.logger.warn(
            `GPSID alert fetch gagal untuk ${imei}, memakai cache lama: ${error.message}`,
          );
          return cached.data;
        }
        throw error;
      })
      .finally(() => {
        this.alertInflight.delete(key);
      });

    this.alertInflight.set(key, promise);
    return promise;
  }

  private putAlertCache(key: string, data: GpsidAlertResponse) {
    const now = Date.now();

    if (this.alertCache.size >= GpsidService.ALERT_CACHE_MAX_ENTRIES) {
      for (const [cacheKey, entry] of this.alertCache) {
        if (entry.expiresAt <= now) {
          this.alertCache.delete(cacheKey);
        }
      }

      if (this.alertCache.size >= GpsidService.ALERT_CACHE_MAX_ENTRIES) {
        const oldestKey = this.alertCache.keys().next().value;
        if (oldestKey) {
          this.alertCache.delete(oldestKey);
        }
      }
    }

    this.alertCache.set(key, {
      data,
      expiresAt: now + GpsidService.ALERT_CACHE_TTL_MS,
    });
  }

  private async doFetchAlerts(
    imei: string,
    start: string,
    end: string,
    retryOnUnauthorized = true,
  ): Promise<GpsidAlertResponse> {
    const token = await this.getToken();
    const url = new URL(
      'https://portal.gps.id/backend/seen/public/alert/alert_data',
    );
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    url.searchParams.set('device', imei);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Token kadaluarsa → refresh sekali lalu ulangi
    if (response.status === 401 && retryOnUnauthorized) {
      this.logger.warn('GPSID alert: token ditolak, refresh token...');
      await this.refreshToken();
      return this.doFetchAlerts(imei, start, end, false);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GPSID alert fetch failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    const data = (await response.json()) as GpsidAlertResponse;

    if (!data.status) {
      throw new Error(
        `GPSID alert fetch failed: ${JSON.stringify(data.message)}`,
      );
    }

    return data;
  }

  private parseGpsidDate(value: string, endOfDay: boolean): Date {
    const raw = value.trim();
    let date: Date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      date = new Date(`${raw}T${endOfDay ? '23:59:59' : '00:00:00'}`);
    } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
      const normalized = raw.replace(' ', 'T');
      const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
        ? `${normalized}:00`
        : normalized;
      date = new Date(withSeconds);
    } else {
      date = new Date(raw);
    }

    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        `Format tanggal tidak valid: "${value}". Gunakan YYYY-MM-DD atau YYYY-MM-DD HH:mm:ss`,
      );
    }

    return date;
  }

  private formatGpsidDate(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private splitIntoWindows(
    start: Date,
    end: Date,
  ): Array<{ start: Date; end: Date }> {
    const windows: Array<{ start: Date; end: Date }> = [];
    const endMs = end.getTime();
    let cursor = start.getTime();

    while (cursor <= endMs) {
      const windowEnd = Math.min(
        cursor + GpsidService.ALERT_MAX_WINDOW_MS,
        endMs,
      );
      windows.push({ start: new Date(cursor), end: new Date(windowEnd) });
      cursor = windowEnd + 1000;
    }

    return windows;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>,
  ): Promise<Array<PromiseSettledResult<R>>> {
    const results: Array<PromiseSettledResult<R>> = new Array(items.length);
    let cursor = 0;

    const runners = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (true) {
          const index = cursor++;
          if (index >= items.length) {
            return;
          }

          try {
            results[index] = {
              status: 'fulfilled',
              value: await worker(items[index]),
            };
          } catch (reason) {
            results[index] = { status: 'rejected', reason };
          }
        }
      },
    );

    await Promise.all(runners);
    return results;
  }

  /** Daftar kode alert GPSID (referensi value → label). */
  async fetchAlertCodes(options?: {
    forceRefresh?: boolean;
  }): Promise<GpsidAlertCodeResponse> {
    const now = Date.now();
    const force = options?.forceRefresh === true;

    if (
      !force &&
      this.alertCodeCache &&
      this.alertCodeCache.expiresAt > now
    ) {
      return this.alertCodeCache.data;
    }

    if (this.alertCodeInflight) {
      return this.alertCodeInflight;
    }

    this.alertCodeInflight = this.doFetchAlertCodes()
      .then((data) => {
        const response: GpsidAlertCodeResponse = {
          ...data,
          message: {
            ...data.message,
            total: data.message?.data?.length ?? 0,
          },
        };

        this.alertCodeCache = {
          data: response,
          expiresAt: Date.now() + GpsidService.ALERT_CODE_CACHE_TTL_MS,
        };

        return response;
      })
      .catch((error: Error) => {
        if (this.alertCodeCache) {
          this.logger.warn(
            `GPSID alert code fetch gagal, memakai cache lama: ${error.message}`,
          );
          return this.alertCodeCache.data;
        }
        throw error;
      })
      .finally(() => {
        this.alertCodeInflight = null;
      });

    return this.alertCodeInflight;
  }

  private async doFetchAlertCodes(
    retryOnUnauthorized = true,
  ): Promise<GpsidAlertCodeResponse> {
    const token = await this.getToken();
    const url =
      'https://portal.gps.id/backend/seen/public/ref_alert/alert_code_list';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Token kadaluarsa → refresh sekali lalu ulangi
    if (response.status === 401 && retryOnUnauthorized) {
      this.logger.warn('GPSID alert code: token ditolak, refresh token...');
      await this.refreshToken();
      return this.doFetchAlertCodes(false);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GPSID alert code fetch failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    const data = (await response.json()) as GpsidAlertCodeResponse;

    if (!data.status) {
      throw new Error(
        `GPSID alert code fetch failed: ${JSON.stringify(data.message)}`,
      );
    }

    return data;
  }

  /** Bust cache (mis. setelah data GPSID diubah dari sisi lain). */
  invalidateVehicleCache() {
    this.vehicleCache = null;
    this.lastVehicleFetchAt = 0;
  }

  /** Bust cache alert. */
  invalidateAlertCache() {
    this.alertCache.clear();
  }

  /** Bust cache kode alert. */
  invalidateAlertCodeCache() {
    this.alertCodeCache = null;
  }
}
