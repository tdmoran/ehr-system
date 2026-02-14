import { Appointment } from '../../api/client';

interface AppointmentSidebarProps {
  upcomingAppointments: Appointment[];
  onBookClinic: () => void;
  onBookOperation: () => void;
}

export function AppointmentSidebar({ upcomingAppointments, onBookClinic, onBookOperation }: AppointmentSidebarProps) {
  const operations = upcomingAppointments.filter(apt => apt.appointmentType === 'Procedure');

  return (
    <div className="lg:col-span-1">
      {/* Next Appointment */}
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
            <button onClick={onBookClinic} className="btn-primary text-sm py-2 px-4">Book appointment</button>
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
        {operations.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-coral-50 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-navy-500 font-body text-sm">No operation scheduled</p>
            <button onClick={onBookOperation} className="mt-2 text-coral-600 hover:text-coral-700 font-medium text-sm">
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
        )}
      </div>
    </div>
  );
}
