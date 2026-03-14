# Heidi Health AI Transcription — Integration Plan

## Table of Contents

1. [Research Summary](#1-research-summary)
2. [Integration Architecture](#2-integration-architecture)
3. [Database Schema Changes](#3-database-schema-changes)
4. [API Endpoints](#4-api-endpoints)
5. [Frontend Components](#5-frontend-components)
6. [Workflow Integration](#6-workflow-integration)
7. [Security & Compliance](#7-security--compliance)
8. [Implementation Phases](#8-implementation-phases)
9. [Alternative: Build-Your-Own AI Scribe](#9-alternative-build-your-own-ai-scribe)

---

## 1. Research Summary

### What is Heidi Health?

Heidi Health is an AI-powered ambient medical scribe founded in 2019 in Melbourne, Australia. It listens to clinician-patient conversations and automatically generates structured clinical notes (SOAP, referral letters, progress notes, etc.).

**Key stats (as of 2026):**
- 370,000+ clinicians across 116 countries
- 10 million+ consultations processed monthly
- 200+ medical specialties, 110+ languages
- $65M Series B (Oct 2025) at $465M valuation

### How It Works

1. **Capture** — Ambient microphone listens during consultation (device mic or mounted hardware)
2. **Transcribe** — Real-time speech-to-text with multi-speaker handling
3. **Structure** — LLMs map transcript content into clinician-configured templates (SOAP, progress notes, referral letters, etc.)
4. **Code** — AI suggests ICD-10-CM and SNOMED-CT codes
5. **Review** — Clinician reviews, edits, and finalizes before pushing to EMR

### Integration Options Heidi Provides

| Method | Description | Best For |
|--------|-------------|----------|
| **Heidi Open API** | REST API for transcribing encounters and generating notes | Backend integration, custom workflows |
| **Heidi Widget/SDK** | Embeddable React/Angular/Vue component | Embedded in-app experience |
| **Chrome Extension** | Works with any web-based EHR | Zero-code integration |
| **FHIR (SMART on FHIR)** | Standards-based health data exchange | Epic-style integrations |

**API Details:**
- REST endpoints for session management, transcription, and note generation
- Token-based authentication per region (AU, US, EU, UK)
- TLS 1.2+ encryption on all calls
- Region-specific data residency

### Compliance & Security

- SOC 2 Type 2 certified
- ISO 27001 certified
- HIPAA compliant (executes BAAs)
- GDPR, PHIPA, APP compliant
- Audio deleted after transcription; only text notes retained (encrypted at rest)
- Region-appropriate data storage

### Pricing

| Plan | Price | Notes |
|------|-------|-------|
| Free | $0 | Unlimited transcription, standard templates, 5 actions/month |
| Pro | ~$90–99/user/month | Unlimited actions, advanced templates |
| Practice | ~$120/user/month | Multi-provider management |
| Enterprise | Custom | SSO, custom integrations, coding workflows |

### Competitors

| Product | Differentiator |
|---------|---------------|
| Nuance DAX (Microsoft) | Enterprise-grade, deep Epic integration |
| Abridge | Strong in hospital/specialty settings |
| Suki AI | Voice assistant approach |
| Freed AI | Simple, affordable for solo practitioners |
| Ambience Healthcare | Full ambient AI suite |

---

## 2. Integration Architecture

### Recommended Approach: Heidi Widget/SDK + Open API Hybrid

The Heidi Widget handles the recording/transcription UI, while the Open API pushes structured notes into our EHR. This minimizes custom audio processing code while keeping full control of data flow.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                             │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │ PatientChart  │    │ TranscriptionPanel│    │ EncounterEditor  │  │
│  │              │───▶│                  │───▶│                  │  │
│  │ Start Visit   │    │ Heidi Widget SDK │    │ Review & Sign    │  │
│  └──────────────┘    │ (embedded)       │    │ SOAP Note        │  │
│                      │                  │    └──────────────────┘  │
│                      │ • Record button  │             │            │
│                      │ • Live transcript│             │            │
│                      │ • Template select│             ▼            │
│                      └────────┬─────────┘    ┌──────────────────┐  │
│                               │              │ CodingSuggestions │  │
│                               │              │ ICD-10 / SNOMED   │  │
│                               │              └──────────────────┘  │
└───────────────────────────────┼──────────────────────┼──────────────┘
                                │                      │
                     ┌──────────▼──────────┐           │
                     │    OUR API SERVER    │◀──────────┘
                     │   (Express.js)       │
                     │                      │
                     │  ┌────────────────┐  │
                     │  │ transcription   │  │     ┌──────────────────┐
                     │  │ routes          │──┼────▶│  Heidi Open API  │
                     │  └────────────────┘  │     │  (External)       │
                     │  ┌────────────────┐  │     │                  │
                     │  │ transcription   │  │     │ • Auth (token)   │
                     │  │ service         │  │     │ • Create session │
                     │  └────────────────┘  │     │ • Get transcript │
                     │  ┌────────────────┐  │     │ • Generate note  │
                     │  │ encounter      │  │     │ • Get ICD codes  │
                     │  │ service         │  │     └──────────────────┘
                     │  └────────────────┘  │
                     │  ┌────────────────┐  │
                     │  │ audit          │  │
                     │  │ middleware      │  │
                     │  └────────────────┘  │
                     └──────────┬───────────┘
                                │
                     ┌──────────▼───────────┐
                     │    PostgreSQL (Neon)  │
                     │                      │
                     │  transcription_       │
                     │    sessions           │
                     │  transcription_       │
                     │    notes              │
                     │  encounters           │
                     │    (updated)          │
                     │  audit_log            │
                     └──────────────────────┘
```

### Data Flow

```
1. Clinician starts appointment → clicks "Start Transcription"
2. Heidi Widget captures audio via browser mic
3. Audio streams to Heidi servers (encrypted, region-specific)
4. Real-time transcript shown in TranscriptionPanel
5. Consultation ends → clinician clicks "End & Generate Note"
6. Our API calls Heidi Open API to retrieve structured note
7. Structured SOAP fields populated in EncounterEditor
8. Clinician reviews, edits, signs → saved to encounters table
9. All actions audit-logged for HIPAA compliance
```

---

## 3. Database Schema Changes

### New Migration: `008_transcription_sessions.sql`

```sql
-- Transcription sessions track each AI scribe recording
CREATE TABLE transcription_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id),

    -- Heidi integration
    external_session_id VARCHAR(255),           -- Heidi's session identifier
    external_provider VARCHAR(50) NOT NULL       -- 'heidi' | 'built_in'
        CHECK (external_provider IN ('heidi', 'built_in')),

    -- Session lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',        -- Created, not yet recording
            'recording',      -- Actively capturing audio
            'processing',     -- Transcription/note generation in progress
            'completed',      -- Note generated and available
            'failed',         -- Processing failed
            'cancelled'       -- Clinician cancelled session
        )),

    -- Timestamps
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    duration_seconds INTEGER,
    template_used VARCHAR(100),                  -- SOAP, progress_note, etc.
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
    full_transcript TEXT,                         -- Raw transcript
    summary TEXT,                                 -- Brief visit summary
    suggested_icd_codes JSONB DEFAULT '[]',       -- [{code, description, confidence}]
    suggested_cpt_codes JSONB DEFAULT '[]',       -- [{code, description, confidence}]

    -- Quality
    confidence_score NUMERIC(3,2),                -- 0.00–1.00
    word_count INTEGER,
    speaker_count INTEGER,

    -- Review state
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    accepted BOOLEAN,                             -- Did clinician accept AI output?
    modifications JSONB,                          -- Track what the clinician changed

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
    sections JSONB NOT NULL,                      -- [{name, prompt, required}]
    is_default BOOLEAN DEFAULT FALSE,
    external_template_id VARCHAR(255),            -- Heidi template ID if synced
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

-- Add resource types to support audit logging
-- (No schema change needed; audit_log.resource_type is VARCHAR, just use new values:
--  'transcription_session', 'transcription_note', 'transcription_consent')
```

### Encounters Table Update

```sql
-- Add transcription linkage to encounters
ALTER TABLE encounters
    ADD COLUMN transcription_session_id UUID REFERENCES transcription_sessions(id)
        ON DELETE SET NULL,
    ADD COLUMN ai_assisted BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_encounters_transcription ON encounters(transcription_session_id);
```

---

## 4. API Endpoints

### New Route Group: `/api/transcriptions`

```
POST   /api/transcriptions/sessions
       Create a new transcription session (provider/nurse)
       Body: { patientId, appointmentId?, templateType?, language? }
       Returns: { session, externalSessionUrl? }

PATCH  /api/transcriptions/sessions/:id/status
       Update session status (recording, processing, cancelled)
       Body: { status }

GET    /api/transcriptions/sessions/:id
       Get session details with generated note
       Returns: { session, note? }

GET    /api/transcriptions/sessions/patient/:patientId
       List all transcription sessions for a patient
       Returns: { sessions[] }

POST   /api/transcriptions/sessions/:id/generate
       Trigger note generation from Heidi API
       Body: { templateType? }
       Returns: { note }

POST   /api/transcriptions/sessions/:id/accept
       Accept AI note and create/update encounter
       Body: { modifications?, encounterId? }
       Returns: { encounter }

POST   /api/transcriptions/sessions/:id/reject
       Reject AI note (clinician will write manually)

GET    /api/transcriptions/templates
       List available templates for current provider
       Returns: { templates[] }

POST   /api/transcriptions/templates
       Create custom template (provider only)
       Body: { name, templateType, sections[] }

PUT    /api/transcriptions/templates/:id
       Update template

DELETE /api/transcriptions/templates/:id
       Delete template

POST   /api/transcriptions/consent
       Record patient consent for audio recording
       Body: { patientId, sessionId?, consentGiven, consentMethod, notes? }
       Returns: { consent }

GET    /api/transcriptions/consent/patient/:patientId
       Get consent history for a patient

GET    /api/transcriptions/sessions/:id/codes
       Get suggested ICD-10/CPT codes for a session
       Returns: { icdCodes[], cptCodes[] }
```

### New Service: `transcription.service.ts`

Key methods:
- `createSession(patientId, providerId, options)` — Create session, init Heidi API session
- `updateStatus(sessionId, status)` — Lifecycle management
- `generateNote(sessionId, templateType)` — Call Heidi API, store structured output
- `acceptNote(sessionId, modifications, encounterId?)` — Map AI note to encounter
- `rejectNote(sessionId)` — Mark as rejected, log for analytics
- `getSessionWithNote(sessionId)` — Fetch session + note joined

### New Service: `heidi-client.service.ts`

Heidi API wrapper:
- `createHeidiSession(patientContext)` — POST to Heidi API
- `getTranscript(externalSessionId)` — GET raw transcript
- `generateStructuredNote(externalSessionId, template)` — POST note generation
- `getSuggestedCodes(externalSessionId)` — GET ICD-10/CPT suggestions
- `getSessionStatus(externalSessionId)` — Poll processing status

### Heidi API Authentication

```typescript
// packages/api/src/services/heidi-client.service.ts

const HEIDI_API_BASE = process.env.HEIDI_API_BASE_URL; // Region-specific
const HEIDI_API_KEY = process.env.HEIDI_API_KEY;

const heidiRequest = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${HEIDI_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${HEIDI_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new HeidiApiError(response.status, await response.text());
  }

  return response.json();
};
```

### New Environment Variables

```
HEIDI_API_BASE_URL=https://api.us.heidihealth.com   # Region-specific base URL
HEIDI_API_KEY=...                                     # Heidi API key
HEIDI_WIDGET_TOKEN=...                                # Heidi Widget auth token
HEIDI_ENABLED=true                                    # Feature flag
```

---

## 5. Frontend Components

### New Components

```
packages/web/src/components/transcription/
├── TranscriptionPanel.tsx          # Main container for the scribe UI
├── TranscriptionControls.tsx       # Start/stop/pause recording buttons
├── LiveTranscript.tsx              # Real-time transcript display
├── NotePreview.tsx                 # AI-generated note review
├── ConsentDialog.tsx               # Patient consent capture modal
├── TemplateSelector.tsx            # Choose note template before recording
├── CodingSuggestions.tsx           # ICD-10/CPT code suggestions
└── TranscriptionHistory.tsx        # Past transcription sessions list
```

### TranscriptionPanel.tsx

The primary UI component, embedded in PatientChart alongside encounters:

```
┌─────────────────────────────────────────────┐
│  AI Scribe                    [Template: ▼] │
│─────────────────────────────────────────────│
│                                             │
│  Status: ● Recording (02:34)                │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Live Transcript                         ││
│  │                                         ││
│  │ Dr. Smith: Can you tell me about the    ││
│  │ symptoms you've been experiencing?      ││
│  │                                         ││
│  │ Patient: I've had this sore throat for  ││
│  │ about two weeks now, and it's getting...││
│  │                                         ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [⏹ Stop & Generate Note]  [✕ Cancel]       │
│─────────────────────────────────────────────│
│  ℹ Patient consent recorded: verbal         │
└─────────────────────────────────────────────┘
```

### NotePreview.tsx — Post-generation review

```
┌─────────────────────────────────────────────┐
│  Generated SOAP Note          Confidence: 94%│
│─────────────────────────────────────────────│
│                                             │
│  Chief Complaint                            │
│  ┌─────────────────────────────────────────┐│
│  │ Sore throat for 2 weeks, worsening     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Subjective                                 │
│  ┌─────────────────────────────────────────┐│
│  │ Patient reports persistent sore throat  ││
│  │ for approximately 2 weeks...            ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Objective                                  │
│  ┌─────────────────────────────────────────┐│
│  │ (editable textarea)                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Assessment                                 │
│  ┌─────────────────────────────────────────┐│
│  │ (editable textarea)                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Plan                                       │
│  ┌─────────────────────────────────────────┐│
│  │ (editable textarea)                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Suggested Codes                            │
│  ☑ J02.9 - Acute pharyngitis, unspec  (92%)│
│  ☐ J31.2 - Chronic pharyngitis        (67%)│
│                                             │
│  [✓ Accept & Create Encounter] [✎ Edit More]│
│  [✕ Discard]  [View Transcript]             │
└─────────────────────────────────────────────┘
```

### ConsentDialog.tsx

Modal shown before first recording per patient:

```
┌─────────────────────────────────────────────┐
│  Patient Consent for AI Transcription       │
│─────────────────────────────────────────────│
│                                             │
│  This visit will be recorded and processed  │
│  by an AI system to generate clinical notes.│
│                                             │
│  Patient: John Smith (MRN: 0012345)         │
│                                             │
│  Consent Method:                            │
│  ○ Verbal    ○ Written    ○ Electronic      │
│                                             │
│  Notes (optional):                          │
│  ┌─────────────────────────────────────────┐│
│  │                                         ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [✓ Consent Given]    [✕ Consent Declined]  │
└─────────────────────────────────────────────┘
```

### Integration into Existing Pages

**PatientChart.tsx** — Add a new "AI Scribe" tab or section:
- Show TranscriptionPanel when appointment is `in_progress`
- Show TranscriptionHistory in the encounters area
- Link accepted transcription notes to encounters

**Dashboard.tsx** — Add quick-start scribe action:
- "Start AI Scribe" button next to each `checked_in` or `in_progress` appointment

### New API Client Module: `transcription.ts`

```typescript
// packages/web/src/api/transcription.ts

export const createSession = (data: CreateSessionRequest) =>
  request<TranscriptionSession>('/transcriptions/sessions', { method: 'POST', body: data });

export const updateSessionStatus = (id: string, status: string) =>
  request<TranscriptionSession>(`/transcriptions/sessions/${id}/status`, { method: 'PATCH', body: { status } });

export const getSession = (id: string) =>
  request<TranscriptionSessionWithNote>(`/transcriptions/sessions/${id}`);

export const getPatientSessions = (patientId: string) =>
  request<TranscriptionSession[]>(`/transcriptions/sessions/patient/${patientId}`);

export const generateNote = (id: string, templateType?: string) =>
  request<TranscriptionNote>(`/transcriptions/sessions/${id}/generate`, { method: 'POST', body: { templateType } });

export const acceptNote = (id: string, data: AcceptNoteRequest) =>
  request<Encounter>(`/transcriptions/sessions/${id}/accept`, { method: 'POST', body: data });

export const rejectNote = (id: string) =>
  request<void>(`/transcriptions/sessions/${id}/reject`, { method: 'POST' });

export const recordConsent = (data: RecordConsentRequest) =>
  request<TranscriptionConsent>('/transcriptions/consent', { method: 'POST', body: data });

export const getPatientConsent = (patientId: string) =>
  request<TranscriptionConsent[]>(`/transcriptions/consent/patient/${patientId}`);

export const getSuggestedCodes = (id: string) =>
  request<SuggestedCodes>(`/transcriptions/sessions/${id}/codes`);
```

---

## 6. Workflow Integration

### Clinician Workflow (Happy Path)

```
1. Appointment status → "checked_in"
2. Provider opens PatientChart
3. Clicks "Start AI Scribe"
4. ConsentDialog appears (if no prior consent for this patient)
   → Provider records verbal/written consent
5. TemplateSelector shown → Provider picks "SOAP Note"
6. TranscriptionPanel activates:
   - Heidi Widget starts ambient recording
   - Live transcript streams in sidebar
7. Consultation proceeds naturally
8. Provider clicks "End & Generate Note"
   - Session status → "processing"
   - Heidi API generates structured note
   - Loading state shown (typically 10-30 seconds)
9. NotePreview displays:
   - Pre-filled SOAP fields
   - Suggested ICD-10 codes
   - Confidence score
10. Provider reviews, edits fields as needed
11. Clicks "Accept & Create Encounter"
    - Encounter created with AI-generated content
    - transcription_session linked to encounter
    - ai_assisted flag set to true
12. Provider signs encounter as usual
13. All steps audit-logged
```

### Appointment Integration Points

```
Appointment Status    │  Transcription Actions Available
──────────────────────┼────────────────────────────────
scheduled             │  None
confirmed             │  None
checked_in            │  "Start AI Scribe" button appears
in_progress           │  Active recording / generate note
completed             │  View past transcription, re-generate
cancelled / no_show   │  None
```

### Encounter Linking

When a transcription note is accepted:
1. If no encounter exists for this visit → create new encounter with SOAP fields from AI
2. If encounter exists (e.g., partially written) → offer to merge AI output into existing fields
3. `encounter.ai_assisted = true` marks AI-generated encounters for compliance tracking
4. `encounter.transcription_session_id` links back to the transcription

### Existing Referral System Synergy

The AI scribe can generate referral letters from the same transcription:
- After SOAP note generation, offer "Also generate referral letter"
- Uses same Heidi session transcript with a different template
- Referral letter stored as a document (category: `letter`)
- Links to the same transcription session

---

## 7. Security & Compliance

### HIPAA Requirements

| Requirement | Implementation |
|------------|----------------|
| **BAA with Heidi** | Execute BAA before any PHI transmission. Heidi offers BAAs for enterprise plans. |
| **Minimum Necessary** | Send only patient context needed for transcription (name, DOB for speaker identification). Never send full medical history. |
| **Encryption in Transit** | Heidi API uses TLS 1.2+. Our API already enforces HTTPS. |
| **Encryption at Rest** | Transcripts and notes encrypted in our DB (Neon.tech provides encryption at rest). |
| **Audit Trail** | All transcription actions logged via existing audit middleware. New resource types: `transcription_session`, `transcription_note`, `transcription_consent`. |
| **Patient Consent** | Mandatory consent recording before first transcription per patient. Stored in `transcription_consents` table. |
| **Data Retention** | Heidi deletes audio after transcription. We retain only text transcripts and notes. Define retention policy (suggest 7 years per medical records standard). |
| **Access Control** | Only `provider` and `nurse` roles can create/view transcription sessions. Sessions scoped to the assigned provider. |

### Audio Data Handling

```
Audio Flow (Heidi manages this):
  Browser mic → Heidi servers (encrypted) → Transcribed → Audio deleted

Our system NEVER stores audio files.
We only store:
  - Text transcript (returned by Heidi API)
  - Structured note (generated by Heidi)
  - Session metadata (timestamps, status, etc.)
```

### Consent Workflow

1. **First visit**: Consent dialog shown, provider records patient's response
2. **Subsequent visits**: Check `transcription_consents` for prior consent
   - If prior consent exists → show reminder banner, allow override
   - If declined → do not show scribe option unless patient re-consents
3. **Consent record is immutable** — new records created for changes, never updated
4. **Audit log** captures all consent interactions

### API Key Security

- `HEIDI_API_KEY` stored as environment variable (never in code)
- Key scoped to specific Heidi region
- Rotate quarterly or on suspected exposure
- Rate limiting on our transcription endpoints to prevent abuse

### Role-Based Access

```
Transcription Permissions:
  provider  → Create, view own, accept/reject, manage templates
  nurse     → Create, view (assisting provider), cannot sign
  admin     → View all, manage templates, view analytics
  secretary → No access to transcription content
  billing   → View suggested codes only (for billing workflows)
```

---

## 8. Implementation Phases

### Phase 1: Foundation (2–3 weeks)

**Goal**: Database schema, basic API, Heidi client, consent tracking

- [ ] Create migration `008_transcription_sessions.sql`
- [ ] Implement `heidi-client.service.ts` (Heidi API wrapper)
- [ ] Implement `transcription.service.ts` (session CRUD, note storage)
- [ ] Add transcription routes with auth/audit middleware
- [ ] Add consent recording endpoint
- [ ] Add environment variables to config
- [ ] Add feature flag (`HEIDI_ENABLED`)
- [ ] Write unit tests for services
- [ ] Write integration tests for routes

### Phase 2: Frontend — Recording & Review (2–3 weeks)

**Goal**: Embed Heidi Widget, build review UI

- [ ] Install Heidi Widget SDK (`@heidihealth/widget-sdk`)
- [ ] Build `TranscriptionPanel` with Heidi Widget embedded
- [ ] Build `ConsentDialog` component
- [ ] Build `TemplateSelector` component
- [ ] Build `NotePreview` component with editable fields
- [ ] Build `TranscriptionControls` (start/stop/cancel)
- [ ] Add transcription API client module
- [ ] Integrate into `PatientChart.tsx` (new tab)
- [ ] Add "Start AI Scribe" button to Dashboard
- [ ] Write component tests

### Phase 3: Encounter Integration (1–2 weeks)

**Goal**: Connect AI notes to encounters, coding suggestions

- [ ] Implement accept/reject workflow (note → encounter)
- [ ] Build encounter merge logic (AI + existing encounter)
- [ ] Build `CodingSuggestions` component
- [ ] Add `ai_assisted` flag to encounter display
- [ ] Build `TranscriptionHistory` for past sessions
- [ ] Link transcription sessions in encounter detail view
- [ ] Write E2E tests for full workflow

### Phase 4: Polish & Compliance (1–2 weeks)

**Goal**: Production readiness

- [ ] Security review (use `security-reviewer` agent)
- [ ] HIPAA compliance audit of all data flows
- [ ] Execute BAA with Heidi Health
- [ ] Add analytics/metrics (acceptance rate, edit frequency, time savings)
- [ ] Error handling for Heidi API failures (graceful degradation)
- [ ] Offline fallback messaging
- [ ] Provider onboarding documentation
- [ ] Load testing with concurrent transcription sessions

### Total Estimated Effort: 6–10 weeks

---

## 9. Alternative: Build-Your-Own AI Scribe

If Heidi pricing is prohibitive or API access is restricted, we can build a similar pipeline using components we already have:

### Architecture

```
Browser MediaRecorder API
  → WebSocket to our API
    → Whisper API (OpenAI) or Deepgram for transcription
      → Claude API (already integrated) for SOAP note structuring
        → Store in same schema as above
```

### Pros
- No external scribe vendor dependency
- Full control over data (no PHI leaves our infrastructure)
- Already have Claude API integration for referral extraction
- Lower per-session cost at scale

### Cons
- Significant development effort (audio handling, streaming, speaker diarization)
- Lower transcription quality than Heidi's specialized medical models
- No pre-built template library or community
- Must handle audio storage/deletion ourselves
- No ICD-10/CPT coding without additional ML

### Recommendation

**Start with Heidi** (Phase 1–4 above). The Widget SDK minimizes frontend work, the API handles the complex audio/ML pipeline, and the compliance certifications (SOC 2, HIPAA BAA) reduce our liability. If usage grows beyond the cost-effective range, consider migrating to a self-hosted solution using the same database schema and API contracts.

---

## Appendix: Shared Types

```typescript
// packages/shared/src/types.ts — additions

export interface TranscriptionSession {
  id: string;
  encounterId: string | null;
  appointmentId: string | null;
  patientId: string;
  providerId: string;
  externalSessionId: string | null;
  externalProvider: 'heidi' | 'built_in';
  status: 'pending' | 'recording' | 'processing' | 'completed' | 'failed' | 'cancelled';
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  templateUsed: string | null;
  language: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptionNote {
  id: string;
  sessionId: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  fullTranscript: string | null;
  summary: string | null;
  suggestedIcdCodes: SuggestedCode[];
  suggestedCptCodes: SuggestedCode[];
  confidenceScore: number | null;
  wordCount: number | null;
  speakerCount: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  accepted: boolean | null;
  modifications: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedCode {
  code: string;
  description: string;
  confidence: number;
}

export interface TranscriptionTemplate {
  id: string;
  providerId: string;
  name: string;
  templateType: 'soap' | 'progress_note' | 'referral_letter' |
                'operative_note' | 'assessment_report' | 'custom';
  sections: TemplateSection[];
  isDefault: boolean;
  externalTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSection {
  name: string;
  prompt: string;
  required: boolean;
}

export interface TranscriptionConsent {
  id: string;
  patientId: string;
  providerId: string;
  sessionId: string | null;
  consentGiven: boolean;
  consentMethod: 'verbal' | 'written' | 'electronic';
  notes: string | null;
  recordedAt: string;
}
```
