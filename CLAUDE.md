# CLAUDE.md - EHR System

## Project Overview

This is a full-stack Electronic Health Record (EHR) system built with TypeScript. It features patient management, clinical documentation (SOAP notes), appointment scheduling, document management with OCR, AI-powered referral processing, and HIPAA-compliant audit logging.

## Tech Stack

**Backend (packages/api):**
- Node.js 20 + Express.js 4.18
- TypeScript 5.3
- PostgreSQL (pg 8.17) - deployed on Neon.tech
- JWT authentication with bcryptjs
- Zod for validation
- Tesseract.js for OCR
- Anthropic SDK (Claude) for AI extraction

**Frontend (packages/web):**
- React 18.2 + React Router 6
- Vite 5.0
- Tailwind CSS 3.4
- TypeScript 5.3

**Shared (packages/shared):**
- TypeScript type definitions shared between packages

## Project Structure

```
/
├── packages/
│   ├── api/              # Express backend
│   │   ├── src/
│   │   │   ├── routes/   # API route handlers
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/
│   │   │   └── config/
│   │   ├── uploads/      # Patient document storage
│   │   └── procedure-templates/  # Reference procedure documents
│   ├── web/              # React frontend
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── hooks/
│   │       └── services/
│   └── shared/           # Shared TypeScript types
├── database/
│   ├── migrations/       # SQL migration files
│   └── seeds/            # Database seeding
├── scripts/              # Utility scripts
├── docker-compose.yml    # Local development
└── render.yaml           # Production deployment
```

## Common Commands

```bash
# Development (full stack with Docker)
npm run dev              # Start postgres, api, web in Docker

# Individual services
npm run dev:api          # API only (tsx watch mode)
npm run dev:web          # Frontend only (Vite dev server)

# Build
npm run build            # Build all packages

# Database
npm run db:migrate       # Run migrations
npm run db:setup         # Initial database setup
npm run db:add-secretary # Add secretary user

# Testing
npm run test             # Run tests (Vitest)

# Linting
npm run lint             # ESLint on all packages
```

## Development Ports

- PostgreSQL: 5432
- API: 3000
- Web: 5173

## Architecture

### API Routes

All routes prefixed with `/api`:
- `/api/auth` - Login, logout, current user
- `/api/patients` - Patient CRUD, search
- `/api/encounters` - Clinical visit documentation
- `/api/documents` - File upload/management
- `/api/appointments` - Scheduling
- `/api/ocr` - Document OCR processing
- `/api/referrals` - Referral letter processing
- `/api/calendar` - Events and on-call tracking
- `/api/tasks` - Patient task management

### Middleware Stack

1. `authenticate` - JWT verification (401 if invalid)
2. `authorize` - Role-based access control
3. `validate` - Zod schema validation
4. `audit` - HIPAA compliance logging

### User Roles

- `provider` - Doctors/clinicians
- `nurse` - Nursing staff
- `admin` - System administrators
- `billing` - Billing department
- `secretary` - Front desk/scheduling

### Procedure Templates Repository

The `packages/api/procedure-templates/` folder contains comprehensive patient information documents for common otolaryngology procedures. These serve as reference materials that can be used for any patient:

**Current Procedures:**
- **Tonsillectomy**: Complete patient guide including indications, procedure details, post-op care, risks/complications
- **Septoplasty**: Detailed information on nasal septum surgery, recovery timeline, and expected outcomes

**Usage:**
- Pre-operative patient education
- Informed consent discussions
- Post-operative instruction reference
- Standard information delivery across patients

Documents are in Markdown format and can be converted to PDF for distribution.

## Database

**Important:** The database is hosted on Neon.tech. When making schema changes, create new migration files in `database/migrations/` and run `npm run db:migrate` to apply them to the live database.

PostgreSQL with these core tables:
- `users` - Authentication and roles
- `patients` - Demographics, contact, insurance
- `allergies` - Patient allergies
- `encounters` - SOAP notes (subjective, objective, assessment, plan)
- `documents` - Uploaded files
- `appointments` - Scheduling with status workflow
- `provider_schedules` - Availability
- `audit_log` - HIPAA compliance trail
- `referral_scans`, `referral_ocr_results` - AI referral processing
- `patient_tasks`, `calendar_events`, `on_call_periods` - Organization

### Appointment Status Flow

scheduled → confirmed → checked_in → in_progress → completed
                                                  → cancelled
                                                  → no_show

## Code Conventions

- Services contain business logic, routes handle HTTP
- All database queries use parameterized statements (SQL injection safe)
- Zod schemas validate all request bodies
- JWT tokens expire after 8 hours
- All patient data access is audit logged

## Environment Variables

```
DATABASE_URL=postgresql://...   # PostgreSQL connection string
JWT_SECRET=...                  # JWT signing secret
CORS_ORIGIN=...                 # Frontend URL for CORS
ANTHROPIC_API_KEY=...           # Claude API key (for AI extraction)
```

## Deployment

- **Production:** Render.io (render.yaml config)
- **Database:** Neon.tech PostgreSQL (requires SSL)
- **Frontend domain:** sxrooms.net

## Key Files for Reference

- `packages/api/src/config/index.ts` - Configuration
- `packages/shared/src/types.ts` - Type definitions
- `database/migrations/` - Schema evolution
- `packages/api/src/services/` - Core business logic
