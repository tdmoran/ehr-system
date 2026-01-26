import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

// Event schemas
const createEventSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
  notes: z.string().optional(),
});

const createOnCallSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

// Get events for a date range
router.get('/events', async (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const providerId = req.query.providerId as string || (req.user as any).providerId || (req.user as any).id;

    const result = await pool.query(
      `SELECT id, provider_id, event_date, title, notes, created_at
       FROM calendar_events
       WHERE provider_id = $1
       AND event_date >= $2 AND event_date <= $3
       ORDER BY event_date, created_at`,
      [providerId, startDate, endDate]
    );

    res.json({
      events: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        providerId: row.provider_id,
        date: row.event_date,
        title: row.title,
        notes: row.notes,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create event
router.post('/events', validate(createEventSchema), async (req, res) => {
  try {
    const user = req.user as any;
    const providerId = user.providerId || user.id;

    const result = await pool.query(
      `INSERT INTO calendar_events (provider_id, event_date, title, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, provider_id, event_date, title, notes, created_at`,
      [providerId, req.body.eventDate, req.body.title, req.body.notes || null, user.id]
    );

    const row = result.rows[0];
    res.status(201).json({
      event: {
        id: row.id,
        providerId: row.provider_id,
        date: row.event_date,
        title: row.title,
        notes: row.notes,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete event
router.delete('/events/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get on-call periods for a date range
router.get('/oncall', async (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const providerId = req.query.providerId as string || (req.user as any).providerId || (req.user as any).id;

    const result = await pool.query(
      `SELECT id, provider_id, start_date, end_date, notes, created_at
       FROM on_call_periods
       WHERE provider_id = $1
       AND ((start_date >= $2 AND start_date <= $3) OR (end_date >= $2 AND end_date <= $3) OR (start_date <= $2 AND end_date >= $3))
       ORDER BY start_date`,
      [providerId, startDate, endDate]
    );

    res.json({
      onCallPeriods: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        providerId: row.provider_id,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Get on-call periods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create on-call period (providers only)
router.post('/oncall', authorize('provider', 'admin'), validate(createOnCallSchema), async (req, res) => {
  try {
    const user = req.user as any;
    const providerId = user.providerId || user.id;

    const result = await pool.query(
      `INSERT INTO on_call_periods (provider_id, start_date, end_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, provider_id, start_date, end_date, notes, created_at`,
      [providerId, req.body.startDate, req.body.endDate, req.body.notes || null, user.id]
    );

    const row = result.rows[0];
    res.status(201).json({
      onCallPeriod: {
        id: row.id,
        providerId: row.provider_id,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error('Create on-call period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete on-call period
router.delete('/oncall/:id', authorize('provider', 'admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM on_call_periods WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete on-call period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
