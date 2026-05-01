import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password', '');

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy(times: number) {
          if (times > 5) {
            return null; // Stop retrying after 5 attempts
          }
          return Math.min(times * 1000, 5000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Redis connected at ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis unavailable: ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      // Try to connect but don't block startup
      await this.client.connect().catch((err) => {
        this.logger.warn(
          `Redis not available at ${host}:${port} — running without cache. Error: ${err.message}`,
        );
      });
    } catch (error) {
      this.logger.warn('Redis initialization failed — running without cache');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.logger.log('Redis connection closed');
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async ping(): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client || !this.isConnected) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }
}
