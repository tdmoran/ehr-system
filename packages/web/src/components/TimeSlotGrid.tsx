import { useMemo } from 'react';
import { Appointment, AppointmentType } from '../api/client';

interface TimeSlotGridProps {
  date: string;
  appointments: Appointment[];
  appointmentTypes: AppointmentType[];
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

// Generate 15-minute time slots from 8:00 AM to 5:00 PM
const TIME_SLOTS: string[] = [];
for (let hour = 8; hour < 17; hour++) {
  for (let minute = 0; minute < 60; minute += 15) {
    TIME_SLOTS.push(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    );
  }
}

export default function TimeSlotGrid({
  date: _date,
  appointments,
  appointmentTypes,
  onSlotClick,
  onAppointmentClick,
}: TimeSlotGridProps) {
  // Map appointments to their time slots
  const appointmentMap = useMemo(() => {
    const map = new Map<string, Appointment>();
    appointments.forEach(apt => {
      const startTime = apt.startTime.substring(0, 5);
      map.set(startTime, apt);
    });
    return map;
  }, [appointments]);

  // Check if a slot is occupied
  const isSlotOccupied = (slotTime: string) => {
    const slotMinutes = timeToMinutes(slotTime);

    return appointments.some(apt => {
      const startMinutes = timeToMinutes(apt.startTime.substring(0, 5));
      const endMinutes = timeToMinutes(apt.endTime.substring(0, 5));
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  };

  // Get appointment that starts at a specific time
  const getAppointmentAtTime = (time: string) => {
    return appointmentMap.get(time);
  };

  // Calculate how many slots an appointment spans
  const getAppointmentSlots = (appointment: Appointment) => {
    const startMinutes = timeToMinutes(appointment.startTime.substring(0, 5));
    const endMinutes = timeToMinutes(appointment.endTime.substring(0, 5));
    return Math.ceil((endMinutes - startMinutes) / 15);
  };

  // Get color for appointment type
  const getAppointmentColor = (typeName: string) => {
    const type = appointmentTypes.find(t => t.name === typeName);
    return type?.color || '#486581';
  };

  // Status badge styles
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-navy-200 dark:bg-navy-700 text-navy-700 dark:text-navy-300',
      confirmed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      checked_in: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      in_progress: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
      completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
      no_show: 'bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-400',
    };
    return styles[status] || styles.scheduled;
  };

  // Track which slots to skip (part of multi-slot appointments)
  const slotsToSkip = new Set<string>();
  appointments.forEach(apt => {
    const startTime = apt.startTime.substring(0, 5);
    const slots = getAppointmentSlots(apt);
    const startIdx = TIME_SLOTS.indexOf(startTime);
    if (startIdx >= 0) {
      for (let i = 1; i < slots && startIdx + i < TIME_SLOTS.length; i++) {
        slotsToSkip.add(TIME_SLOTS[startIdx + i]);
      }
    }
  });

  return (
    <div className="card-clinical overflow-hidden">
      <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr]">
        {/* Time column header */}
        <div className="bg-clinical-100 dark:bg-navy-800 p-3 border-b border-r border-clinical-200 dark:border-navy-700">
          <span className="text-xs font-medium text-navy-500 dark:text-navy-400">Time</span>
        </div>
        {/* Appointments column header */}
        <div className="bg-clinical-100 dark:bg-navy-800 p-3 border-b border-clinical-200 dark:border-navy-700">
          <span className="text-xs font-medium text-navy-500 dark:text-navy-400">Appointments</span>
        </div>

        {/* Time slots */}
        {TIME_SLOTS.map((time) => {
          const appointment = getAppointmentAtTime(time);
          const isOccupied = isSlotOccupied(time);
          const shouldSkip = slotsToSkip.has(time);
          const isHourStart = time.endsWith(':00');
          const appointmentSlots = appointment ? getAppointmentSlots(appointment) : 1;

          if (shouldSkip) return null;

          return (
            <div key={time} className="contents">
              {/* Time label */}
              <div
                className={`p-2 border-r border-b border-clinical-200 dark:border-navy-700 flex items-start justify-end ${
                  isHourStart ? 'bg-clinical-50 dark:bg-navy-900' : ''
                }`}
                style={appointment ? { gridRow: `span ${appointmentSlots}` } : undefined}
              >
                <span className={`text-sm ${
                  isHourStart
                    ? 'font-medium text-navy-700 dark:text-navy-300'
                    : 'text-navy-400 dark:text-navy-500'
                }`}>
                  {formatTime(time)}
                </span>
              </div>

              {/* Slot content */}
              <div
                className={`border-b border-clinical-200 dark:border-navy-700 transition-colors ${
                  !appointment && !isOccupied
                    ? 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/10'
                    : ''
                } ${isHourStart ? 'bg-clinical-50/50 dark:bg-navy-900/50' : ''}`}
                style={appointment ? { gridRow: `span ${appointmentSlots}` } : undefined}
                onClick={() => !appointment && !isOccupied && onSlotClick(time)}
              >
                {appointment ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(appointment);
                    }}
                    className="h-full p-2 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: getAppointmentColor(appointment.appointmentType) + '20' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getAppointmentColor(appointment.appointmentType) }}
                          />
                          <span className="font-medium text-navy-900 dark:text-navy-100 truncate">
                            {appointment.patientFirstName} {appointment.patientLastName}
                          </span>
                        </div>
                        <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">
                          {appointment.patientMrn} | {appointment.appointmentType}
                        </p>
                        {appointment.reason && (
                          <p className="text-xs text-navy-400 dark:text-navy-500 mt-1 truncate">
                            {appointment.reason}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getStatusBadge(appointment.status)}`}>
                        {formatStatus(appointment.status)}
                      </span>
                    </div>
                  </div>
                ) : isOccupied ? null : (
                  <div className="h-full min-h-[40px] flex items-center justify-center">
                    <span className="text-xs text-navy-300 dark:text-navy-600 opacity-0 hover:opacity-100 transition-opacity">
                      + Book
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
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
