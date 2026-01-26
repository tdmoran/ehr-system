import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, Appointment } from '../api/client';
import WaitingRoom from '../components/WaitingRoom';
import QuickActions from '../components/QuickActions';

export default function Dashboard() {
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientListTab, setPatientListTab] = useState<'clinic' | 'operation'>('clinic');

  const now = new Date();

  // Day-based greeting
  const getGreeting = () => {
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    return `Happy ${dayOfWeek}`;
  };

  // Fetch appointments function (extracted so it can be called from handleStatusUpdate)
  const fetchAppointments = async () => {
    const today = now.toISOString().split('T')[0];

    // For secretaries, use their linked providerId; for providers, use their own id
    const providerId = user?.role === 'secretary' ? user?.providerId : user?.id;
    const { data } = await api.getAppointments(today, today, providerId);
    if (data) {
      // Sort appointments by time
      const sorted = data.appointments.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTodayAppointments(sorted);
    }
    setLoading(false);
  };

  // Fetch today's and week's appointments
  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  // Handle status update from WaitingRoom component
  const handleStatusUpdate = async (appointmentId: string, status: string) => {
    const { error } = await api.updateAppointment(appointmentId, { status });
    if (!error) {
      fetchAppointments();
    }
  };

  // Get next upcoming appointment
  const getNextAppointment = () => {
    const currentTime = now.toTimeString().slice(0, 5);
    return todayAppointments.find(apt => apt.startTime > currentTime && apt.status !== 'completed' && apt.status !== 'cancelled');
  };

  // Get appointments by status
  const completedToday = todayAppointments.filter(a => a.status === 'completed' || a.status === 'checked_out').length;
  const remainingToday = todayAppointments.filter(a => a.status !== 'completed' && a.status !== 'checked_out' && a.status !== 'cancelled').length;
  const inProgress = todayAppointments.find(a => a.status === 'in_progress');
  const waitingRoom = todayAppointments.filter(a => a.status === 'checked_in');

  const nextAppointment = getNextAppointment();

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'bg-amber-500';
      case 'in_progress': return 'bg-teal-500';
      case 'completed': return 'bg-navy-300 dark:bg-navy-600';
      case 'cancelled': return 'bg-coral-400';
      case 'no_show': return 'bg-coral-500';
      default: return 'bg-navy-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 dark:text-navy-400 font-body">Loading your day...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Personal Greeting */}
      <div className="text-center py-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900 dark:text-navy-100">
          {getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-navy-500 dark:text-navy-400 font-body text-lg mt-2">
          {now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Today's Patient List - with Clinic/Operation tabs */}
      {todayAppointments.length > 0 && (() => {
        const clinicAppointments = todayAppointments.filter(apt => apt.appointmentType !== 'Procedure' && apt.status !== 'no_show');
        const operationAppointments = todayAppointments.filter(apt => apt.appointmentType === 'Procedure' && apt.status !== 'no_show');
        const displayedAppointments = patientListTab === 'clinic' ? clinicAppointments : operationAppointments;

        return (
        <div className="card-clinical overflow-hidden">
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100">Today's Patient List</h2>
              <Link to="/calendar" className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline font-body">
                View Calendar
              </Link>
            </div>
            {/* Folder Tabs */}
            <div className="flex -mb-px">
              <button
                onClick={() => setPatientListTab('clinic')}
                className={`px-5 py-2.5 text-sm font-medium transition-colors rounded-t-lg border-t border-l border-r ${
                  patientListTab === 'clinic'
                    ? 'bg-white dark:bg-navy-900 border-clinical-200 dark:border-navy-700 text-teal-700 dark:text-teal-400 -mb-px'
                    : 'bg-clinical-100 dark:bg-navy-800 border-transparent text-navy-500 dark:text-navy-400 hover:text-navy-700 dark:hover:text-navy-300'
                }`}
              >
                Clinic List
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  patientListTab === 'clinic'
                    ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300'
                    : 'bg-navy-200 dark:bg-navy-700 text-navy-600 dark:text-navy-400'
                }`}>
                  {clinicAppointments.length}
                </span>
              </button>
              <button
                onClick={() => setPatientListTab('operation')}
                className={`px-5 py-2.5 text-sm font-medium transition-colors rounded-t-lg border-t border-l border-r ml-1 ${
                  patientListTab === 'operation'
                    ? 'bg-white dark:bg-navy-900 border-clinical-200 dark:border-navy-700 text-coral-700 dark:text-coral-400 -mb-px'
                    : 'bg-clinical-100 dark:bg-navy-800 border-transparent text-navy-500 dark:text-navy-400 hover:text-navy-700 dark:hover:text-navy-300'
                }`}
              >
                Operation List
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  patientListTab === 'operation'
                    ? 'bg-coral-100 dark:bg-coral-900/50 text-coral-700 dark:text-coral-300'
                    : 'bg-navy-200 dark:bg-navy-700 text-navy-600 dark:text-navy-400'
                }`}>
                  {operationAppointments.length}
                </span>
              </button>
            </div>
          </div>
          <div className="border-t border-clinical-200 dark:border-navy-700">
          {displayedAppointments.length === 0 ? (
            <div className="p-8 text-center text-navy-400 dark:text-navy-500">
              No {patientListTab === 'clinic' ? 'clinic appointments' : 'operations'} scheduled for today
            </div>
          ) : (
          <div className="divide-y divide-clinical-100 dark:divide-navy-700">
            {displayedAppointments.map((apt, index) => {
              const isPast = apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show';
              const isCurrent = apt.status === 'in_progress' || apt.status === 'checked_in';

              return (
                <div
                  key={apt.id}
                  className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                    isCurrent ? 'bg-teal-50 dark:bg-teal-900/20' :
                    isPast ? 'opacity-60' : 'hover:bg-clinical-50 dark:hover:bg-navy-800/50'
                  }`}
                >
                  {/* Time */}
                  <div className="w-20 text-right">
                    <p className={`font-display font-semibold ${isPast ? 'text-navy-400' : 'text-navy-900 dark:text-navy-100'}`}>
                      {formatTime(apt.startTime)}
                    </p>
                  </div>

                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(apt.status)} ${isCurrent ? 'ring-4 ring-teal-200 dark:ring-teal-800' : ''}`} />
                    {index < displayedAppointments.length - 1 && (
                      <div className="w-0.5 h-12 bg-clinical-200 dark:bg-navy-700 -mb-4" />
                    )}
                  </div>

                  {/* Appointment Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/patients/${apt.patientId}`}
                        className={`font-display font-semibold hover:underline ${isPast ? 'text-teal-400 dark:text-teal-500' : 'text-teal-600 dark:text-teal-400'}`}
                      >
                        {apt.patientFirstName} {apt.patientLastName}
                      </Link>
                      {isCurrent && (
                        <span className="badge badge-success">In Progress</span>
                      )}
                      {apt.status === 'checked_in' && (
                        <button
                          onClick={() => handleStatusUpdate(apt.id, 'scheduled')}
                          className="badge badge-warning hover:bg-amber-200 dark:hover:bg-amber-800 cursor-pointer"
                          title="Click to undo check-in"
                        >
                          Checked In ✕
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-navy-500 dark:text-navy-400 font-body">
                      {apt.appointmentType}
                      {apt.reason && ` · ${apt.reason}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Arrived and No Show buttons - only show for scheduled/confirmed appointments */}
                    {(apt.status === 'scheduled' || apt.status === 'confirmed') && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(apt.id, 'checked_in')}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Arrived
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(apt.id, 'no_show')}
                          className="px-3 py-1.5 bg-coral-500 hover:bg-coral-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          No Show
                        </button>
                      </>
                    )}
                    {/* Complete button - show after patient has been seen (in_progress) */}
                    {apt.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(apt.id, 'completed')}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Complete
                      </button>
                    )}
                    {/* Go to chart */}
                    {!isPast && (
                      <Link
                        to={`/patients/${apt.patientId}`}
                        className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    )}
                    {isPast && apt.status === 'completed' && (
                      <CheckIcon className="w-5 h-5 text-teal-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
          </div>
        </div>
        );
      })()}

      {/* WORK VIEW */}
      {/* Current Status Card */}
      {inProgress ? (
        <div className="card-clinical p-6 border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50 to-white dark:from-teal-900/20 dark:to-navy-900">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-sm font-medium font-body uppercase tracking-wide">In Progress</span>
          </div>
          <h2 className="font-display text-xl font-bold text-teal-600 dark:text-teal-400">
            {inProgress.patientFirstName} {inProgress.patientLastName}
          </h2>
          <p className="text-navy-600 dark:text-navy-400 font-body mt-1">
            {inProgress.appointmentType} · Started at {formatTime(inProgress.startTime)}
          </p>
          <Link
            to={`/patients/${inProgress.patientId}`}
            className="inline-flex items-center gap-2 mt-4 text-teal-600 dark:text-teal-400 font-medium text-sm hover:underline"
          >
            Open Chart
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      ) : nextAppointment ? (
        <div className="card-clinical p-6 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-navy-900">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
            <ClockIcon className="w-4 h-4" />
            <span className="text-sm font-medium font-body uppercase tracking-wide">Up Next</span>
          </div>
          <h2 className="font-display text-xl font-bold text-teal-600 dark:text-teal-400">
            {nextAppointment.patientFirstName} {nextAppointment.patientLastName}
          </h2>
          <p className="text-navy-600 dark:text-navy-400 font-body mt-1">
            {nextAppointment.appointmentType} · {formatTime(nextAppointment.startTime)}
          </p>
          {nextAppointment.reason && (
            <p className="text-navy-500 dark:text-navy-500 font-body text-sm mt-2 italic">
              "{nextAppointment.reason}"
            </p>
          )}
        </div>
      ) : todayAppointments.length === 0 ? (
        <div className="card-clinical p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-clinical-100 dark:bg-navy-800 flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-8 h-8 text-navy-400" />
          </div>
          <h2 className="font-display text-xl font-semibold text-navy-900 dark:text-navy-100">
            No appointments today
          </h2>
          <p className="text-navy-500 dark:text-navy-400 font-body mt-2">
            Your schedule is clear. Enjoy your day!
          </p>
          <Link to="/calendar" className="btn-primary inline-flex items-center gap-2 mt-6">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Schedule Appointment
          </Link>
        </div>
      ) : (
        <div className="card-clinical p-6 border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50 to-white dark:from-teal-900/20 dark:to-navy-900">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-2">
            <CheckIcon className="w-4 h-4" />
            <span className="text-sm font-medium font-body uppercase tracking-wide">All Done</span>
          </div>
          <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
            You've completed all appointments for today!
          </h2>
          <p className="text-navy-600 dark:text-navy-400 font-body mt-1">
            {completedToday} patient{completedToday !== 1 ? 's' : ''} seen today
          </p>
        </div>
      )}

      {/* Waiting Room Panel - Full component for secretaries, simple view for providers */}
      {user?.role === 'secretary' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-navy-900 dark:text-navy-100">
              Waiting Room
            </h2>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium">Live</span>
            </div>
          </div>
          <WaitingRoom
            appointments={todayAppointments.filter(apt => apt.status === 'checked_in')}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      ) : waitingRoom.length > 0 && (
        <div className="card-clinical overflow-hidden border-2 border-amber-300 dark:border-amber-600">
          <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <UsersIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-amber-800 dark:text-amber-200">Waiting Room</h2>
                <p className="text-sm text-amber-600 dark:text-amber-400">{waitingRoom.length} patient{waitingRoom.length !== 1 ? 's' : ''} ready</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium">Live</span>
            </div>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900/50">
            {waitingRoom.map((apt) => {
              const checkedInTime = apt.startTime;
              return (
                <div
                  key={apt.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-teal-700 dark:text-teal-400">
                      {apt.patientFirstName?.[0]}{apt.patientLastName?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-navy-900 dark:text-navy-100">
                      {apt.patientFirstName} {apt.patientLastName}
                    </p>
                    <p className="text-sm text-navy-500 dark:text-navy-400">
                      {apt.appointmentType}
                      {apt.reason && ` · ${apt.reason}`}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Scheduled: {formatTime(checkedInTime)}
                    </p>
                  </div>
                  <Link
                    to={`/patients/${apt.patientId}`}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    Start Visit
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-clinical p-4 text-center">
          <p className="font-display text-3xl font-bold text-navy-900 dark:text-navy-100">{todayAppointments.length}</p>
          <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">Total Today</p>
        </div>
        <div className="card-clinical p-4 text-center">
          <p className="font-display text-3xl font-bold text-teal-600">{completedToday}</p>
          <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">Completed</p>
        </div>
        <div className="card-clinical p-4 text-center">
          <p className="font-display text-3xl font-bold text-amber-600">{remainingToday}</p>
          <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">Remaining</p>
        </div>
      </div>

      {/* Did Not Attend */}
      {(() => {
        const noShowAppointments = todayAppointments.filter(apt => apt.status === 'no_show');
        return noShowAppointments.length > 0 && (
          <div className="card-clinical overflow-hidden border-2 border-coral-300 dark:border-coral-600">
            <div className="px-6 py-4 bg-coral-50 dark:bg-coral-900/20 border-b border-coral-200 dark:border-coral-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-coral-100 dark:bg-coral-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-coral-600 dark:text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-display font-semibold text-coral-800 dark:text-coral-200">Did Not Attend</h2>
                  <p className="text-sm text-coral-600 dark:text-coral-400">{noShowAppointments.length} patient{noShowAppointments.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-coral-100 dark:divide-coral-900/30">
              {noShowAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center gap-4 px-6 py-4"
                >
                  <div className="w-12 h-12 rounded-full bg-coral-100 dark:bg-coral-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-coral-700 dark:text-coral-400">
                      {apt.patientFirstName?.[0]}{apt.patientLastName?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/patients/${apt.patientId}`}
                      className="font-display font-semibold text-coral-700 dark:text-coral-400 hover:underline"
                    >
                      {apt.patientFirstName} {apt.patientLastName}
                    </Link>
                    <p className="text-sm text-navy-500 dark:text-navy-400">
                      {apt.appointmentType} · Scheduled for {formatTime(apt.startTime)}
                    </p>
                  </div>
                  <Link
                    to={`/patients/${apt.patientId}`}
                    className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Reschedule
                  </Link>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Quick Actions */}
      <QuickActions />

    </div>
  );
}
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}


function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
