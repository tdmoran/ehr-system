import { useState } from 'react';
import { api, PendingReferral, CreatePatientInput, Patient } from '../../api/client';

interface ReferralReviewModalProps {
  referral: PendingReferral;
  onClose: () => void;
  onResolved: () => void;
}

type Mode = 'review' | 'create-patient' | 'search-patient';

export function ReferralReviewModal({ referral, onClose, onResolved }: ReferralReviewModalProps) {
  const [mode, setMode] = useState<Mode>('review');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patient form state
  const [patientForm, setPatientForm] = useState<CreatePatientInput>({
    mrn: '', // Will be generated
    firstName: referral.patientFirstName || '',
    lastName: referral.patientLastName || '',
    dateOfBirth: referral.patientDob || '',
    phone: referral.patientPhone || '',
  });

  // Patient search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);

  const handleAddToMatchedPatient = async () => {
    if (!referral.matchedPatientId) return;

    setLoading(true);
    setError(null);

    const { error: apiError } = await api.addReferralToPatient(referral.id, {
      patientId: referral.matchedPatientId,
      referringPhysician: referral.referringPhysician || undefined,
      referringFacility: referral.referringFacility || undefined,
      reasonForReferral: referral.reasonForReferral || undefined,
    });

    if (apiError) {
      setError(apiError);
      setLoading(false);
      return;
    }

    onResolved();
  };

  const handleCreatePatient = async () => {
    setLoading(true);
    setError(null);

    // Validate required fields
    if (!patientForm.firstName?.trim()) {
      setError('First name is required.');
      setLoading(false);
      return;
    }
    if (!patientForm.lastName?.trim()) {
      setError('Last name is required.');
      setLoading(false);
      return;
    }
    if (!patientForm.dateOfBirth) {
      setError('Date of birth is required. Please select a date.');
      setLoading(false);
      return;
    }
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patientForm.dateOfBirth)) {
      setError('Date of birth must be in YYYY-MM-DD format. Please use the date picker.');
      setLoading(false);
      return;
    }

    const { error: apiError, data } = await api.createPatientFromReferral(referral.id, patientForm);

    if (apiError) {
      // Try to parse validation details if available
      if (typeof apiError === 'string' && apiError.includes('Validation failed')) {
        setError('Validation failed. Please check all required fields are filled correctly.');
      } else {
        setError(apiError);
      }
      setLoading(false);
      return;
    }

    onResolved();
  };

  const handleAddToSelectedPatient = async () => {
    if (!selectedPatient) return;

    setLoading(true);
    setError(null);

    const { error: apiError } = await api.addReferralToPatient(referral.id, {
      patientId: selectedPatient.id,
      referringPhysician: referral.referringPhysician || undefined,
      referringFacility: referral.referringFacility || undefined,
      reasonForReferral: referral.reasonForReferral || undefined,
    });

    if (apiError) {
      setError(apiError);
      setLoading(false);
      return;
    }

    onResolved();
  };

  const handleSkip = async () => {
    setLoading(true);
    setError(null);

    const { error: apiError } = await api.skipReferral(referral.id);

    if (apiError) {
      setError(apiError);
      setLoading(false);
      return;
    }

    onResolved();
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setSearching(true);
    setError(null);

    const { data, error: apiError } = await api.getPatients(searchTerm);

    if (apiError) {
      setError(apiError);
    } else if (data) {
      setSearchResults(data.patients);
    }

    setSearching(false);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getConfidenceColor = (confidence: number | null): string => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {mode === 'review' && 'Review Referral'}
              {mode === 'create-patient' && 'Create New Patient'}
              {mode === 'search-patient' && 'Find Existing Patient'}
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'review' && (
            <div className="space-y-6">
              {/* Extracted Patient Info */}
              <Section title="Extracted Patient Information">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" value={referral.patientFirstName} />
                  <Field label="Last Name" value={referral.patientLastName} />
                  <Field
                    label="Date of Birth"
                    value={referral.patientDob ? formatDate(referral.patientDob) : null}
                  />
                  <Field label="Phone" value={referral.patientPhone} />
                </div>
              </Section>

              {/* Referral Info */}
              <Section title="Referral Information">
                <div className="space-y-3">
                  <Field label="Referring Physician" value={referral.referringPhysician} />
                  <Field label="Referring Facility" value={referral.referringFacility} />
                  <Field
                    label="Reason for Referral"
                    value={referral.reasonForReferral}
                    multiline
                  />
                </div>
              </Section>

              {/* Matched Patient */}
              {referral.matchedPatientId && (
                <Section title="Matched Patient">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">
                          {referral.matchedPatientFirstName} {referral.matchedPatientLastName}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          MRN: {referral.matchedPatientMrn}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-medium ${getConfidenceColor(
                            referral.matchConfidence
                          )}`}
                        >
                          {Math.round((referral.matchConfidence || 0) * 100)}% Match
                        </span>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* Original Document Link */}
              <div className="flex items-center gap-2 text-sm">
                <DocumentIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Source document:</span>
                <a
                  href={api.getReferralFileUrl(referral.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {referral.originalName}
                </a>
              </div>
            </div>
          )}

          {mode === 'create-patient' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review and edit the patient information extracted from the referral letter.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={patientForm.firstName}
                    onChange={(e) => setPatientForm({ ...patientForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={patientForm.lastName}
                    onChange={(e) => setPatientForm({ ...patientForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={patientForm.dateOfBirth}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, dateOfBirth: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={patientForm.phone || ''}
                    onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={patientForm.gender || ''}
                    onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={patientForm.email || ''}
                    onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {mode === 'search-patient' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Search for an existing patient to add this referral to.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name, MRN, or phone..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPatient?.id === patient.id
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        MRN: {patient.mrn} | DOB: {formatDate(patient.dateOfBirth)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && searchTerm && !searching && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No patients found matching "{searchTerm}"
                </p>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {mode === 'review' && (
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
              >
                Skip
              </button>
              <div className="flex items-center gap-3">
                {referral.matchedPatientId ? (
                  <>
                    <button
                      onClick={() => setMode('search-patient')}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      Different Patient
                    </button>
                    <button
                      onClick={handleAddToMatchedPatient}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? (
                        <SpinnerIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckIcon className="w-4 h-4" />
                      )}
                      Add to {referral.matchedPatientFirstName} {referral.matchedPatientLastName}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setMode('search-patient')}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      Find Existing Patient
                    </button>
                    <button
                      onClick={() => setMode('create-patient')}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <UserPlusIcon className="w-4 h-4" />
                      Create New Patient
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {mode === 'create-patient' && (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setMode('review')}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCreatePatient}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckIcon className="w-4 h-4" />
                )}
                Create Patient
              </button>
            </div>
          )}

          {mode === 'search-patient' && (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setMode('review');
                  setSearchResults([]);
                  setSelectedPatient(null);
                  setSearchTerm('');
                }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleAddToSelectedPatient}
                disabled={loading || !selectedPatient}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckIcon className="w-4 h-4" />
                )}
                Add to Selected Patient
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      {multiline ? (
        <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
          {value || <span className="text-gray-400 dark:text-gray-500 italic">Not extracted</span>}
        </p>
      ) : (
        <p className="mt-1 text-sm text-gray-900 dark:text-white">
          {value || <span className="text-gray-400 dark:text-gray-500 italic">Not extracted</span>}
        </p>
      )}
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

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
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

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
      />
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
