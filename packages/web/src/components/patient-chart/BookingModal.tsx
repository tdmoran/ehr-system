import { FormEvent } from 'react';

interface BookingModalProps {
  bookingType: 'clinic' | 'operation' | 'scan';
  bookingDate: string;
  bookingTime: string;
  bookingNotes: string;
  bookingError: string;
  bookingSubmitting: boolean;
  patientName: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function BookingModal({
  bookingType,
  bookingDate,
  bookingTime,
  bookingNotes,
  bookingError,
  bookingSubmitting,
  patientName,
  onDateChange,
  onTimeChange,
  onNotesChange,
  onSubmit,
  onClose,
}: BookingModalProps) {
  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
          <div>
            <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
              {bookingType === 'operation' ? 'Book Operation' : bookingType === 'scan' ? 'Book Scan' : 'Book Clinic Appointment'}
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
          <div className="p-6 space-y-4">
            {bookingError && (
              <div className="p-3 bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 rounded-lg">
                <p className="text-coral-700 dark:text-coral-400 text-sm font-body">{bookingError}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-navy-500 dark:text-navy-400">Type:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                bookingType === 'operation'
                  ? 'bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-400'
                  : bookingType === 'scan'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  : 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
              }`}>
                {bookingType === 'operation' ? 'Procedure / Operation' : bookingType === 'scan' ? 'CT / MRI / Ultrasound' : 'Clinic Follow-up'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                Date <span className="text-coral-500">*</span>
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => onDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="input-clinical"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                Time <span className="text-coral-500">*</span>
              </label>
              <input
                type="time"
                value={bookingTime}
                onChange={(e) => onTimeChange(e.target.value)}
                className="input-clinical"
                required
              />
              <p className="text-xs text-navy-400 mt-1">
                Duration: {bookingType === 'operation' ? '60 minutes' : '30 minutes'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                Notes
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder={bookingType === 'operation' ? 'e.g., Procedure details, pre-op requirements...' : bookingType === 'scan' ? 'e.g., CT chest with contrast, MRI brain...' : 'e.g., Reason for follow-up...'}
                rows={3}
                className="input-clinical resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={bookingSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-primary flex items-center gap-2 ${
                bookingType === 'operation' ? 'bg-coral-600 hover:bg-coral-700' :
                bookingType === 'scan' ? 'bg-purple-600 hover:bg-purple-700' : ''
              }`}
              disabled={bookingSubmitting}
            >
              {bookingSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Booking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {bookingType === 'operation' ? 'Book Operation' : bookingType === 'scan' ? 'Book Scan' : 'Book Appointment'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
