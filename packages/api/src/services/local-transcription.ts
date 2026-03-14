import { logger } from '../utils/logger.js';
import type { WhisperTranscriptionResult, TranscriptSegment } from './whisper-service.js';
import type { GeneratedClinicalNote } from './llm-note-generator.js';

// ─── Local Transcription Fallback ────────────────────────────────────────────
//
// Provides basic transcription capabilities when external APIs (OpenAI Whisper,
// Anthropic Claude) are unavailable. This is a minimal fallback for offline or
// degraded-mode operation — it stores raw audio metadata and returns placeholder
// transcripts that the clinician can manually complete.

export interface LocalTranscriptionResult {
  readonly text: string;
  readonly segments: readonly TranscriptSegment[];
  readonly language: string;
  readonly duration: number;
  readonly isOfflineFallback: true;
}

/**
 * Create a placeholder transcription result when external APIs are unavailable.
 * The audio buffer metadata is logged so it can be re-processed later.
 */
export function createOfflineTranscription(
  audioBuffer: Buffer,
  options: {
    readonly language?: string;
    readonly estimatedDurationSeconds?: number;
  } = {}
): LocalTranscriptionResult {
  const fileSizeKb = Math.round(audioBuffer.length / 1024);

  logger.info('Local transcription: creating offline placeholder', {
    fileSizeKb,
    language: options.language,
  });

  return {
    text: `[Offline transcription — ${fileSizeKb}KB audio received. Manual transcription required.]`,
    segments: [
      {
        start: 0,
        end: options.estimatedDurationSeconds ?? 0,
        text: '[Audio captured offline — pending transcription]',
      },
    ],
    language: options.language ?? 'en',
    duration: options.estimatedDurationSeconds ?? 0,
    isOfflineFallback: true,
  };
}

/**
 * Generate a placeholder clinical note structure when the LLM API is unavailable.
 * Returns empty SOAP fields that the clinician must fill in manually.
 */
export function createOfflineNote(
  transcript: string
): GeneratedClinicalNote {
  logger.info('Local transcription: creating offline note placeholder', {
    transcriptLength: transcript.length,
  });

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  return {
    chiefComplaint: null,
    subjective: transcript || null,
    objective: null,
    assessment: null,
    plan: null,
    summary: wordCount > 0
      ? `[Offline mode] Transcript captured (${wordCount} words). Manual note generation required.`
      : '[Offline mode] No transcript available. Manual documentation required.',
    confidenceScore: 0,
    suggestedIcdCodes: [],
    suggestedCptCodes: [],
  };
}

/**
 * Check if local/offline transcription mode should be used.
 * Returns true when both external APIs are unavailable.
 */
export function shouldUseOfflineMode(): boolean {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  return !hasOpenAI && !hasAnthropic;
}

/**
 * Estimate audio duration from buffer size.
 * Rough estimate based on typical WebM/Opus encoding at ~32kbps.
 */
export function estimateDuration(audioBuffer: Buffer): number {
  const bytesPerSecond = 4_000; // ~32kbps
  return Math.round(audioBuffer.length / bytesPerSecond);
}
