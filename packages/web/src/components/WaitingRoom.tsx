import { useState, useMemo } from 'react';
import { Appointment } from '../api/client';
import CheckInModal from './CheckInModal';
import CheckOutModal from './CheckOutModal';

interface WaitingRoomProps {
  appointments: Appointment[];
  onStatusUpdate: (appointmentId: string, status: string) => void;
}

type SortBy = 'time' | 'status' | 'wait';
type FilterStatus = 'all' | 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'checked_out';

const STATUS_ORDER: Record<string, number> = {
  checked_in: 0,
  in_progress: 1,
  completed: 2,
  scheduled: 3,
  confirmed: 4,
  checked_out: 5,
  cancelled: 6,
  no_show: 7,
};

export default function WaitingRoom({ appointments, onStatusUpdate }: WaitingRoomProps) {
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [checkInAppointment, setCheckInAppointment] = useState<Appointment | null>(null);
  const [checkOutAppointment, setCheckOutAppointment] = useState<Appointment | null>(null);

  // Filter and sort appointments
  const sortedAppointments = useMemo(() => {
    let filtered = [...appointments];

    // Apply filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'time':
          return a.startTime.localeCompare(b.startTime);
        case 'status':
          return (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99);
        case 'wait':
          // Sort by check-in time (for now, use scheduled time as proxy)
          return a.startTime.localeCompare(b.startTime);
        default:
          return 0;
      }
    });

    return filtered;
  }, [appointments, sortBy, filterStatus]);

  // Handle status change
  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    setUpdatingId(appointmentId);
    await onStatusUpdate(appointmentId, newStatus);
    setUpdatingId(null);
  };

  // Handle check-in button click - opens modal for verification
  const handleCheckInClick = (appointment: Appointment) => {
    setCheckInAppointment(appointment);
  };

  // Handle successful check-in from modal
  const handleCheckInComplete = () => {
    setCheckInAppointment(null);
    // Trigger refresh of appointments
    if (checkInAppointment) {
      onStatusUpdate(checkInAppointment.id, 'checked_in');
    }
  };

  // Handle check-out button click - opens modal for checkout
  const handleCheckOutClick = (appointment: Appointment) => {
    setCheckOutAppointment(appointment);
  };

  // Handle successful check-out from modal
  const handleCheckOutComplete = () => {
    setCheckOutAppointment(null);
    // Trigger refresh of appointments
    if (checkOutAppointment) {
      onStatusUpdate(checkOutAppointment.id, 'checked_out');
    }
  };

  // Get status badge style
  const getStatusStyle = (status: string) => {
    const styles: Record<string, { bg: string; text: string; border: string }> = {
      scheduled: {
        bg: 'bg-navy-100 dark:bg-navy-800',
        text: 'text-navy-700 dark:text-navy-300',
        border: 'border-navy-200 dark:border-navy-700',
      },
      confirmed: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
      },
      checked_in: {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
      },
      in_progress: {
        bg: 'bg-teal-100 dark:bg-teal-900/30',
        text: 'text-teal-700 dark:text-teal-400',
        border: 'border-teal-200 dark:border-teal-800',
      },
      completed: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
      },
      checked_out: {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800',
      },
      cancelled: {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-600 dark:text-gray-400',
        border: 'border-gray-200 dark:border-gray-700',
      },
      no_show: {
        bg: 'bg-coral-100 dark:bg-coral-900/30',
        text: 'text-coral-700 dark:text-coral-400',
        border: 'border-coral-200 dark:border-coral-800',
      },
    };
    return styles[status] || styles.scheduled;
  };

  // Get next action for workflow
  const getWorkflowActions = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'confirmed':
        return [
          { label: 'Check In', status: 'checked_in', variant: 'primary' },
          { label: 'No Show', status: 'no_show', variant: 'danger' },
        ];
      case 'checked_in':
        return [
          { label: 'Start Visit', status: 'in_progress', variant: 'primary' },
          { label: 'No Show', status: 'no_show', variant: 'danger' },
        ];
      case 'in_progress':
        return [
          { label: 'Complete', status: 'completed', variant: 'success' },
        ];
      case 'completed':
        return [
          { label: 'Check Out', status: 'checked_out', variant: 'success' },
        ];
      default:
        return [];
    }
  };

  if (appointments.length === 0) {
    return (
      <div className="card-clinical p-12 text-center">
        <UsersIcon className="w-12 h-12 text-navy-300 dark:text-navy-600 mx-auto mb-4" />
        <h3 className="font-display text-lg font-semibold text-navy-900 dark:text-navy-100">
          No Appointments
        </h3>
        <p className="text-navy-500 dark:text-navy-400 mt-2">
          There are no appointments scheduled for this day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-navy-600 dark:text-navy-400">Filter:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="input-clinical py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="checked_in">Checked In</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="checked_out">Checked Out</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-navy-600 dark:text-navy-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="input-clinical py-1.5 text-sm"
          >
            <option value="time">By Time</option>
            <option value="status">By Status</option>
            <option value="wait">By Wait Time</option>
          </select>
        </div>

        {/* Count */}
        <span className="text-sm text-navy-500 dark:text-navy-400 ml-auto">
          {sortedAppointments.length} appointment{sortedAppointments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Appointment List */}
      <div className="space-y-3">
        {sortedAppointments.map(appointment => {
          const style = getStatusStyle(appointment.status);
          const actions = getWorkflowActions(appointment.status);
          const isUpdating = updatingId === appointment.id;

          return (
            <div
              key={appointment.id}
              className={`card-clinical p-4 border-l-4 ${style.border}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Patient Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <span className="text-teal-700 dark:text-teal-400 font-semibold">
                        {appointment.patientFirstName?.[0]}{appointment.patientLastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-navy-900 dark:text-navy-100">
                        {appointment.patientFirstName} {appointment.patientLastName}
                      </h3>
                      <p className="text-sm text-navy-500 dark:text-navy-400">
                        {appointment.patientMrn} | {appointment.appointmentType}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time & Status */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-navy-900 dark:text-navy-100">
                      {formatTime(appointment.startTime.substring(0, 5))}
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                      {formatStatus(appointment.status)}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  {actions.length > 0 && (
                    <div className="flex gap-2">
                      {actions.map(action => (
                        <button
                          key={action.status}
                          onClick={() => {
                            // Use modal for check-in and check-out, direct status change for others
                            if (action.status === 'checked_in') {
                              handleCheckInClick(appointment);
                            } else if (action.status === 'checked_out') {
                              handleCheckOutClick(appointment);
                            } else {
                              handleStatusChange(appointment.id, action.status);
                            }
                          }}
                          disabled={isUpdating}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                            action.variant === 'primary'
                              ? 'bg-teal-600 hover:bg-teal-700 text-white'
                              : action.variant === 'success'
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : action.variant === 'danger'
                              ? 'bg-coral-600 hover:bg-coral-700 text-white'
                              : 'bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300 hover:bg-navy-200 dark:hover:bg-navy-700'
                          }`}
                        >
                          {isUpdating ? '...' : action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Reason if present */}
              {appointment.reason && (
                <p className="text-sm text-navy-500 dark:text-navy-400 mt-3 pl-13">
                  Reason: {appointment.reason}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Check-In Modal */}
      {checkInAppointment && (
        <CheckInModal
          appointment={checkInAppointment}
          onClose={() => setCheckInAppointment(null)}
          onCheckIn={handleCheckInComplete}
        />
      )}

      {/* Check-Out Modal */}
      {checkOutAppointment && (
        <CheckOutModal
          appointment={checkOutAppointment}
          onClose={() => setCheckOutAppointment(null)}
          onCheckOut={handleCheckOutComplete}
        />
      )}
    </div>
  );
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatStatus(status: string): string {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
