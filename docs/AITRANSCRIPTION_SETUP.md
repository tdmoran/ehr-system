# AITranscription Setup Guide

## Prerequisites

- Node.js 20+
- PostgreSQL (local Docker or Neon.tech)
- An AITranscription Health account (for external transcription)
- Browser with microphone access (Chrome/Edge recommended)

## Step 1: Run Database Migration

Apply the transcription schema migration:

```bash
npm run db:migrate
```

This creates the following tables:
- `transcription_sessions`
- `transcription_notes`
- `transcription_templates`
- `transcription_consents`

And adds `transcription_session_id` and `ai_assisted` columns to the `encounters` table.

## Step 2: Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.ai-transcription .env.ai-transcription.local
```

### Getting AITranscription Health API Credentials

1. Sign up at [AITranscription Health](https://www.heidihealth.com/) and select a plan (Free tier available)
2. Navigate to **Settings > API Access** in the AITranscription dashboard
3. Generate an API key
4. Note your region-specific API base URL:
   - US: `https://api.us.heidihealth.com`
   - AU: `https://api.au.heidihealth.com`
   - EU: `https://api.eu.heidihealth.com`
   - UK: `https://api.uk.heidihealth.com`
5. Add to your `.env` file:
   ```
   HEIDI_API_BASE_URL=https://api.us.heidihealth.com
   HEIDI_API_KEY=your-api-key-here
   HEIDI_ENABLED=true
   ```

### Running Without AITranscription (Feature Disabled)

If you don't have AITranscription credentials, the feature flag disables all transcription endpoints:

```
HEIDI_ENABLED=false
```

The API returns 503 for any transcription request when disabled.

## Step 3: WebSocket Configuration

The LiveRecording component uses WebSocket for real-time transcript streaming.

### Local Development

The WebSocket URL is derived from the `VITE_API_URL` environment variable:

```
# packages/web/.env.local
VITE_API_URL=http://localhost:3000
```

The WebSocket connection is made to:
```
ws://localhost:3000/api/transcriptions/{sessionId}/live
```

### Production

For production with HTTPS, WebSocket automatically upgrades to WSS:

```
wss://your-api-domain.com/api/transcriptions/{sessionId}/live
```

Ensure your reverse proxy (e.g., Render, Nginx) supports WebSocket upgrades:

**Nginx example**:
```nginx
location /api/transcriptions/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

### WebSocket Reconnection

The client automatically reconnects on disconnect:
- Max reconnect attempts: 5
- Reconnect delay: 3 seconds
- Only reconnects while MediaRecorder is actively recording

## Step 4: Browser Permissions

The LiveRecording component requests microphone access via `navigator.mediaDevices.getUserMedia`. Ensure:

1. The site is served over HTTPS (or `localhost` for development)
2. The user grants microphone permission when prompted
3. Audio settings: echo cancellation enabled, noise suppression enabled, 44.1kHz sample rate

## Step 5: Verify the Setup

### Start the development stack

```bash
npm run dev
```

### Test the API

```bash
# Login to get a JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"provider@example.com","password":"password"}' \
  | jq -r '.token')

# Check if transcription is enabled
curl -s http://localhost:3000/api/transcriptions/templates \
  -H "Authorization: Bearer $TOKEN" | jq .
```

If `HEIDI_ENABLED=true`, you should get `{ "templates": [] }`.
If `HEIDI_ENABLED=false`, you should get a 503 error.

### Test the frontend

1. Navigate to `http://localhost:5173/transcriptions`
2. You should see the TranscriptionDashboard with an empty session list
3. Click "New Session" to navigate to the LiveRecording view
4. Search and select a patient
5. Click "Start Recording" (allow microphone access)
6. The waveform visualization should animate
7. Stop recording to trigger note generation

## Step 6: Testing the Transcription Engine

### Manual End-to-End Test

1. **Create a session**: POST `/api/transcriptions/sessions` with a valid `patientId`
2. **Record consent**: POST `/api/transcriptions/consent` with `consentGiven: true`
3. **Start recording**: PATCH `/api/transcriptions/sessions/:id/status` with `status: "recording"`
4. **Stop and generate**: PATCH status to `"processing"`, then POST `/api/transcriptions/sessions/:id/generate`
5. **Review note**: GET `/api/transcriptions/sessions/:id` to see the generated note
6. **Accept or reject**: POST `/api/transcriptions/sessions/:id/accept` or `/reject`
7. **Verify encounter**: Check that an encounter was created with `ai_assisted: true`

### Checking Audit Logs

All transcription actions are audit-logged. Query the audit trail:

```sql
SELECT action, resource_type, resource_id, created_at
FROM audit_log
WHERE resource_type IN ('transcription_session', 'transcription_note', 'transcription_consent')
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 503 "Transcription feature is not enabled" | Set `HEIDI_ENABLED=true` in `.env` |
| 503 "AITranscription API is not configured" | Set `HEIDI_API_BASE_URL` and `HEIDI_API_KEY` |
| Microphone permission denied | Check browser settings, ensure HTTPS or localhost |
| WebSocket disconnects | Check proxy WebSocket upgrade support, increase timeout |
| "No external session ID available" | Session was created without AITranscription; enable the feature |
| Note generation fails | Check AITranscription API key validity and rate limits |
