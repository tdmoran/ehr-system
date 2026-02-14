-- Migration: Additional performance indexes
-- Created: 2026-02-14
-- Adds composite indexes for common query patterns

-- Appointments: provider + date composite for calendar/schedule views
CREATE INDEX IF NOT EXISTS idx_appointments_provider_date ON appointments(provider_id, appointment_date);

-- Appointments: date + status for dashboard queries (today's appointments by status)
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status);

-- Documents: lookup by uploader
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- Documents: category filtering
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

-- Encounters: status filtering (find in-progress encounters)
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(status);

-- Encounters: patient + date composite for chart timeline
CREATE INDEX IF NOT EXISTS idx_encounters_patient_date ON encounters(patient_id, encounter_date DESC);

-- Users: role filtering (provider lookups, secretary views)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Patient tasks: composite for common "incomplete tasks for patient" query
CREATE INDEX IF NOT EXISTS idx_patient_tasks_patient_completed ON patient_tasks(patient_id, completed);

-- Patient tasks: creator lookup
CREATE INDEX IF NOT EXISTS idx_patient_tasks_created_by ON patient_tasks(created_by);

-- Audit log: date range + action type for compliance reports
CREATE INDEX IF NOT EXISTS idx_audit_action_date ON audit_log(action, created_at DESC);
