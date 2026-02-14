interface NotesTabContentProps {
  title: string;
  notes: string;
  saving: boolean;
  saved: boolean;
  placeholder: string;
  onNotesChange: (value: string) => void;
  onSave: () => void;
}

export function NotesTabContent({
  title,
  notes,
  saving,
  saved,
  placeholder,
  onNotesChange,
  onSave,
}: NotesTabContentProps) {
  return (
    <div className="card-clinical overflow-hidden">
      <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
        <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100">{title}</h3>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary text-sm py-2 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Save Notes
              </>
            )}
          </button>
        </div>
      </div>
      <div className="p-4">
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-48 md:h-64 lg:h-96 p-4 border border-clinical-200 dark:border-navy-700 rounded-lg font-body text-navy-900 dark:text-navy-100 dark:bg-navy-800 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}
