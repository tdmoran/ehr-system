import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { asyncHandler, NotFoundError } from '../errors/index.js';
import { AuthUser } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateRangeQuery = z.object({
  startDate: z.string().regex(dateRegex, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD'),
  providerId: z.string().uuid().optional(),
});

const createEventSchema = z.object({
  eventDate: z.string().regex(dateRegex),
  title: z.string().min(1).max(255),
  notes: z.string().max(2000).optional(),
});

const createOnCallSchema = z.object({
  startDate: z.string().regex(dateRegex),
  endDate: z.string().regex(dateRegex),
  notes: z.string().max(2000).optional(),
});

function getProviderId(user: AuthUser): string {
  return user.providerId || user.id;
}

// Get events for a date range
router.get('/events', authorize('provider', 'nurse', 'admin', 'secretary'), validateQuery(dateRangeQuery), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query as z.infer<typeof dateRangeQuery>;
  const providerId = (req.query.providerId as string) || getProviderId(req.user!);

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
}));

// Create event
router.post('/events', authorize('provider', 'nurse', 'admin', 'secretary'), validate(createEventSchema), asyncHandler(async (req, res) => {
  const providerId = getProviderId(req.user!);

  const result = await pool.query(
    `INSERT INTO calendar_events (provider_id, event_date, title, notes, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, provider_id, event_date, title, notes, created_at`,
    [providerId, req.body.eventDate, req.body.title, req.body.notes || null, req.user!.id]
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
}));

// Delete event
router.delete('/events/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM calendar_events WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rowCount === 0) throw new NotFoundError('Event not found');
  res.json({ success: true });
}));

// Get on-call periods for a date range
router.get('/oncall', validateQuery(dateRangeQuery), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query as z.infer<typeof dateRangeQuery>;
  const providerId = (req.query.providerId as string) || getProviderId(req.user!);

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
}));

// Create on-call period (providers only)
router.post('/oncall', authorize('provider', 'admin'), validate(createOnCallSchema), asyncHandler(async (req, res) => {
  const providerId = getProviderId(req.user!);

  const result = await pool.query(
    `INSERT INTO on_call_periods (provider_id, start_date, end_date, notes, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, provider_id, start_date, end_date, notes, created_at`,
    [providerId, req.body.startDate, req.body.endDate, req.body.notes || null, req.user!.id]
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
}));

// Delete on-call period
router.delete('/oncall/:id', authorize('provider', 'admin'), asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM on_call_periods WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rowCount === 0) throw new NotFoundError('On-call period not found');
  res.json({ success: true });
}));

export default router;
