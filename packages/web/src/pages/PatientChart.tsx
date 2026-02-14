import { useState, useEffect, FormEvent, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePatient } from '../hooks/usePatients';
import { api, Document, CreatePatientInput, OcrResult, Appointment, Encounter } from '../api/client';
import { ExtractedFieldsReview } from '../components/ocr/ExtractedFieldsReview';
import { BookingModal } from '../components/patient-chart/BookingModal';
import { EditPatientModal } from '../components/patient-chart/EditPatientModal';
import { MemoTaskModal } from '../components/patient-chart/MemoTaskModal';
import { EncounterDetailsModal } from '../components/patient-chart/EncounterDetailsModal';
import { AppointmentSidebar } from '../components/patient-chart/AppointmentSidebar';
import { DocumentsTabContent } from '../components/patient-chart/DocumentsTabContent';
import { DocumentListPanel } from '../components/patient-chart/DocumentListPanel';
import { NotesTabContent } from '../components/patient-chart/NotesTabContent';

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

  // Clinic notes state
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

  // Clinical tracking state
  const [flexibleLaryngoscopyDone, setFlexibleLaryngoscopyDone] = useState(false);
  const [mdtBooked, setMdtBooked] = useState(false);
  const [lastMdtDate] = useState<string | null>(null);
  const [audiologicalBooked, setAudiologicalBooked] = useState(false);
  const [allergyTestingBooked, setAllergyTestingBooked] = useState(false);

  // Encounter modal state
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);

  // --- Data fetching ---

  const fetchDocuments = () => {
    if (id) {
      api.getPatientDocuments(id).then(({ data }) => {
        if (data) {
          setDocuments(data.documents);
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

  useEffect(() => {
    if (patient) setNotes(patient.notes || '');
  }, [patient]);

  useEffect(() => {
    if (patient) setClinicNotes(patient.clinicNotes || '');
  }, [patient]);

  // --- Handlers ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, category: 'scanned_document' | 'letter' | 'operative_note' = 'scanned_document') => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    setUploadError('');
    const { error } = await api.uploadDocument(id, file, undefined, category);
    if (error) setUploadError(error);
    else fetchDocuments();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const scannedDocuments = documents.filter(doc => !doc.category || doc.category === 'scanned_document');
  const letters = documents.filter(doc => doc.category === 'letter');
  const operativeNotes = documents.filter(doc => doc.category === 'operative_note');

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    const { error } = await api.deleteDocument(docId);
    if (!error) fetchDocuments();
  };

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

    const durationMinutes = bookingType === 'operation' ? 60 : 30;
    const [hours, minutes] = bookingTime.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + durationMinutes);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    const appointmentType = bookingType === 'operation' ? 'Procedure' : bookingType === 'scan' ? 'Scan' : 'Follow-up';

    const { error } = await api.createAppointment({
      patientId: id,
      providerId: 'a0000000-0000-0000-0000-000000000002',
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
    fetchUpcomingAppointments();
  };

  const handleMemoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!memoText.trim() || !patient) return;
    setMemoSubmitting(true);
    const { error } = await api.createTask({ patientId: patient.id, taskText: memoText.trim() });
    if (!error) {
      setMemoText('');
      setShowMemoModal(false);
    }
    setMemoSubmitting(false);
  };

  const handleOpenEditPatient = () => {
    if (patient) {
      setEditForm({
        mrn: patient.mrn, firstName: patient.firstName, lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth.split('T')[0], gender: patient.gender || '',
        email: patient.email || '', phone: patient.phone || '',
        addressLine1: patient.addressLine1 || '', city: patient.city || '',
        state: patient.state || '', zip: patient.zip || '',
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

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const saveClinicNotes = async () => {
    setClinicNotesSaving(true);
    const { error } = await api.updatePatient(id!, { clinicNotes });
    setClinicNotesSaving(false);
    if (!error) {
      setClinicNotesSaved(true);
      setTimeout(() => setClinicNotesSaved(false), 2000);
    }
  };

  const saveClinicalNotes = async () => {
    setNotesSaving(true);
    const { error } = await api.updatePatient(id!, { notes });
    setNotesSaving(false);
    if (!error) {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  };

  // --- Loading / not found ---

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
          <Link to="/patients" className="text-teal-600 font-body text-sm hover:underline mt-2 inline-block">Back to patients</Link>
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
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const patientName = `${patient.firstName} ${patient.lastName}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-body">
        <Link to="/patients" className="text-navy-500 hover:text-navy-700">Patients</Link>
        <svg className="w-4 h-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-teal-600 dark:text-teal-400 font-semibold">{patientName}</span>
      </nav>

      {/* Patient Header - Stacked Pages Effect */}
      <div className="relative">
        {encounters.length > 1 && (
          <>
            <div className="absolute -left-1 top-3 right-1 bottom-0 rounded-xl bg-navy-200/50 dark:bg-navy-700/30 transform -rotate-1" />
            <div className="absolute -left-0.5 top-1.5 right-0.5 bottom-0 rounded-xl bg-navy-100/70 dark:bg-navy-800/50 transform rotate-0.5" />
          </>
        )}

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
                  onClick={() => { setSelectedEncounter(encounter); setShowEncounterModal(true); }}
                  className={`${tabColor} text-[10px] font-mono px-2 py-1 rounded-l-md shadow-sm transform -rotate-90 origin-right translate-x-[-100%] whitespace-nowrap cursor-pointer hover:scale-110 hover:shadow-md transition-all ${index > 0 ? 'mt-8' : ''}`}
                  title={`Click to view: ${formattedDate} - ${encounter.chiefComplaint || 'Visit'}`}
                >
                  {formattedDate}
                </div>
              );
            })}
          </div>
        )}

        <div className="card-clinical p-6 relative z-20">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {patientName}'s Chart
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
                <button onClick={() => openBookingModal('clinic')} className="btn-primary bg-teal-600 hover:bg-teal-700 text-sm">Book Clinic Appt</button>
                <button onClick={() => openBookingModal('operation')} className="btn-primary bg-coral-600 hover:bg-coral-700 text-sm">Book Operation</button>
                <button onClick={() => openBookingModal('scan')} className="btn-primary bg-purple-600 hover:bg-purple-700 text-sm">Book Scan</button>
              </div>
            </div>

            {/* Clinical Tracking Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 mb-2">
              <ClinicalToggle label="Book for MDT" active={mdtBooked} onToggle={() => setMdtBooked(!mdtBooked)} color="amber" subtitle={`Last MDT: ${lastMdtDate || 'None'}`} icon="mdt" />
              <ClinicalToggle label="Flexible Laryngoscopy" active={flexibleLaryngoscopyDone} onToggle={() => setFlexibleLaryngoscopyDone(!flexibleLaryngoscopyDone)} color="blue" icon="eye" />
              <ClinicalToggle label="Audiological Assessment" active={audiologicalBooked} onToggle={() => setAudiologicalBooked(!audiologicalBooked)} color="purple" icon="mic" />
              <ClinicalToggle label="Allergy Testing" active={allergyTestingBooked} onToggle={() => setAllergyTestingBooked(!allergyTestingBooked)} color="rose" icon="flask" />
            </div>

            {/* Memo Task Button */}
            <div className="mt-4">
              <button onClick={() => setShowMemoModal(true)} className="px-6 py-3 text-sm font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors">
                Memo Task
              </button>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Phone</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.phone || '\u2014'}</p>
              </div>
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Email</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.email || '\u2014'}</p>
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

            {/* Visit History Summary */}
            {encounters.length > 0 && (
              <div className="mt-4 p-3 bg-navy-50 dark:bg-navy-800/50 rounded-lg">
                <p className="text-xs text-navy-500 dark:text-navy-400 font-body uppercase tracking-wide mb-2">Visit History</p>
                <div className="flex flex-wrap gap-2">
                  {encounters.map((encounter) => {
                    const date = new Date(encounter.encounterDate);
                    const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const complaint = encounter.chiefComplaint || encounter.assessment || 'Visit';
                    const words = complaint.split(/\s+/).slice(0, 5).join(' ');
                    const summary = words.length > 30 ? words.substring(0, 30) + '\u2026' : words;
                    return (
                      <button
                        key={encounter.id}
                        onClick={() => { setSelectedEncounter(encounter); setShowEncounterModal(true); }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-navy-700 rounded-full text-xs font-medium text-navy-600 dark:text-navy-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400 transition-colors border border-navy-200 dark:border-navy-600 hover:border-teal-300 dark:hover:border-teal-600"
                        title={complaint}
                      >
                        <span className="text-navy-400 dark:text-navy-500">{shortDate}</span>
                        <span className="font-semibold">{summary}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
              <NotesTabContent title="Clinic Notes" notes={clinicNotes} saving={clinicNotesSaving} saved={clinicNotesSaved} placeholder="Type clinic notes here..." onNotesChange={setClinicNotes} onSave={saveClinicNotes} />
            )}

            {activeTab === 'notes' && (
              <NotesTabContent title="Clinical Notes" notes={notes} saving={notesSaving} saved={notesSaved} placeholder="Type or paste clinical notes here..." onNotesChange={setNotes} onSave={saveClinicalNotes} />
            )}

            {activeTab === 'documents' && (
              <DocumentsTabContent
                scannedDocuments={scannedDocuments}
                uploading={uploading}
                uploadError={uploadError}
                ocrResults={ocrResults}
                selectedDocumentForOcr={selectedDocumentForOcr}
                showExtractedFields={showExtractedFields}
                onFileSelect={handleFileSelect}
                onShowExtractedFields={handleShowExtractedFields}
                onOcrProcessingComplete={handleOcrProcessingComplete}
                onSelectForOcr={setSelectedDocumentForOcr}
                onDeleteDocument={handleDeleteDocument}
              />
            )}

            {activeTab === 'letters' && (
              <DocumentListPanel
                title="Letters"
                uploadLabel="Upload Letter"
                uploadId="letter-upload"
                emptyIcon="letter"
                emptyTitle="No letters yet"
                emptyDescription="Upload referral letters, medical certificates, and correspondence"
                documents={letters}
                uploading={uploading}
                iconColor="blue"
                onFileSelect={(e) => handleFileSelect(e, 'letter')}
                onDeleteDocument={handleDeleteDocument}
              />
            )}

            {activeTab === 'operative-notes' && (
              <DocumentListPanel
                title="Operative Notes"
                uploadLabel="Upload Operative Note"
                uploadId="operative-note-upload"
                emptyIcon="operative"
                emptyTitle="No operative notes yet"
                emptyDescription="Upload surgical procedures and operative findings"
                documents={operativeNotes}
                uploading={uploading}
                iconColor="purple"
                onFileSelect={(e) => handleFileSelect(e, 'operative_note')}
                onDeleteDocument={handleDeleteDocument}
              />
            )}
          </div>
        </div>

        <AppointmentSidebar
          upcomingAppointments={upcomingAppointments}
          onBookClinic={() => openBookingModal('clinic')}
          onBookOperation={() => openBookingModal('operation')}
        />
      </div>

      {/* Modals */}
      {showExtractedFields && selectedDocumentForOcr && patient && (
        <ExtractedFieldsReview
          documentId={selectedDocumentForOcr.id}
          patient={patient}
          onClose={() => { setShowExtractedFields(false); setSelectedDocumentForOcr(null); }}
          onFieldsApplied={handleFieldsApplied}
        />
      )}

      {showBookingModal && (
        <BookingModal
          bookingType={bookingType}
          bookingDate={bookingDate}
          bookingTime={bookingTime}
          bookingNotes={bookingNotes}
          bookingError={bookingError}
          bookingSubmitting={bookingSubmitting}
          patientName={patientName}
          onDateChange={setBookingDate}
          onTimeChange={setBookingTime}
          onNotesChange={setBookingNotes}
          onSubmit={handleBookingSubmit}
          onClose={() => setShowBookingModal(false)}
        />
      )}

      {showEditPatient && (
        <EditPatientModal
          mrn={patient.mrn}
          editForm={editForm}
          editFormError={editFormError}
          editSubmitting={editSubmitting}
          onInputChange={handleEditInputChange}
          onSubmit={handleEditPatientSubmit}
          onClose={handleCloseEditPatient}
        />
      )}

      {showMemoModal && (
        <MemoTaskModal
          memoText={memoText}
          memoSubmitting={memoSubmitting}
          patientName={patientName}
          onTextChange={setMemoText}
          onSubmit={handleMemoSubmit}
          onClose={() => setShowMemoModal(false)}
        />
      )}

      {showEncounterModal && selectedEncounter && (
        <EncounterDetailsModal
          encounter={selectedEncounter}
          onClose={() => setShowEncounterModal(false)}
        />
      )}
    </div>
  );
}

// --- Helper component for clinical tracking toggle buttons ---

const clinicalIcons = {
  mdt: {
    active: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    inactive: <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
  },
  eye: {
    active: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    inactive: <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,
  },
  mic: {
    active: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    inactive: <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />,
  },
  flask: {
    active: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    inactive: <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />,
  },
};

function ClinicalToggle({ label, active, onToggle, color, subtitle, icon }: {
  label: string;
  active: boolean;
  onToggle: () => void;
  color: string;
  subtitle?: string;
  icon: keyof typeof clinicalIcons;
}) {
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all ${
          active
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-2 ring-green-500'
            : `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-400 hover:bg-${color}-200 dark:hover:bg-${color}-900/50`
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {active ? clinicalIcons[icon].active : clinicalIcons[icon].inactive}
        </svg>
        {label} {active && '\u2713'}
      </button>
      <span className="text-xs text-navy-500 dark:text-navy-400 mt-1">{subtitle || '\u00A0'}</span>
    </div>
  );
}
