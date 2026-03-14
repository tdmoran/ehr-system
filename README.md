# EHR System

A full-stack Electronic Health Record system built with TypeScript, featuring patient management, clinical documentation, appointment scheduling, document management with OCR, AI-powered referral processing, AI transcription, and HIPAA-compliant audit logging.

## Quick Start

```bash
# Start the full stack (PostgreSQL + API + Web)
npm run dev

# Or run services individually
npm run dev:api    # API on :3000
npm run dev:web    # Web on :5173
```

## Tech Stack

- **Backend**: Node.js 20, Express.js 4.18, TypeScript 5.3, PostgreSQL (Neon.tech)
- **Frontend**: React 18.2, Vite 5.0, Tailwind CSS 3.4, React Router 6
- **AI**: Anthropic SDK (Claude) for referral extraction, AITranscription Health for ambient transcription

## Features

- Patient management with demographics, contact, and insurance
- Clinical documentation (SOAP notes) with encounter history
- Appointment scheduling with status workflow
- Document upload and OCR processing (Tesseract.js)
- AI-powered referral letter extraction
- AI transcription with ambient medical scribe
- HIPAA-compliant audit logging
- Role-based access control (provider, nurse, admin, billing, secretary)

## AI Transcription (AITranscription)

The AI transcription feature enables clinicians to record patient visits and automatically generate structured clinical notes using AITranscription Health's ambient AI scribe.

### Capabilities

- Ambient recording via browser microphone with real-time waveform visualization
- Live transcript streaming over WebSocket
- AI-generated SOAP notes with configurable templates
- ICD-10 and CPT code suggestions with confidence scores
- Patient consent capture (electronic with digital signature, verbal, written)
- Note review and editing with auto-save
- Encounter creation from accepted AI notes

### Quick Setup

1. Run the migration: `npm run db:migrate`
2. Copy `.env.ai-transcription` to your `.env` and fill in AITranscription credentials
3. Set `HEIDI_ENABLED=true`
4. Restart the API: `npm run dev:api`
5. Navigate to `/transcriptions` in the web app

### Documentation

- [Feature Documentation](docs/AITRANSCRIPTION_FEATURE.md) -- Architecture, API reference, component guide
- [Setup Guide](docs/AITRANSCRIPTION_SETUP.md) -- Step-by-step configuration
- [Testing Guide](docs/AITRANSCRIPTION_TESTING.md) -- Test strategy and examples

## Common Commands

```bash
npm run dev              # Start full stack with Docker
npm run build            # Build all packages
npm run db:migrate       # Run database migrations
npm run test             # Run tests (Vitest)
npm run lint             # ESLint on all packages
```

## Project Structure

```
packages/
  api/              # Express backend
  web/              # React frontend
  shared/           # Shared TypeScript types
database/
  migrations/       # SQL migration files
  seeds/            # Database seeding
docs/               # Feature documentation
scripts/            # Utility scripts
```

## Environment Variables

```
DATABASE_URL=postgresql://...     # PostgreSQL connection string
JWT_SECRET=...                    # JWT signing secret
CORS_ORIGIN=...                   # Frontend URL for CORS
ANTHROPIC_API_KEY=...             # Claude API key (referral extraction)
HEIDI_API_BASE_URL=...            # AITranscription API base URL
HEIDI_API_KEY=...                 # AITranscription API key
HEIDI_ENABLED=true                # Enable AI transcription feature
```

## Deployment

- **Production**: Render.io (`render.yaml`)
- **Database**: Neon.tech PostgreSQL
- **Frontend domain**: sxrooms.net
