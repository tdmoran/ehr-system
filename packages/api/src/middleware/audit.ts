import { Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';

type AuditAction = 'view' | 'create' | 'update' | 'delete' | 'login' | 'logout' | 'bulk_create';
type ResourceType = 'patient' | 'encounter' | 'medication' | 'lab_result' | 'user' | 'session' | 'appointment' | 'document' | 'ocr_processing' | 'ocr_result' | 'ocr_field_mappings' | 'referral_scan';

interface AuditEntry {
  userId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  patientId?: string;
  details?: Record<string, unknown>;
}

export async function logAudit(req: Request, entry: AuditEntry) {
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  try {
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, patient_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.userId || req.user?.id || null,
        entry.action,
        entry.resourceType,
        entry.resourceId || null,
        entry.patientId || null,
        ipAddress,
        userAgent,
        entry.details ? JSON.stringify(entry.details) : null,
      ]
    );
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
}

export function auditMiddleware(
  action: AuditAction,
  resourceType: ResourceType,
  getResourceId?: (req: Request) => string | undefined,
  getPatientId?: (req: Request) => string | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        await logAudit(req, {
          action,
          resourceType,
          resourceId: getResourceId?.(req),
          patientId: getPatientId?.(req),
        });
      }
    });
    next();
  };
}
