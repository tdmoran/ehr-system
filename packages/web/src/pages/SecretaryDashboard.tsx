import { useState, useEffect, useMemo } from 'react';
import { api, Appointment, AppointmentType, Patient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TimeSlotGrid from '../components/TimeSlotGrid';
import QuickBooking from '../components/QuickBooking';
import WaitingRoom from '../components/WaitingRoom';
import BulkScheduler from '../components/BulkScheduler';
import { ReferralScanner } from '../components/referrals/ReferralScanner';
import { ReferralReviewList } from '../components/referrals/ReferralReviewList';

type TabType = 'schedule' | 'waiting' | 'bulk' | 'referrals';

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

  // Handle status update from waiting room
  const handleStatusUpdate = async (appointmentId: string, status: string) => {
    const { error } = await api.updateAppointment(appointmentId, { status });
    if (!error) {
      fetchAppointments();
    }
  };

  // Handle bulk scheduling complete
  const handleBulkComplete = () => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 dark:text-navy-100">
            Reception Desk
          </h1>
          <p className="text-navy-500 dark:text-navy-400 font-body mt-1">
            Managing schedule for Dr. {user?.lastName ? `${user.lastName}'s` : 'your provider'}
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
      <div className="flex gap-2 border-b border-clinical-200 dark:border-navy-700">
        <TabButton active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')}>
          <CalendarIcon className="w-4 h-4" />
          Schedule
        </TabButton>
        <TabButton active={activeTab === 'waiting'} onClick={() => setActiveTab('waiting')}>
          <UsersIcon className="w-4 h-4" />
          Waiting Room
          {stats.waiting > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
              {stats.waiting}
            </span>
          )}
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

      {activeTab === 'waiting' && (
        <WaitingRoom
          appointments={appointments}
          onStatusUpdate={handleStatusUpdate}
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
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    navy: 'bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    coral: 'bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-400',
  };

  return (
    <div className="card-clinical p-4">
      <p className="text-sm text-navy-500 dark:text-navy-400 font-body">{label}</p>
      <p className={`text-2xl font-bold font-display mt-1 ${colorClasses[color]?.split(' ')[2] || 'text-navy-900 dark:text-navy-100'}`}>
        {value}
      </p>
    </div>
  );
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

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
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
