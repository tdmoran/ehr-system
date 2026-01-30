import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, Appointment, AppointmentType, Patient, PatientTask } from '../api/client';
import QuickActions from '../components/QuickActions';
import { useAuth } from '../context/AuthContext';
import TimeSlotGrid from '../components/TimeSlotGrid';
import QuickBooking from '../components/QuickBooking';
import BulkScheduler from '../components/BulkScheduler';
import { ReferralScanner } from '../components/referrals/ReferralScanner';
import { ReferralReviewList } from '../components/referrals/ReferralReviewList';

type TabType = 'schedule' | 'bulk' | 'referrals';

export default function SecretaryDashboard() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('schedule');

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);

  // Referral refresh trigger
  const [referralRefreshTrigger, setReferralRefreshTrigger] = useState(0);

  // Patient tasks modal state
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [patientTasks, setPatientTasks] = useState<PatientTask[]>([]);

  // Quick booking modal state (for clinic/operation)
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false);

  // Ref for scrolling to schedule section
  const scheduleTabRef = useRef<HTMLDivElement>(null);
  const [quickBookingType, setQuickBookingType] = useState<'clinic' | 'operation'>('clinic');
  const [quickBookingPatient, setQuickBookingPatient] = useState('');
  const [quickBookingDate, setQuickBookingDate] = useState('');
  const [quickBookingTime, setQuickBookingTime] = useState('09:00');
  const [quickBookingNotes, setQuickBookingNotes] = useState('');
  const [quickBookingSubmitting, setQuickBookingSubmitting] = useState(false);
  const [quickBookingError, setQuickBookingError] = useState('');

  // The secretary's assigned provider ID
  const providerId = user?.providerId;

  // Fetch appointments for selected date
  const fetchAppointments = async () => {
    if (!providerId) return;

    const { data } = await api.getAppointments(selectedDate, selectedDate, providerId);
    if (data) {
      setAppointments(data.appointments);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const [typesRes, patientsRes] = await Promise.all([
        api.getAppointmentTypes(),
        api.getPatients(),
      ]);

      if (typesRes.data) setAppointmentTypes(typesRes.data.types);
      if (patientsRes.data) setPatients(patientsRes.data.patients);

      await fetchAppointments();
      setLoading(false);
    };

    fetchInitialData();
  }, []);

  // Refetch when date changes
  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, providerId]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = appointments.length;
    const checkedIn = appointments.filter(a => a.status === 'checked_in').length;
    const inProgress = appointments.filter(a => a.status === 'in_progress').length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const noShow = appointments.filter(a => a.status === 'no_show').length;
    const waiting = checkedIn; // Checked in but not yet in progress

    return { total, checkedIn, inProgress, completed, noShow, waiting };
  }, [appointments]);

  // Handle slot click
  const handleSlotClick = (time: string) => {
    setSelectedSlotTime(time);
    setShowBookingModal(true);
  };

  // Handle appointment click for editing
  const handleAppointmentClick = (appointment: Appointment) => {
    // Could open an edit modal - for now, just log
    console.log('Appointment clicked:', appointment);
  };

  // Handle booking complete
  const handleBookingComplete = () => {
    setShowBookingModal(false);
    setSelectedSlotTime(null);
    fetchAppointments();
  };

  // Handle bulk scheduling complete
  const handleBulkComplete = () => {
    fetchAppointments();
  };

  // Patient tasks handlers
  const openTasksModal = async () => {
    const { data } = await api.getTasks(false);
    if (data) {
      setPatientTasks(data.tasks);
    }
    setShowTasksModal(true);
  };

  const completeTask = async (taskId: string) => {
    await api.updateTask(taskId, true);
    const { data } = await api.getTasks(false);
    if (data) {
      setPatientTasks(data.tasks);
    }
  };

  const deleteTask = async (taskId: string) => {
    await api.deleteTask(taskId);
    const { data } = await api.getTasks(false);
    if (data) {
      setPatientTasks(data.tasks);
    }
  };

  // Quick booking handlers
  const openQuickBooking = (type: 'clinic' | 'operation') => {
    setQuickBookingType(type);
    setQuickBookingPatient('');
    setQuickBookingDate(selectedDate);
    setQuickBookingTime('09:00');
    setQuickBookingNotes('');
    setQuickBookingError('');
    setShowQuickBookingModal(true);
  };

  const handleQuickBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBookingPatient || !quickBookingDate || !quickBookingTime || !providerId) {
      setQuickBookingError('Please select a patient, date, and time');
      return;
    }

    setQuickBookingSubmitting(true);
    setQuickBookingError('');

    const durationMinutes = quickBookingType === 'operation' ? 60 : 30;
    const [hours, minutes] = quickBookingTime.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + durationMinutes);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const appointmentType = quickBookingType === 'operation' ? 'Procedure' : 'Follow-up';

    const { error } = await api.createAppointment({
      patientId: quickBookingPatient,
      providerId: providerId,
      appointmentDate: quickBookingDate,
      startTime: quickBookingTime,
      endTime: endTime,
      appointmentType: appointmentType,
      notes: quickBookingNotes || undefined,
    });

    if (error) {
      setQuickBookingError(error);
      setQuickBookingSubmitting(false);
      return;
    }

    setShowQuickBookingModal(false);
    setQuickBookingSubmitting(false);
    fetchAppointments();
  };

  // Navigate date
  const goToToday = () => setSelectedDate(new Date().toISOString().split('T')[0]);
  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };
  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (!providerId) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-100">Not Assigned</h2>
          <p className="text-navy-500 dark:text-navy-400 mt-2">
            Your account is not linked to a provider. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 dark:text-navy-400 font-body">Loading schedule...</span>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const loginTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 dark:text-navy-100">
            Happy {dayOfWeek}, {user?.firstName || 'Secretary'}!
          </h1>
          <p className="text-navy-500 dark:text-navy-400 font-body mt-1">
            Last login: {loginTime}
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg hover:bg-clinical-100 dark:hover:bg-navy-800 transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-navy-600 dark:text-navy-300" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-clinical py-2 text-sm"
          />
          <button
            onClick={goToNextDay}
            className="p-2 rounded-lg hover:bg-clinical-100 dark:hover:bg-navy-800 transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5 text-navy-600 dark:text-navy-300" />
          </button>
          {!isToday && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Upcoming Appointments Preview */}
      <div className="card-clinical overflow-hidden">
        <div className="px-4 py-3 bg-clinical-50 dark:bg-navy-800 border-b border-clinical-200 dark:border-navy-700 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm">
            Today's Appointments
          </h2>
          <span className="text-xs text-navy-500 dark:text-navy-400 font-body">
            {appointments.length} scheduled
          </span>
        </div>
        {appointments.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-navy-400 dark:text-navy-500 font-body text-sm">No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="divide-y divide-clinical-100 dark:divide-navy-700">
            {appointments.slice(0, 5).map((apt) => (
              <div key={apt.id} className="px-4 py-3 flex items-center gap-4 hover:bg-clinical-50 dark:hover:bg-navy-800/50 transition-colors">
                <div className="text-center min-w-[60px]">
                  <p className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm">
                    {formatDisplayTime(apt.startTime)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/patients/${apt.patientId}`}
                    className="font-display font-medium text-teal-600 dark:text-teal-400 hover:underline truncate block"
                  >
                    {apt.patientFirstName} {apt.patientLastName}
                  </Link>
                  <p className="text-xs text-navy-500 dark:text-navy-400 font-body">
                    {apt.patientMrn} • {apt.appointmentType}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(apt.status)}`}>
                  {formatStatus(apt.status)}
                </span>
              </div>
            ))}
            {appointments.length > 5 && (
              <div className="px-4 py-2 text-center">
                <button
                  onClick={() => {
                    setActiveTab('schedule');
                    setTimeout(() => {
                      scheduleTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className="text-sm text-teal-600 dark:text-teal-400 hover:underline font-body"
                >
                  View all {appointments.length} appointments →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions - Book Appointments */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => openQuickBooking('clinic')}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 p-6 text-left shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                Book Clinic Appointment
              </h3>
              <p className="text-teal-100 text-sm mt-1 font-body">
                Schedule a follow-up visit
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => openQuickBooking('operation')}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-coral-500 via-coral-600 to-red-600 p-6 text-left shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <ProcedureIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                Book Operation
              </h3>
              <p className="text-coral-100 text-sm mt-1 font-body">
                Schedule a procedure
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Quick Action - Process Referrals */}
      <button
        onClick={() => setActiveTab('referrals')}
        className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 p-6 text-left shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <DocumentScanIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white font-display">
                Process Referral Letters
              </h3>
              <p className="text-teal-100 text-sm mt-1 font-body">
                Scan and process incoming referral letters with AI-powered extraction
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
            <span className="text-sm font-medium hidden sm:block">Click to start</span>
            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </button>

      {/* Address Patient Tasks */}
      <button
        onClick={openTasksModal}
        className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 p-6 text-left shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <ClipboardIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white font-display">
                Address Patient Tasks
              </h3>
              <p className="text-amber-100 text-sm mt-1 font-body">
                Review and complete pending patient memo tasks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
            <span className="text-sm font-medium hidden sm:block">Click to start</span>
            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </button>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total} color="navy" />
        <StatCard label="Waiting" value={stats.waiting} color="amber" />
        <StatCard label="In Progress" value={stats.inProgress} color="blue" />
        <StatCard label="Completed" value={stats.completed} color="teal" />
        <StatCard label="No Show" value={stats.noShow} color="coral" />
      </div>

      {/* Date Header */}
      <div className="card-clinical p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900 dark:text-navy-100">
            {formattedDate}
          </h2>
          {isToday && (
            <span className="px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-sm font-medium rounded-full">
              Today
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div ref={scheduleTabRef} className="flex gap-2 border-b border-clinical-200 dark:border-navy-700">
        <TabButton active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')}>
          <CalendarIcon className="w-4 h-4" />
          Schedule
        </TabButton>
        <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')}>
          <UploadIcon className="w-4 h-4" />
          Bulk Import
        </TabButton>
        <TabButton active={activeTab === 'referrals'} onClick={() => setActiveTab('referrals')}>
          <DocumentScanIcon className="w-4 h-4" />
          Referrals
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'schedule' && (
        <TimeSlotGrid
          date={selectedDate}
          appointments={appointments}
          appointmentTypes={appointmentTypes}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {activeTab === 'bulk' && (
        <BulkScheduler
          providerId={providerId}
          patients={patients}
          appointmentTypes={appointmentTypes}
          selectedDate={selectedDate}
          onComplete={handleBulkComplete}
        />
      )}

      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <div className="card-clinical p-6">
            <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-4">
              Scan Referral Letters
            </h3>
            <ReferralScanner
              onUploadComplete={() => setReferralRefreshTrigger((t) => t + 1)}
            />
          </div>
          <div className="card-clinical p-6">
            <ReferralReviewList
              refreshTrigger={referralRefreshTrigger}
              onResolved={() => setReferralRefreshTrigger((t) => t + 1)}
            />
          </div>
        </div>
      )}

      {/* Quick Booking Modal */}
      {showBookingModal && (
        <QuickBooking
          providerId={providerId}
          date={selectedDate}
          startTime={selectedSlotTime || '09:00'}
          patients={patients}
          appointmentTypes={appointmentTypes}
          onClose={() => setShowBookingModal(false)}
          onComplete={handleBookingComplete}
        />
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Quick Booking Modal for Clinic/Operation */}
      {showQuickBookingModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                  {quickBookingType === 'operation' ? 'Book Operation' : 'Book Clinic Appointment'}
                </h2>
                <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
                  {quickBookingType === 'operation' ? '60 minute procedure' : '30 minute follow-up'}
                </p>
              </div>
              <button
                onClick={() => setShowQuickBookingModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleQuickBookingSubmit}>
              <div className="p-6 space-y-4">
                {quickBookingError && (
                  <div className="p-3 bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 rounded-lg">
                    <p className="text-coral-700 dark:text-coral-400 text-sm font-body">{quickBookingError}</p>
                  </div>
                )}

                {/* Patient Selection */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Patient <span className="text-coral-500">*</span>
                  </label>
                  <select
                    value={quickBookingPatient}
                    onChange={(e) => setQuickBookingPatient(e.target.value)}
                    className="input-clinical"
                    required
                  >
                    <option value="">Select patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName} ({patient.mrn})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Date <span className="text-coral-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={quickBookingDate}
                    onChange={(e) => setQuickBookingDate(e.target.value)}
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
                    value={quickBookingTime}
                    onChange={(e) => setQuickBookingTime(e.target.value)}
                    className="input-clinical"
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Notes
                  </label>
                  <textarea
                    value={quickBookingNotes}
                    onChange={(e) => setQuickBookingNotes(e.target.value)}
                    placeholder={quickBookingType === 'operation' ? 'Procedure details...' : 'Reason for visit...'}
                    rows={3}
                    className="input-clinical resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowQuickBookingModal(false)}
                  className="btn-secondary"
                  disabled={quickBookingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-primary flex items-center gap-2 ${
                    quickBookingType === 'operation' ? 'bg-coral-600 hover:bg-coral-700' : ''
                  }`}
                  disabled={quickBookingSubmitting}
                >
                  {quickBookingSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Booking...
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="w-4 h-4" />
                      {quickBookingType === 'operation' ? 'Book Operation' : 'Book Appointment'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Tasks Modal */}
      {showTasksModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                  Patient Tasks
                </h2>
                <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
                  {patientTasks.length} pending task{patientTasks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowTasksModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {patientTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-navy-900 dark:text-navy-100 font-display font-medium">All caught up!</p>
                  <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">No pending patient tasks</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patientTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 bg-clinical-50 dark:bg-navy-800 rounded-xl border border-clinical-200 dark:border-navy-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <Link
                            to={`/patients/${task.patientId}`}
                            className="font-display font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            {task.patientName}
                          </Link>
                          <span className="text-navy-400 dark:text-navy-500 text-sm ml-2">
                            ({task.patientMrn})
                          </span>
                          <p className="text-navy-700 dark:text-navy-300 font-body mt-2">
                            {task.text}
                          </p>
                          <p className="text-navy-400 dark:text-navy-500 text-xs mt-2">
                            {new Date(task.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => completeTask(task.id)}
                            className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 text-sm font-medium rounded-lg transition-colors"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1.5 hover:bg-coral-100 dark:hover:bg-coral-900/30 text-navy-400 hover:text-coral-600 dark:hover:text-coral-400 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
              <button
                onClick={() => setShowTasksModal(false)}
                className="btn-secondary w-full"
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, { bg: string; text: string; icon: string; badge: string }> = {
    navy: {
      bg: 'bg-navy-50 dark:bg-navy-800/50',
      text: 'text-navy-700 dark:text-navy-300',
      icon: 'text-navy-400 dark:text-navy-500',
      badge: 'bg-navy-100 dark:bg-navy-700 text-navy-600 dark:text-navy-300',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-400',
      icon: 'text-amber-500',
      badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-400',
      icon: 'text-blue-500',
      badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    },
    teal: {
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      text: 'text-teal-700 dark:text-teal-400',
      icon: 'text-teal-500',
      badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
    },
    coral: {
      bg: 'bg-coral-50 dark:bg-coral-900/20',
      text: 'text-coral-700 dark:text-coral-400',
      icon: 'text-coral-500',
      badge: 'bg-coral-100 dark:bg-coral-900/40 text-coral-700 dark:text-coral-300',
    },
  };

  const icons: Record<string, JSX.Element> = {
    navy: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    amber: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    blue: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    teal: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    coral: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  };

  const styles = colorClasses[color] || colorClasses.navy;

  return (
    <div className={`card-clinical p-4 ${styles.bg} border-0`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={styles.icon}>{icons[color]}</span>
        <p className="text-sm text-navy-500 dark:text-navy-400 font-body">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-full text-xl font-bold font-display ${styles.badge}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function formatDisplayTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatStatus(status: string): string {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function getStatusStyle(status: string): string {
  const styles: Record<string, string> = {
    scheduled: 'bg-navy-100 dark:bg-navy-700 text-navy-600 dark:text-navy-300',
    confirmed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    checked_in: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    in_progress: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    checked_out: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    no_show: 'bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-400',
  };
  return styles[status] || styles.scheduled;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
        active
          ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400'
          : 'text-navy-500 dark:text-navy-400 border-transparent hover:text-navy-700 dark:hover:text-navy-200'
      }`}
    >
      {children}
    </button>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function DocumentScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function ProcedureIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}
