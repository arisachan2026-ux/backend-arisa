import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = configService.get<string>('database.url');

    // Prisma 7 uses pg Pool directly — configure timeouts explicitly
    // (pg Pool defaults to 0 = no timeout, unlike Prisma 6's 5s default)
    const pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000, // 5s — fail fast if DB unreachable
      idleTimeoutMillis: 30000, // 30s — close idle connections
      max: 10, // Max pool size
    });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database connection closed');
  }
}
