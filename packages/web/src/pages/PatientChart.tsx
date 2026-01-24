import { useState, useEffect, FormEvent, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePatient } from '../hooks/usePatients';
import { api, Encounter, CreateEncounterInput, Document, CreatePatientInput } from '../api/client';

const initialEncounterForm: Omit<CreateEncounterInput, 'patientId'> = {
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

export default function PatientChart() {
  const { id } = useParams<{ id: string }>();
  const { patient, loading: patientLoading, refetch: refetchPatient } = usePatient(id!);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'encounters' | 'documents'>('overview');

  // Encounter form state
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [encounterForm, setEncounterForm] = useState(initialEncounterForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Document upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Edit patient state
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CreatePatientInput>>({});
  const [editFormError, setEditFormError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchEncounters = () => {
    if (id) {
      api.getPatientEncounters(id).then(({ data }) => {
        if (data) setEncounters(data.encounters);
      });
    }
  };

  const fetchDocuments = () => {
    if (id) {
      api.getPatientDocuments(id).then(({ data }) => {
        if (data) setDocuments(data.documents);
      });
    }
  };

  useEffect(() => {
    fetchEncounters();
    fetchDocuments();
  }, [id]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    setUploadError('');

    const { data, error } = await api.uploadDocument(id, file);

    if (error) {
      setUploadError(error);
    } else if (data) {
      fetchDocuments();
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    const { error } = await api.deleteDocument(docId);
    if (!error) {
      fetchDocuments();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpenEncounterModal = () => {
    setEncounterForm(initialEncounterForm);
    setFormError('');
    setShowNewEncounter(true);
  };

  const handleCloseEncounterModal = () => {
    setShowNewEncounter(false);
    setEncounterForm(initialEncounterForm);
    setFormError('');
  };

  const handleEncounterInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEncounterForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEncounterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!encounterForm.chiefComplaint?.trim()) {
      setFormError('Chief complaint is required.');
      setSubmitting(false);
      return;
    }

    const { data, error } = await api.createEncounter({
      patientId: id!,
      ...encounterForm,
    });

    if (error) {
      setFormError(error);
      setSubmitting(false);
      return;
    }

    if (data) {
      handleCloseEncounterModal();
      fetchEncounters();
      setActiveTab('encounters');
    }
    setSubmitting(false);
  };

  // Edit patient handlers
  const handleOpenEditPatient = () => {
    if (patient) {
      setEditForm({
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth.split('T')[0],
        gender: patient.gender || '',
        email: patient.email || '',
        phone: patient.phone || '',
        addressLine1: patient.addressLine1 || '',
        city: patient.city || '',
        state: patient.state || '',
        zip: patient.zip || '',
        insuranceProvider: patient.insuranceProvider || '',
      });
      setEditFormError('');
      setShowEditPatient(true);
    }
  };

  const handleCloseEditPatient = () => {
    setShowEditPatient(false);
    setEditForm({});
    setEditFormError('');
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditPatientSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEditFormError('');
    setEditSubmitting(true);

    if (!editForm.firstName?.trim() || !editForm.lastName?.trim() || !editForm.dateOfBirth) {
      setEditFormError('First name, last name, and date of birth are required.');
      setEditSubmitting(false);
      return;
    }

    const { data, error } = await api.updatePatient(id!, editForm);

    if (error) {
      setEditFormError(error);
      setEditSubmitting(false);
      return;
    }

    if (data) {
      handleCloseEditPatient();
      refetchPatient();
    }
    setEditSubmitting(false);
  };

  if (patientLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 font-body">Loading patient...</span>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-navy-900 font-display font-medium">Patient not found</p>
          <Link to="/patients" className="text-teal-600 font-body text-sm hover:underline mt-2 inline-block">
            Back to patients
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'encounters', label: 'Encounters' },
    { id: 'documents', label: 'Documents' },
  ] as const;

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-body">
        <Link to="/patients" className="text-navy-500 hover:text-navy-700">Patients</Link>
        <svg className="w-4 h-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-teal-600 dark:text-teal-400 font-semibold">{patient.firstName} {patient.lastName}</span>
      </nav>

      {/* Patient Header */}
      <div className="card-clinical p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Patient Info */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {patient.firstName} {patient.lastName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-navy-500 font-body text-sm">
                  <span className="font-mono bg-navy-50 px-2 py-0.5 rounded">{patient.mrn}</span>
                  <span>{calculateAge(patient.dateOfBirth)} years old</span>
                  <span className="capitalize">{patient.gender || 'Unknown'}</span>
                  <span>DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleOpenEditPatient} className="btn-secondary">Edit Patient</button>
                <button onClick={handleOpenEncounterModal} className="btn-primary">New Encounter</button>
              </div>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Phone</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.phone || '—'}</p>
              </div>
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Insurance</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.insuranceProvider || '—'}</p>
              </div>
              <div className="p-3 bg-coral-50 rounded-lg border border-coral-100">
                <p className="text-xs text-coral-600 font-body uppercase tracking-wide">Allergies</p>
                <p className="font-display font-medium text-coral-700 mt-1">Penicillin, Shellfish</p>
              </div>
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Primary Care</p>
                <p className="font-display font-medium text-navy-900 mt-1">Dr. Smith</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-clinical-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-display font-medium text-sm transition-colors relative ${
                activeTab === tab.id
                  ? 'text-teal-600'
                  : 'text-navy-500 hover:text-navy-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && (
          <div className="max-w-xl">
            {/* Allergies */}
            <div className="card-clinical overflow-hidden">
              <div className="px-5 py-4 border-b border-clinical-200 bg-clinical-50 flex items-center justify-between">
                <h3 className="font-display font-semibold text-navy-900">Allergies</h3>
                <span className="badge badge-danger">2</span>
              </div>
              <div className="divide-y divide-clinical-100">
                <AllergyRow allergen="Penicillin" reaction="Rash, hives" severity="moderate" />
                <AllergyRow allergen="Shellfish" reaction="Anaphylaxis" severity="severe" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'encounters' && (
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900">Encounter History</h3>
              <button onClick={handleOpenEncounterModal} className="btn-primary text-sm py-2">New Encounter</button>
            </div>
            {encounters.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-navy-500 font-body">No encounters recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-clinical-100">
                {encounters.map((encounter) => (
                  <div key={encounter.id} className="p-6 hover:bg-clinical-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-display font-medium text-navy-900">
                            {new Date(encounter.encounterDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <span className={`badge ${
                            encounter.status === 'signed' ? 'badge-success' :
                            encounter.status === 'completed' ? 'badge-neutral' :
                            'badge-warning'
                          }`}>
                            {encounter.status === 'in_progress' ? 'In Progress' :
                             encounter.status === 'completed' ? 'Completed' : 'Signed'}
                          </span>
                        </div>
                        <p className="text-navy-500 font-body mt-1">{encounter.chiefComplaint || 'No chief complaint recorded'}</p>
                      </div>
                      <button className="text-teal-600 hover:text-teal-700 font-medium text-sm font-body">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900">Scanned Documents</h3>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.tiff"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="document-upload"
                />
                <label
                  htmlFor="document-upload"
                  className={`btn-primary text-sm py-2 cursor-pointer inline-flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {uploading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Upload Document
                    </>
                  )}
                </label>
              </div>
            </div>

            {uploadError && (
              <div className="mx-6 mt-4 p-4 bg-coral-50 border border-coral-200 rounded-lg">
                <p className="text-coral-700 text-sm font-body">{uploadError}</p>
              </div>
            )}

            {documents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-navy-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-navy-900 font-display font-medium">No documents uploaded</p>
                <p className="text-navy-500 font-body text-sm mt-1">Upload PDF or image files to add to the patient's chart</p>
              </div>
            ) : (
              <div className="divide-y divide-clinical-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 hover:bg-clinical-50 transition-colors flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-coral-50 flex items-center justify-center flex-shrink-0">
                      {doc.mimeType === 'application/pdf' ? (
                        <svg className="w-5 h-5 text-coral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-coral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-medium text-navy-900 truncate">{doc.originalName}</p>
                      <p className="text-sm text-navy-500 font-body">
                        {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={api.getDocumentUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-navy-100 text-teal-600 transition-colors"
                        title="View document"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 rounded-lg hover:bg-coral-50 text-navy-400 hover:text-coral-600 transition-colors"
                        title="Delete document"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* New Encounter Modal */}
      {showNewEncounter && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-clinical-xl max-w-3xl w-full my-8 animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900">New Encounter</h2>
                <p className="text-navy-500 font-body text-sm mt-1">
                  {patient.firstName} {patient.lastName} • {patient.mrn}
                </p>
              </div>
              <button
                onClick={handleCloseEncounterModal}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEncounterSubmit}>
              <div className="p-6 space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto">
                {formError && (
                  <div className="p-4 bg-coral-50 border border-coral-200 rounded-lg">
                    <p className="text-coral-700 text-sm font-body flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {formError}
                    </p>
                  </div>
                )}

                {/* Chief Complaint */}
                <div>
                  <label htmlFor="chiefComplaint" className="block text-sm font-medium text-navy-700 font-body mb-1">
                    Chief Complaint <span className="text-coral-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="chiefComplaint"
                    name="chiefComplaint"
                    value={encounterForm.chiefComplaint}
                    onChange={handleEncounterInputChange}
                    placeholder="Primary reason for visit"
                    className="input-clinical"
                    required
                  />
                </div>

                {/* SOAP Notes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Subjective */}
                  <div>
                    <label htmlFor="subjective" className="block text-sm font-medium text-navy-700 font-body mb-1">
                      Subjective
                      <span className="text-navy-400 font-normal ml-1">(History)</span>
                    </label>
                    <textarea
                      id="subjective"
                      name="subjective"
                      value={encounterForm.subjective}
                      onChange={handleEncounterInputChange}
                      placeholder="Patient's description of symptoms, history of present illness..."
                      rows={5}
                      className="input-clinical resize-none"
                    />
                  </div>

                  {/* Objective */}
                  <div>
                    <label htmlFor="objective" className="block text-sm font-medium text-navy-700 font-body mb-1">
                      Objective
                      <span className="text-navy-400 font-normal ml-1">(Exam Findings)</span>
                    </label>
                    <textarea
                      id="objective"
                      name="objective"
                      value={encounterForm.objective}
                      onChange={handleEncounterInputChange}
                      placeholder="Physical examination findings, test results..."
                      rows={5}
                      className="input-clinical resize-none"
                    />
                  </div>

                  {/* Assessment */}
                  <div>
                    <label htmlFor="assessment" className="block text-sm font-medium text-navy-700 font-body mb-1">
                      Assessment
                      <span className="text-navy-400 font-normal ml-1">(Diagnosis)</span>
                    </label>
                    <textarea
                      id="assessment"
                      name="assessment"
                      value={encounterForm.assessment}
                      onChange={handleEncounterInputChange}
                      placeholder="Clinical impression, differential diagnosis..."
                      rows={5}
                      className="input-clinical resize-none"
                    />
                  </div>

                  {/* Plan */}
                  <div>
                    <label htmlFor="plan" className="block text-sm font-medium text-navy-700 font-body mb-1">
                      Plan
                      <span className="text-navy-400 font-normal ml-1">(Treatment)</span>
                    </label>
                    <textarea
                      id="plan"
                      name="plan"
                      value={encounterForm.plan}
                      onChange={handleEncounterInputChange}
                      placeholder="Treatment plan, follow-up instructions..."
                      rows={5}
                      className="input-clinical resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 bg-clinical-50 rounded-b-2xl">
                <button type="button" onClick={handleCloseEncounterModal} className="btn-secondary" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Create Encounter'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditPatient && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-clinical-xl max-w-2xl w-full my-8 animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900">Edit Patient</h2>
                <p className="text-navy-500 font-body text-sm mt-1">
                  MRN: {patient?.mrn}
                </p>
              </div>
              <button
                onClick={handleCloseEditPatient}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditPatientSubmit}>
              <div className="p-6 space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto">
                {editFormError && (
                  <div className="p-4 bg-coral-50 border border-coral-200 rounded-lg">
                    <p className="text-coral-700 text-sm font-body flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {editFormError}
                    </p>
                  </div>
                )}

                {/* Basic Information */}
                <div>
                  <h3 className="font-display font-semibold text-navy-900 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        First Name <span className="text-coral-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={editForm.firstName || ''}
                        onChange={handleEditInputChange}
                        className="input-clinical"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Last Name <span className="text-coral-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={editForm.lastName || ''}
                        onChange={handleEditInputChange}
                        className="input-clinical"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="dateOfBirth" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Date of Birth <span className="text-coral-500">*</span>
                      </label>
                      <input
                        type="date"
                        id="dateOfBirth"
                        name="dateOfBirth"
                        value={editForm.dateOfBirth || ''}
                        onChange={handleEditInputChange}
                        className="input-clinical"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Gender
                      </label>
                      <select
                        id="gender"
                        name="gender"
                        value={editForm.gender || ''}
                        onChange={handleEditInputChange}
                        className="input-clinical"
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="font-display font-semibold text-navy-900 mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={editForm.phone || ''}
                        onChange={handleEditInputChange}
                        placeholder="(555) 123-4567"
                        className="input-clinical"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={editForm.email || ''}
                        onChange={handleEditInputChange}
                        placeholder="patient@example.com"
                        className="input-clinical"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="font-display font-semibold text-navy-900 mb-4">Address</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="addressLine1" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        id="addressLine1"
                        name="addressLine1"
                        value={editForm.addressLine1 || ''}
                        onChange={handleEditInputChange}
                        placeholder="123 Main Street"
                        className="input-clinical"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <label htmlFor="city" className="block text-sm font-medium text-navy-700 font-body mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          id="city"
                          name="city"
                          value={editForm.city || ''}
                          onChange={handleEditInputChange}
                          className="input-clinical"
                        />
                      </div>
                      <div>
                        <label htmlFor="state" className="block text-sm font-medium text-navy-700 font-body mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          id="state"
                          name="state"
                          value={editForm.state || ''}
                          onChange={handleEditInputChange}
                          placeholder="CA"
                          maxLength={2}
                          className="input-clinical"
                        />
                      </div>
                      <div>
                        <label htmlFor="zip" className="block text-sm font-medium text-navy-700 font-body mb-1">
                          ZIP Code
                        </label>
                        <input
                          type="text"
                          id="zip"
                          name="zip"
                          value={editForm.zip || ''}
                          onChange={handleEditInputChange}
                          placeholder="12345"
                          maxLength={10}
                          className="input-clinical"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insurance */}
                <div>
                  <h3 className="font-display font-semibold text-navy-900 mb-4">Insurance</h3>
                  <div>
                    <label htmlFor="insuranceProvider" className="block text-sm font-medium text-navy-700 font-body mb-1">
                      Insurance Provider
                    </label>
                    <input
                      type="text"
                      id="insuranceProvider"
                      name="insuranceProvider"
                      value={editForm.insuranceProvider || ''}
                      onChange={handleEditInputChange}
                      placeholder="e.g., Blue Cross Blue Shield"
                      className="input-clinical"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 bg-clinical-50 rounded-b-2xl">
                <button type="button" onClick={handleCloseEditPatient} className="btn-secondary" disabled={editSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={editSubmitting}>
                  {editSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AllergyRow({ allergen, reaction, severity }: { allergen: string; reaction: string; severity: 'mild' | 'moderate' | 'severe' }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between">
      <div>
        <p className="font-display font-medium text-navy-900">{allergen}</p>
        <p className="text-sm text-navy-500 font-body">{reaction}</p>
      </div>
      <span className={`badge ${
        severity === 'severe' ? 'badge-danger' :
        severity === 'moderate' ? 'badge-warning' :
        'badge-neutral'
      }`}>
        {severity}
      </span>
    </div>
  );
}
