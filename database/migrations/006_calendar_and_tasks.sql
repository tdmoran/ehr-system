-- Migration: Calendar Events, On-Call Periods, Patient Tasks, and Clinic Notes
-- Created: 2026-01-26

-- Add clinic_notes column to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS clinic_notes TEXT;

-- Patient Tasks (memo tasks from patient chart)
CREATE TABLE IF NOT EXISTS patient_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    task_text TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    completed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar Events (custom events on calendar)
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- On-Call Periods
CREATE TABLE IF NOT EXISTS on_call_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_tasks_patient ON patient_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_tasks_completed ON patient_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_calendar_events_provider ON calendar_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_on_call_periods_provider ON on_call_periods(provider_id);
CREATE INDEX IF NOT EXISTS idx_on_call_periods_dates ON on_call_periods(start_date, end_date);
