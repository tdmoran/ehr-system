import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'provider' | 'nurse' | 'admin' | 'billing' | 'secretary';
  providerId?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'provider' | 'nurse' | 'admin' | 'billing' | 'secretary';
  providerId?: string;
}

function mapRow(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    role: row.role as User['role'],
    providerId: row.provider_id as string | undefined,
    active: row.active as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function findByEmail(email: string): Promise<User | null> {
  const result = await query<Record<string, unknown>>(`SELECT * FROM users WHERE email = $1 AND active = true`, [email]);
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function findById(id: string): Promise<User | null> {
  const result = await query<Record<string, unknown>>(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM users WHERE email = $1 AND active = true`,
    [email]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const passwordHash = row.password_hash as string;

  const isValid = await bcrypt.compare(password, passwordHash);
  if (!isValid) return null;

  return mapRow(row);
}

export async function create(input: CreateUserInput): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  const result = await query<Record<string, unknown>>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.email, passwordHash, input.firstName, input.lastName, input.role]
  );

  return mapRow(result.rows[0]);
}

export function generateToken(user: User): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    providerId: user.providerId,
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn']
  });
}

export async function findAll(): Promise<User[]> {
  const result = await query<Record<string, unknown>>(`SELECT * FROM users WHERE active = true ORDER BY last_name, first_name`);
  return result.rows.map(mapRow);
}
