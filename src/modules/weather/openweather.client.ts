import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Low-level HTTP client for OpenWeather API.
 *
 * Uses two free-tier endpoints:
 * - Current Weather: /data/2.5/weather (includes sunrise/sunset, rain, wind)
 * - 5-Day Forecast: /data/2.5/forecast (3-hour step, 40 data points)
 *
 * Decision: Not using One Call API 3.0 because it requires
 * a separate paid subscription. The free endpoints above
 * give us everything we need for agricultural monitoring.
 */
@Injectable()
export class OpenWeatherClient {
  private readonly logger = new Logger(OpenWeatherClient.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('openWeather.apiKey', '');

    if (!this.apiKey) {
      this.logger.warn(
        'OPENWEATHER_API_KEY not set — weather endpoints will return errors',
      );
    }
  }

  /**
   * Get current weather for coordinates.
   * Docs: https://openweathermap.org/current
   */
  async getCurrentWeather(lat: number, lon: number): Promise<any> {
    const url = `${this.baseUrl}/weather`;
    const params = {
      lat: lat.toString(),
      lon: lon.toString(),
      appid: this.apiKey,
      units: 'metric',
      lang: 'id', // Bahasa Indonesia
    };

    this.logger.debug(`Fetching current weather: lat=${lat}, lon=${lon}`);

    const response = await firstValueFrom(
      this.httpService.get(url, { params }),
    );

    return response.data;
  }

  /**
   * Get 5-day / 3-hour forecast for coordinates.
   * Returns up to 40 data points (8 per day × 5 days).
   * Docs: https://openweathermap.org/forecast5
   */
  async getForecast(lat: number, lon: number): Promise<any> {
    const url = `${this.baseUrl}/forecast`;
    const params = {
      lat: lat.toString(),
      lon: lon.toString(),
      appid: this.apiKey,
      units: 'metric',
      lang: 'id',
    };

    this.logger.debug(`Fetching forecast: lat=${lat}, lon=${lon}`);

    const response = await firstValueFrom(
      this.httpService.get(url, { params }),
    );

    return response.data;
  }

  /**
   * Check if API key is configured.
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
