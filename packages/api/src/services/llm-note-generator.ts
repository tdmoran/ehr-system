import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedClinicalNote {
  readonly chiefComplaint: string | null;
  readonly subjective: string | null;
  readonly objective: string | null;
  readonly assessment: string | null;
  readonly plan: string | null;
  readonly summary: string | null;
  readonly confidenceScore: number;
  readonly suggestedIcdCodes: readonly SuggestedCode[];
  readonly suggestedCptCodes: readonly SuggestedCode[];
}

export interface SuggestedCode {
  readonly code: string;
  readonly description: string;
  readonly confidence: number;
}

export type NoteTemplate = 'soap' | 'progress_note' | 'referral_letter' |
  'operative_note' | 'assessment_report' | 'custom';

interface NoteGenerationOptions {
  readonly transcript: string;
  readonly templateType?: NoteTemplate;
  readonly speakerLabels?: readonly string[];
  readonly patientContext?: {
    readonly name?: string;
    readonly dateOfBirth?: string;
    readonly knownConditions?: readonly string[];
  };
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false,
};

function checkCircuitBreaker(): void {
  if (!circuitBreaker.isOpen) return;

  const elapsed = Date.now() - circuitBreaker.lastFailureTime;
  if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
    logger.info('LLM note generator circuit breaker: half-open, allowing retry');
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    return;
  }

  throw new NoteGeneratorError(
    'LLM note generator circuit breaker is open — too many recent failures',
    503
  );
}

function recordSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

function recordFailure(): void {
  circuitBreaker.failures += 1;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    logger.warn('LLM note generator circuit breaker opened', {
      failures: circuitBreaker.failures,
    });
  }
}

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === MAX_RETRIES) break;

      // Don't retry on client errors
      if (error instanceof NoteGeneratorError && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
      logger.warn(`${label}: attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`, {
        error: lastError.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ─── Error ───────────────────────────────────────────────────────────────────

export class NoteGeneratorError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Prompt Templates ────────────────────────────────────────────────────────

function buildPrompt(options: NoteGenerationOptions): string {
  const { transcript, templateType = 'soap', patientContext } = options;

  const patientInfo = patientContext
    ? `\nPatient context:\n- Name: ${patientContext.name ?? 'Unknown'}\n- DOB: ${patientContext.dateOfBirth ?? 'Unknown'}\n- Known conditions: ${patientContext.knownConditions?.join(', ') ?? 'None provided'}\n`
    : '';

  const templateInstructions = getTemplateInstructions(templateType);

  return `You are an expert medical scribe AI. Analyze the following clinical consultation transcript and generate a structured clinical note.
${patientInfo}
${templateInstructions}

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY a valid JSON object with this exact structure:
{
  "chiefComplaint": "Brief chief complaint or null if unclear",
  "subjective": "Patient's reported symptoms, history, concerns",
  "objective": "Observable findings, exam results mentioned",
  "assessment": "Clinical assessment and differential diagnoses",
  "plan": "Treatment plan, follow-ups, prescriptions",
  "summary": "1-2 sentence visit summary",
  "confidenceScore": 0.0 to 1.0,
  "suggestedIcdCodes": [{"code": "X00.0", "description": "...", "confidence": 0.0-1.0}],
  "suggestedCptCodes": [{"code": "99213", "description": "...", "confidence": 0.0-1.0}]
}

Important:
- Base all content strictly on what is discussed in the transcript
- Do not fabricate or infer information not present
- Use medical terminology appropriately
- Set confidenceScore based on transcript clarity and completeness
- Suggest relevant ICD-10-CM and CPT codes with confidence levels
- Return ONLY the JSON object, no surrounding text`;
}

function getTemplateInstructions(templateType: NoteTemplate): string {
  const instructions: Record<NoteTemplate, string> = {
    soap: 'Generate a standard SOAP (Subjective, Objective, Assessment, Plan) note.',
    progress_note: 'Generate a progress note focusing on changes since last visit and current status.',
    referral_letter: 'Generate a referral letter with reason for referral and relevant history.',
    operative_note: 'Generate an operative/procedure note with pre-op, intra-op, and post-op details.',
    assessment_report: 'Generate a comprehensive assessment report with findings and recommendations.',
    custom: 'Generate a structured clinical note with all relevant sections.',
  };

  return instructions[templateType] ?? instructions.soap;
}

// ─── Service ─────────────────────────────────────────────────────────────────

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new NoteGeneratorError('ANTHROPIC_API_KEY is not configured', 503);
  }
  return new Anthropic({ apiKey });
}

/**
 * Generate a structured clinical note from a transcript using Claude.
 */
export async function generateClinicalNote(
  options: NoteGenerationOptions
): Promise<GeneratedClinicalNote> {
  checkCircuitBreaker();

  if (!options.transcript.trim()) {
    throw new NoteGeneratorError('Transcript is empty', 400);
  }

  const prompt = buildPrompt(options);
  const client = getClient();

  return withRetry(async () => {
    logger.info('LLM note generator: sending request', {
      transcriptLength: options.transcript.length,
      templateType: options.templateType,
    });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      recordFailure();
      throw new NoteGeneratorError('No text response from LLM');
    }

    const responseText = textContent.text.trim();

    // Parse JSON — handle potential markdown code blocks
    let jsonStr = responseText;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      recordFailure();
      throw new NoteGeneratorError('Failed to parse LLM response as JSON');
    }

    recordSuccess();

    return {
      chiefComplaint: (parsed.chiefComplaint as string) ?? null,
      subjective: (parsed.subjective as string) ?? null,
      objective: (parsed.objective as string) ?? null,
      assessment: (parsed.assessment as string) ?? null,
      plan: (parsed.plan as string) ?? null,
      summary: (parsed.summary as string) ?? null,
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
      suggestedIcdCodes: Array.isArray(parsed.suggestedIcdCodes)
        ? parsed.suggestedIcdCodes.map(mapCode)
        : [],
      suggestedCptCodes: Array.isArray(parsed.suggestedCptCodes)
        ? parsed.suggestedCptCodes.map(mapCode)
        : [],
    };
  }, 'LLM note generation');
}

function mapCode(raw: unknown): SuggestedCode {
  const obj = raw as Record<string, unknown>;
  return {
    code: String(obj.code ?? ''),
    description: String(obj.description ?? ''),
    confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
  };
}

/**
 * Check whether the note generator is available.
 */
export function isNoteGeneratorAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && !circuitBreaker.isOpen;
}

/**
 * Get circuit breaker status for health checks.
 */
export function getCircuitBreakerStatus(): {
  readonly isOpen: boolean;
  readonly failures: number;
} {
  return {
    isOpen: circuitBreaker.isOpen,
    failures: circuitBreaker.failures,
  };
}
