# AITranscription Feature Documentation

## Overview

The AITranscription feature integrates AI-powered ambient medical transcription into the EHR system. During clinical visits, clinician-patient conversations are captured via the browser microphone, transcribed in real time, and structured into clinical notes (SOAP, progress notes, referral letters, etc.) with suggested ICD-10 and CPT codes.

The system supports two transcription backends:

- **AITranscription Health** (external) -- Uses the AITranscription Open API and Widget SDK for transcription and note generation.
- **Built-in** (future) -- A self-hosted pipeline using Whisper + Claude for transcription and structuring.

## Architecture

```
+------------------------------------------------------+
|                   FRONTEND (React)                    |
|                                                      |
|  TranscriptionLayout                                 |
|    +-- TranscriptionDashboard   (session list)       |
|    +-- LiveRecording            (mic + waveform)     |
|    +-- NoteEditor               (SOAP editor)        |
|    +-- ConsentModal             (patient consent)    |
|                                                      |
|  Browser MediaRecorder --> WebSocket audio chunks     |
|  Web Audio API --> real-time waveform visualization   |
+-------------------------+----------------------------+
                          |
                          v
+-------------------------+----------------------------+
|                 API SERVER (Express.js)               |
|                                                      |
|  routes/transcriptions.ts                            |
|    +-- authenticate + authorize middleware            |
|    +-- Zod request validation                        |
|    +-- HIPAA audit logging on every action            |
|                                                      |
|  services/transcription.service.ts                   |
|    +-- Session CRUD (create, find, update status)     |
|    +-- Note generation (calls AITranscription API)    |
|    +-- Accept/reject workflow (note -> encounter)     |
|    +-- Template CRUD                                 |
|    +-- Consent recording                             |
|                                                      |
|  services/ai-transcription-client.service.ts         |
|    +-- AITranscription API wrapper (REST client)      |
|    +-- Session creation, transcript retrieval         |
|    +-- Structured note generation                    |
|    +-- ICD-10/CPT code suggestions                   |
+-------------------------+----------------------------+
                          |
                          v
+-------------------------+----------------------------+
|              PostgreSQL (Neon.tech)                   |
|                                                      |
|  transcription_sessions   (session lifecycle)        |
|  transcription_notes      (AI-generated SOAP notes)  |
|  transcription_templates  (provider note templates)  |
|  transcription_consents   (patient consent records)  |
|  encounters               (linked via ai_assisted)   |
|  audit_log                (HIPAA compliance trail)   |
+------------------------------------------------------+
```

## Database Schema

Migration: `database/migrations/008_transcription_sessions.sql`

### transcription_sessions

Tracks each AI scribe recording session from creation through completion.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Session identifier |
| `encounter_id` | UUID (FK) | Linked encounter (set after note acceptance) |
| `appointment_id` | UUID (FK) | Associated appointment |
| `patient_id` | UUID (FK, NOT NULL) | Patient being seen |
| `provider_id` | UUID (FK, NOT NULL) | Clinician running the session |
| `external_session_id` | VARCHAR(255) | AITranscription's session identifier |
| `external_provider` | VARCHAR(50) | `'aiTranscription'` or `'built_in'` |
| `status` | VARCHAR(20) | `pending` -> `recording` -> `processing` -> `completed` / `failed` / `cancelled` |
| `started_at` | TIMESTAMPTZ | When recording began |
| `ended_at` | TIMESTAMPTZ | When recording ended |
| `duration_seconds` | INTEGER | Computed recording duration |
| `template_used` | VARCHAR(100) | Template type (e.g., `soap`, `progress_note`) |
| `language` | VARCHAR(10) | Language code (default: `en`) |
| `error_message` | TEXT | Error details if status is `failed` |
| `created_at` / `updated_at` | TIMESTAMPTZ | Timestamps |

### transcription_notes

Stores AI-generated structured notes linked to a session.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Note identifier |
| `session_id` | UUID (FK, NOT NULL) | Parent session |
| `chief_complaint` | TEXT | Extracted chief complaint |
| `subjective` | TEXT | SOAP subjective |
| `objective` | TEXT | SOAP objective |
| `assessment` | TEXT | SOAP assessment |
| `plan` | TEXT | SOAP plan |
| `full_transcript` | TEXT | Raw conversation transcript |
| `summary` | TEXT | Brief visit summary |
| `suggested_icd_codes` | JSONB | `[{code, description, confidence}]` |
| `suggested_cpt_codes` | JSONB | `[{code, description, confidence}]` |
| `confidence_score` | NUMERIC(3,2) | AI confidence (0.00-1.00) |
| `word_count` | INTEGER | Transcript word count |
| `speaker_count` | INTEGER | Number of speakers detected |
| `reviewed_by` | UUID (FK) | Clinician who reviewed |
| `reviewed_at` | TIMESTAMPTZ | When reviewed |
| `accepted` | BOOLEAN | Whether clinician accepted the note |
| `modifications` | JSONB | Tracks what the clinician changed |

### transcription_templates

Provider-specific note templates.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Template identifier |
| `provider_id` | UUID (FK, NOT NULL) | Owning provider |
| `name` | VARCHAR(100) | Template name (unique per provider) |
| `template_type` | VARCHAR(50) | `soap`, `progress_note`, `referral_letter`, `operative_note`, `assessment_report`, `custom` |
| `sections` | JSONB | `[{name, prompt, required}]` |
| `is_default` | BOOLEAN | Whether this is the provider's default template |
| `external_template_id` | VARCHAR(255) | AITranscription template ID if synced |

### transcription_consents

Immutable consent records for HIPAA compliance.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Consent record identifier |
| `patient_id` | UUID (FK, NOT NULL) | Patient |
| `provider_id` | UUID (FK, NOT NULL) | Recording provider |
| `session_id` | UUID (FK) | Associated session (optional) |
| `consent_given` | BOOLEAN | Whether patient consented |
| `consent_method` | VARCHAR(50) | `verbal`, `written`, or `electronic` |
| `notes` | TEXT | Additional notes |
| `recorded_at` | TIMESTAMPTZ | When consent was recorded |

### encounters table additions

```sql
ALTER TABLE encounters
    ADD COLUMN transcription_session_id UUID REFERENCES transcription_sessions(id),
    ADD COLUMN ai_assisted BOOLEAN DEFAULT FALSE;
```

## API Endpoint Reference

All endpoints are prefixed with `/api/transcriptions` and require JWT authentication.

### Session Endpoints

#### POST /sessions

Create a new transcription session.

- **Auth**: `provider`, `nurse`
- **Feature flag**: Requires `HEIDI_ENABLED=true`
- **Body**:
  ```json
  {
    "patientId": "uuid",
    "appointmentId": "uuid (optional)",
    "templateType": "soap (optional)",
    "language": "en (optional)"
  }
  ```
- **Response** (201):
  ```json
  {
    "session": { "id": "uuid", "status": "pending", ... },
    "externalSessionUrl": "https://..."
  }
  ```

#### PATCH /sessions/:id/status

Update session status.

- **Auth**: `provider`, `nurse` (own sessions only, or admin)
- **Body**: `{ "status": "recording" | "processing" | "cancelled" }`
- **Response**: `{ "session": { ... } }`

#### GET /sessions/:id

Get session details with generated note.

- **Auth**: `provider`, `nurse`, `admin`
- **Response**: `{ "session": { ... }, "note": { ... } | null }`

#### GET /sessions/patient/:patientId

List all transcription sessions for a patient.

- **Auth**: `provider`, `nurse`, `admin`
- **Response**: `{ "sessions": [ ... ] }`

#### POST /sessions/:id/generate

Trigger AI note generation from the transcription.

- **Auth**: `provider`, `nurse`
- **Body**: `{ "templateType": "soap (optional)" }`
- **Response** (201): `{ "note": { ... } }`

#### POST /sessions/:id/accept

Accept the AI note and create/update an encounter.

- **Auth**: `provider` (own sessions only)
- **Body**:
  ```json
  {
    "modifications": { "subjective": "edited text", ... },
    "encounterId": "uuid (optional, to update existing)"
  }
  ```
- **Response**: `{ "encounter": { ... } }`

#### POST /sessions/:id/reject

Reject the AI note (clinician will write manually).

- **Auth**: `provider` (own sessions only)
- **Response**: `{ "message": "Note rejected" }`

#### PUT /sessions/:id/note

Update note content (draft save).

- **Auth**: `provider`, `nurse`
- **Body**: `{ "chiefComplaint?", "subjective?", "objective?", "assessment?", "plan?", "summary?", "reviewStatus?" }`
- **Response**: `{ "note": { ... } }`

#### GET /sessions/:id/note

Get the note for a session.

- **Auth**: `provider`, `nurse`, `admin`
- **Response**: `{ "note": { ... } }`

#### GET /sessions/:id/codes

Get suggested ICD-10 and CPT codes.

- **Auth**: `provider`, `nurse`, `admin`, `billing`
- **Response**: `{ "icdCodes": [...], "cptCodes": [...] }`

### Template Endpoints

#### GET /templates

List templates for current provider.

- **Auth**: `provider`, `admin`
- **Response**: `{ "templates": [ ... ] }`

#### POST /templates

Create a custom template.

- **Auth**: `provider`
- **Body**:
  ```json
  {
    "name": "My SOAP Template",
    "templateType": "soap",
    "sections": [{ "name": "Chief Complaint", "prompt": "...", "required": true }],
    "isDefault": false
  }
  ```
- **Response** (201): `{ "template": { ... } }`

#### PUT /templates/:id

Update a template (own templates only).

- **Auth**: `provider`

#### DELETE /templates/:id

Delete a template (own templates only).

- **Auth**: `provider`
- **Response**: 204 No Content

### Consent Endpoints

#### POST /consent

Record patient consent for AI transcription.

- **Auth**: `provider`, `nurse`
- **Body**:
  ```json
  {
    "patientId": "uuid",
    "sessionId": "uuid (optional)",
    "consentGiven": true,
    "consentMethod": "verbal" | "written" | "electronic",
    "notes": "optional notes"
  }
  ```
- **Response** (201): `{ "consent": { ... } }`

#### GET /consent/patient/:patientId

Get consent history for a patient.

- **Auth**: `provider`, `nurse`, `admin`
- **Response**: `{ "consents": [ ... ] }`

## Frontend Components

All components are located in `packages/web/src/components/transcriptions/`.

### TranscriptionLayout

Top-level layout with tab navigation between Sessions and New Recording views.

**Routes**:
- `/transcriptions` -- Sessions list (TranscriptionDashboard)
- `/transcriptions/new` -- New Recording (LiveRecording)

**Keyboard shortcuts**: `Ctrl+N` (new session), `Ctrl+S` (save), `Space` (pause/resume)

### TranscriptionDashboard

Session management table with filtering, sorting, and pagination.

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `onCreateSession` | `() => void` | Navigate to new recording |
| `onViewSession` | `(sessionId: string) => void` | Open session detail |
| `onEditSession` | `(sessionId: string) => void` | Open note editor |

**Features**: Status filtering, patient search, date range, sortable columns, mobile-responsive cards, delete with confirmation.

### LiveRecording

Real-time recording interface with waveform visualization and live transcript.

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `initialPatientId` | `string?` | Pre-selected patient |
| `appointmentId` | `string?` | Pre-selected appointment |
| `onSessionComplete` | `(session) => void` | Called on completion |
| `onCancel` | `() => void` | Called on cancellation |

**Features**: Patient search dropdown, microphone capture with echo cancellation and noise suppression, WebSocket live transcript, waveform visualization via Web Audio API, pause/resume support.

### NoteEditor

Side-by-side view of raw transcript and structured SOAP note editor with auto-save.

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `sessionId` | `string` | Session to edit |
| `onClose` | `() => void` | Close editor |
| `onFinalized` | `() => void` | Called after note is finalized |

**Features**: Template switching (SOAP, H&P, Procedure, Custom), auto-save with 1.5s debounce, AI suggestion chips extracted from transcript, confidence score display, finalize creates encounter.

### ConsentModal

HIPAA-compliant consent capture modal with digital signature.

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `patient` | `Patient` | Patient record |
| `sessionId` | `string?` | Associated session |
| `onConsentRecorded` | `(consentId: string) => void` | Success callback |
| `onClose` | `() => void` | Close modal |

**Features**: Electronic/verbal/written consent methods, digital signature canvas (touch + mouse), consent text display, print/PDF export, decline flow.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HEIDI_API_BASE_URL` | Yes (if enabled) | AITranscription API base URL (region-specific) |
| `HEIDI_API_KEY` | Yes (if enabled) | AITranscription API authentication key |
| `HEIDI_ENABLED` | No | Feature flag (`true` to enable, default: disabled) |

See `.env.ai-transcription` for a complete example.

## Role-Based Access

| Role | Permissions |
|------|------------|
| `provider` | Create sessions, view own, accept/reject notes, manage templates, record consent |
| `nurse` | Create sessions, view (assisting), update notes, record consent |
| `admin` | View all sessions, manage templates |
| `billing` | View suggested codes only |
| `secretary` | No access to transcription content |

## Session Status Flow

```
pending --> recording --> processing --> completed
                                    --> failed
                      --> cancelled
```

## HIPAA Compliance

- All transcription actions are audit-logged via the existing `audit` middleware
- New audit resource types: `transcription_session`, `transcription_note`, `transcription_consent`
- Patient consent is mandatory before first transcription
- Consent records are immutable (new records created for changes)
- Audio is never stored in our system (processed and deleted by AITranscription)
- Only text transcripts and structured notes are retained
- All data encrypted in transit (TLS 1.2+) and at rest (Neon.tech)
