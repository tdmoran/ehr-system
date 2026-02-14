import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../errors/index.js';

const router = Router();

router.use(authenticate);

const createTaskSchema = z.object({
  patientId: z.string().uuid(),
  taskText: z.string().min(1),
});

// Get all tasks (optionally filter by completed status)
router.get('/', authorize('provider', 'nurse', 'admin', 'secretary'), asyncHandler(async (req, res) => {
  const completed = req.query.completed;

  let sqlQuery = `
    SELECT t.id, t.patient_id, t.task_text, t.completed, t.completed_at, t.created_at,
           p.first_name as patient_first_name, p.last_name as patient_last_name, p.mrn as patient_mrn
    FROM patient_tasks t
    JOIN patients p ON t.patient_id = p.id
  `;

  const params: unknown[] = [];
  if (completed !== undefined) {
    sqlQuery += ' WHERE t.completed = $1';
    params.push(completed === 'true');
  }

  sqlQuery += ' ORDER BY t.created_at DESC';

  const result = await pool.query(sqlQuery, params);

  res.json({
    tasks: result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: `${row.patient_first_name} ${row.patient_last_name}`,
      patientMrn: row.patient_mrn,
      text: row.task_text,
      completed: row.completed,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    })),
  });
}));

// Get tasks for a specific patient
router.get('/patient/:patientId', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT t.id, t.patient_id, t.task_text, t.completed, t.completed_at, t.created_at,
            p.first_name as patient_first_name, p.last_name as patient_last_name, p.mrn as patient_mrn
     FROM patient_tasks t
     JOIN patients p ON t.patient_id = p.id
     WHERE t.patient_id = $1
     ORDER BY t.created_at DESC`,
    [req.params.patientId]
  );

  res.json({
    tasks: result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: `${row.patient_first_name} ${row.patient_last_name}`,
      patientMrn: row.patient_mrn,
      text: row.task_text,
      completed: row.completed,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    })),
  });
}));

// Create task
router.post('/', authorize('provider', 'nurse', 'admin', 'secretary'), validate(createTaskSchema), asyncHandler(async (req, res) => {
  const result = await pool.query(
    `INSERT INTO patient_tasks (patient_id, created_by, task_text)
     VALUES ($1, $2, $3)
     RETURNING id, patient_id, task_text, completed, created_at`,
    [req.body.patientId, req.user!.id, req.body.taskText]
  );

  // Get patient info
  const patientResult = await pool.query(
    'SELECT first_name, last_name, mrn FROM patients WHERE id = $1',
    [req.body.patientId]
  );
  const patient = patientResult.rows[0];

  const row = result.rows[0];
  res.status(201).json({
    task: {
      id: row.id,
      patientId: row.patient_id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      patientMrn: patient.mrn,
      text: row.task_text,
      completed: row.completed,
      createdAt: row.created_at,
    },
  });
}));

// Update task (mark complete/incomplete)
router.patch('/:id', asyncHandler(async (req, res) => {
  const { completed } = req.body;

  const result = await pool.query(
    `UPDATE patient_tasks
     SET completed = $1,
         completed_at = $2,
         completed_by = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING id, completed, completed_at`,
    [completed, completed ? new Date() : null, completed ? req.user!.id : null, req.params.id]
  );

  if (result.rows.length === 0) throw new NotFoundError('Task not found');

  res.json({ task: result.rows[0] });
}));

// Delete task
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM patient_tasks WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rowCount === 0) throw new NotFoundError('Task not found');
  res.json({ success: true });
}));

export default router;
