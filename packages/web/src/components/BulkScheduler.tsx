import { useState, useRef } from 'react';
import { api, Patient, AppointmentType, CreateAppointmentInput } from '../api/client';

interface BulkSchedulerProps {
  providerId: string;
  patients: Patient[];
  appointmentTypes: AppointmentType[];
  selectedDate: string;
  onComplete: () => void;
}

interface ParsedRow {
  patientIdentifier: string;
  time: string;
  appointmentType: string;
  reason?: string;
  patient?: Patient;
  error?: string;
}

export default function BulkScheduler({
  providerId,
  patients,
  appointmentTypes,
  selectedDate,
  onComplete,
}: BulkSchedulerProps) {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV text
  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const rows: ParsedRow[] = [];

    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes('patient') ||
                       lines[0]?.toLowerCase().includes('mrn') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length < 3) {
        rows.push({
          patientIdentifier: parts[0] || '',
          time: parts[1] || '',
          appointmentType: parts[2] || '',
          error: 'Invalid row format (need at least: patient, time, type)',
        });
        continue;
      }

      const [patientIdentifier, time, appointmentType, reason] = parts;

      // Find patient by MRN or name
      const patient = findPatient(patientIdentifier, patients);

      // Validate time format
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      const isValidTime = timeRegex.test(time);

      // Validate appointment type
      const isValidType = appointmentTypes.some(t =>
        t.name.toLowerCase() === appointmentType.toLowerCase()
      );

      let error: string | undefined;
      if (!patient) {
        error = 'Patient not found';
      } else if (!isValidTime) {
        error = 'Invalid time format (use HH:MM)';
      } else if (!isValidType) {
        error = 'Invalid appointment type';
      }

      rows.push({
        patientIdentifier,
        time,
        appointmentType,
        reason,
        patient,
        error,
      });
    }

    return rows;
  };

  // Find patient by MRN or name
  const findPatient = (identifier: string, patients: Patient[]): Patient | undefined => {
    const lower = identifier.toLowerCase();

    // Try exact MRN match first
    const byMrn = patients.find(p => p.mrn.toLowerCase() === lower);
    if (byMrn) return byMrn;

    // Try name match
    const byName = patients.find(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase() === lower ||
      `${p.lastName}, ${p.firstName}`.toLowerCase() === lower
    );
    if (byName) return byName;

    // Try partial match
    const partial = patients.find(p =>
      p.mrn.toLowerCase().includes(lower) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(lower)
    );
    return partial;
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  // Handle preview
  const handlePreview = () => {
    const rows = parseCSV(csvText);
    setParsedRows(rows);
    setShowPreview(true);
    setResult(null);
  };

  // Handle submit
  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);

    const validRows = parsedRows.filter(r => !r.error && r.patient);
    const appointments: CreateAppointmentInput[] = validRows.map(row => {
      const type = appointmentTypes.find(t =>
        t.name.toLowerCase() === row.appointmentType.toLowerCase()
      );
      const duration = type?.durationMinutes || 30;
      const endTime = calculateEndTime(row.time, duration);

      return {
        patientId: row.patient!.id,
        providerId,
        appointmentDate: selectedDate,
        startTime: row.time,
        endTime,
        appointmentType: type?.name || row.appointmentType,
        reason: row.reason,
      };
    });

    const { data, error } = await api.createBulkAppointments(appointments);

    if (error) {
      setResult({ success: 0, failed: appointments.length });
    } else if (data) {
      setResult({
        success: data.appointments.length,
        failed: data.errors.length,
      });
      if (data.appointments.length > 0) {
        onComplete();
      }
    }

    setSubmitting(false);
  };

  // Reset form
  const handleReset = () => {
    setCsvText('');
    setParsedRows([]);
    setShowPreview(false);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validCount = parsedRows.filter(r => !r.error).length;
  const errorCount = parsedRows.filter(r => r.error).length;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="card-clinical p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">CSV Format</h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
          Upload a CSV file or paste data with the following format:
        </p>
        <code className="block bg-blue-100 dark:bg-blue-900/40 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          Patient Name/MRN, Time (HH:MM), Appointment Type, Reason (optional)
        </code>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
          Example: MRN-001, 09:00, Follow-up, Hearing evaluation
        </p>
      </div>

      {/* Input Area */}
      {!showPreview && (
        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
              Upload CSV File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="block w-full text-sm text-navy-600 dark:text-navy-400
                file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                file:text-sm file:font-medium file:bg-teal-50 dark:file:bg-teal-900/30
                file:text-teal-700 dark:file:text-teal-400 hover:file:bg-teal-100
                dark:hover:file:bg-teal-900/50 cursor-pointer"
            />
          </div>

          {/* Or Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-clinical-200 dark:bg-navy-700" />
            <span className="text-sm text-navy-400 dark:text-navy-500">OR</span>
            <div className="flex-1 h-px bg-clinical-200 dark:bg-navy-700" />
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
              Paste CSV Data
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="MRN-001, 09:00, Follow-up, Hearing evaluation&#10;Alice Johnson, 09:30, New Patient&#10;MRN-002, 10:00, Follow-up"
              rows={8}
              className="input-clinical font-mono text-sm"
            />
          </div>

          {/* Preview Button */}
          <button
            onClick={handlePreview}
            disabled={!csvText.trim()}
            className="btn-primary w-full"
          >
            Preview Appointments
          </button>
        </div>
      )}

      {/* Preview Table */}
      {showPreview && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-navy-600 dark:text-navy-400">
              <span className="font-semibold text-green-600 dark:text-green-400">{validCount}</span> valid
            </span>
            {errorCount > 0 && (
              <span className="text-sm text-navy-600 dark:text-navy-400">
                <span className="font-semibold text-coral-600 dark:text-coral-400">{errorCount}</span> with errors
              </span>
            )}
          </div>

          {/* Table */}
          <div className="card-clinical overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-clinical-100 dark:bg-navy-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-500 dark:text-navy-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-500 dark:text-navy-400 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-500 dark:text-navy-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-500 dark:text-navy-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-500 dark:text-navy-400 uppercase tracking-wider">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clinical-200 dark:divide-navy-700">
                  {parsedRows.map((row, index) => (
                    <tr
                      key={index}
                      className={row.error ? 'bg-coral-50 dark:bg-coral-900/10' : ''}
                    >
                      <td className="px-4 py-3">
                        {row.error ? (
                          <span className="inline-flex items-center gap-1 text-coral-600 dark:text-coral-400">
                            <ErrorIcon className="w-4 h-4" />
                            <span className="text-xs">{row.error}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-green-600 dark:text-green-400">
                            <CheckIcon className="w-4 h-4" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-900 dark:text-navy-100">
                        {row.patient ? (
                          <span>
                            {row.patient.firstName} {row.patient.lastName}
                            <span className="text-navy-400 dark:text-navy-500 ml-1">
                              ({row.patient.mrn})
                            </span>
                          </span>
                        ) : (
                          <span className="text-navy-400 dark:text-navy-500 italic">
                            {row.patientIdentifier}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-900 dark:text-navy-100">
                        {row.time}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-900 dark:text-navy-100">
                        {row.appointmentType}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-500 dark:text-navy-400">
                        {row.reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`p-4 rounded-lg ${
              result.failed === 0
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
            }`}>
              <p className={result.failed === 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
                Created {result.success} appointment{result.success !== 1 ? 's' : ''}.
                {result.failed > 0 && ` ${result.failed} failed.`}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="btn-secondary"
            >
              Start Over
            </button>
            <button
              onClick={handleSubmit}
              disabled={validCount === 0 || submitting}
              className="btn-primary flex-1"
            >
              {submitting
                ? 'Creating...'
                : `Create ${validCount} Appointment${validCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}
