import { useState, useEffect, useRef, useCallback, CSSProperties, ReactElement } from 'react';
import { List as VirtualList, ListImperativeAPI } from 'react-window';
import { Link } from 'react-router-dom';
import { transcriptionsApi, TranscriptionSession } from '../../api/transcriptions';
import { api, Patient } from '../../api/client';
import { useIsMobile } from '../../hooks/useIsMobile';
import { WaveformVisualizer } from './WaveformVisualizer';
import {
  MicrophoneIcon,
  RecordDotIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  XIcon,
  SpinnerIcon,
  ArrowLeftIcon,
  UserIcon,
  ExclamationIcon,
} from './transcription-icons';

// ─── Types ──────────────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'paused' | 'processing' | 'error';

interface TranscriptLine {
  readonly speaker: string;
  readonly text: string;
  readonly timestamp: number;
}

interface LiveRecordingProps {
  /** Pre-selected patient ID (e.g. from patient chart) */
  readonly initialPatientId?: string;
  /** Pre-selected appointment ID */
  readonly appointmentId?: string;
  /** Whether navigation originated from a patient chart */
  readonly fromPatientChart?: boolean;
  /** Called when recording session completes successfully */
  readonly onSessionComplete?: (session: TranscriptionSession) => void;
  /** Called when user cancels recording */
  readonly onCancel?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AUDIO_CHUNK_INTERVAL_MS = 5000;
const WS_RECONNECT_DELAY_MS = 3000;
const MAX_WS_RECONNECT_ATTEMPTS = 5;
const TRANSCRIPT_LINE_HEIGHT = 32;
const TRANSCRIPT_VISIBLE_HEIGHT = 256;
const MAX_TRANSCRIPT_LINES = 500;

// ─── Component ──────────────────────────────────────────────────────────────

export function LiveRecording({
  initialPatientId,
  appointmentId,
  fromPatientChart = false,
  onSessionComplete,
  onCancel,
}: LiveRecordingProps) {
  const isMobile = useIsMobile();

  // ── State ───────────────────────────────────────────────────────────────
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeAnalyser, setActiveAnalyser] = useState<AnalyserNode | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<readonly TranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Patient selector state
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(initialPatientId ?? null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<readonly Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectAttemptsRef = useRef(0);
  const transcriptListRef = useRef<ListImperativeAPI>(null);
  const patientDropdownRef = useRef<HTMLDivElement | null>(null);

  // ── Patient search with debounce ────────────────────────────────────────

  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatients([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setPatientsLoading(true);
      const { data, error: apiError } = await api.getPatients(patientSearch);
      if (data && !apiError) {
        setPatients(data.patients);
      }
      setPatientsLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [patientSearch]);

  // Load initial patient if ID provided
  useEffect(() => {
    if (!initialPatientId) return;

    (async () => {
      const { data } = await api.getPatient(initialPatientId);
      if (data) {
        setSelectedPatient(data.patient);
      }
    })();
  }, [initialPatientId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll transcript to latest line
  useEffect(() => {
    if (transcriptLines.length > 0) {
      transcriptListRef.current?.scrollToRow({
        index: transcriptLines.length - 1,
        align: 'end',
      });
    }
  }, [transcriptLines]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopMediaResources();
      stopTimer();
      disconnectWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Media / Audio helpers ───────────────────────────────────────────────

  const stopMediaResources = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    setActiveAnalyser(null);
  }, []);

  // ── Timer helpers ───────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // ── WebSocket for live transcript ───────────────────────────────────────

  const connectWebSocket = useCallback((sid: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : window.location.host;
    const wsUrl = `${protocol}//${host}/api/transcriptions/${sid}/live`;

    setConnectionStatus('connecting');

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Authenticate via message instead of query string
      const token = localStorage.getItem('token');
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }
      wsReconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'transcript': {
            const line: TranscriptLine = {
              speaker: message.speaker ?? 'Unknown',
              text: message.text ?? '',
              timestamp: message.timestamp ?? Date.now(),
            };
            setTranscriptLines((prev) => {
              const next = [...prev, line];
              return next.length > MAX_TRANSCRIPT_LINES
                ? next.slice(next.length - MAX_TRANSCRIPT_LINES)
                : next;
            });
            break;
          }
          case 'status': {
            if (message.status === 'connected') {
              setConnectionStatus('connected');
            } else if (message.status === 'completed' || message.status === 'failed') {
              setRecordingState(message.status === 'completed' ? 'processing' : 'error');
              if (message.error) {
                setError(message.error);
              }
            }
            break;
          }
          case 'error': {
            setError(message.error ?? 'Transcription error');
            break;
          }
          default:
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      // Auto-reconnect with exponential backoff if still recording
      if (wsReconnectAttemptsRef.current < MAX_WS_RECONNECT_ATTEMPTS) {
        const attempt = wsReconnectAttemptsRef.current;
        wsReconnectAttemptsRef.current += 1;
        const delay = WS_RECONNECT_DELAY_MS * Math.pow(1.5, attempt);
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            connectWebSocket(sid);
          }
        }, delay);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('disconnected');
    };

    wsRef.current = ws;
  }, []);

  const disconnectWebSocket = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionStatus('disconnected');
  }, []);

  // ── Recording controls ──────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    if (!selectedPatientId) {
      setError('Please select a patient before recording.');
      return;
    }

    setError(null);

    // 1. Request mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permissions in your browser settings.'
          : 'Could not access microphone. Please check your audio device.';
      setError(message);
      return;
    }

    mediaStreamRef.current = stream;

    // 2. Create session on backend
    const { data, error: apiError } = await transcriptionsApi.createSession({
      patientId: selectedPatientId,
      appointmentId,
    });

    if (apiError || !data) {
      setError(apiError ?? 'Failed to create transcription session.');
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const sid = data.session.id;
    setSessionId(sid);

    // 3. Set status to recording
    await transcriptionsApi.updateSessionStatus(sid, 'recording');

    // 4. Set up Web Audio API for waveform
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    // 5. Set up MediaRecorder for audio chunks
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && sid) {
        // Prefer WebSocket for real-time streaming; fall back to HTTP upload
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            if (base64 && currentWs.readyState === WebSocket.OPEN) {
              currentWs.send(JSON.stringify({ type: 'audio_chunk', data: base64 }));
            }
          };
          reader.readAsDataURL(event.data);
        } else {
          const { error: uploadError } = await transcriptionsApi.uploadAudioChunk(sid, event.data);
          if (uploadError) {
            console.error('Audio chunk upload failed:', uploadError);
          }
        }
      }
    };

    recorder.start(AUDIO_CHUNK_INTERVAL_MS);
    mediaRecorderRef.current = recorder;

    // 6. Connect WebSocket for live transcript
    connectWebSocket(sid);

    // 7. Start visualization and timer
    setActiveAnalyser(analyser);
    startTimer();
    setRecordingState('recording');
  }, [
    selectedPatientId,
    appointmentId,
    connectWebSocket,
    startTimer,
  ]);

  const handlePauseResume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recordingState === 'recording') {
      recorder.pause();
      stopTimer();
      setRecordingState('paused');
    } else if (recordingState === 'paused') {
      recorder.resume();
      startTimer();
      setRecordingState('recording');
    }
  }, [recordingState, stopTimer, startTimer]);

  const handleStopRecording = useCallback(async () => {
    setRecordingState('processing');
    stopTimer();
    stopMediaResources();
    disconnectWebSocket();

    if (!sessionId) return;

    // Update session status to processing
    const { error: statusError } = await transcriptionsApi.updateSessionStatus(sessionId, 'processing');
    if (statusError) {
      setError(statusError);
      setRecordingState('error');
      return;
    }

    // Trigger note generation
    const { data, error: genError } = await transcriptionsApi.generateNote(sessionId);
    if (genError || !data) {
      setError(genError ?? 'Note generation failed.');
      setRecordingState('error');
      return;
    }

    // Fetch final session
    const { data: sessionData } = await transcriptionsApi.getSession(sessionId);
    if (sessionData) {
      onSessionComplete?.(sessionData.session);
    }
  }, [sessionId, stopTimer, stopMediaResources, disconnectWebSocket, onSessionComplete]);

  const handleCancel = useCallback(async () => {
    stopTimer();
    stopMediaResources();
    disconnectWebSocket();
    setRecordingState('idle');
    setElapsedSeconds(0);
    setTranscriptLines([]);

    if (sessionId) {
      await transcriptionsApi.updateSessionStatus(sessionId, 'cancelled');
    }

    onCancel?.();
  }, [sessionId, stopTimer, stopMediaResources, disconnectWebSocket, onCancel]);

  // ── Patient selection ───────────────────────────────────────────────────

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatientId(patient.id);
    setSelectedPatient(patient);
    setPatientSearch('');
    setShowPatientDropdown(false);
  }, []);

  const clearPatient = useCallback(() => {
    setSelectedPatientId(null);
    setSelectedPatient(null);
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────

  const formattedTime = formatDuration(elapsedSeconds);
  const isRecordingActive = recordingState === 'recording' || recordingState === 'paused';
  const canStart = recordingState === 'idle' && selectedPatientId !== null;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MicrophoneIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live Recording
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge recordingState={recordingState} />
          <ConnectionBadge status={connectionStatus} />
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Back to Patient Chart link */}
        {fromPatientChart && initialPatientId && (
          <Link
            to={`/patients/${initialPatientId}`}
            className="inline-flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Patient Chart
          </Link>
        )}

        {/* Recording for Patient banner (when from patient chart) */}
        {fromPatientChart && selectedPatient && (
          <div className="flex items-center gap-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg px-4 py-3">
            <UserIcon className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                Recording for: {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              <p className="text-xs text-teal-600 dark:text-teal-400">
                MRN: {selectedPatient.mrn}
              </p>
            </div>
          </div>
        )}

        {/* Patient Selector (hidden when pre-selected from patient chart) */}
        {recordingState === 'idle' && !fromPatientChart && (
          <div ref={patientDropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Patient
            </label>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedPatient.lastName}, {selectedPatient.firstName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    MRN: {selectedPatient.mrn}
                  </span>
                </div>
                <button
                  onClick={clearPatient}
                  className="p-3 -mr-2 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Clear patient selection"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  placeholder="Search patient by name or MRN..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
                {showPatientDropdown && patientSearch.trim() && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patientsLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Searching...
                      </div>
                    ) : patients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        No patients found
                      </div>
                    ) : (
                      patients.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => handleSelectPatient(patient)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {patient.lastName}, {patient.firstName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            MRN: {patient.mrn} | DOB: {patient.dateOfBirth}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Waveform Visualization (DOM-driven, no React re-renders) */}
        {isRecordingActive && (
          <WaveformVisualizer
            analyser={activeAnalyser}
            isPaused={recordingState === 'paused'}
          />
        )}

        {/* Timer */}
        {(isRecordingActive || recordingState === 'processing') && (
          <div className="text-center">
            <span className="text-3xl font-mono font-semibold text-gray-900 dark:text-white tabular-nums">
              {formattedTime}
            </span>
          </div>
        )}

        {/* Controls — touch-friendly on mobile */}
        <div className={isMobile ? 'flex flex-wrap items-center justify-center gap-2' : 'flex items-center justify-center gap-3'}>
          {recordingState === 'idle' && (
            <button
              onClick={handleStartRecording}
              disabled={!canStart}
              className={isMobile
                ? 'flex items-center justify-center gap-2 w-full px-6 py-4 text-base bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]'
                : 'flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]'}
            >
              <RecordDotIcon className="w-5 h-5" />
              Start Recording
            </button>
          )}

          {isRecordingActive && (
            <>
              <button
                onClick={handlePauseResume}
                className={isMobile
                  ? 'flex flex-1 items-center justify-center gap-2 px-4 py-3.5 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 active:bg-yellow-700 transition-colors min-h-[48px]'
                  : 'flex items-center gap-2 px-5 py-3 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 transition-colors min-h-[44px]'}
              >
                {recordingState === 'recording' ? (
                  <>
                    <PauseIcon className="w-5 h-5" />
                    Pause
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-5 h-5" />
                    Resume
                  </>
                )}
              </button>

              <button
                onClick={handleStopRecording}
                className={isMobile
                  ? 'flex flex-1 items-center justify-center gap-2 px-4 py-3.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors min-h-[48px]'
                  : 'flex items-center gap-2 px-5 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors min-h-[44px]'}
              >
                <StopIcon className="w-5 h-5" />
                {isMobile ? 'Stop' : 'Stop & Generate Note'}
              </button>

              <button
                onClick={handleCancel}
                className={isMobile
                  ? 'flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors min-h-[44px]'
                  : 'flex items-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]'}
              >
                <XIcon className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}

          {recordingState === 'processing' && (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <SpinnerIcon className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Processing transcription...</span>
            </div>
          )}
        </div>

        {/* Live Transcript Display (virtualized) */}
        {(isRecordingActive || recordingState === 'processing') && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Live Transcript
              </h3>
            </div>
            <div className="p-4">
              {transcriptLines.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  Waiting for speech...
                </p>
              ) : (
                <VirtualList<TranscriptRowProps>
                  listRef={transcriptListRef}
                  style={{
                    height: Math.min(
                      TRANSCRIPT_VISIBLE_HEIGHT,
                      transcriptLines.length * TRANSCRIPT_LINE_HEIGHT
                    ),
                  }}
                  rowCount={transcriptLines.length}
                  rowHeight={TRANSCRIPT_LINE_HEIGHT}
                  rowComponent={TranscriptRow}
                  rowProps={{ lines: transcriptLines }}
                  overscanCount={5}
                />
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <ExclamationIcon className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              {recordingState === 'error' && (
                <button
                  onClick={() => {
                    setError(null);
                    setRecordingState('idle');
                    setElapsedSeconds(0);
                    setTranscriptLines([]);
                  }}
                  className="mt-2 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline min-h-[44px]"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ recordingState }: { readonly recordingState: RecordingState }) {
  const config: Record<RecordingState, { label: string; dotClass: string; bgClass: string }> = {
    idle: {
      label: 'Ready',
      dotClass: 'bg-gray-400',
      bgClass: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    },
    recording: {
      label: 'Recording',
      dotClass: 'bg-red-500 animate-pulse',
      bgClass: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    },
    paused: {
      label: 'Paused',
      dotClass: 'bg-yellow-500',
      bgClass: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    },
    processing: {
      label: 'Processing',
      dotClass: 'bg-blue-500 animate-pulse',
      bgClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    },
    error: {
      label: 'Error',
      dotClass: 'bg-red-600',
      bgClass: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    },
  };

  const { label, dotClass, bgClass } = config[recordingState];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bgClass}`}>
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

function ConnectionBadge({ status }: { readonly status: 'disconnected' | 'connecting' | 'connected' }) {
  if (status === 'disconnected') return null;

  const isConnected = status === 'connected';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isConnected
          ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
        }`}
      />
      {isConnected ? 'Live transcription active' : 'Connecting...'}
    </span>
  );
}

interface TranscriptRowProps {
  readonly lines: readonly TranscriptLine[];
}

function TranscriptRow({ index, style, lines }: { index: number; style: CSSProperties; lines: readonly TranscriptLine[] }): ReactElement {
  const line = lines[index];
  return (
    <div style={style} className="text-sm flex items-center">
      <span className="font-medium text-teal-700 dark:text-teal-400 flex-shrink-0">
        {line.speaker}:
      </span>
      <span className="text-gray-800 dark:text-gray-200 ml-1 truncate">{line.text}</span>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

