import { query } from '../db/index.js';

export interface Document {
  id: string;
  patientId: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  description: string | null;
  createdAt: Date;
}

export interface CreateDocumentInput {
  patientId: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  description?: string;
}

function mapRow(row: Record<string, unknown>): Document {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    uploadedBy: row.uploaded_by as string,
    filename: row.filename as string,
    originalName: row.original_name as string,
    mimeType: row.mime_type as string,
    fileSize: row.file_size as number,
    description: row.description as string | null,
    createdAt: row.created_at as Date,
  };
}

export async function findByPatientId(patientId: string): Promise<Document[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM documents WHERE patient_id = $1 ORDER BY created_at DESC`,
    [patientId]
  );
  return result.rows.map(mapRow);
}

export async function findById(id: string): Promise<Document | null> {
  const result = await query<Record<string, unknown>>(`SELECT * FROM documents WHERE id = $1`, [id]);
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function create(input: CreateDocumentInput): Promise<Document> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO documents (
      patient_id, uploaded_by, filename, original_name, mime_type, file_size, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      input.patientId,
      input.uploadedBy,
      input.filename,
      input.originalName,
      input.mimeType,
      input.fileSize,
      input.description || null,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function remove(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM documents WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
