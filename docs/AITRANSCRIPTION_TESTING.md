# AITranscription Testing Guide

## Test Structure

Tests for the AITranscription feature are organized by layer:

```
packages/api/src/
  services/__tests__/
    transcription.service.test.ts       # Unit tests for session/note/template/consent logic
    ai-transcription-client.test.ts     # Unit tests for AITranscription API client
  routes/__tests__/
    transcriptions.test.ts              # Integration tests for all API endpoints
packages/web/src/
  components/transcriptions/__tests__/
    TranscriptionDashboard.test.tsx     # Component tests
    LiveRecording.test.tsx              # Component tests
    NoteEditor.test.tsx                 # Component tests
    ConsentModal.test.tsx               # Component tests
  hooks/__tests__/
    useTranscriptions.test.ts           # Hook tests
```

## Running Tests

```bash
# Run all tests
npm run test

# Run only transcription-related tests
npx vitest run --reporter=verbose packages/api/src/services/__tests__/transcription*
npx vitest run --reporter=verbose packages/api/src/routes/__tests__/transcription*
npx vitest run --reporter=verbose packages/web/src/components/transcriptions/__tests__/*

# Watch mode for development
npx vitest watch packages/api/src/services/__tests__/transcription*
```

## Unit Testing: transcription.service.ts

### What to Test

| Function | Key Scenarios |
|----------|--------------|
| `createSession` | Creates session with correct defaults; calls AITranscription client when enabled; stores external session ID; handles AITranscription API failure |
| `findSessionById` | Returns session by ID; returns null for missing ID |
| `findSessionsByPatientId` | Returns sessions ordered by `created_at` DESC; returns empty array for no results |
| `updateSessionStatus` | Updates status and timestamps correctly; sets `started_at` on `recording`; sets `ended_at` and `duration_seconds` on terminal states; appends error message |
| `generateNote` | Calls AITranscription API for transcript and note; stores all fields; updates session to `completed`; throws for missing external session ID |
| `acceptNote` | Marks note as accepted; creates new encounter when no `encounterId`; updates existing encounter; links encounter to session; applies modifications |
| `rejectNote` | Marks note as rejected with reviewer info |
| `getSuggestedCodes` | Returns stored codes from note; falls back to AITranscription API; returns empty arrays when no codes available |
| `updateNote` | Updates specified fields only; preserves unspecified fields; handles empty update |
| `createTemplate` | Creates template; unsets other defaults when `isDefault: true` |
| `updateTemplate` | Updates specified fields; returns null for missing ID |
| `deleteTemplate` | Deletes template; returns false for missing ID |
| `recordConsent` | Creates consent record with all fields |
| `findConsentsByPatientId` | Returns consents ordered by `recorded_at` DESC |

### Mocking Strategy

Mock the database `query` and `withTransaction` functions:

```typescript
import { vi } from 'vitest';

vi.mock('../db/index.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn((fn) => fn({
    query: vi.fn(),
  })),
}));

vi.mock('./aiTranscription-client.service.js', () => ({
  isAITranscriptionEnabled: vi.fn(),
  createAITranscriptionSession: vi.fn(),
  generateStructuredNote: vi.fn(),
  getTranscript: vi.fn(),
  getSuggestedCodes: vi.fn(),
}));
```

## Unit Testing: ai-transcription-client.service.ts

### What to Test

| Function | Key Scenarios |
|----------|--------------|
| `createAITranscriptionSession` | Sends correct request body; returns session ID and URL |
| `getTranscript` | URL-encodes external session ID; returns transcript with word/speaker counts |
| `generateStructuredNote` | Sends template type; returns structured SOAP fields and codes |
| `getSuggestedCodes` | Returns ICD and CPT code arrays |
| `getSessionStatus` | Returns status and optional error |
| `isAITranscriptionEnabled` | Returns config value |
| Error handling | Throws `AITranscriptionApiError` on non-OK response; throws when disabled; throws when not configured |

### Mocking Strategy

Mock `fetch` globally and the config:

```typescript
vi.mock('../config/index.js', () => ({
  config: {
    aiTranscription: {
      apiBaseUrl: 'https://api.test.heidihealth.com',
      apiKey: 'test-api-key',
      enabled: true,
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;
```

## Integration Testing: transcriptions routes

### What to Test

Test each endpoint with real HTTP requests against the Express router:

| Endpoint | Key Scenarios |
|----------|--------------|
| `POST /sessions` | 201 on valid request; 503 when feature disabled; 401 without auth; 403 for unauthorized roles; 400 on invalid body |
| `PATCH /sessions/:id/status` | 200 on valid status transition; 404 for missing session; 403 for another provider's session |
| `GET /sessions/:id` | 200 with session and note; 404 for missing session |
| `GET /sessions/patient/:patientId` | 200 with session list; audit log created |
| `POST /sessions/:id/generate` | 201 on success; 400 if already completed; 404 for missing session |
| `POST /sessions/:id/accept` | 200 creates/updates encounter; 403 for non-owner |
| `POST /sessions/:id/reject` | 200 marks as rejected; 403 for non-owner |
| `PUT /sessions/:id/note` | 200 updates note fields; 404 for missing session |
| `GET /sessions/:id/codes` | 200 returns codes; accessible by billing role |
| Template CRUD | Full lifecycle; provider isolation |
| Consent endpoints | Create and list; audit logging |

### Test Setup

Use `supertest` with the Express app:

```typescript
import request from 'supertest';
import { app } from '../../app.js';

// Helper to create an authenticated request
function authRequest(method: string, path: string, token: string) {
  return request(app)[method](`/api/transcriptions${path}`)
    .set('Authorization', `Bearer ${token}`);
}
```

## Component Testing: Frontend

### TranscriptionDashboard

- Renders empty state when no sessions
- Renders session table with correct data
- Filters by status
- Filters by patient search
- Sorts by column
- Paginates
- Calls `onViewSession` and `onEditSession` callbacks
- Delete button disabled for recording/processing sessions
- Shows error state and retry button

### LiveRecording

- Renders patient search when idle
- Requests microphone permission on start
- Shows waveform visualization during recording
- Displays live transcript lines
- Pause/resume toggles recording state
- Stop triggers note generation
- Cancel cancels session
- Shows error message on failure
- Handles microphone permission denial

### NoteEditor

- Loads and displays session/note data
- Pre-fills SOAP fields from note
- Auto-saves on field change (debounced)
- Switches template types
- Shows AI suggestions from transcript
- Apply suggestion appends to field
- Dismiss suggestion removes chip
- Finalize creates encounter
- Shows confidence score badge
- Shows save status indicator

### ConsentModal

- Renders patient info
- Enables submit only when both checkboxes checked
- Electronic consent requires signature
- Digital signature canvas works with mouse and touch
- Clear signature resets state
- Records consent on submit
- Handles decline flow
- Print/PDF export works

### Mocking APIs

```typescript
vi.mock('../../api/transcriptions', () => ({
  transcriptionsApi: {
    getSession: vi.fn(),
    updateNote: vi.fn(),
    acceptNote: vi.fn(),
    createSession: vi.fn(),
    updateSessionStatus: vi.fn(),
    generateNote: vi.fn(),
    recordConsent: vi.fn(),
  },
}));
```

## Coverage Targets

| Layer | Target |
|-------|--------|
| `transcription.service.ts` | 90%+ |
| `ai-transcription-client.service.ts` | 90%+ |
| `routes/transcriptions.ts` | 80%+ |
| Frontend components | 80%+ |
| Overall AITranscription feature | 80%+ |

## Test Data Factories

Create reusable factory functions for test data:

```typescript
function buildSession(overrides: Partial<TranscriptionSession> = {}): TranscriptionSession {
  return {
    id: 'session-uuid',
    patientId: 'patient-uuid',
    providerId: 'provider-uuid',
    encounterId: null,
    appointmentId: null,
    externalSessionId: 'ext-session-123',
    externalProvider: 'aiTranscription',
    status: 'completed',
    startedAt: new Date('2026-03-14T10:00:00Z'),
    endedAt: new Date('2026-03-14T10:15:00Z'),
    durationSeconds: 900,
    templateUsed: 'soap',
    language: 'en',
    errorMessage: null,
    createdAt: new Date('2026-03-14T10:00:00Z'),
    updatedAt: new Date('2026-03-14T10:15:00Z'),
    ...overrides,
  };
}

function buildNote(overrides: Partial<TranscriptionNote> = {}): TranscriptionNote {
  return {
    id: 'note-uuid',
    sessionId: 'session-uuid',
    chiefComplaint: 'Sore throat for 2 weeks',
    subjective: 'Patient reports persistent sore throat...',
    objective: 'Pharynx erythematous, no exudate...',
    assessment: 'Acute pharyngitis',
    plan: 'Symptomatic treatment, follow-up in 1 week',
    fullTranscript: 'Dr: What brings you in today?\nPatient: ...',
    summary: 'Visit for sore throat, acute pharyngitis diagnosed',
    suggestedIcdCodes: [{ code: 'J02.9', description: 'Acute pharyngitis', confidence: 0.92 }],
    suggestedCptCodes: [{ code: '99213', description: 'Office visit', confidence: 0.88 }],
    confidenceScore: 0.94,
    wordCount: 450,
    speakerCount: 2,
    reviewedBy: null,
    reviewedAt: null,
    accepted: null,
    modifications: null,
    createdAt: new Date('2026-03-14T10:15:00Z'),
    updatedAt: new Date('2026-03-14T10:15:00Z'),
    ...overrides,
  };
}
```

## E2E Testing

For end-to-end tests of the full transcription workflow, use Playwright:

```typescript
test('complete transcription workflow', async ({ page }) => {
  // 1. Login as provider
  await page.goto('/login');
  await page.fill('[name=email]', 'provider@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // 2. Navigate to transcriptions
  await page.goto('/transcriptions');
  await expect(page.getByText('AI Transcriptions')).toBeVisible();

  // 3. Start new session
  await page.click('text=New Session');
  await expect(page.getByText('Live Recording')).toBeVisible();

  // 4. Select patient
  await page.fill('input[placeholder*="Search patient"]', 'Smith');
  await page.click('text=Smith, John');

  // 5. Note: actual recording requires microphone mock
  // See Playwright docs on mocking getUserMedia
});
```

### Mocking Microphone in Playwright

```typescript
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dest = ctx.createMediaStreamDestination();
    oscillator.connect(dest);
    oscillator.start();
    return dest.stream;
  };
});
```
