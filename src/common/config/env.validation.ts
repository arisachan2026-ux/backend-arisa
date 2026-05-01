import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Supabase
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  SUPABASE_JWT_SECRET: Joi.string().required(),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // Device Security
  DEVICE_REGISTRATION_SECRET: Joi.string().required().min(20),
  DEVICE_TOKEN_SALT_ROUNDS: Joi.number().default(12),

  // Pairing
  PAIRING_CODE_EXPIRY_MINUTES: Joi.number().default(10),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // OpenRouter AI
  OPENROUTER_API_KEY: Joi.string().required(),
  OPENROUTER_DEFAULT_MODEL: Joi.string().default('google/gemini-2.5-flash'),
  OPENROUTER_FALLBACK_MODEL: Joi.string().default('anthropic/claude-haiku-4.5'),
  OPENROUTER_MAX_TOKENS: Joi.number().default(8192),
  OPENROUTER_TIMEOUT_MS: Joi.number().default(30000),
  AI_USER_RATE_LIMIT_PER_MINUTE: Joi.number().default(10),
  AI_USER_RATE_LIMIT_PER_HOUR: Joi.number().default(100),

  // CORS
  CORS_ORIGINS: Joi.string().default(''),

  // OpenWeather
  OPENWEATHER_API_KEY: Joi.string().default(''),
  OPENWEATHER_CACHE_TTL_MINUTES: Joi.number().default(15),

  // Direct URL for Prisma migrations (bypasses PgBouncer)
  DIRECT_URL: Joi.string().default(''),
});
