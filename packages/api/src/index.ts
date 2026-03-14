import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateTranscriptionEnv } from './config/index.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './errors/index.js';
import { setupTranscriptionWebSocket } from './websocket/transcriptions.js';
import { startCleanupJob } from './jobs/transcription-cleanup.js';

const app = express();

// Security headers
app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      config.cors.origin,
      'https://www.sxrooms.net',
      'https://sxrooms.net',
      'http://localhost:5173',
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (origin.endsWith('.vercel.app')) {
      // Allow Vercel preview deployments for mobile testing
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(config.requestTimeoutMs);
  res.setTimeout(config.requestTimeoutMs, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  next();
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

app.get('/health', async (req, res) => {
  try {
    const { pool } = await import('./db/index.js');
    const result = await pool.query('SELECT 1 as test');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.json({ status: 'ok', db: 'error', dbError: err?.message, timestamp: new Date().toISOString() });
  }
});

app.use('/api', routes);

// Centralized error handler — must be registered after all routes
app.use(errorHandler);

// Validate transcription environment variables
validateTranscriptionEnv();

// Create HTTP server and attach WebSocket
const server = createServer(app);
setupTranscriptionWebSocket(server);

// Start background jobs
startCleanupJob();

// Start server
const port = process.env.PORT || config.port;
server.listen(port, () => {
  logger.info(`API server running on port ${port}`);
});

// Export for Vercel
export default app;
export { server };
