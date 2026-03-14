/**
 * Require an environment variable in production.
 * Falls back to defaultValue in non-production environments.
 */
function requireEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return defaultValue;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://ehr:ehr@localhost:5432/ehr',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  },
  jwt: {
    secret: requireEnv('JWT_SECRET', 'dev-secret-change-in-production'),
    expiresIn: '8h',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  uploads: {
    maxFileSizeMb: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '20', 10),
    allowedMimeTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'application/pdf,image/jpeg,image/png,image/tiff').split(','),
  },
  rateLimit: {
    authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10),
    authMaxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10),
  },
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),
  aiTranscription: {
    apiBaseUrl: process.env.HEIDI_API_BASE_URL || '',
    apiKey: process.env.HEIDI_API_KEY || '',
    enabled: process.env.HEIDI_ENABLED === 'true',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
};

/**
 * Validate that required API keys for transcription services are present.
 * Logs warnings for missing keys but does not throw — services degrade gracefully.
 */
export function validateTranscriptionEnv(): void {
  const warnings: string[] = [];

  if (!process.env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY is not set — Whisper speech-to-text will be unavailable');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY is not set — AI note generation will be unavailable');
  }

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    warnings.push('No AI API keys configured — transcription will run in offline/fallback mode');
  }

  for (const warning of warnings) {
    console.warn(`[CONFIG] ${warning}`);
  }
}
