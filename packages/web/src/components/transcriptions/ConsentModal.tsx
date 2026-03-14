import { useState, useRef, useCallback, useEffect } from 'react';
import type { Patient, ConsentMethod } from '@ehr/shared';
import { transcriptionsApi } from '../../api/transcriptions';
import { XIcon, CheckIcon, SpinnerIcon, ShieldIcon, UndoIcon, PrintIcon } from './transcription-icons';

// ─── Constants ──────────────────────────────────────────────────────────────

const CONSENT_TEXT_PARAGRAPHS = [
  'This clinical visit will be recorded using an AI-powered transcription system (AITranscription Health) to assist in generating clinical documentation.',
  'The audio from this visit will be temporarily processed by AITranscription Health\'s secure servers to produce a text transcript. Audio is deleted immediately after transcription — only the text transcript and structured clinical notes are retained.',
  'All data is encrypted in transit (TLS 1.2+) and at rest. AITranscription Health is SOC 2 Type 2 certified, ISO 27001 certified, and HIPAA compliant.',
  'The generated notes will be reviewed and approved by your clinician before being added to your medical record. You may withdraw consent at any time.',
];

const FULL_CONSENT_TEXT = CONSENT_TEXT_PARAGRAPHS.join('\n\n');

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConsentModalProps {
  readonly patient: Patient;
  readonly sessionId?: string;
  readonly onConsentRecorded: (consentId: string) => void;
  readonly onClose: () => void;
}

interface SignatureCanvasState {
  readonly isDrawing: boolean;
  readonly hasSignature: boolean;
}

interface Stroke {
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
}

const SIGNATURE_HEIGHT_MOBILE = 180;
const SIGNATURE_HEIGHT_DESKTOP = 150;
const STROKE_LINE_WIDTH = 2.5;

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConsentModal({
  patient,
  sessionId,
  onConsentRecorded,
  onClose,
}: ConsentModalProps) {
  const [consentMethod, setConsentMethod] = useState<ConsentMethod>('electronic');
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [aiTranscriptionConsentChecked, setAITranscriptionConsentChecked] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureState, setSignatureState] = useState<SignatureCanvasState>({
    isDrawing: false,
    hasSignature: false,
  });

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef<Stroke[]>([]);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isElectronic = consentMethod === 'electronic';
  const canSubmit =
    aiConsentChecked &&
    aiTranscriptionConsentChecked &&
    (!isElectronic || signatureState.hasSignature);

  // ─── Canvas Setup ───────────────────────────────────────────────────────

  const initCanvas = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = STROKE_LINE_WIDTH;
  }, []);

  const redrawStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    initCanvas(ctx);

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;
      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, STROKE_LINE_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [initCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    initCanvas(ctx);
    contextRef.current = ctx;

    // Redraw existing strokes after canvas re-init (e.g. orientation change)
    redrawStrokes();
  }, [consentMethod, isMobile, initCanvas, redrawStrokes]);

  // ─── Drawing Handlers ─────────────────────────────────────────────────

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();

      if ('touches' in e) {
        const touch = e.touches[0] ?? e.changedTouches[0];
        if (!touch) return null;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }

      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const point = getCanvasPoint(e);
      if (!point || !contextRef.current) return;

      currentPointsRef.current = [point];
      isDrawingRef.current = true;
      contextRef.current.beginPath();
      contextRef.current.moveTo(point.x, point.y);
      setSignatureState({ isDrawing: true, hasSignature: true });
    },
    [getCanvasPoint]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;

      const point = getCanvasPoint(e);
      if (!point || !contextRef.current) return;

      currentPointsRef.current = [...currentPointsRef.current, point];
      contextRef.current.lineTo(point.x, point.y);
      contextRef.current.stroke();
    },
    [getCanvasPoint]
  );

  const stopDrawing = useCallback(() => {
    if (!contextRef.current || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    contextRef.current.closePath();

    if (currentPointsRef.current.length > 0) {
      strokesRef.current = [
        ...strokesRef.current,
        { points: [...currentPointsRef.current] },
      ];
      currentPointsRef.current = [];
      setCanUndo(true);
    }

    setSignatureState((prev) => ({ ...prev, isDrawing: false }));
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    strokesRef.current = [];
    currentPointsRef.current = [];
    setCanUndo(false);
    setSignatureState({ isDrawing: false, hasSignature: false });
  }, []);

  const undoStroke = useCallback(() => {
    if (strokesRef.current.length === 0) return;

    strokesRef.current = strokesRef.current.slice(0, -1);
    const hasStrokes = strokesRef.current.length > 0;
    setCanUndo(hasStrokes);
    setSignatureState({ isDrawing: false, hasSignature: hasStrokes });
    redrawStrokes();
  }, [redrawStrokes]);

  const getSignatureDataUrl = useCallback((): string | undefined => {
    const canvas = canvasRef.current;
    if (!canvas || !signatureState.hasSignature) return undefined;
    return canvas.toDataURL('image/png');
  }, [signatureState.hasSignature]);

  // ─── Submit ───────────────────────────────────────────────────────────

  const handleRecordConsent = async () => {
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const signatureDataUrl = isElectronic ? getSignatureDataUrl() : undefined;

    const { data, error: apiError } = await transcriptionsApi.recordConsent({
      patientId: patient.id,
      sessionId,
      consentGiven: true,
      consentMethod,
      consentText: FULL_CONSENT_TEXT,
      signatureDataUrl,
      notes: notes.trim() || undefined,
    });

    if (apiError) {
      setError(apiError);
      setSaving(false);
      return;
    }

    if (data?.consent) {
      onConsentRecorded(data.consent.id);
    }
  };

  const handleDeclineConsent = async () => {
    setSaving(true);
    setError(null);

    const { error: apiError } = await transcriptionsApi.recordConsent({
      patientId: patient.id,
      sessionId,
      consentGiven: false,
      consentMethod,
      notes: notes.trim() || 'Patient declined AI transcription consent',
    });

    if (apiError) {
      setError(apiError);
      setSaving(false);
      return;
    }

    onClose();
  };

  // ─── Print / PDF ──────────────────────────────────────────────────────

  const handlePrintConsent = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const signatureImg = isElectronic ? getSignatureDataUrl() : null;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Patient Consent - AI Transcription</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
          h1 { font-size: 20px; border-bottom: 2px solid #0d9488; padding-bottom: 8px; }
          .patient-info { background: #f3f4f6; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }
          .patient-info p { margin: 4px 0; }
          .consent-text { line-height: 1.6; }
          .consent-text p { margin: 12px 0; }
          .checkboxes { margin: 20px 0; }
          .checkboxes label { display: block; margin: 8px 0; }
          .signature-section { margin-top: 24px; border-top: 1px solid #d1d5db; padding-top: 16px; }
          .signature-img { max-width: 300px; border: 1px solid #d1d5db; margin-top: 8px; }
          .signature-line { border-bottom: 1px solid #1f2937; width: 300px; margin-top: 40px; }
          .date { margin-top: 8px; font-size: 14px; color: #6b7280; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>Patient Consent for AI-Assisted Transcription</h1>
        <div class="patient-info">
          <p><strong>Patient:</strong> ${patient.firstName} ${patient.lastName}</p>
          <p><strong>MRN:</strong> ${patient.mrn}</p>
          <p><strong>Date of Birth:</strong> ${new Date(patient.dateOfBirth).toLocaleDateString('en-GB')}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
        </div>
        <div class="consent-text">
          ${CONSENT_TEXT_PARAGRAPHS.map((p) => `<p>${p}</p>`).join('')}
        </div>
        <div class="checkboxes">
          <label>[${aiConsentChecked ? 'X' : ' '}] Patient consents to AI-assisted transcription of this visit</label>
          <label>[${aiTranscriptionConsentChecked ? 'X' : ' '}] Patient understands data will be processed by AITranscription Health</label>
        </div>
        <div class="consent-section">
          <p><strong>Consent Method:</strong> ${consentMethod}</p>
          ${notes.trim() ? `<p><strong>Notes:</strong> ${notes.trim()}</p>` : ''}
        </div>
        <div class="signature-section">
          ${signatureImg ? `<p><strong>Digital Signature:</strong></p><img class="signature-img" src="${signatureImg}" alt="Patient signature" />` : '<p><strong>Signature:</strong></p><div class="signature-line"></div><p style="font-size:12px;color:#9ca3af;">Patient signature</p>'}
        </div>
        <p class="date">Recorded: ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-teal-600 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldIcon className="w-6 h-6 text-white" />
                <h2 className="text-xl font-semibold text-white">
                  Patient Consent for AI Transcription
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-white/80 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Patient Info */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-teal-700 dark:text-teal-400">
                  {patient.firstName[0]}{patient.lastName[0]}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {patient.firstName} {patient.lastName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  MRN: {patient.mrn}
                </p>
              </div>
            </div>

            {/* Consent Text */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">
                About AI Transcription
              </h4>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 space-y-3 max-h-48 overflow-y-auto">
                {CONSENT_TEXT_PARAGRAPHS.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConsentChecked}
                  onChange={(e) => setAiConsentChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Patient consents to AI-assisted transcription of this visit
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiTranscriptionConsentChecked}
                  onChange={(e) => setAITranscriptionConsentChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Patient understands data will be processed by AITranscription Health
                </span>
              </label>
            </div>

            {/* Consent Method */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Consent Method
              </label>
              <div className="flex gap-4">
                {(['electronic', 'verbal', 'written'] as const).map((method) => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="consentMethod"
                      value={method}
                      checked={consentMethod === method}
                      onChange={() => setConsentMethod(method)}
                      className="h-4 w-4 border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {method}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Digital Signature (electronic only) */}
            {isElectronic && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Digital Signature
                  </label>
                  <div className="flex items-center gap-3">
                    {canUndo && (
                      <button
                        type="button"
                        onClick={undoStroke}
                        className="text-xs text-gray-600 dark:text-gray-400 hover:underline flex items-center gap-1"
                      >
                        <UndoIcon className="w-3.5 h-3.5" />
                        Undo
                      </button>
                    )}
                    {signatureState.hasSignature && (
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline py-2 min-h-[44px]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height: `${isMobile ? SIGNATURE_HEIGHT_MOBILE : SIGNATURE_HEIGHT_DESKTOP}px` }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    onTouchCancel={stopDrawing}
                  />
                  {!signatureState.hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-sm text-gray-400 dark:text-gray-500">
                        Sign here
                      </span>
                    </div>
                  )}
                </div>
                {!signatureState.hasSignature && aiConsentChecked && aiTranscriptionConsentChecked && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    A digital signature is required for electronic consent
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                placeholder="Any additional notes about the consent..."
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrintConsent}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1 transition-colors py-2 min-h-[44px]"
              >
                <PrintIcon className="w-4 h-4" />
                View / Print
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeclineConsent}
                  disabled={saving}
                  className="px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 min-h-[44px]"
                >
                  Consent Declined
                </button>
                <button
                  type="button"
                  onClick={handleRecordConsent}
                  disabled={!canSubmit || saving}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm min-h-[44px]"
                >
                  {saving ? (
                    <>
                      <SpinnerIcon className="w-4 h-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Record Consent
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

