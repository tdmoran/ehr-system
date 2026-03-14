import { logger } from '../utils/logger.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhisperTranscriptionResult {
  readonly text: string;
  readonly segments: readonly TranscriptSegment[];
  readonly language: string;
  readonly duration: number;
}

export interface TranscriptSegment {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly speaker?: string;
}

interface WhisperApiResponse {
  readonly text: string;
  readonly segments?: readonly {
    readonly start: number;
    readonly end: number;
    readonly text: string;
  }[];
  readonly language?: string;
  readonly duration?: number;
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
    logger.info('Whisper circuit breaker: half-open, allowing retry');
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    return;
  }

  throw new WhisperServiceError(
    'Whisper API circuit breaker is open — too many recent failures',
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
    logger.warn('Whisper circuit breaker opened', {
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

      // Don't retry on 4xx client errors
      if (error instanceof WhisperServiceError && error.statusCode >= 400 && error.statusCode < 500) {
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

export class WhisperServiceError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new WhisperServiceError('OPENAI_API_KEY is not configured', 503);
  }
  return key;
}

/**
 * Transcribe an audio buffer using the OpenAI Whisper API.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: {
    readonly language?: string;
    readonly filename?: string;
  } = {}
): Promise<WhisperTranscriptionResult> {
  checkCircuitBreaker();

  const apiKey = getApiKey();
  const filename = options.filename ?? 'audio.webm';

  return withRetry(async () => {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    if (options.language) {
      formData.append('language', options.language);
    }

    logger.info('Whisper API: sending transcription request', {
      fileSize: audioBuffer.length,
      language: options.language,
    });

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      recordFailure();
      throw new WhisperServiceError(
        `Whisper API error (${response.status}): ${body}`,
        response.status
      );
    }

    const data = (await response.json()) as WhisperApiResponse;
    recordSuccess();

    const segments: TranscriptSegment[] = (data.segments ?? []).map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    return {
      text: data.text,
      segments,
      language: data.language ?? options.language ?? 'en',
      duration: data.duration ?? 0,
    };
  }, 'Whisper transcription');
}

/**
 * Transcribe a stream of audio chunks, yielding partial results.
 * Each chunk is transcribed independently and results are concatenated.
 */
export async function transcribeChunk(
  chunk: Buffer,
  language?: string
): Promise<WhisperTranscriptionResult> {
  return transcribeAudio(chunk, { language, filename: 'chunk.webm' });
}

/**
 * Check whether the Whisper service is available.
 */
export function isWhisperAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY && !circuitBreaker.isOpen;
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
