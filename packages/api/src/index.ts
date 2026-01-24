import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();

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
    } else {
      callback(null, true); // Allow all for now, tighten later if needed
    }
  },
  credentials: true,
}));

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || config.port;
app.listen(port, () => {
  logger.info(`API server running on port ${port}`);
});

// Export for Vercel
export default app;
