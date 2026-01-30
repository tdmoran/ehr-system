import { useState, useEffect, FormEvent, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePatient } from '../hooks/usePatients';
import { api, Document, CreatePatientInput, OcrResult, Appointment, Encounter } from '../api/client';
import { OcrProcessingPanel } from '../components/ocr/OcrProcessingPanel';
import { ExtractedFieldsReview } from '../components/ocr/ExtractedFieldsReview';

export default function PatientChart() {
  const { id } = useParams<{ id: string }>();
  const { patient, loading: patientLoading, refetch: refetchPatient } = usePatient(id!);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'letters' | 'operative-notes' | 'clinic-notes' | 'notes'>('documents');
  const [notes, setNotes] = useState<string>('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Clinic notes state (stored in localStorage)
  const [clinicNotes, setClinicNotes] = useState<string>('');
  const [clinicNotesSaving, setClinicNotesSaving] = useState(false);
  const [clinicNotesSaved, setClinicNotesSaved] = useState(false);

  // Document upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Edit patient state
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CreatePatientInput>>({});
  const [editFormError, setEditFormError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // OCR state
  const [selectedDocumentForOcr, setSelectedDocumentForOcr] = useState<Document | null>(null);
  const [showExtractedFields, setShowExtractedFields] = useState(false);
  const [ocrResults, setOcrResults] = useState<Record<string, OcrResult>>({});

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingType, setBookingType] = useState<'clinic' | 'operation' | 'scan'>('clinic');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Memo task modal state
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [memoSubmitting, setMemoSubmitting] = useState(false);

  // Flexible Laryngoscopy state (tracks if procedure was performed this visit)
  const [flexibleLaryngoscopyDone, setFlexibleLaryngoscopyDone] = useState(false);

  // MDT booking state
  const [mdtBooked, setMdtBooked] = useState(false);
  const [lastMdtDate] = useState<string | null>(null);

  // Audiological assessment booking state
  const [audiologicalBooked, setAudiologicalBooked] = useState(false);

  // Allergy testing booking state
  const [allergyTestingBooked, setAllergyTestingBooked] = useState(false);

  // Selected encounter state (for viewing past visits)
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);

  const fetchDocuments = () => {
    if (id) {
      api.getPatientDocuments(id).then(({ data }) => {
        if (data) {
          setDocuments(data.documents);
          // Fetch OCR status for each document
          data.documents.forEach((doc) => {
            api.getOcrResult(doc.id).then(({ data: ocrData }) => {
              if (ocrData?.ocrResult) {
                setOcrResults((prev) => ({ ...prev, [doc.id]: ocrData.ocrResult }));
              }
            });
          });
        }
      });
    }
  };

  const fetchUpcomingAppointments = async () => {
    if (id) {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const { data } = await api.getAppointments(today, futureDate.toISOString().split('T')[0]);
      if (data) {
        // Filter for this patient and sort by date
        const patientAppointments = data.appointments
          .filter(apt => apt.patientId === id && apt.status !== 'completed' && apt.status !== 'cancelled' && apt.status !== 'no_show')
          .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.startTime.localeCompare(b.startTime));
        setUpcomingAppointments(patientAppointments);
      }
    }
  };

  const fetchEncounters = async () => {
    if (id) {
      const { data } = await api.getPatientEncounters(id);
      if (data) {
        // Sort by date, most recent first
        const sortedEncounters = data.encounters.sort((a, b) =>
          new Date(b.encounterDate).getTime() - new Date(a.encounterDate).getTime()
        );
        setEncounters(sortedEncounters);
      }
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchUpcomingAppointments();
    fetchEncounters();
  }, [id]);

  // Load notes from patient when patient data is available
  useEffect(() => {
    if (patient) {
      setNotes(patient.notes || '');
    }
  }, [patient]);

  // Load clinic notes from patient data
  useEffect(() => {
    if (patient) {
      setClinicNotes(patient.clinicNotes || '');
    }
  }, [patient]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, category: 'scanned_document' | 'letter' | 'operative_note' = 'scanned_document') => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    setUploadError('');

    const { data, error } = await api.uploadDocument(id, file, undefined, category);

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

  // Filter documents by category
  const scannedDocuments = documents.filter(doc => !doc.category || doc.category === 'scanned_document');
  const letters = documents.filter(doc => doc.category === 'letter');
  const operativeNotes = documents.filter(doc => doc.category === 'operative_note');

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

  // OCR handlers
  const handleOcrProcessingComplete = (ocrResult: OcrResult) => {
    if (selectedDocumentForOcr) {
      setOcrResults((prev) => ({ ...prev, [selectedDocumentForOcr.id]: ocrResult }));
    }
  };

  const handleShowExtractedFields = (doc: Document) => {
    setSelectedDocumentForOcr(doc);
    setShowExtractedFields(true);
  };

  const handleFieldsApplied = () => {
    setShowExtractedFields(false);
    setSelectedDocumentForOcr(null);
    refetchPatient();
    fetchDocuments();
  };

  const getOcrStatusBadge = (docId: string) => {
    const result = ocrResults[docId];
    if (!result) return null;

    switch (result.processingStatus) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            OCR Complete
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            OCR Failed
          </span>
        );
      default:
        return null;
    }
  };

  // Booking modal handlers
  const openBookingModal = (type: 'clinic' | 'operation' | 'scan') => {
    setBookingType(type);
    setBookingDate('');
    setBookingTime('09:00');
    setBookingNotes('');
    setBookingError('');
    setShowBookingModal(true);
  };

  const handleBookingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookingDate || !bookingTime || !id) {
      setBookingError('Please select a date and time');
      return;
    }

    setBookingSubmitting(true);
    setBookingError('');

    // Calculate end time (30 min for clinic/scan, 60 min for operation)
    const durationMinutes = bookingType === 'operation' ? 60 : 30;
    const [hours, minutes] = bookingTime.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + durationMinutes);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const appointmentType = bookingType === 'operation' ? 'Procedure' : bookingType === 'scan' ? 'Scan' : 'Follow-up';

    const { error } = await api.createAppointment({
      patientId: id,
      providerId: 'a0000000-0000-0000-0000-000000000002', // Default provider - TODO: make selectable
      appointmentDate: bookingDate,
      startTime: bookingTime,
      endTime: endTime,
      appointmentType: appointmentType,
      notes: bookingNotes || undefined,
    });

    if (error) {
      setBookingError(error);
      setBookingSubmitting(false);
      return;
    }

    setShowBookingModal(false);
    setBookingSubmitting(false);
  };

  // Handle memo task submission
  const handleMemoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!memoText.trim() || !patient) return;

    setMemoSubmitting(true);

    // Create task via API
    const { error } = await api.createTask({
      patientId: patient.id,
      taskText: memoText.trim(),
    });

    if (!error) {
      setMemoText('');
      setShowMemoModal(false);
    }
    setMemoSubmitting(false);
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
    { id: 'documents', label: 'Scanned Documents' },
    { id: 'letters', label: 'Letters' },
    { id: 'clinic-notes', label: 'Clinic Notes' },
    { id: 'notes', label: 'Notes from Heidi' },
    { id: 'operative-notes', label: 'Operative Notes' },
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

      {/* Patient Header - Stacked Pages Effect */}
      <div className="relative">
        {/* Background pages (previous visits) - only show if there are encounters */}
        {encounters.length > 1 && (
          <>
            <div className="absolute -left-1 top-3 right-1 bottom-0 rounded-xl bg-navy-200/50 dark:bg-navy-700/30 transform -rotate-1" />
            <div className="absolute -left-0.5 top-1.5 right-0.5 bottom-0 rounded-xl bg-navy-100/70 dark:bg-navy-800/50 transform rotate-0.5" />
          </>
        )}

        {/* Visit date tabs on the side - dynamically from encounters */}
        {encounters.length > 0 && (
          <div className="absolute -left-2 top-8 flex flex-col gap-1 z-10">
            {encounters.slice(0, 5).map((encounter, index) => {
              const date = new Date(encounter.encounterDate);
              const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const isSelected = selectedEncounter?.id === encounter.id;
              const unselectedColors = [
                'bg-navy-200 dark:bg-navy-700 text-navy-600 dark:text-navy-300',
                'bg-navy-300 dark:bg-navy-600 text-navy-700 dark:text-navy-200',
                'bg-navy-400 dark:bg-navy-500 text-white',
                'bg-navy-500 dark:bg-navy-400 text-white',
                'bg-navy-600 dark:bg-navy-300 text-white',
              ];
              const tabColor = isSelected
                ? 'bg-teal-500 dark:bg-teal-600 text-white ring-2 ring-teal-300 dark:ring-teal-400 shadow-lg'
                : unselectedColors[index];
              return (
                <div
                  key={encounter.id}
                  onClick={() => {
                    setSelectedEncounter(encounter);
                    setShowEncounterModal(true);
                  }}
                  className={`${tabColor} text-[10px] font-mono px-2 py-1 rounded-l-md shadow-sm transform -rotate-90 origin-right translate-x-[-100%] whitespace-nowrap cursor-pointer hover:scale-110 hover:shadow-md transition-all ${index > 0 ? 'mt-8' : ''}`}
                  title={`Click to view: ${formattedDate} - ${encounter.chiefComplaint || 'Visit'}`}
                >
                  {formattedDate}
                </div>
              );
            })}
          </div>
        )}

        {/* Current visit (main card) */}
        <div className="card-clinical p-6 relative z-20">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Patient Info */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {patient.firstName} {patient.lastName}'s Chart
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-navy-500 font-body text-sm">
                  <span className="font-mono bg-navy-50 px-2 py-0.5 rounded">{patient.mrn}</span>
                  <span>{calculateAge(patient.dateOfBirth)} years old</span>
                  <span className="capitalize">{patient.gender || 'Unknown'}</span>
                  <span>DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleOpenEditPatient} className="btn-secondary text-sm">Edit Patient</button>
                <button
                  onClick={() => openBookingModal('clinic')}
                  className="btn-primary bg-teal-600 hover:bg-teal-700 text-sm"
                >
                  Book Clinic Appt
                </button>
                <button
                  onClick={() => openBookingModal('operation')}
                  className="btn-primary bg-coral-600 hover:bg-coral-700 text-sm"
                >
                  Book Operation
                </button>
                <button
                  onClick={() => openBookingModal('scan')}
                  className="btn-primary bg-purple-600 hover:bg-purple-700 text-sm"
                >
                  Book Scan
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 mb-2">
              {/* Book for MDT */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setMdtBooked(!mdtBooked)}
                  className={`w-full px-4 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all ${
                    mdtBooked
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-2 ring-green-500'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {mdtBooked ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    )}
                  </svg>
                  Book for MDT {mdtBooked && '✓'}
                </button>
                <span className="text-xs text-navy-500 dark:text-navy-400 mt-1">
                  Last MDT: {lastMdtDate || 'None'}
                </span>
              </div>

              {/* Flexible Laryngoscopy */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setFlexibleLaryngoscopyDone(!flexibleLaryngoscopyDone)}
                  className={`w-full px-4 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all ${
                    flexibleLaryngoscopyDone
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-2 ring-green-500'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {flexibleLaryngoscopyDone ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                  Flexible Laryngoscopy {flexibleLaryngoscopyDone && '✓'}
                </button>
                <span className="text-xs text-navy-500 dark:text-navy-400 mt-1">&nbsp;</span>
              </div>

              {/* Audiological Assessment */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setAudiologicalBooked(!audiologicalBooked)}
                  className={`w-full px-4 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all ${
                    audiologicalBooked
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-2 ring-green-500'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {audiologicalBooked ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    )}
                  </svg>
                  Audiological Assessment {audiologicalBooked && '✓'}
                </button>
                <span className="text-xs text-navy-500 dark:text-navy-400 mt-1">&nbsp;</span>
              </div>

              {/* Allergy Testing */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setAllergyTestingBooked(!allergyTestingBooked)}
                  className={`w-full px-4 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all ${
                    allergyTestingBooked
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-2 ring-green-500'
                      : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {allergyTestingBooked ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    )}
                  </svg>
                  Allergy Testing {allergyTestingBooked && '✓'}
                </button>
                <span className="text-xs text-navy-500 dark:text-navy-400 mt-1">&nbsp;</span>
              </div>
            </div>

            {/* Memo Task Button */}
            <div className="mt-4">
              <button
                onClick={() => setShowMemoModal(true)}
                className="px-6 py-3 text-sm font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors"
              >
                Memo Task
              </button>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Phone</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.phone || '—'}</p>
              </div>
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Email</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.email || '—'}</p>
              </div>
              <div className="p-3 bg-coral-50 dark:bg-coral-900/30 rounded-lg border-2 border-coral-300 dark:border-coral-700 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-coral-200/30 dark:bg-coral-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-coral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-coral-600 dark:text-coral-400 font-body uppercase tracking-wide font-semibold">Allergies</p>
                  <span className="w-2 h-2 rounded-full bg-coral-500 animate-pulse" />
                </div>
                <p className="font-display font-semibold text-coral-700 dark:text-coral-300 mt-1 relative">Penicillin, Shellfish</p>
              </div>
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Patient's GP</p>
                <p className="font-display font-medium text-navy-900 mt-1">Dr. Smith</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Main content grid - Tabs on left, Next Appointment on right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left side - Tabs and content */}
        <div className="lg:col-span-3">
          {/* Tabs */}
          <div className="border-b-2 border-clinical-200 mb-4">
            <nav className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 font-display font-semibold text-base transition-all relative rounded-t-lg ${
                    activeTab === tab.id
                      ? 'text-teal-700 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400 border-2 border-b-0 border-teal-300 dark:border-teal-700 -mb-0.5'
                      : 'text-navy-500 hover:text-navy-700 hover:bg-clinical-50 dark:text-navy-400 dark:hover:text-navy-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="animate-fade-in">
        {activeTab === 'clinic-notes' && (
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100">Clinic Notes</h3>
              <div className="flex items-center gap-2">
                {clinicNotesSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                <button
                  onClick={async () => {
                    setClinicNotesSaving(true);
                    const { error } = await api.updatePatient(id!, { clinicNotes });
                    setClinicNotesSaving(false);
                    if (!error) {
                      setClinicNotesSaved(true);
                      setTimeout(() => setClinicNotesSaved(false), 2000);
                    }
                  }}
                  disabled={clinicNotesSaving}
                  className="btn-primary text-sm py-2 flex items-center gap-2"
                >
                  {clinicNotesSaving ? (
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
                value={clinicNotes}
                onChange={(e) => setClinicNotes(e.target.value)}
                placeholder="Type clinic notes here..."
                className="w-full h-96 p-4 border border-clinical-200 dark:border-navy-700 rounded-lg font-body text-navy-900 dark:text-navy-100 dark:bg-navy-800 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900">Clinical Notes</h3>
              <div className="flex items-center gap-2">
                {notesSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                <button
                  onClick={async () => {
                    setNotesSaving(true);
                    const { error } = await api.updatePatient(id!, { notes });
                    setNotesSaving(false);
                    if (!error) {
                      setNotesSaved(true);
                      setTimeout(() => setNotesSaved(false), 2000);
                    }
                  }}
                  disabled={notesSaving}
                  className="btn-primary text-sm py-2 flex items-center gap-2"
                >
                  {notesSaving ? (
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
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type or paste clinical notes here..."
                className="w-full h-96 p-4 border border-clinical-200 rounded-lg font-body text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
            </div>
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

            {scannedDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-navy-50 dark:bg-navy-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-navy-300 dark:text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-navy-900 dark:text-navy-100 font-display font-medium">No documents uploaded</p>
                <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1 mb-3">
                  Upload referral letters, lab results, imaging reports, or other clinical documents
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-navy-400 dark:text-navy-500">
                  <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">PDF</span>
                  <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">JPG</span>
                  <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">PNG</span>
                  <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">DICOM</span>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-clinical-100">
                {scannedDocuments.map((doc) => (
                  <div key={doc.id} className="p-4 hover:bg-clinical-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <a
                        href={api.getDocumentUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-lg bg-coral-50 flex items-center justify-center flex-shrink-0 hover:bg-coral-100 transition-colors"
                      >
                        {doc.mimeType === 'application/pdf' ? (
                          <svg className="w-5 h-5 text-coral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-coral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        )}
                      </a>
                      <a
                        href={api.getDocumentUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-display font-medium text-navy-900 truncate hover:text-teal-600">{doc.originalName}</p>
                          {getOcrStatusBadge(doc.id)}
                        </div>
                        <p className="text-sm text-navy-500 font-body">
                          {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </a>
                      <div className="flex items-center gap-2">
                        {ocrResults[doc.id]?.processingStatus === 'completed' && (
                          <button
                            onClick={() => handleShowExtractedFields(doc)}
                            className="px-3 py-1.5 text-sm bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors flex items-center gap-1.5"
                            title="Review extracted fields"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                            </svg>
                            Review Fields
                          </button>
                        )}
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

                    {/* OCR Processing Panel - show for selected document */}
                    {selectedDocumentForOcr?.id === doc.id && !showExtractedFields && (
                      <div className="mt-4">
                        <OcrProcessingPanel
                          documentId={doc.id}
                          onProcessingComplete={handleOcrProcessingComplete}
                        />
                      </div>
                    )}

                    {/* Quick OCR button for documents that haven't been processed */}
                    {!ocrResults[doc.id] && selectedDocumentForOcr?.id !== doc.id && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => setSelectedDocumentForOcr(doc)}
                          className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Process with OCR
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'letters' && (
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900">Letters</h3>
              <div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.tiff"
                  onChange={(e) => handleFileSelect(e, 'letter')}
                  className="hidden"
                  id="letter-upload"
                />
                <label
                  htmlFor="letter-upload"
                  className={`btn-primary text-sm py-2 cursor-pointer inline-flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Upload Letter
                </label>
              </div>
            </div>
            {letters.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-navy-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <p className="text-navy-900 font-display font-medium">No letters yet</p>
                <p className="text-navy-500 font-body text-sm mt-1">Upload referral letters, medical certificates, and correspondence</p>
              </div>
            ) : (
              <div className="divide-y divide-clinical-100">
                {letters.map((doc) => (
                  <a
                    key={doc.id}
                    href={api.getDocumentUrl(doc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 hover:bg-clinical-50 transition-colors flex items-center gap-4 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-medium text-navy-900 truncate hover:text-teal-600">{doc.originalName}</p>
                      <p className="text-sm text-navy-500 font-body">
                        {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteDocument(doc.id); }}
                      className="p-2 rounded-lg hover:bg-coral-50 text-navy-400 hover:text-coral-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'operative-notes' && (
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900">Operative Notes</h3>
              <div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.tiff"
                  onChange={(e) => handleFileSelect(e, 'operative_note')}
                  className="hidden"
                  id="operative-note-upload"
                />
                <label
                  htmlFor="operative-note-upload"
                  className={`btn-primary text-sm py-2 cursor-pointer inline-flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Upload Operative Note
                </label>
              </div>
            </div>
            {operativeNotes.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-navy-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <p className="text-navy-900 font-display font-medium">No operative notes yet</p>
                <p className="text-navy-500 font-body text-sm mt-1">Upload surgical procedures and operative findings</p>
              </div>
            ) : (
              <div className="divide-y divide-clinical-100">
                {operativeNotes.map((doc) => (
                  <a
                    key={doc.id}
                    href={api.getDocumentUrl(doc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 hover:bg-clinical-50 transition-colors flex items-center gap-4 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-medium text-navy-900 truncate hover:text-teal-600">{doc.originalName}</p>
                      <p className="text-sm text-navy-500 font-body">
                        {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteDocument(doc.id); }}
                      className="p-2 rounded-lg hover:bg-coral-50 text-navy-400 hover:text-coral-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        </div>
        </div>

        {/* Right side - Next Appointment */}
        <div className="lg:col-span-1">
          <div className="card-clinical overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-clinical-200 bg-teal-50 dark:bg-teal-900/20">
              <h3 className="font-display font-semibold text-teal-800 dark:text-teal-200 text-sm">Next Appointment</h3>
            </div>
            {upcomingAppointments.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-clinical-100 dark:bg-navy-800 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-navy-400 dark:text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="text-navy-600 dark:text-navy-300 font-body text-sm font-medium">No upcoming appointments</p>
                <p className="text-navy-400 dark:text-navy-500 font-body text-xs mt-1 mb-3">Schedule a clinic visit or procedure</p>
                <button
                  onClick={() => openBookingModal('clinic')}
                  className="btn-primary text-sm py-2 px-4"
                >
                  Book appointment
                </button>
              </div>
            ) : (
              <div className="divide-y divide-clinical-100">
                {upcomingAppointments.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${
                        apt.appointmentType === 'Procedure' ? 'bg-coral-500' :
                        apt.appointmentType === 'Scan' ? 'bg-purple-500' :
                        'bg-teal-500'
                      }`} />
                      <p className="font-display font-medium text-navy-900 text-sm">
                        {new Date(apt.appointmentDate + 'T12:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <p className="text-navy-600 font-body text-xs ml-4">
                      {apt.startTime.substring(0, 5)} · {apt.appointmentType}
                    </p>
                  </div>
                ))}
                {upcomingAppointments.length > 5 && (
                  <div className="p-2 text-center">
                    <span className="text-navy-400 text-xs">+{upcomingAppointments.length - 5} more</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Operation Date */}
          <div className="card-clinical overflow-hidden mt-4">
            <div className="px-4 py-3 border-b border-clinical-200 bg-coral-50 dark:bg-coral-900/20">
              <h3 className="font-display font-semibold text-coral-800 dark:text-coral-200 text-sm">Operation Date</h3>
            </div>
            {(() => {
              const operations = upcomingAppointments.filter(apt => apt.appointmentType === 'Procedure');
              return operations.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-coral-50 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-navy-500 font-body text-sm">No operation scheduled</p>
                  <button
                    onClick={() => openBookingModal('operation')}
                    className="mt-2 text-coral-600 hover:text-coral-700 font-medium text-sm"
                  >
                    Book operation
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-clinical-100">
                  {operations.slice(0, 3).map((apt) => (
                    <div key={apt.id} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-coral-500" />
                        <p className="font-display font-medium text-navy-900 text-sm">
                          {new Date(apt.appointmentDate + 'T12:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <p className="text-navy-600 font-body text-xs ml-4">
                        {apt.startTime.substring(0, 5)}
                        {apt.notes && ` · ${apt.notes}`}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Extracted Fields Review Modal */}
      {showExtractedFields && selectedDocumentForOcr && patient && (
        <ExtractedFieldsReview
          documentId={selectedDocumentForOcr.id}
          patient={patient}
          onClose={() => {
            setShowExtractedFields(false);
            setSelectedDocumentForOcr(null);
          }}
          onFieldsApplied={handleFieldsApplied}
        />
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                  {bookingType === 'operation' ? 'Book Operation' : bookingType === 'scan' ? 'Book Scan' : 'Book Clinic Appointment'}
                </h2>
                <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
                  {patient?.firstName} {patient?.lastName}
                </p>
              </div>
              <button
                onClick={() => setShowBookingModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleBookingSubmit}>
              <div className="p-6 space-y-4">
                {bookingError && (
                  <div className="p-3 bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 rounded-lg">
                    <p className="text-coral-700 dark:text-coral-400 text-sm font-body">{bookingError}</p>
                  </div>
                )}

                {/* Appointment Type Badge */}
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

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Date <span className="text-coral-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="input-clinical"
                    required
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Time <span className="text-coral-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="input-clinical"
                    required
                  />
                  <p className="text-xs text-navy-400 mt-1">
                    Duration: {bookingType === 'operation' ? '60 minutes' : '30 minutes'}
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Notes
                  </label>
                  <textarea
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder={bookingType === 'operation' ? 'e.g., Procedure details, pre-op requirements...' : bookingType === 'scan' ? 'e.g., CT chest with contrast, MRI brain...' : 'e.g., Reason for follow-up...'}
                    rows={3}
                    className="input-clinical resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
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

      {/* Memo Task Modal */}
      {showMemoModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                  Memo Task
                </h2>
                <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
                  {patient?.firstName} {patient?.lastName}
                </p>
              </div>
              <button
                onClick={() => setShowMemoModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleMemoSubmit}>
              <div className="p-6">
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-2">
                  Task Description
                </label>
                <textarea
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="Enter task details for secretary to action..."
                  rows={4}
                  className="input-clinical resize-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowMemoModal(false)}
                  className="btn-secondary"
                  disabled={memoSubmitting}
                >
                  Cancel
                </button>
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
      )}

      {/* Encounter Details Modal */}
      {showEncounterModal && selectedEncounter && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEncounterModal(false)}>
          <div
            className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700 bg-gradient-to-r from-teal-500 to-teal-600">
              <div>
                <h2 className="font-display text-xl font-bold text-white">
                  Visit on {new Date(selectedEncounter.encounterDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h2>
                <p className="text-teal-100 font-body text-sm mt-1">
                  {selectedEncounter.chiefComplaint || 'Clinical Visit'}
                </p>
              </div>
              <button
                onClick={() => setShowEncounterModal(false)}
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
                  selectedEncounter.status === 'signed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : selectedEncounter.status === 'completed'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {selectedEncounter.status === 'signed' ? '✓ Signed' : selectedEncounter.status === 'completed' ? 'Completed' : 'In Progress'}
                </span>
                {selectedEncounter.signedAt && (
                  <span className="text-sm text-navy-500 dark:text-navy-400">
                    Signed on {new Date(selectedEncounter.signedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Chief Complaint */}
              {selectedEncounter.chiefComplaint && (
                <div>
                  <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-coral-500"></span>
                    Chief Complaint
                  </h3>
                  <p className="text-navy-700 dark:text-navy-300 font-body bg-coral-50 dark:bg-coral-900/20 p-4 rounded-lg border-l-4 border-coral-400">
                    {selectedEncounter.chiefComplaint}
                  </p>
                </div>
              )}

              {/* Subjective */}
              {selectedEncounter.subjective && (
                <div>
                  <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">S</span>
                    Subjective
                  </h3>
                  <p className="text-navy-700 dark:text-navy-300 font-body bg-clinical-50 dark:bg-navy-800 p-4 rounded-lg whitespace-pre-wrap">
                    {selectedEncounter.subjective}
                  </p>
                </div>
              )}

              {/* Objective */}
              {selectedEncounter.objective && (
                <div>
                  <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-bold">O</span>
                    Objective
                  </h3>
                  <p className="text-navy-700 dark:text-navy-300 font-body bg-clinical-50 dark:bg-navy-800 p-4 rounded-lg whitespace-pre-wrap">
                    {selectedEncounter.objective}
                  </p>
                </div>
              )}

              {/* Assessment */}
              {selectedEncounter.assessment && (
                <div>
                  <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">A</span>
                    Assessment
                  </h3>
                  <p className="text-navy-700 dark:text-navy-300 font-body bg-clinical-50 dark:bg-navy-800 p-4 rounded-lg whitespace-pre-wrap">
                    {selectedEncounter.assessment}
                  </p>
                </div>
              )}

              {/* Plan */}
              {selectedEncounter.plan && (
                <div>
                  <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-bold">P</span>
                    Plan
                  </h3>
                  <p className="text-navy-700 dark:text-navy-300 font-body bg-clinical-50 dark:bg-navy-800 p-4 rounded-lg whitespace-pre-wrap">
                    {selectedEncounter.plan}
                  </p>
                </div>
              )}

              {/* Empty state if no SOAP data */}
              {!selectedEncounter.subjective && !selectedEncounter.objective && !selectedEncounter.assessment && !selectedEncounter.plan && (
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
              <button
                onClick={() => setShowEncounterModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

