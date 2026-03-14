# Medical Accuracy Improvement Plan

A practical roadmap for achieving high medical transcription accuracy in our EHR AI transcription system, informed by Heidi Health's approach and tailored to our ENT-focused practice.

---

## 1. How Heidi Health Achieves Medical Accuracy

Heidi Health is an Australian AI medical scribe that has achieved widespread adoption (used by thousands of clinicians across Australia, UK, and NZ). Their accuracy strategy rests on several pillars:

### Speech Recognition Tuned for Medicine
- Uses a **medical-domain speech model** rather than generic Whisper — either a fine-tuned variant or a proprietary model trained on clinical audio (accented English, varied recording conditions, overlapping speech).
- **Custom vocabulary injection** for drug names, procedures, and anatomy (e.g., "Augmentin", "tympanoplasty", "inferior turbinate") so the ASR layer does not hallucinate common medical words as phonetically similar everyday words.

### NLP & Medical Context Understanding
- A **two-stage pipeline**: raw ASR output is post-processed by an LLM with a medical system prompt that corrects terminology, resolves ambiguity, and structures output.
- Uses **speaker diarization** to distinguish clinician speech from patient speech, which is critical for mapping statements to the correct SOAP section (patient-reported symptoms → Subjective, clinician findings → Objective).
- **Contextual priming** — the LLM receives the patient's known problem list, medications, and allergies so it can bias toward contextually plausible terms (e.g., hearing "metroprolol" and correcting to "metoprolol" because it is on the med list).

### Template-Based Structured Output
- Offers **specialty-specific templates** (GP, dermatology, psychiatry, ENT, etc.) so the note structure matches what each specialty expects.
- Templates are not just formatting — they inform the LLM about which information to extract and where to place it.
- Supports **customizable templates** so individual clinicians can match their personal documentation style.

### Continuous Learning from Corrections
- When a clinician edits the generated note, the diff is captured and used as **preference signal**.
- Over time, the system learns per-clinician style (level of detail, preferred phrasing, common diagnoses) — a form of few-shot personalization without model retraining.
- Aggregated corrections across all users surface **systematic ASR or LLM errors** that are fixed in the next model update.

### Medical Terminology Handling
- Maintains a curated **medical lexicon** (drug databases, ICD/SNOMED code descriptions, anatomy ontologies).
- Post-ASR normalization maps phonetic variants to canonical terms (e.g., "bee pee" → "BP", "oh two sats" → "O2 sats").
- Abbreviation expansion and standardization based on specialty context.

---

## 2. Our Current Approach vs Heidi

### What We Have Now

| Component | Implementation | File |
|-----------|---------------|------|
| Speech-to-text | OpenAI Whisper API (`whisper-1`) — generic model, no medical tuning | `whisper-service.ts` |
| Note generation | Claude Sonnet via Anthropic SDK — single generic medical scribe prompt | `llm-note-generator.ts` |
| External integration | AITranscription client (Heidi API passthrough) — delegates to external service | `ai-transcription-client.service.ts` |
| Template support | 6 template types (SOAP, progress, referral, operative, assessment, custom) — but templates only change a one-line instruction, not the extraction logic | `llm-note-generator.ts:178-189` |
| Patient context | Name, DOB, known conditions passed to prompt — but no medication list, no allergy list, no prior notes | `llm-note-generator.ts:31-36` |
| Speaker diarization | `speakerLabels` field exists in the interface but is **never used in the prompt** | `llm-note-generator.ts:30` |
| Medical vocabulary | None — relies entirely on Whisper's general vocabulary | — |
| Correction learning | None — edits are not tracked or fed back | — |
| Coding suggestions | ICD-10 and CPT codes generated but with no validation against a code database | `llm-note-generator.ts:14-16` |
| Resilience | Circuit breakers + retry with exponential backoff on both services | Both services |

### Gaps Compared to Heidi

| Gap | Impact | Severity |
|-----|--------|----------|
| **No medical vocabulary for Whisper** | Drug names, procedures, and anatomy terms are frequently mis-transcribed | Critical |
| **Speaker diarization not wired in** | Cannot reliably separate patient-reported symptoms from clinician observations, leading to SOAP section mixing | High |
| **Generic prompt, no specialty tuning** | ENT-specific terminology and note conventions are not reflected in the LLM prompt | High |
| **No few-shot examples** | The LLM has no examples of what a good ENT SOAP note looks like | High |
| **Shallow patient context** | Missing medication list, allergies, and prior encounter history — the LLM cannot validate or contextualize terms | Medium |
| **No correction feedback loop** | Provider edits are lost; the same mistakes repeat every session | Medium |
| **No post-ASR normalization** | Abbreviations, slang, and phonetic variants pass through as-is | Medium |
| **Template instructions are too thin** | One sentence per template type does not meaningfully guide extraction | Medium |
| **No code validation** | Suggested ICD/CPT codes may be invalid or retired | Low |

---

## 3. Improvement Roadmap

### Phase 1: Immediate Improvements (1–2 weeks)

**Goal:** Improve note quality with zero infrastructure changes — prompt engineering and vocabulary only.

#### 1a. Medical Terminology Dictionary for Whisper

Create a `prompt` parameter payload for the Whisper API call that includes common medical terms. OpenAI Whisper supports a `prompt` field that biases recognition toward specific vocabulary.

```typescript
// In whisper-service.ts, add a medical prompt
const MEDICAL_PROMPT = [
  // ENT anatomy
  'tympanic membrane', 'inferior turbinate', 'nasal septum', 'eustachian tube',
  'tonsillar fossa', 'uvula', 'larynx', 'pharynx', 'nasopharynx',
  'cochlea', 'ossicles', 'mastoid', 'cricothyroid',
  // Common ENT conditions
  'otitis media', 'otitis externa', 'sinusitis', 'tonsillitis',
  'cholesteatoma', 'tinnitus', 'vertigo', 'Meniere disease',
  'sensorineural hearing loss', 'conductive hearing loss',
  'obstructive sleep apnea', 'deviated septum',
  // Medications
  'amoxicillin', 'augmentin', 'azithromycin', 'fluticasone',
  'mometasone', 'ciprofloxacin', 'ofloxacin', 'dexamethasone',
  'prednisolone', 'pseudoephedrine', 'cetirizine',
  // Procedures
  'tympanoplasty', 'myringotomy', 'septoplasty', 'tonsillectomy',
  'adenoidectomy', 'FESS', 'endoscopy', 'audiogram',
  'tympanometry', 'laryngoscopy',
].join(', ');

// Pass as `prompt` in the Whisper API call
formData.append('prompt', MEDICAL_PROMPT);
```

**Effort:** ~2 hours. **Impact:** Significant reduction in medical term mis-transcription.

#### 1b. Specialty-Specific LLM Prompts (ENT Focus)

Rewrite `buildPrompt()` to include ENT-specific guidance, common findings, and expected note structure.

```typescript
// Add ENT-specific system context
const ENT_CONTEXT = `
You are an expert ENT (Otolaryngology) medical scribe. You are documenting a visit
at an ENT specialist clinic. Common topics include:
- Ear: hearing loss, tinnitus, otitis media/externa, cholesteatoma, ear tubes
- Nose: sinusitis, deviated septum, nasal polyps, epistaxis, rhinitis
- Throat: tonsillitis, pharyngitis, laryngitis, dysphagia, sleep apnea
- Head & Neck: thyroid nodules, salivary gland disorders, neck masses

When documenting:
- Use standard ENT examination terminology (e.g., "TMs clear bilaterally",
  "nasal mucosa boggy", "oropharynx clear")
- Document hearing test results in standard format (PTA, SRT, WRS)
- Note laterality (left, right, bilateral) for all ear/nose findings
- Include Weber/Rinne test results when mentioned
`;
```

**Effort:** ~4 hours. **Impact:** More accurate SOAP section mapping and terminology.

#### 1c. Few-Shot Examples for SOAP Notes

Add 2–3 exemplar ENT SOAP notes to the prompt so the LLM understands the expected output format and level of detail.

```typescript
const FEW_SHOT_EXAMPLE = `
Example of a well-structured ENT SOAP note:

Transcript: "Patient is a 45 year old male presenting with two months of left
sided hearing loss and intermittent tinnitus... [abbreviated]"

Output:
{
  "chiefComplaint": "Left-sided hearing loss and tinnitus x 2 months",
  "subjective": "45M presents with progressive left-sided hearing loss over 2 months
    with intermittent high-pitched tinnitus. Denies otalgia, otorrhea, vertigo.
    No recent URI or noise exposure. No family history of hearing loss.",
  "objective": "Otoscopy: Right TM intact, normal landmarks. Left TM intact but
    slightly retracted. Weber lateralizes to right. Rinne: AC>BC bilaterally.
    Audiogram: Left mild-moderate sensorineural hearing loss (30-55 dB HL,
    250-8000 Hz). Right WNL.",
  ...
}
`;
```

**Effort:** ~4 hours to craft quality examples. **Impact:** Consistent note quality and structure.

#### 1d. Wire Up Speaker Diarization

The `speakerLabels` field already exists but is ignored. Add it to the prompt so the LLM can distinguish doctor vs patient speech.

```typescript
// In buildPrompt(), add speaker context when available
if (options.speakerLabels?.length) {
  prompt += `\n\nSpeaker identification:\n`;
  prompt += `The transcript uses speaker labels. Map them as follows:\n`;
  prompt += options.speakerLabels.map(
    (label, i) => `- Speaker ${i + 1}: ${label}`
  ).join('\n');
  prompt += `\n\nUse speaker identity to place content in correct SOAP sections:`;
  prompt += `\n- Patient-reported information → Subjective`;
  prompt += `\n- Clinician observations/findings → Objective`;
}
```

**Effort:** ~2 hours. **Impact:** Correct SOAP section attribution.

---

### Phase 2: Enhanced Accuracy (1 month)

**Goal:** Add post-processing, richer context, and validation layers.

#### 2a. Post-ASR Medical Term Normalization

Create a normalization service that runs between Whisper output and LLM input.

**File:** `packages/api/src/services/medical-normalizer.ts`

Responsibilities:
- Map phonetic variants → canonical terms (e.g., "bee pee" → "BP", "oh two sats" → "O2 sats", "temp" → "temperature")
- Expand common abbreviations in context
- Correct common Whisper mis-hearings of drug names using a Levenshtein-distance lookup against a drug database
- Normalize vitals format (e.g., "one twenty over eighty" → "120/80 mmHg")

Data source: RxNorm (drugs), SNOMED CT (clinical terms), custom ENT dictionary.

**Effort:** ~2 weeks. **Impact:** Cleaner input to LLM = better notes.

#### 2b. Enriched Patient Context

Expand the patient context passed to the LLM to include:

```typescript
interface EnrichedPatientContext {
  readonly name?: string;
  readonly dateOfBirth?: string;
  readonly knownConditions?: readonly string[];
  readonly currentMedications?: readonly string[];    // NEW
  readonly allergies?: readonly string[];              // NEW
  readonly recentEncounterSummaries?: readonly string[]; // NEW — last 3 visits
  readonly referralReason?: string;                    // NEW — if referral visit
}
```

This allows the LLM to:
- Validate mentioned medications against the known med list
- Avoid suggesting contraindicated drugs
- Reference continuity of care (e.g., "follow-up from myringotomy on 2/15")

**Effort:** ~1 week (DB queries + prompt changes). **Impact:** Contextually grounded notes.

#### 2c. ICD/CPT Code Validation

Add a validation layer that checks suggested codes against a local database.

- Load ICD-10-CM and CPT code sets (publicly available TSV files)
- Validate that suggested codes exist and are active
- Cross-reference code descriptions with the note content for plausibility
- Filter out low-confidence codes (< 0.6) from the final output

**Effort:** ~3 days. **Impact:** No more invalid code suggestions.

#### 2d. Confidence-Based Flagging

When `confidenceScore < 0.7`, automatically flag sections that need provider review:

```typescript
interface GeneratedClinicalNote {
  // ... existing fields
  readonly reviewFlags: readonly ReviewFlag[];  // NEW
}

interface ReviewFlag {
  readonly section: 'subjective' | 'objective' | 'assessment' | 'plan';
  readonly reason: string;   // e.g., "Audio unclear at 2:31–2:45"
  readonly severity: 'info' | 'warning' | 'critical';
}
```

**Effort:** ~3 days. **Impact:** Providers know where to focus their review.

---

### Phase 3: Advanced Features (2–3 months)

**Goal:** Close the gap with Heidi through learning and specialization.

#### 3a. Correction Feedback Loop

Track provider edits to generated notes and use them for improvement.

**Database schema:**
```sql
CREATE TABLE note_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id),
  provider_id UUID REFERENCES users(id),
  section TEXT NOT NULL,          -- 'subjective', 'objective', etc.
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  correction_type TEXT,           -- 'terminology', 'missing_info', 'wrong_section', 'style'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Usage pipeline:**
1. Frontend diffs the AI-generated note against the saved note
2. Corrections are stored with categorization
3. Aggregate corrections surface systematic errors (e.g., "Whisper always transcribes 'Flonase' as 'flow nasal'")
4. Per-provider corrections become few-shot examples for that provider's future notes
5. Monthly review of top-20 corrections drives dictionary and prompt updates

**Effort:** ~3 weeks. **Impact:** System improves over time without model retraining.

#### 3b. Specialty-Specific Prompt Profiles

Extend the template system to full specialty profiles:

```typescript
interface SpecialtyProfile {
  readonly specialty: string;
  readonly systemPrompt: string;
  readonly fewShotExamples: readonly string[];
  readonly commonTerms: readonly string[];      // Whisper prompt
  readonly typicalExamFindings: readonly string[];
  readonly commonDiagnoses: readonly string[];
  readonly commonProcedures: readonly string[];
}
```

Start with ENT (our primary use case), then expand to:
- General Practice
- Oncology (head & neck)
- Audiology
- Allergy/Immunology

**Effort:** ~2 weeks per specialty. **Impact:** Specialty-grade accuracy.

#### 3c. EHR History Integration for Context

Before generating a note, pull the patient's recent history to prime the LLM:

- Last 3 encounter summaries
- Active problem list
- Current medication list
- Pending orders/referrals
- Recent lab/imaging results

This transforms the LLM from a "scribe with amnesia" to a "scribe who has read the chart."

**Effort:** ~2 weeks. **Impact:** Continuity-aware notes that reference prior visits.

#### 3d. Real-Time Medical Term Suggestions (Frontend)

As the provider speaks, show a sidebar with:
- Detected medical terms (highlighted in transcript)
- Suggested ICD codes updating in real-time
- Flagged unclear segments
- Alternative interpretations for ambiguous terms

**Effort:** ~3 weeks (WebSocket + React components). **Impact:** Provider can correct in real-time rather than post-hoc.

---

### Phase 4: Competitive Differentiation (3–6 months)

**Goal:** Surpass Heidi in areas relevant to our user base.

#### 4a. Multi-Language Medical Support

Our practice sees diverse patient populations. Support:
- **English** (primary) — already supported
- **Spanish** — second priority (large patient base)
- **Mandarin/Cantonese** — third priority

Implementation:
- Use Whisper's language detection + medical vocabulary per language
- LLM prompts in target language with bilingual medical term mapping
- Generate notes in English regardless of consultation language

**Effort:** ~1 month per language. **Impact:** Serve multilingual practices.

#### 4b. Procedure-Specific Templates

Leverage our existing procedure templates (`packages/api/procedure-templates/`) to create procedure-specific note generation:

- **Pre-op notes:** Auto-populate from template + patient-specific details
- **Operative notes:** Structured extraction of intra-op details (time, findings, technique, complications)
- **Post-op notes:** Follow-up-specific structure with recovery milestones

Templates already exist for tonsillectomy and septoplasty — extend the system to use them as LLM context.

**Effort:** ~2 weeks. **Impact:** Dramatically faster operative documentation.

#### 4c. Automated Coding Accuracy

Move beyond "suggested" codes to "validated" codes:
- Cross-reference note content with ICD-10 coding guidelines
- Apply coding rules (e.g., laterality modifiers, combination codes)
- Flag under-coding or over-coding patterns
- Compare against specialty-specific coding benchmarks
- Generate a "coding confidence report" for billing review

**Effort:** ~1 month. **Impact:** Revenue protection + compliance.

#### 4d. Quality Scoring System

Implement a note quality score that evaluates:

| Dimension | Weight | Measurement |
|-----------|--------|-------------|
| Completeness | 30% | All expected sections populated |
| Accuracy | 25% | Medical term correctness (validated against lexicon) |
| Consistency | 20% | No contradictions between sections |
| Coding alignment | 15% | Diagnosis codes match assessment text |
| Readability | 10% | Appropriate length, no repetition |

Display the score to providers with actionable suggestions for improvement.

**Effort:** ~2 weeks. **Impact:** Measurable quality + gamification of note quality.

---

## 4. Technical Implementation Details

### Model Fine-Tuning Approach

**Whisper fine-tuning (Phase 2+):**
- We do NOT need to fine-tune Whisper initially — the `prompt` parameter covers 80% of vocabulary issues
- If accuracy plateaus, consider using a medical-specific ASR model:
  - **Deepgram Nova Medical** — purpose-built medical ASR, API-compatible
  - **Azure Speech with custom vocabulary** — allows custom lexicon upload
  - **Whisper fine-tune** via OpenAI — requires 50+ hours of labeled medical audio (expensive to collect)

**LLM approach (no fine-tuning needed):**
- Claude is already strong at medical note generation
- Prompt engineering + few-shot examples + patient context is sufficient
- If needed, use Claude's tool-use feature to call a medical terminology validation API mid-generation

### Training Data Requirements

| Data Type | Source | Volume Needed | Phase |
|-----------|--------|--------------|-------|
| Medical vocabulary | RxNorm, SNOMED, ENT textbooks | ~5,000 terms | Phase 1 |
| Few-shot SOAP examples | De-identified real notes (provider-supplied) | 10–20 per specialty | Phase 1 |
| Correction data | Provider edits in production | 500+ corrections | Phase 3 |
| Labeled audio (if fine-tuning) | Recorded consultations (consented) | 50+ hours | Phase 2+ |
| ICD/CPT code database | CMS.gov (free download) | Full code set | Phase 2 |

### Infrastructure Needs

| Phase | Infrastructure Change |
|-------|----------------------|
| Phase 1 | None — prompt changes only |
| Phase 2 | New service file (`medical-normalizer.ts`), RxNorm/SNOMED data files (~50 MB), ICD/CPT lookup table in PostgreSQL |
| Phase 3 | `note_corrections` table, background job for correction aggregation, per-provider preference storage |
| Phase 4 | Multi-language vocabulary files, procedure template loader, quality scoring service |

### API Changes Required

**Phase 1 — no API changes**, internal prompt improvements only.

**Phase 2 — extend existing endpoints:**
```
PATCH /api/encounters/:id/note  →  capture original vs edited diff
GET  /api/patients/:id/context  →  return enriched patient context for LLM
```

**Phase 3 — new endpoints:**
```
GET  /api/providers/:id/preferences  →  provider-specific note style
POST /api/notes/:id/corrections      →  submit correction feedback
GET  /api/notes/:id/quality-score    →  retrieve quality assessment
```

**Phase 4 — new endpoints:**
```
GET  /api/procedures/:id/template    →  procedure-specific template
GET  /api/encounters/:id/coding      →  validated coding suggestions
```

---

## 5. Metrics & Evaluation

### How to Measure Accuracy

#### Word Error Rate (WER) — ASR Layer
- **Method:** Compare Whisper output against manually transcribed "gold standard" audio clips
- **Target:** < 10% WER for medical terms (Whisper generic is ~15–20% on medical audio)
- **Frequency:** Weekly sample of 10 random consultations

#### Medical Term Accuracy (MTA) — New Metric
- **Method:** Extract medical terms from transcript, check against validated term list
- **Formula:** `correct_medical_terms / total_medical_terms × 100`
- **Target:** > 95% for common ENT terms
- **Frequency:** Per-session, aggregated weekly

#### Note Quality Score (NQS) — LLM Layer
- **Method:** Automated scoring (see §4d) + monthly clinician review of 20 random notes
- **Dimensions:** Completeness, accuracy, consistency, coding alignment, readability
- **Target:** > 85% composite score
- **Frequency:** Per-note (automated), monthly (manual review)

#### Provider Edit Rate — Proxy for Accuracy
- **Method:** `(notes_edited / notes_generated) × 100` and `average_edit_distance`
- **Target:** < 30% of notes require edits; average edit < 50 words
- **Frequency:** Daily dashboard

### Benchmark Against Heidi

| Metric | Our Current (est.) | Heidi (est.) | Phase 1 Target | Phase 3 Target |
|--------|-------------------|-------------|----------------|----------------|
| Medical term WER | ~20% | ~8% | ~12% | ~8% |
| SOAP section accuracy | ~75% | ~90% | ~85% | ~92% |
| Provider edit rate | ~60% | ~25% | ~40% | ~20% |
| ICD code accuracy | ~50% | ~80% | ~65% | ~85% |
| Time to usable note | 3–5 min review | 1–2 min review | 2–3 min review | < 1 min review |

### Provider Satisfaction Metrics

Collect via in-app feedback after each note:
- **Net Promoter Score (NPS):** "How likely are you to recommend this AI scribe to a colleague?" (1–10)
- **Time Saved:** Self-reported minutes saved per consultation
- **Trust Score:** "How much do you trust the generated note without reviewing?" (1–5)
- **Feature Requests:** Free-text feedback aggregated monthly

**Target:** NPS > 50, Time Saved > 5 min/visit, Trust Score > 3.5/5 by end of Phase 3.

---

## Summary

| Phase | Timeline | Key Deliverables | Expected Impact |
|-------|----------|-----------------|-----------------|
| **1** | 1–2 weeks | Medical vocab for Whisper, ENT prompts, few-shot examples, speaker diarization | 30% fewer transcription errors |
| **2** | 1 month | Post-ASR normalizer, enriched context, code validation, confidence flags | 50% reduction in provider edits |
| **3** | 2–3 months | Correction feedback loop, specialty profiles, EHR history integration | Parity with Heidi |
| **4** | 3–6 months | Multi-language, procedure templates, validated coding, quality scores | Competitive differentiation |

**Recommended starting point for Tom:** Phase 1a (Whisper medical prompt) — it is a ~2 hour change to `whisper-service.ts` with immediate accuracy improvement.
