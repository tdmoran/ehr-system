import { useState, useEffect } from 'react';
import { api, Appointment, Patient } from '../api/client';

interface CheckInModalProps {
  appointment: Appointment;
  onClose: () => void;
  onCheckIn: () => void;
}

export default function CheckInModal({ appointment, onClose, onCheckIn }: CheckInModalProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPatient();
  }, [appointment.patientId]);

  const loadPatient = async () => {
    setLoading(true);
    const { data, error: apiError } = await api.getPatient(appointment.patientId);

    if (apiError) {
      setError(apiError);
    } else if (data) {
      setPatient(data.patient);
    }
    setLoading(false);
  };

  const handleCheckIn = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error: statusError } = await api.updateAppointment(appointment.id, {
        status: 'checked_in'
      });

      if (statusError) {
        setError(`Failed to check in: ${statusError}`);
        setSaving(false);
        return;
      }

      onCheckIn();
    } catch (err) {
      setError('An unexpected error occurred');
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-teal-600">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Check In Patient</h2>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error && !patient ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : patient ? (
              <div className="space-y-4">
                {/* Patient Info */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-teal-700 dark:text-teal-400">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {patient.firstName} {patient.lastName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      MRN: {patient.mrn}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      DOB: {formatDate(patient.dateOfBirth)}
                    </p>
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {appointment.appointmentType}
                      </p>
                      {appointment.reason && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {appointment.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatTime(appointment.startTime.substring(0, 5))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckIn}
                disabled={saving || loading || !patient}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Check In
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
