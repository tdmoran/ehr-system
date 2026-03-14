-- Migration: 008_transcription_sessions.sql
-- Description: Add tables for Heidi AI transcription integration

-- Transcription sessions track each AI scribe recording
CREATE TABLE transcription_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id),

    -- Heidi integration
    external_session_id VARCHAR(255),
    external_provider VARCHAR(50) NOT NULL
        CHECK (external_provider IN ('heidi', 'built_in')),

    -- Session lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'recording',
            'processing',
            'completed',
            'failed',
            'cancelled'
        )),

    -- Timestamps
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    duration_seconds INTEGER,
    template_used VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    error_message TEXT
);

-- Generated notes from transcription
CREATE TABLE transcription_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES transcription_sessions(id) ON DELETE CASCADE,

    -- Structured output (mirrors encounter SOAP fields)
    chief_complaint TEXT,
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,

    -- Additional AI outputs
    full_transcript TEXT,
    summary TEXT,
    suggested_icd_codes JSONB DEFAULT '[]',
    suggested_cpt_codes JSONB DEFAULT '[]',

    -- Quality
    confidence_score NUMERIC(3,2),
    word_count INTEGER,
    speaker_count INTEGER,

    -- Review state
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    accepted BOOLEAN,
    modifications JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template preferences per provider
CREATE TABLE transcription_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL
        CHECK (template_type IN (
            'soap', 'progress_note', 'referral_letter',
            'operative_note', 'assessment_report', 'custom'
        )),
    sections JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    external_template_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(provider_id, name)
);

-- Consent tracking for audio recording
CREATE TABLE transcription_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id),
    session_id UUID REFERENCES transcription_sessions(id) ON DELETE SET NULL,
    consent_given BOOLEAN NOT NULL,
    consent_method VARCHAR(50) NOT NULL
        CHECK (consent_method IN ('verbal', 'written', 'electronic')),
    notes TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transcription_sessions_patient ON transcription_sessions(patient_id);
CREATE INDEX idx_transcription_sessions_provider ON transcription_sessions(provider_id);
CREATE INDEX idx_transcription_sessions_encounter ON transcription_sessions(encounter_id);
CREATE INDEX idx_transcription_sessions_appointment ON transcription_sessions(appointment_id);
CREATE INDEX idx_transcription_sessions_status ON transcription_sessions(status);
CREATE INDEX idx_transcription_notes_session ON transcription_notes(session_id);
CREATE INDEX idx_transcription_consents_patient ON transcription_consents(patient_id);
CREATE INDEX idx_transcription_templates_provider ON transcription_templates(provider_id);

-- Add transcription linkage to encounters
ALTER TABLE encounters
    ADD COLUMN transcription_session_id UUID REFERENCES transcription_sessions(id)
        ON DELETE SET NULL,
    ADD COLUMN ai_assisted BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_encounters_transcription ON encounters(transcription_session_id);
