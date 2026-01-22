export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://ehr:ehr@localhost:5432/ehr',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: '8h',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
};
