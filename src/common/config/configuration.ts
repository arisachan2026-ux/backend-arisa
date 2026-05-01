export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET,
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  security: {
    deviceRegistrationSecret: process.env.DEVICE_REGISTRATION_SECRET,
    deviceTokenSaltRounds: parseInt(
      process.env.DEVICE_TOKEN_SALT_ROUNDS ?? '12',
      10,
    ),
    pairingCodeExpiryMinutes: parseInt(
      process.env.PAIRING_CODE_EXPIRY_MINUTES ?? '10',
      10,
    ),
  },

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultModel:
      process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash',
    fallbackModel:
      process.env.OPENROUTER_FALLBACK_MODEL || 'anthropic/claude-haiku-4.5',
    maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS ?? '8192', 10),
    timeoutMs: parseInt(process.env.OPENROUTER_TIMEOUT_MS ?? '30000', 10),
    userRateLimitPerMinute: parseInt(
      process.env.AI_USER_RATE_LIMIT_PER_MINUTE ?? '10',
      10,
    ),
    userRateLimitPerHour: parseInt(
      process.env.AI_USER_RATE_LIMIT_PER_HOUR ?? '100',
      10,
    ),
    appUrl: process.env.OPENROUTER_APP_URL || 'https://arisa.app',
    appTitle: process.env.OPENROUTER_APP_TITLE || 'ARISA Smart Agriculture',
  },

  openWeather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '',
    cacheTtlMinutes: parseInt(
      process.env.OPENWEATHER_CACHE_TTL_MINUTES ?? '15',
      10,
    ),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
