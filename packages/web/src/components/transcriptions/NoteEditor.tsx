import { useState, useEffect, useCallback, useRef } from 'react';
import { transcriptionsApi, TranscriptionNote, TranscriptionSession } from '../../api/transcriptions';

// ─── Types ──────────────────────────────────────────────────────────────────

type TemplateType = 'soap' | 'hp' | 'procedure' | 'custom';

interface NoteFields {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  summary: string;
}

interface AiSuggestion {
  id: string;
  text: string;
  targetField: keyof NoteFields;
  label: string;
}

interface NoteEditorProps {
  sessionId: string;
  onClose?: () => void;
  onFinalized?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── Template Configs ───────────────────────────────────────────────────────

const TEMPLATE_CONFIGS: Record<TemplateType, { label: string; fields: (keyof NoteFields)[] }> = {
  soap: {
    label: 'SOAP Note',
    fields: ['chiefComplaint', 'subjective', 'objective', 'assessment', 'plan'],
  },
  hp: {
    label: 'H&P',
    fields: ['chiefComplaint', 'subjective', 'objective', 'assessment', 'plan', 'summary'],
  },
  procedure: {
    label: 'Procedure Note',
    fields: ['chiefComplaint', 'objective', 'assessment', 'plan'],
  },
  custom: {
    label: 'Custom',
    fields: ['chiefComplaint', 'subjective', 'objective', 'assessment', 'plan', 'summary'],
  },
};

const FIELD_LABELS: Record<keyof NoteFields, string> = {
  chiefComplaint: 'Chief Complaint',
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
  summary: 'Summary',
};

const EMPTY_FIELDS: NoteFields = {
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  summary: '',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function noteToFields(note: TranscriptionNote): NoteFields {
  return {
    chiefComplaint: note.chiefComplaint ?? '',
    subjective: note.subjective ?? '',
    objective: note.objective ?? '',
    assessment: note.assessment ?? '',
    plan: note.plan ?? '',
    summary: note.summary ?? '',
  };
}

function extractSuggestions(transcript: string): AiSuggestion[] {
  if (!transcript) return [];

  const suggestions: AiSuggestion[] = [];
  const lines = transcript.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      lower.includes('complain') ||
      lower.includes('presenting') ||
      lower.includes('chief concern') ||
      lower.includes('reason for visit')
    ) {
      suggestions.push({
        id: `cc-${suggestions.length}`,
        text: line.replace(/^(patient|doctor|dr\.\s*\w+):\s*/i, '').trim(),
        targetField: 'chiefComplaint',
        label: 'Insert as Chief Complaint',
      });
    }

    if (
      lower.includes('history') ||
      lower.includes('symptom') ||
      lower.includes('pain') ||
      lower.includes('feel') ||
      lower.includes('started') ||
      lower.includes('been having')
    ) {
      suggestions.push({
        id: `hpi-${suggestions.length}`,
        text: line.replace(/^(patient|doctor|dr\.\s*\w+):\s*/i, '').trim(),
        targetField: 'subjective',
        label: 'Insert as HPI',
      });
    }

    if (
      lower.includes('exam') ||
      lower.includes('vital') ||
      lower.includes('blood pressure') ||
      lower.includes('temperature') ||
      lower.includes('finding')
    ) {
      suggestions.push({
        id: `obj-${suggestions.length}`,
        text: line.replace(/^(patient|doctor|dr\.\s*\w+):\s*/i, '').trim(),
        targetField: 'objective',
        label: 'Add to Objective',
      });
    }

    if (
      lower.includes('diagnos') ||
      lower.includes('impression') ||
      lower.includes('assessment') ||
      lower.includes('likely') ||
      lower.includes('consistent with')
    ) {
      suggestions.push({
        id: `ax-${suggestions.length}`,
        text: line.replace(/^(patient|doctor|dr\.\s*\w+):\s*/i, '').trim(),
        targetField: 'assessment',
        label: 'Add to Assessment',
      });
    }

    if (
      lower.includes('prescri') ||
      lower.includes('follow up') ||
      lower.includes('refer') ||
      lower.includes('recommend') ||
      lower.includes('plan')
    ) {
      suggestions.push({
        id: `plan-${suggestions.length}`,
        text: line.replace(/^(patient|doctor|dr\.\s*\w+):\s*/i, '').trim(),
        targetField: 'plan',
        label: 'Add to Plan',
      });
    }
  }

  // Deduplicate by text
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.text)) return false;
    seen.add(s.text);
    return true;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NoteEditor({ sessionId, onClose, onFinalized }: NoteEditorProps) {
  const [session, setSession] = useState<TranscriptionSession | null>(null);
  const [note, setNote] = useState<TranscriptionNote | null>(null);
  const [fields, setFields] = useState<NoteFields>(EMPTY_FIELDS);
  const [template, setTemplate] = useState<TemplateType>('soap');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [finalizing, setFinalizing] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load session + note ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: apiErr } = await transcriptionsApi.getSession(sessionId);

      if (cancelled) return;

      if (apiErr || !data) {
        setError(apiErr ?? 'Failed to load transcription session');
        setLoading(false);
        return;
      }

      setSession(data.session);

      if (data.note) {
        setNote(data.note);
        setFields(noteToFields(data.note));
        setSuggestions(extractSuggestions(data.note.fullTranscript ?? ''));

        // Auto-detect template from session
        if (data.session.templateUsed) {
          const mapped = mapTemplateType(data.session.templateUsed);
          setTemplate(mapped);
        }
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ─── Auto-save draft (debounced) ────────────────────────────────────────

  const saveDraft = useCallback(
    async (currentFields: NoteFields) => {
      setSaveStatus('saving');

      const { error: saveErr } = await transcriptionsApi.updateNote(sessionId, {
        chiefComplaint: currentFields.chiefComplaint || undefined,
        subjective: currentFields.subjective || undefined,
        objective: currentFields.objective || undefined,
        assessment: currentFields.assessment || undefined,
        plan: currentFields.plan || undefined,
        summary: currentFields.summary || undefined,
        reviewStatus: 'draft',
      });

      if (saveErr) {
        setSaveStatus('error');
      } else {
        setSaveStatus('saved');
      }
    },
    [sessionId],
  );

  const debouncedSave = useCallback(
    (currentFields: NoteFields) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      setSaveStatus('idle');
      saveTimerRef.current = setTimeout(() => {
        saveDraft(currentFields);
      }, 1500);
    },
    [saveDraft],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ─── Field update handler ───────────────────────────────────────────────

  const updateField = useCallback(
    (field: keyof NoteFields, value: string) => {
      const updated = { ...fields, [field]: value };
      setFields(updated);
      debouncedSave(updated);
    },
    [fields, debouncedSave],
  );

  // ─── Apply AI suggestion ───────────────────────────────────────────────

  const applySuggestion = useCallback(
    (suggestion: AiSuggestion) => {
      const current = fields[suggestion.targetField];
      const separator = current.trim() ? '\n' : '';
      const updated = { ...fields, [suggestion.targetField]: current + separator + suggestion.text };
      setFields(updated);
      setDismissedSuggestions((prev) => new Set([...prev, suggestion.id]));
      debouncedSave(updated);
    },
    [fields, debouncedSave],
  );

  const dismissSuggestion = useCallback((id: string) => {
    setDismissedSuggestions((prev) => new Set([...prev, id]));
  }, []);

  // ─── Finalize note ─────────────────────────────────────────────────────

  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    setError(null);

    // Save current state as finalized
    const { error: saveErr } = await transcriptionsApi.updateNote(sessionId, {
      chiefComplaint: fields.chiefComplaint || undefined,
      subjective: fields.subjective || undefined,
      objective: fields.objective || undefined,
      assessment: fields.assessment || undefined,
      plan: fields.plan || undefined,
      summary: fields.summary || undefined,
      reviewStatus: 'finalized',
    });

    if (saveErr) {
      setError(saveErr);
      setFinalizing(false);
      return;
    }

    // Accept the note and create encounter
    const { error: acceptErr } = await transcriptionsApi.acceptNote(sessionId, {
      modifications: {
        chiefComplaint: fields.chiefComplaint,
        subjective: fields.subjective,
        objective: fields.objective,
        assessment: fields.assessment,
        plan: fields.plan,
      },
    });

    if (acceptErr) {
      setError(acceptErr);
      setFinalizing(false);
      return;
    }

    setFinalizing(false);
    onFinalized?.();
  }, [sessionId, fields, onFinalized]);

  // ─── Manual save ────────────────────────────────────────────────────────

  const handleSaveDraft = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveDraft(fields);
  }, [saveDraft, fields]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <SpinnerIcon className="w-5 h-5 animate-spin" />
          <span>Loading transcription...</span>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const activeFields = TEMPLATE_CONFIGS[template].fields;
  const transcript = note?.fullTranscript ?? '';
  const visibleSuggestions = suggestions.filter((s) => !dismissedSuggestions.has(s.id));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 md:gap-4">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">Note Editor</h2>
          <SaveStatusBadge status={saveStatus} />
        </div>

        <div className="flex items-center gap-3">
          {/* Template selector */}
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            Template:
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as TemplateType)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            >
              {Object.entries(TEMPLATE_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </label>

          {/* Confidence score */}
          {note?.confidenceScore != null && (
            <ConfidenceBadge score={note.confidenceScore} />
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Main content: stacked on mobile, side-by-side on md+ ────────────── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT / TOP: Raw transcript */}
        <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 max-h-[40vh] md:max-h-none">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Raw Transcript
              </h3>
              {note?.wordCount != null && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {note.wordCount.toLocaleString()} words
                  {note.speakerCount != null && ` · ${note.speakerCount} speakers`}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {transcript ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                  {transcript}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No transcript available for this session.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT / BOTTOM: Structured note editor */}
        <div className="w-full md:w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Structured Note — {TEMPLATE_CONFIGS[template].label}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeFields.map((field) => (
              <NoteFieldEditor
                key={field}
                label={FIELD_LABELS[field]}
                value={fields[field]}
                onChange={(val) => updateField(field, val)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Suggestions panel ────────────────────────────────────────────── */}
      {visibleSuggestions.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
          <div className="px-6 py-2">
            <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-2">
              AI Suggestions
            </h4>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {visibleSuggestions.slice(0, 8).map((suggestion) => (
                <SuggestionChip
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={() => applySuggestion(suggestion)}
                  onDismiss={() => dismissSuggestion(suggestion.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer actions ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          {session && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Session: {session.status}
              {session.durationSeconds != null && (
                <> · {formatDuration(session.durationSeconds)}</>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saveStatus === 'saving'}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {finalizing ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <CheckIcon className="w-4 h-4" />
            )}
            Finalize Note
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoteFieldEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 80)}px`;
  }, [value]);

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </label>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none transition-colors"
        placeholder={`Enter ${label.toLowerCase()}...`}
      />
    </div>
  );
}

function SuggestionChip({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: AiSuggestion;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const truncated =
    suggestion.text.length > 60 ? `${suggestion.text.slice(0, 57)}...` : suggestion.text;

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs">
      <button
        onClick={onApply}
        className="text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 font-medium transition-colors"
        title={suggestion.text}
      >
        {suggestion.label}: <span className="font-normal text-gray-600 dark:text-gray-400">{truncated}</span>
      </button>
      <button
        onClick={onDismiss}
        className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  const config = {
    saving: { text: 'Saving...', className: 'text-amber-600 dark:text-amber-400' },
    saved: { text: 'Saved', className: 'text-green-600 dark:text-green-400' },
    error: { text: 'Save failed', className: 'text-red-600 dark:text-red-400' },
  } as const;

  const { text, className } = config[status];

  return <span className={`text-xs font-medium ${className}`}>{text}</span>;
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : pct >= 50
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
      {pct}% confidence
    </span>
  );
}

// ─── Utility helpers ────────────────────────────────────────────────────────

function mapTemplateType(templateUsed: string): TemplateType {
  const map: Record<string, TemplateType> = {
    soap: 'soap',
    progress_note: 'soap',
    referral_letter: 'custom',
    operative_note: 'procedure',
    assessment_report: 'hp',
    custom: 'custom',
  };
  return map[templateUsed] ?? 'soap';
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
