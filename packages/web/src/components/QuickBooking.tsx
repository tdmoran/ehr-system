import { useState } from 'react';
import { api, Patient, AppointmentType, CreateAppointmentInput } from '../api/client';

interface QuickBookingProps {
  providerId: string;
  date: string;
  startTime: string;
  patients: Patient[];
  appointmentTypes: AppointmentType[];
  onClose: () => void;
  onComplete: () => void;
}

export default function QuickBooking({
  providerId,
  date,
  startTime,
  patients,
  appointmentTypes,
  onClose,
  onComplete,
}: QuickBookingProps) {
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateAppointmentInput>>({
    providerId,
    appointmentDate: date,
    startTime,
    endTime: calculateEndTime(startTime, 30),
    appointmentType: appointmentTypes[0]?.name || '',
    reason: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter patients based on search
  const filteredPatients = patients.filter(p => {
    const searchLower = patientSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(searchLower) ||
      p.lastName.toLowerCase().includes(searchLower) ||
      p.mrn.toLowerCase().includes(searchLower)
    );
  });

  // Update end time when appointment type changes
  const handleTypeChange = (typeName: string) => {
    const type = appointmentTypes.find(t => t.name === typeName);
    const duration = type?.durationMinutes || 30;
    setFormData({
      ...formData,
      appointmentType: typeName,
      endTime: calculateEndTime(formData.startTime || startTime, duration),
    });
  };

  // Handle patient selection
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(`${patient.firstName} ${patient.lastName} (${patient.mrn})`);
    setShowPatientDropdown(false);
    setFormData({ ...formData, patientId: patient.id });
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }

    if (!formData.appointmentType) {
      setError('Please select an appointment type');
      return;
    }

    setSubmitting(true);

    const appointmentData: CreateAppointmentInput = {
      patientId: selectedPatient.id,
      providerId,
      appointmentDate: date,
      startTime: formData.startTime || startTime,
      endTime: formData.endTime || calculateEndTime(startTime, 30),
      appointmentType: formData.appointmentType,
      reason: formData.reason,
    };

    const { error: apiError } = await api.createAppointment(appointmentData);

    if (apiError) {
      setError(apiError);
      setSubmitting(false);
      return;
    }

    onComplete();
  };

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
          <div>
            <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
              Quick Book
            </h2>
            <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
              {formattedDate} at {formatTime(startTime)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
          >
            <CloseIcon className="w-5 h-5 text-navy-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 rounded-lg">
                <p className="text-coral-700 dark:text-coral-400 text-sm font-body">{error}</p>
              </div>
            )}

            {/* Patient Search */}
            <div className="relative">
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                Patient <span className="text-coral-500">*</span>
              </label>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setShowPatientDropdown(true);
                  if (!e.target.value) setSelectedPatient(null);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                placeholder="Search by name or MRN..."
                className="input-clinical"
              />
              {showPatientDropdown && patientSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-navy-800 border border-clinical-200 dark:border-navy-700 rounded-lg shadow-clinical-lg max-h-48 overflow-y-auto">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.slice(0, 10).map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handlePatientSelect(patient)}
                        className="w-full px-4 py-2 text-left hover:bg-clinical-50 dark:hover:bg-navy-700 transition-colors"
                      >
                        <span className="font-medium text-navy-900 dark:text-navy-100">
                          {patient.firstName} {patient.lastName}
                        </span>
                        <span className="text-navy-500 dark:text-navy-400 text-sm ml-2">
                          ({patient.mrn})
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-navy-500 dark:text-navy-400 text-sm">
                      No patients found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                  Start Time <span className="text-coral-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => {
                    const type = appointmentTypes.find(t => t.name === formData.appointmentType);
                    const duration = type?.durationMinutes || 30;
                    setFormData({
                      ...formData,
                      startTime: e.target.value,
                      endTime: calculateEndTime(e.target.value, duration),
                    });
                  }}
                  className="input-clinical"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="input-clinical"
                />
              </div>
            </div>

            {/* Appointment Type */}
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                Appointment Type <span className="text-coral-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {appointmentTypes.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleTypeChange(type.name)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      formData.appointmentType === type.name
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-clinical-200 dark:border-navy-700 hover:border-clinical-300 dark:hover:border-navy-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="font-medium text-navy-900 dark:text-navy-100 text-sm">
                        {type.name}
                      </span>
                    </div>
                    <span className="text-xs text-navy-500 dark:text-navy-400 mt-1 block">
                      {type.durationMinutes} min
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={formData.reason || ''}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Follow-up, New complaint..."
                className="input-clinical"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !selectedPatient}
            >
              {submitting ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
