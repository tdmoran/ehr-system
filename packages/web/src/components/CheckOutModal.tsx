import { useState, useEffect } from 'react';
import { api, Appointment, Patient } from '../api/client';

interface CheckOutModalProps {
  appointment: Appointment;
  onClose: () => void;
  onCheckOut: () => void;
}

export default function CheckOutModal({ appointment, onClose, onCheckOut }: CheckOutModalProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checkout options
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpWeeks, setFollowUpWeeks] = useState('4');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [copayCollected, setCopayCollected] = useState(false);
  const [copayAmount, setCopayAmount] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');

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

  const handleCheckOut = async () => {
    setSaving(true);
    setError(null);

    try {
      // Build notes with checkout info
      let notes = appointment.notes || '';
      if (checkoutNotes) {
        notes = notes ? `${notes}\n\nCheckout Notes: ${checkoutNotes}` : `Checkout Notes: ${checkoutNotes}`;
      }
      if (copayCollected && copayAmount) {
        notes = notes ? `${notes}\nCopay Collected: $${copayAmount}` : `Copay Collected: $${copayAmount}`;
      }
      if (scheduleFollowUp) {
        notes = notes ? `${notes}\nFollow-up requested: ${followUpWeeks} weeks` : `Follow-up requested: ${followUpWeeks} weeks`;
        if (followUpNotes) {
          notes += ` - ${followUpNotes}`;
        }
      }

      // Update appointment to checked_out status
      const { error: statusError } = await api.updateAppointment(appointment.id, {
        status: 'checked_out',
        notes: notes || undefined,
      });

      if (statusError) {
        setError(`Failed to check out: ${statusError}`);
        setSaving(false);
        return;
      }

      onCheckOut();
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

  const printVisitSummary = () => {
    const printContent = `
      <html>
        <head>
          <title>Visit Summary - ${patient?.firstName} ${patient?.lastName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #0d9488; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; color: #374151; }
            .value { margin-left: 10px; }
          </style>
        </head>
        <body>
          <h1>Visit Summary</h1>
          <div class="section">
            <p><span class="label">Patient:</span><span class="value">${patient?.firstName} ${patient?.lastName}</span></p>
            <p><span class="label">MRN:</span><span class="value">${patient?.mrn}</span></p>
            <p><span class="label">Date of Birth:</span><span class="value">${patient ? formatDate(patient.dateOfBirth) : ''}</span></p>
          </div>
          <div class="section">
            <p><span class="label">Visit Date:</span><span class="value">${formatDate(appointment.appointmentDate)}</span></p>
            <p><span class="label">Visit Time:</span><span class="value">${formatTime(appointment.startTime.substring(0, 5))}</span></p>
            <p><span class="label">Visit Type:</span><span class="value">${appointment.appointmentType}</span></p>
            <p><span class="label">Provider:</span><span class="value">Dr. ${appointment.providerFirstName} ${appointment.providerLastName}</span></p>
          </div>
          ${appointment.reason ? `<div class="section"><p><span class="label">Reason for Visit:</span><span class="value">${appointment.reason}</span></p></div>` : ''}
          ${scheduleFollowUp ? `<div class="section"><p><span class="label">Follow-up:</span><span class="value">Scheduled for ${followUpWeeks} weeks</span></p></div>` : ''}
          <div class="section" style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
            <p>Thank you for your visit!</p>
            <p style="color: #6b7280; font-size: 12px;">Please call our office if you have any questions.</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-green-600">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Patient Check-Out</h2>
                <p className="text-green-100 text-sm mt-1">
                  Complete checkout and schedule follow-up if needed
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error && !patient ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : patient ? (
              <div className="space-y-6">
                {/* Patient Header */}
                <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {patient.firstName} {patient.lastName}
                    </h3>
                    <div className="mt-1 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                      <p><span className="font-medium">MRN:</span> {patient.mrn}</p>
                      <p><span className="font-medium">DOB:</span> {formatDate(patient.dateOfBirth)}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatTime(appointment.startTime.substring(0, 5))}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">{appointment.appointmentType}</p>
                    <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      Visit Completed
                    </span>
                  </div>
                </div>

                {/* Follow-up Scheduling */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="scheduleFollowUp"
                      checked={scheduleFollowUp}
                      onChange={(e) => setScheduleFollowUp(e.target.checked)}
                      className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="scheduleFollowUp" className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Schedule Follow-up Appointment
                    </label>
                  </div>

                  {scheduleFollowUp && (
                    <div className="space-y-4 pl-8">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Follow-up in
                        </label>
                        <select
                          value={followUpWeeks}
                          onChange={(e) => setFollowUpWeeks(e.target.value)}
                          className="input-clinical w-full"
                        >
                          <option value="1">1 week</option>
                          <option value="2">2 weeks</option>
                          <option value="3">3 weeks</option>
                          <option value="4">4 weeks</option>
                          <option value="6">6 weeks</option>
                          <option value="8">8 weeks</option>
                          <option value="12">3 months</option>
                          <option value="26">6 months</option>
                          <option value="52">1 year</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Follow-up Notes
                        </label>
                        <input
                          type="text"
                          value={followUpNotes}
                          onChange={(e) => setFollowUpNotes(e.target.value)}
                          className="input-clinical w-full"
                          placeholder="e.g., Review labs, Check BP"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Collection */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="copayCollected"
                      checked={copayCollected}
                      onChange={(e) => setCopayCollected(e.target.checked)}
                      className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="copayCollected" className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Copay / Payment Collected
                    </label>
                  </div>

                  {copayCollected && (
                    <div className="pl-8">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Amount Collected
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={copayAmount}
                          onChange={(e) => setCopayAmount(e.target.value)}
                          className="input-clinical w-full pl-7"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Checkout Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                    Checkout Notes
                  </label>
                  <textarea
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    className="input-clinical w-full"
                    rows={3}
                    placeholder="Any additional notes..."
                  />
                </div>

                {/* Print Visit Summary Button */}
                <button
                  onClick={printVisitSummary}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <PrintIcon className="w-5 h-5" />
                  Print Visit Summary
                </button>

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
                onClick={handleCheckOut}
                disabled={saving || loading || !patient}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Complete Check-Out
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

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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
