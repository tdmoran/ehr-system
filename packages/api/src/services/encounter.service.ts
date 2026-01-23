import { query } from '../db/index.js';

export interface Encounter {
  id: string;
  patientId: string;
  providerId: string;
  encounterDate: Date;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: 'in_progress' | 'completed' | 'signed';
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEncounterInput {
  patientId: string;
  providerId: string;
  encounterDate?: Date;
  chiefComplaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

function mapRow(row: Record<string, unknown>): Encounter {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    providerId: row.provider_id as string,
    encounterDate: row.encounter_date as Date,
    chiefComplaint: row.chief_complaint as string | null,
    subjective: row.subjective as string | null,
    objective: row.objective as string | null,
    assessment: row.assessment as string | null,
    plan: row.plan as string | null,
    status: row.status as Encounter['status'],
    signedAt: row.signed_at as Date | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function findByPatientId(patientId: string): Promise<Encounter[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM encounters WHERE patient_id = $1 ORDER BY encounter_date DESC`,
    [patientId]
  );
  return result.rows.map(mapRow);
}

export async function findById(id: string): Promise<Encounter | null> {
  const result = await query<Record<string, unknown>>(`SELECT * FROM encounters WHERE id = $1`, [id]);
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function create(input: CreateEncounterInput): Promise<Encounter> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO encounters (
      patient_id, provider_id, encounter_date, chief_complaint,
      subjective, objective, assessment, plan
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      input.patientId,
      input.providerId,
      input.encounterDate || new Date(),
      input.chiefComplaint || null,
      input.subjective || null,
      input.objective || null,
      input.assessment || null,
      input.plan || null,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function update(id: string, input: Partial<CreateEncounterInput>): Promise<Encounter | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  const fieldMap: Record<string, string> = {
    chiefComplaint: 'chief_complaint',
    subjective: 'subjective',
    objective: 'objective',
    assessment: 'assessment',
    plan: 'plan',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (key in input) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(input[key as keyof CreateEncounterInput] || null);
      paramCount++;
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query<Record<string, unknown>>(
    `UPDATE encounters SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function sign(id: string): Promise<Encounter | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE encounters
     SET status = 'signed', signed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status != 'signed'
     RETURNING *`,
    [id]
  );
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}
