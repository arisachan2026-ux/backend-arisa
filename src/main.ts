import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';

// Global filters & interceptors
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Security ────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ────────────────────────────────────────────────────
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.CORS_ORIGINS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : true, // Allow all in development
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ── Global Prefix ───────────────────────────────────────────
  // Exclude health endpoints from prefix (they must be at root)
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });

  // ── Validation ──────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Global Filters & Interceptors ──────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ── Swagger ─────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('ARISA Cloud Backend API')
    .setDescription(
      'Cloud backend API for the ARISA hybrid IoT agricultural system. ' +
        'Provides authentication, device management, data sync, AI gateway, ' +
        'and monitoring capabilities.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT access token for user authentication',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Device-Token',
        description: 'Device authentication token for Raspberry Pi',
      },
      'device-token',
    )
    .addTag('Health', 'System health and readiness checks')
    .addTag('Auth', 'User authentication and session management')
    .addTag('Users', 'User profile management')
    .addTag('Devices', 'Device registration, pairing, and management')
    .addTag('Sync', 'Data synchronization between edge and cloud')
    .addTag('Data', 'Core data CRUD operations')
    .addTag('Telemetry', 'Device telemetry data')
    .addTag('AI', 'AI gateway for analysis and chat')
    .addTag('Notifications', 'In-app notification management')
    .addTag('Admin', 'Admin dashboard and management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ── Start ───────────────────────────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`\n🚀 ARISA Cloud Backend running on port ${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`❤️  Health check: http://localhost:${port}/health\n`);
}

bootstrap();
