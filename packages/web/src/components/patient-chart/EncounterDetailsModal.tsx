import { Encounter } from '../../api/client';

interface EncounterDetailsModalProps {
  encounter: Encounter;
  onClose: () => void;
}

export function EncounterDetailsModal({ encounter, onClose }: EncounterDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700 bg-gradient-to-r from-teal-500 to-teal-600">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Visit on {new Date(encounter.encounterDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h2>
            <p className="text-teal-100 font-body text-sm mt-1">
              {encounter.chiefComplaint || 'Clinical Visit'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* SOAP Note Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              encounter.status === 'signed'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : encounter.status === 'completed'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              {encounter.status === 'signed' ? 'Signed' : encounter.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
            {encounter.signedAt && (
              <span className="text-sm text-navy-500 dark:text-navy-400">
                Signed on {new Date(encounter.signedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Chief Complaint */}
          {encounter.chiefComplaint && (
            <div>
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-coral-500"></span>
                Chief Complaint
              </h3>
              <p className="text-navy-700 dark:text-navy-300 font-body bg-coral-50 dark:bg-coral-900/20 p-4 rounded-lg border-l-4 border-coral-400">
                {encounter.chiefComplaint}
              </p>
            </div>
          )}

          {/* SOAP sections */}
          {encounter.subjective && (
            <SoapSection letter="S" label="Subjective" content={encounter.subjective} color="blue" />
          )}
          {encounter.objective && (
            <SoapSection letter="O" label="Objective" content={encounter.objective} color="green" />
          )}
          {encounter.assessment && (
            <SoapSection letter="A" label="Assessment" content={encounter.assessment} color="purple" />
          )}
          {encounter.plan && (
            <SoapSection letter="P" label="Plan" content={encounter.plan} color="teal" />
          )}

          {/* Empty state */}
          {!encounter.subjective && !encounter.objective && !encounter.assessment && !encounter.plan && (
            <div className="text-center py-8 text-navy-500 dark:text-navy-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-body">No clinical notes recorded for this visit</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

function SoapSection({ letter, label, content, color }: { letter: string; label: string; content: string; color: string }) {
  return (
    <div>
      <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-2 flex items-center gap-2">
        <span className={`w-6 h-6 rounded-full bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 flex items-center justify-center text-xs font-bold`}>{letter}</span>
        {label}
      </h3>
      <p className="text-navy-700 dark:text-navy-300 font-body bg-clinical-50 dark:bg-navy-800 p-4 rounded-lg whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}
