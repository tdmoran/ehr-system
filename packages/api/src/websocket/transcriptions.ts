import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verify } from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import * as whisperService from '../services/whisper-service.js';
import * as localTranscription from '../services/local-transcription.js';
import * as transcriptionService from '../services/transcription.service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive?: boolean;
}

interface IncomingMessage {
  readonly type: 'auth' | 'audio_chunk' | 'stop' | 'ping';
  readonly token?: string;  // JWT for auth message
  readonly data?: string;   // base64-encoded audio for audio_chunk
}

interface OutgoingMessage {
  readonly type: 'transcript' | 'status' | 'error' | 'pong';
  readonly speaker?: string;
  readonly text?: string;
  readonly timestamp?: number;
  readonly status?: string;
  readonly error?: string;
}

// ─── Session Management ──────────────────────────────────────────────────────

// Maps sessionId -> set of connected WebSocket clients
const sessionClients = new Map<string, Set<AuthenticatedSocket>>();

function addClient(sessionId: string, ws: AuthenticatedSocket): void {
  const clients = sessionClients.get(sessionId) ?? new Set();
  clients.add(ws);
  sessionClients.set(sessionId, clients);
}

function removeClient(sessionId: string, ws: AuthenticatedSocket): void {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  clients.delete(ws);
  if (clients.size === 0) {
    sessionClients.delete(sessionId);
  }
}

function broadcastToSession(sessionId: string, message: OutgoingMessage): void {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;

  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

/**
 * Broadcast a transcript line to all clients in a session.
 * Can be called from other modules (e.g., audio upload route).
 */
export function broadcastTranscript(
  sessionId: string,
  speaker: string,
  text: string
): void {
  broadcastToSession(sessionId, {
    type: 'transcript',
    speaker,
    text,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast a status change to all clients in a session.
 */
export function broadcastStatus(
  sessionId: string,
  status: string,
  error?: string
): void {
  broadcastToSession(sessionId, {
    type: 'status',
    status,
    error,
  });
}

// ─── JWT Authentication ──────────────────────────────────────────────────────

function authenticateToken(token: string): string | null {
  try {
    const decoded = verify(token, config.jwt.secret) as { id: string };
    return decoded.id ?? null;
  } catch {
    return null;
  }
}

// ─── Audio Processing ────────────────────────────────────────────────────────

async function processAudioChunk(
  sessionId: string,
  audioBase64: string,
  language?: string
): Promise<void> {
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  try {
    let result;

    if (whisperService.isWhisperAvailable()) {
      result = await whisperService.transcribeChunk(audioBuffer, language);
    } else {
      result = localTranscription.createOfflineTranscription(audioBuffer, { language });
    }

    if (result.text.trim()) {
      broadcastTranscript(sessionId, 'Speaker', result.text.trim());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    logger.error('WebSocket: audio chunk processing failed', {
      sessionId,
      error: message,
    });
    broadcastToSession(sessionId, {
      type: 'error',
      error: message,
    });
  }
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;

function startHeartbeat(wss: WebSocketServer): NodeJS.Timeout {
  return setInterval(() => {
    for (const ws of wss.clients as Set<AuthenticatedSocket>) {
      if (!ws.isAlive) {
        logger.debug('WebSocket: terminating dead connection', {
          sessionId: ws.sessionId,
        });
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

// ─── WebSocket Server Setup ──────────────────────────────────────────────────

export function setupTranscriptionWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: undefined, // We handle path matching manually below
    noServer: true,
  });

  const heartbeatInterval = startHeartbeat(wss);

  // Handle upgrade requests manually to support path-based routing
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/api\/transcriptions\/([a-f0-9-]+)\/live$/);

    if (!match) {
      // Not a transcription WebSocket path — ignore (let other handlers deal with it)
      return;
    }

    const sessionId = match[1];

    // Accept connection without auth — client must send auth message after connect
    wss.handleUpgrade(request, socket, head, (ws) => {
      const authenticatedWs = ws as AuthenticatedSocket;
      authenticatedWs.sessionId = sessionId;
      authenticatedWs.isAlive = true;
      // userId is set later via auth message

      wss.emit('connection', authenticatedWs, request);
    });
  });

  const AUTH_TIMEOUT_MS = 10_000;

  wss.on('connection', (ws: AuthenticatedSocket) => {
    const sessionId = ws.sessionId!;

    logger.info('WebSocket: client connected, awaiting auth', { sessionId });

    // Require auth message within timeout
    const authTimer = setTimeout(() => {
      if (!ws.userId) {
        logger.warn('WebSocket: auth timeout — closing connection', { sessionId });
        ws.send(JSON.stringify({ type: 'error', error: 'Authentication timeout' }));
        ws.close(4001, 'Authentication timeout');
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (rawData) => {
      try {
        const message: IncomingMessage = JSON.parse(rawData.toString());

        // Before auth, only accept auth messages
        if (!ws.userId) {
          if (message.type !== 'auth') {
            ws.send(JSON.stringify({ type: 'error', error: 'Authentication required' }));
            return;
          }

          if (!message.token) {
            ws.send(JSON.stringify({ type: 'error', error: 'Missing token' }));
            ws.close(4001, 'Missing token');
            clearTimeout(authTimer);
            return;
          }

          const userId = authenticateToken(message.token);
          if (!userId) {
            logger.warn('WebSocket: auth failed — invalid token', { sessionId });
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid token' }));
            ws.close(4001, 'Invalid token');
            clearTimeout(authTimer);
            return;
          }

          ws.userId = userId;
          clearTimeout(authTimer);
          addClient(sessionId, ws);
          logger.info('WebSocket: client authenticated', { sessionId, userId });
          ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
          return;
        }

        switch (message.type) {
          case 'audio_chunk': {
            if (!message.data) break;

            // Fetch session to get language
            const session = await transcriptionService.findSessionById(sessionId);
            const language = session?.language;

            await processAudioChunk(sessionId, message.data, language);
            break;
          }

          case 'stop': {
            broadcastStatus(sessionId, 'processing');
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }

          default:
            break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('WebSocket: message handling error', {
          sessionId,
          error: message,
        });
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      logger.info('WebSocket: client disconnected', { sessionId, userId: ws.userId });
      if (ws.userId) {
        removeClient(sessionId, ws);
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket: connection error', {
        sessionId,
        error: error.message,
      });
    });
  });

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    sessionClients.clear();
    logger.info('WebSocket server closed');
  });

  logger.info('Transcription WebSocket server initialized');

  return wss;
}

/**
 * Get count of active WebSocket connections (for health checks).
 */
export function getActiveConnectionCount(): number {
  let count = 0;
  for (const clients of sessionClients.values()) {
    count += clients.size;
  }
  return count;
}
