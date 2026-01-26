import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

const createTaskSchema = z.object({
  patientId: z.string().uuid(),
  taskText: z.string().min(1),
});

// Get all tasks (optionally filter by completed status)
router.get('/', async (req, res) => {
  try {
    const completed = req.query.completed;

    let query = `
      SELECT t.id, t.patient_id, t.task_text, t.completed, t.completed_at, t.created_at,
             p.first_name as patient_first_name, p.last_name as patient_last_name, p.mrn as patient_mrn
      FROM patient_tasks t
      JOIN patients p ON t.patient_id = p.id
    `;

    const params: any[] = [];
    if (completed !== undefined) {
      query += ' WHERE t.completed = $1';
      params.push(completed === 'true');
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);

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
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks for a specific patient
router.get('/patient/:patientId', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Get patient tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task
router.post('/', validate(createTaskSchema), async (req, res) => {
  try {
    const user = req.user as any;

    const result = await pool.query(
      `INSERT INTO patient_tasks (patient_id, created_by, task_text)
       VALUES ($1, $2, $3)
       RETURNING id, patient_id, task_text, completed, created_at`,
      [req.body.patientId, user.id, req.body.taskText]
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
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task (mark complete/incomplete)
router.patch('/:id', async (req, res) => {
  try {
    const user = req.user as any;
    const { completed } = req.body;

    const result = await pool.query(
      `UPDATE patient_tasks
       SET completed = $1,
           completed_at = $2,
           completed_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, completed, completed_at`,
      [completed, completed ? new Date() : null, completed ? user.id : null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM patient_tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
