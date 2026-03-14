import { query } from '../db/index.js';
import { logger } from '../utils/logger.js';

// ─── Configuration ───────────────────────────────────────────────────────────

/** How old a pending/recording session must be before cleanup (in hours). */
const STALE_SESSION_AGE_HOURS = 4;

/** How often the cleanup job runs (in milliseconds). */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** Maximum sessions to clean up per run (prevents long-running queries). */
const MAX_CLEANUP_BATCH = 100;

// ─── Cleanup Logic ───────────────────────────────────────────────────────────

/**
 * Mark stale pending/recording sessions as failed.
 * A session is considered stale if it has been in 'pending' or 'recording'
 * status for longer than STALE_SESSION_AGE_HOURS.
 */
export async function cleanupStaleSessions(): Promise<number> {
  const cutoffHours = STALE_SESSION_AGE_HOURS;

  try {
    const result = await query(
      `UPDATE transcription_sessions
       SET status = 'failed',
           error_message = 'Session timed out — automatically cleaned up',
           ended_at = NOW(),
           updated_at = NOW()
       WHERE status IN ('pending', 'recording')
         AND created_at < NOW() - INTERVAL '1 hour' * $1
       LIMIT $2
       RETURNING id`,
      [cutoffHours, MAX_CLEANUP_BATCH]
    );

    const cleanedCount = result.rowCount ?? 0;

    if (cleanedCount > 0) {
      logger.info('Transcription cleanup: marked stale sessions as failed', {
        count: cleanedCount,
        cutoffHours,
      });
    }

    return cleanedCount;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Transcription cleanup: failed to clean stale sessions', {
      error: message,
    });
    return 0;
  }
}

/**
 * Clean up orphaned processing sessions that never completed.
 * These are sessions stuck in 'processing' for too long.
 */
export async function cleanupStuckProcessing(): Promise<number> {
  const processingTimeoutHours = 1;

  try {
    const result = await query(
      `UPDATE transcription_sessions
       SET status = 'failed',
           error_message = 'Processing timed out — automatically cleaned up',
           ended_at = NOW(),
           updated_at = NOW()
       WHERE status = 'processing'
         AND updated_at < NOW() - INTERVAL '1 hour' * $1
       RETURNING id`,
      [processingTimeoutHours]
    );

    const cleanedCount = result.rowCount ?? 0;

    if (cleanedCount > 0) {
      logger.info('Transcription cleanup: marked stuck processing sessions as failed', {
        count: cleanedCount,
        timeoutHours: processingTimeoutHours,
      });
    }

    return cleanedCount;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Transcription cleanup: failed to clean stuck processing sessions', {
      error: message,
    });
    return 0;
  }
}

/**
 * Run all cleanup tasks.
 */
export async function runCleanup(): Promise<{
  readonly staleSessions: number;
  readonly stuckProcessing: number;
}> {
  logger.debug('Transcription cleanup: starting cleanup run');

  const [staleSessions, stuckProcessing] = await Promise.all([
    cleanupStaleSessions(),
    cleanupStuckProcessing(),
  ]);

  return { staleSessions, stuckProcessing };
}

// ─── Background Scheduler ────────────────────────────────────────────────────

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic cleanup job.
 */
export function startCleanupJob(): void {
  if (cleanupInterval) {
    logger.warn('Transcription cleanup: job already running');
    return;
  }

  logger.info('Transcription cleanup: starting periodic job', {
    intervalMs: CLEANUP_INTERVAL_MS,
    staleAgeHours: STALE_SESSION_AGE_HOURS,
  });

  // Run immediately on start
  runCleanup().catch((error) => {
    logger.error('Transcription cleanup: initial run failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });

  cleanupInterval = setInterval(() => {
    runCleanup().catch((error) => {
      logger.error('Transcription cleanup: scheduled run failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the periodic cleanup job.
 */
export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Transcription cleanup: job stopped');
  }
}
