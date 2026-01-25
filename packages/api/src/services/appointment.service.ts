import { query } from '../db/index.js';

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reason: string | null;
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'checked_out' | 'cancelled' | 'no_show';
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  // Joined fields
  patientFirstName?: string;
  patientLastName?: string;
  patientMrn?: string;
  providerFirstName?: string;
  providerLastName?: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  color: string;
  active: boolean;
}

export interface CreateAppointmentInput {
  patientId: string;
  providerId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reason?: string;
  notes?: string;
  createdBy: string;
}

export async function findByDateRange(
  startDate: string,
  endDate: string,
  providerId?: string
): Promise<Appointment[]> {
  let sql = `
    SELECT
      a.*,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.mrn as patient_mrn,
      u.first_name as provider_first_name,
      u.last_name as provider_last_name
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.provider_id = u.id
    WHERE a.appointment_date >= $1 AND a.appointment_date <= $2
  `;
  const params: unknown[] = [startDate, endDate];

  if (providerId) {
    sql += ` AND a.provider_id = $3`;
    params.push(providerId);
  }

  sql += ` ORDER BY a.appointment_date, a.start_time`;

  const result = await query<any>(sql, params);
  return result.rows.map(row => ({
    id: row.id,
    patientId: row.patient_id,
    providerId: row.provider_id,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    appointmentType: row.appointment_type,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    patientFirstName: row.patient_first_name,
    patientLastName: row.patient_last_name,
    patientMrn: row.patient_mrn,
    providerFirstName: row.provider_first_name,
    providerLastName: row.provider_last_name,
  }));
}

export async function findById(id: string): Promise<Appointment | null> {
  const result = await query<any>(
    `SELECT
      a.*,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.mrn as patient_mrn,
      u.first_name as provider_first_name,
      u.last_name as provider_last_name
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.provider_id = u.id
    WHERE a.id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    patientId: row.patient_id,
    providerId: row.provider_id,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    appointmentType: row.appointment_type,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    patientFirstName: row.patient_first_name,
    patientLastName: row.patient_last_name,
    patientMrn: row.patient_mrn,
    providerFirstName: row.provider_first_name,
    providerLastName: row.provider_last_name,
  };
}

export async function create(input: CreateAppointmentInput): Promise<Appointment> {
  const result = await query<any>(
    `INSERT INTO appointments (patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.patientId,
      input.providerId,
      input.appointmentDate,
      input.startTime,
      input.endTime,
      input.appointmentType,
      input.reason || null,
      input.notes || null,
      input.createdBy,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    patientId: row.patient_id,
    providerId: row.provider_id,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    appointmentType: row.appointment_type,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function update(
  id: string,
  input: Partial<CreateAppointmentInput> & { status?: string }
): Promise<Appointment | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (input.patientId) {
    fields.push(`patient_id = $${paramCount++}`);
    values.push(input.patientId);
  }
  if (input.providerId) {
    fields.push(`provider_id = $${paramCount++}`);
    values.push(input.providerId);
  }
  if (input.appointmentDate) {
    fields.push(`appointment_date = $${paramCount++}`);
    values.push(input.appointmentDate);
  }
  if (input.startTime) {
    fields.push(`start_time = $${paramCount++}`);
    values.push(input.startTime);
  }
  if (input.endTime) {
    fields.push(`end_time = $${paramCount++}`);
    values.push(input.endTime);
  }
  if (input.appointmentType) {
    fields.push(`appointment_type = $${paramCount++}`);
    values.push(input.appointmentType);
  }
  if (input.reason !== undefined) {
    fields.push(`reason = $${paramCount++}`);
    values.push(input.reason);
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${paramCount++}`);
    values.push(input.notes);
  }
  if (input.status) {
    fields.push(`status = $${paramCount++}`);
    values.push(input.status);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query<any>(
    `UPDATE appointments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    patientId: row.patient_id,
    providerId: row.provider_id,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    appointmentType: row.appointment_type,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function remove(id: string): Promise<boolean> {
  const result = await query('DELETE FROM appointments WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getAppointmentTypes(): Promise<AppointmentType[]> {
  const result = await query<any>(
    'SELECT * FROM appointment_types WHERE active = true ORDER BY name'
  );
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    color: row.color,
    active: row.active,
  }));
}

export async function getProviders(): Promise<{ id: string; firstName: string; lastName: string }[]> {
  const result = await query<any>(
    "SELECT id, first_name, last_name FROM users WHERE role = 'provider' AND active = true ORDER BY last_name, first_name"
  );
  return result.rows.map(row => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
  }));
}
