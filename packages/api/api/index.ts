import express from 'express';
import cors from 'cors';

const app = express();

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin,
  credentials: true,
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Rooms API', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // For now, simple validation
  if (email === 'drmoran@example.com' && password === 'password123') {
    res.json({
      user: {
        id: 'a0000000-0000-0000-0000-000000000002',
        email: 'drmoran@example.com',
        firstName: 'Tom',
        lastName: 'Moran',
        role: 'provider'
      },
      token: 'demo-token-12345'
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    id: 'a0000000-0000-0000-0000-000000000002',
    email: 'drmoran@example.com',
    firstName: 'Tom',
    lastName: 'Moran',
    role: 'provider'
  });
});

export default app;
