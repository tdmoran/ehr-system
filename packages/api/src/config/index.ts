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
};
