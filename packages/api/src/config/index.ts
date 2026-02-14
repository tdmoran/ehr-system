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
  },
  jwt: {
    secret: requireEnv('JWT_SECRET', 'dev-secret-change-in-production'),
    expiresIn: '8h',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
};
