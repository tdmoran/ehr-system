import { query } from '../db/index.js';

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  insuranceProvider: string | null;
  insuranceId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePatientInput {
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  insuranceId?: string;
}

function mapRow(row: Record<string, unknown>): Patient {
  return {
    id: row.id as string,
    mrn: row.mrn as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    dateOfBirth: row.date_of_birth as string,
    gender: row.gender as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    addressLine1: row.address_line1 as string | null,
    addressLine2: row.address_line2 as string | null,
    city: row.city as string | null,
    state: row.state as string | null,
    zip: row.zip as string | null,
    emergencyContactName: row.emergency_contact_name as string | null,
    emergencyContactPhone: row.emergency_contact_phone as string | null,
    insuranceProvider: row.insurance_provider as string | null,
    insuranceId: row.insurance_id as string | null,
    active: row.active as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function findAll(limit = 50, offset = 0): Promise<Patient[]> {
  const result = await query(
    `SELECT * FROM patients WHERE active = true ORDER BY last_name, first_name LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows.map(mapRow);
}

export async function findById(id: string): Promise<Patient | null> {
  const result = await query(`SELECT * FROM patients WHERE id = $1`, [id]);
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function findByMrn(mrn: string): Promise<Patient | null> {
  const result = await query(`SELECT * FROM patients WHERE mrn = $1`, [mrn]);
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function search(searchTerm: string, limit = 20): Promise<Patient[]> {
  const result = await query(
    `SELECT * FROM patients
     WHERE active = true
       AND (
         LOWER(first_name) LIKE LOWER($1)
         OR LOWER(last_name) LIKE LOWER($1)
         OR mrn LIKE $1
         OR phone LIKE $1
       )
     ORDER BY last_name, first_name
     LIMIT $2`,
    [`%${searchTerm}%`, limit]
  );
  return result.rows.map(mapRow);
}

export async function create(input: CreatePatientInput): Promise<Patient> {
  const result = await query(
    `INSERT INTO patients (
      mrn, first_name, last_name, date_of_birth, gender, email, phone,
      address_line1, address_line2, city, state, zip,
      emergency_contact_name, emergency_contact_phone,
      insurance_provider, insurance_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      input.mrn,
      input.firstName,
      input.lastName,
      input.dateOfBirth,
      input.gender || null,
      input.email || null,
      input.phone || null,
      input.addressLine1 || null,
      input.addressLine2 || null,
      input.city || null,
      input.state || null,
      input.zip || null,
      input.emergencyContactName || null,
      input.emergencyContactPhone || null,
      input.insuranceProvider || null,
      input.insuranceId || null,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function update(id: string, input: Partial<CreatePatientInput>): Promise<Patient | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  const fieldMap: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    email: 'email',
    phone: 'phone',
    addressLine1: 'address_line1',
    addressLine2: 'address_line2',
    city: 'city',
    state: 'state',
    zip: 'zip',
    emergencyContactName: 'emergency_contact_name',
    emergencyContactPhone: 'emergency_contact_phone',
    insuranceProvider: 'insurance_provider',
    insuranceId: 'insurance_id',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (key in input) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(input[key as keyof CreatePatientInput] || null);
      paramCount++;
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query(
    `UPDATE patients SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function deactivate(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE patients SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
