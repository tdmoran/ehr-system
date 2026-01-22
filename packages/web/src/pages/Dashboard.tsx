import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  const stats = [
    { label: 'Patients Today', value: '12', change: '+2', trend: 'up', icon: PatientsIcon },
    { label: 'Pending Charts', value: '4', change: '-1', trend: 'down', icon: ChartIcon },
    { label: 'Lab Results', value: '7', change: '+3', trend: 'up', icon: LabIcon },
    { label: 'Messages', value: '3', change: '0', trend: 'neutral', icon: MessageIcon },
  ];

  const recentPatients = [
    { id: '1', name: 'Alice Johnson', mrn: 'MRN-001', lastVisit: 'Today, 9:30 AM', status: 'in_progress' },
    { id: '2', name: 'Bob Williams', mrn: 'MRN-002', lastVisit: 'Today, 10:15 AM', status: 'completed' },
    { id: '3', name: 'Carol Davis', mrn: 'MRN-003', lastVisit: 'Yesterday', status: 'signed' },
  ];

  const upcomingAppointments = [
    { time: '11:00 AM', patient: 'David Miller', type: 'Follow-up', duration: '30 min' },
    { time: '11:45 AM', patient: 'Emma Brown', type: 'New Patient', duration: '45 min' },
    { time: '1:30 PM', patient: 'Frank Garcia', type: 'Annual Physical', duration: '30 min' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">
            Good morning, Dr. {user?.lastName}
          </h1>
          <p className="text-navy-500 font-body mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Link to="/patients" className="btn-primary inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Encounter
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`card-clinical p-6 animate-slide-up stagger-${index + 1}`}
            style={{ animationFillMode: 'backwards' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-navy-500 text-sm font-body">{stat.label}</p>
                <p className="font-display text-3xl font-bold text-navy-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-teal-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1">
              {stat.trend === 'up' && (
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l5-5 5 5" />
                </svg>
              )}
              {stat.trend === 'down' && (
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 7l-5 5-5-5" />
                </svg>
              )}
              <span className={`text-sm font-body ${stat.trend === 'neutral' ? 'text-navy-400' : 'text-teal-600'}`}>
                {stat.change} from yesterday
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <div className="card-clinical overflow-hidden">
          <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
            <h2 className="font-display font-semibold text-navy-900">Recent Patients</h2>
            <Link to="/patients" className="text-sm text-teal-600 font-medium hover:text-teal-700 font-body">
              View all
            </Link>
          </div>
          <div className="divide-y divide-clinical-100">
            {recentPatients.map((patient) => (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-clinical-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center">
                  <span className="font-display font-semibold text-navy-600">
                    {patient.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-medium text-navy-900 truncate">{patient.name}</p>
                  <p className="text-sm text-navy-400 font-mono">{patient.mrn}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-navy-500 font-body">{patient.lastVisit}</p>
                  <span className={`badge mt-1 ${
                    patient.status === 'signed' ? 'badge-success' :
                    patient.status === 'completed' ? 'badge-neutral' :
                    'badge-warning'
                  }`}>
                    {patient.status === 'in_progress' ? 'In Progress' :
                     patient.status === 'completed' ? 'Completed' : 'Signed'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="card-clinical overflow-hidden">
          <div className="px-6 py-4 border-b border-clinical-200">
            <h2 className="font-display font-semibold text-navy-900">Today's Schedule</h2>
          </div>
          <div className="divide-y divide-clinical-100">
            {upcomingAppointments.map((appointment, index) => (
              <div key={index} className="flex items-center gap-4 px-6 py-4">
                <div className="w-16 text-center">
                  <p className="font-display font-semibold text-navy-900">{appointment.time.split(' ')[0]}</p>
                  <p className="text-xs text-navy-400 font-body">{appointment.time.split(' ')[1]}</p>
                </div>
                <div className="w-px h-10 bg-teal-200" />
                <div className="flex-1">
                  <p className="font-display font-medium text-navy-900">{appointment.patient}</p>
                  <p className="text-sm text-navy-500 font-body">{appointment.type}</p>
                </div>
                <span className="badge badge-neutral">{appointment.duration}</span>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 bg-clinical-50 border-t border-clinical-200">
            <p className="text-sm text-navy-500 font-body text-center">
              3 more appointments scheduled for today
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-clinical p-6">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Search Patients', icon: SearchIcon, href: '/patients' },
            { label: 'View Lab Results', icon: LabIcon, href: '/patients' },
            { label: 'Pending Signatures', icon: SignatureIcon, href: '/patients' },
            { label: 'Messages', icon: MessageIcon, href: '/patients' },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="flex flex-col items-center gap-3 p-4 rounded-lg border border-clinical-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-navy-50 group-hover:bg-teal-100 flex items-center justify-center transition-colors">
                <action.icon className="w-6 h-6 text-navy-500 group-hover:text-teal-600 transition-colors" />
              </div>
              <span className="font-body text-sm text-navy-700 text-center">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function PatientsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function LabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function SignatureIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}
