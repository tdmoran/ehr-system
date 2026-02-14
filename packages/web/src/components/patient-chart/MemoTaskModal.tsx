import { FormEvent } from 'react';

interface MemoTaskModalProps {
  memoText: string;
  memoSubmitting: boolean;
  patientName: string;
  onTextChange: (text: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function MemoTaskModal({
  memoText,
  memoSubmitting,
  patientName,
  onTextChange,
  onSubmit,
  onClose,
}: MemoTaskModalProps) {
  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
          <div>
            <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
              Memo Task
            </h2>
            <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
              {patientName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="p-6">
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-2">
              Task Description
            </label>
            <textarea
              value={memoText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Enter task details for secretary to action..."
              rows={4}
              className="input-clinical resize-none"
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={memoSubmitting}>Cancel</button>
            <button
              type="submit"
              className="btn-primary bg-amber-600 hover:bg-amber-700 flex items-center gap-2"
              disabled={memoSubmitting || !memoText.trim()}
            >
              {memoSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Send to Secretary'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
