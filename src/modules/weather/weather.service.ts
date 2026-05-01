import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenWeatherClient } from './openweather.client';
import { WeatherRecommendationEngine } from './weather-recommendation.engine';
import { RedisService } from '../../redis/redis.service';
import {
  WeatherFullResponse,
  CuacaSekarangResponse,
  PrakiraanHarianResponse,
  PrakiraanPerJamResponse,
} from './dto/weather.dto';

/** Indonesian day names (ISO weekday: 0=Sunday) */
const HARI_INDONESIA = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

/**
 * WeatherService — orchestrates OpenWeather API calls, caching,
 * data transformation, and recommendation generation.
 *
 * Cache strategy:
 * - Primary: Redis (15 min TTL)
 * - Fallback: in-memory Map (for when Redis is unavailable)
 * - Cache key: `weather:{lat}:{lon}` (rounded to 2 decimal places)
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cacheTtlMs: number;
  private readonly memoryCache = new Map<string, { data: WeatherFullResponse; expiresAt: number }>();

  constructor(
    private readonly openWeatherClient: OpenWeatherClient,
    private readonly recommendationEngine: WeatherRecommendationEngine,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Default 15 minutes, configurable
    this.cacheTtlMs =
      this.configService.get<number>('openWeather.cacheTtlMinutes', 15) * 60 * 1000;
  }

  /**
   * Main entry point — get full weather data for coordinates.
   */
  async getWeatherForCoordinates(
    lat: number,
    lon: number,
    locationName: string,
    sawahId?: string,
  ): Promise<WeatherFullResponse> {
    if (!this.openWeatherClient.isConfigured()) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'WEATHER_API_NOT_CONFIGURED',
            message: 'OpenWeather API key is not configured',
            userMessage: 'Layanan cuaca belum dikonfigurasi. Hubungi admin.',
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Round coordinates for cache key consistency
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const cacheKey = `weather:${roundedLat}:${roundedLon}`;

    // Try cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      // Update location name in case it changed
      cached.lokasi.nama = locationName;
      if (sawahId) cached.lokasi.sawah_id = sawahId;
      return cached;
    }

    // Fetch from OpenWeather
    this.logger.debug(`Cache miss: ${cacheKey}, fetching from API`);

    try {
      const [currentData, forecastData] = await Promise.all([
        this.openWeatherClient.getCurrentWeather(lat, lon),
        this.openWeatherClient.getForecast(lat, lon),
      ]);

      const cuacaSekarang = this.mapCurrentWeather(currentData);
      const { harian, perJam } = this.mapForecast(forecastData);
      const rekomendasi = this.recommendationEngine.generateRecommendations(
        cuacaSekarang,
        harian,
      );

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.cacheTtlMs);

      const result: WeatherFullResponse = {
        lokasi: {
          nama: locationName,
          latitude: lat,
          longitude: lon,
          ...(sawahId ? { sawah_id: sawahId } : {}),
        },
        cuaca_sekarang: cuacaSekarang,
        prakiraan_harian: harian,
        prakiraan_per_jam: perJam.slice(0, 12), // Next 12 entries (36 hours)
        alerts: [], // Free tier doesn't include alerts; can be added with One Call 3.0
        rekomendasi,
        cache: {
          dari_cache: false,
          diperbarui_pada: now.toISOString(),
          kadaluarsa_pada: expiresAt.toISOString(),
        },
      };

      // Store in cache
      await this.setCache(cacheKey, result);

      return result;
    } catch (error: any) {
      this.logger.error(
        `OpenWeather API error: ${error?.response?.status || error?.message}`,
      );

      if (error?.response?.status === 401) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'WEATHER_API_UNAUTHORIZED',
              message: 'Invalid OpenWeather API key',
              userMessage: 'API cuaca tidak valid. Hubungi admin.',
              statusCode: HttpStatus.BAD_GATEWAY,
            },
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (error?.response?.status === 429) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'WEATHER_RATE_LIMITED',
              message: 'OpenWeather rate limit exceeded',
              userMessage: 'Terlalu banyak permintaan cuaca. Coba lagi nanti.',
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new HttpException(
        {
          success: false,
          error: {
            code: 'WEATHER_FETCH_FAILED',
            message: `Failed to fetch weather: ${error?.message}`,
            userMessage: 'Gagal mengambil data cuaca. Coba lagi nanti.',
            statusCode: HttpStatus.BAD_GATEWAY,
          },
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ─── Data mappers ──────────────────────────────────────────

  private mapCurrentWeather(data: any): CuacaSekarangResponse {
    const weather = data.weather?.[0] || {};
    const timezoneOffset = data.timezone || 0;

    return {
      suhu: Math.round((data.main?.temp ?? 0) * 10) / 10,
      terasa_seperti: Math.round((data.main?.feels_like ?? 0) * 10) / 10,
      kelembapan: data.main?.humidity ?? 0,
      tekanan_udara: data.main?.pressure ?? 0,
      kondisi: weather.main || 'Unknown',
      deskripsi: weather.description || '',
      ikon: weather.icon
        ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
        : '',
      angin: {
        kecepatan: Math.round((data.wind?.speed ?? 0) * 10) / 10,
        arah_derajat: data.wind?.deg ?? 0,
        hembusan: data.wind?.gust
          ? Math.round(data.wind.gust * 10) / 10
          : undefined,
      },
      // Current Weather API doesn't provide UV index (only One Call 3.0 does)
      // We set null and the recommendation engine handles it gracefully
      uv_index: null,
      jarak_pandang: data.visibility ?? 10000,
      awan: data.clouds?.all ?? 0,
      curah_hujan_1jam: data.rain?.['1h'] ?? undefined,
      sunrise: this.formatUnixTime(data.sys?.sunrise, timezoneOffset),
      sunset: this.formatUnixTime(data.sys?.sunset, timezoneOffset),
    };
  }

  private mapForecast(data: any): {
    harian: PrakiraanHarianResponse[];
    perJam: PrakiraanPerJamResponse[];
  } {
    const list: any[] = data.list || [];
    const timezoneOffset = data.city?.timezone || 0;

    // ─── Per-jam (hourly from 3-hour steps) ─────────────
    const perJam: PrakiraanPerJamResponse[] = list.map((item: any) => {
      const weather = item.weather?.[0] || {};
      return {
        waktu: this.formatUnixTime(item.dt, timezoneOffset),
        suhu: Math.round((item.main?.temp ?? 0) * 10) / 10,
        kelembapan: item.main?.humidity ?? 0,
        kondisi: weather.description || '',
        peluang_hujan: Math.round((item.pop ?? 0) * 100),
        angin: Math.round((item.wind?.speed ?? 0) * 10) / 10,
      };
    });

    // ─── Aggregate to daily ─────────────────────────────
    const dailyMap = new Map<string, any[]>();
    for (const item of list) {
      const date = new Date((item.dt + timezoneOffset) * 1000);
      const dateKey = date.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      dailyMap.get(dateKey)!.push(item);
    }

    const harian: PrakiraanHarianResponse[] = [];
    let dayIndex = 0;

    for (const [dateKey, items] of dailyMap) {
      if (dayIndex >= 5) break; // Max 5 days

      const temps = items.map((i: any) => i.main?.temp ?? 0);
      const humidities = items.map((i: any) => i.main?.humidity ?? 0);
      const winds = items.map((i: any) => i.wind?.speed ?? 0);
      const pops = items.map((i: any) => i.pop ?? 0);
      const rains = items
        .map((i: any) => i.rain?.['3h'] ?? 0)
        .reduce((a: number, b: number) => a + b, 0);

      // Pick the most common weather condition
      const weatherMain = items[Math.floor(items.length / 2)]?.weather?.[0] || {};
      const dateObj = new Date(dateKey + 'T12:00:00Z');
      const dayOfWeek = dateObj.getUTCDay();

      let hariLabel: string;
      if (dayIndex === 0) {
        hariLabel = 'Hari Ini';
      } else if (dayIndex === 1) {
        hariLabel = 'Besok';
      } else {
        hariLabel = HARI_INDONESIA[dayOfWeek] || dateKey;
      }

      harian.push({
        tanggal: dateKey,
        hari: hariLabel,
        kondisi: weatherMain.main || 'Unknown',
        deskripsi: weatherMain.description || '',
        ikon: weatherMain.icon
          ? `https://openweathermap.org/img/wn/${weatherMain.icon}@2x.png`
          : '',
        suhu_min: Math.round(Math.min(...temps) * 10) / 10,
        suhu_max: Math.round(Math.max(...temps) * 10) / 10,
        kelembapan: Math.round(
          humidities.reduce((a: number, b: number) => a + b, 0) / humidities.length,
        ),
        angin: Math.round(Math.max(...winds) * 10) / 10,
        peluang_hujan: Math.round(Math.max(...pops) * 100),
        curah_hujan: rains > 0 ? Math.round(rains * 10) / 10 : undefined,
      });

      dayIndex++;
    }

    return { harian, perJam };
  }

  // ─── Cache layer ───────────────────────────────────────────

  private async getFromCache(key: string): Promise<WeatherFullResponse | null> {
    // Try Redis first
    try {
      const redisData = await this.redisService.get(key);
      if (redisData) {
        const parsed = JSON.parse(redisData) as WeatherFullResponse;
        parsed.cache.dari_cache = true;
        return parsed;
      }
    } catch {
      // Redis unavailable, fall through to memory cache
    }

    // Try in-memory cache
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      const result = { ...memEntry.data };
      result.cache = { ...result.cache, dari_cache: true };
      return result;
    }

    // Cleanup expired entry
    if (memEntry) {
      this.memoryCache.delete(key);
    }

    return null;
  }

  private async setCache(
    key: string,
    data: WeatherFullResponse,
  ): Promise<void> {
    const ttlSeconds = Math.floor(this.cacheTtlMs / 1000);

    // Try Redis
    try {
      await this.redisService.set(key, JSON.stringify(data), ttlSeconds);
    } catch {
      // Redis unavailable, use memory cache only
    }

    // Always set in-memory cache as fallback
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    // Cleanup old entries (max 100 locations cached in memory)
    if (this.memoryCache.size > 100) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private formatUnixTime(unix: number | undefined, timezoneOffset: number): string {
    if (!unix) return '';
    const date = new Date((unix + timezoneOffset) * 1000);
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }
}
