import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Appointment, AppointmentType, Patient, CreateAppointmentInput, CalendarEvent, OnCallPeriod } from '../api/client';
import QuickActions from '../components/QuickActions';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
}

export default function Calendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState<Partial<CreateAppointmentInput>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Day view state
  const [showDayView, setShowDayView] = useState(false);
  const [dayViewDate, setDayViewDate] = useState<Date | null>(null);
  const [dayViewFilter, setDayViewFilter] = useState<'all' | 'clinic' | 'operations'>('all');

  // Event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  // On Call modal state
  const [showOnCallModal, setShowOnCallModal] = useState(false);
  const [onCallStartDate, setOnCallStartDate] = useState('');
  const [onCallEndDate, setOnCallEndDate] = useState('');

  // Stored events and on-call periods
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [onCallPeriods, setOnCallPeriods] = useState<OnCallPeriod[]>([]);

  // Fetch events and on-call periods from API
  const fetchEventsAndOnCall = async () => {
    const { start, end } = getMonthRange(currentDate);
    const [eventsRes, onCallRes] = await Promise.all([
      api.getCalendarEvents(start, end, selectedProvider || undefined),
      api.getOnCallPeriods(start, end, selectedProvider || undefined),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data.events);
    if (onCallRes.data) setOnCallPeriods(onCallRes.data.onCallPeriods);
  };

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => {
      const eventDate = e.date.split('T')[0];
      return eventDate === dateStr;
    });
  };

  // Check if a day is within an on-call period
  const isOnCallDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return onCallPeriods.some(p => {
      const startDate = p.startDate.split('T')[0];
      const endDate = p.endDate.split('T')[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  // Get first and last day of month for fetching appointments
  const getMonthRange = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    };
  };

  // Fetch appointments for current month
  const fetchAppointments = async () => {
    const { start, end } = getMonthRange(currentDate);
    const { data } = await api.getAppointments(start, end, selectedProvider || undefined);
    if (data) {
      setAppointments(data.appointments);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const [typesRes, providersRes, patientsRes] = await Promise.all([
        api.getAppointmentTypes(),
        api.getProviders(),
        api.getPatients(),
      ]);

      if (typesRes.data) setAppointmentTypes(typesRes.data.types);
      if (providersRes.data) setProviders(providersRes.data.providers);
      if (patientsRes.data) setPatients(patientsRes.data.patients);

      await Promise.all([fetchAppointments(), fetchEventsAndOnCall()]);
      setLoading(false);
    };

    fetchInitialData();
  }, []);

  // Refetch when month or provider changes
  useEffect(() => {
    fetchAppointments();
    fetchEventsAndOnCall();
  }, [currentDate, selectedProvider]);

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Get appointments for a specific day
  const getAppointmentsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(apt => apt.appointmentDate.split('T')[0] === dateStr);
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle day click - show day view with patient list
  const handleDayClick = (date: Date, filter: 'all' | 'clinic' | 'operations' = 'all') => {
    setDayViewDate(date);
    setDayViewFilter(filter);
    setShowDayView(true);
  };

  // Open new appointment modal from day view
  const openNewAppointmentModal = (date: Date) => {
    setSelectedDate(date);
    setSelectedAppointment(null);
    setFormData({
      appointmentDate: date.toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '09:30',
      appointmentType: appointmentTypes[0]?.name || '',
      providerId: selectedProvider || providers[0]?.id || '',
    });
    setFormError('');
    setShowDayView(false);
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!formData.patientId || !formData.providerId || !formData.appointmentDate ||
        !formData.startTime || !formData.endTime || !formData.appointmentType) {
      setFormError('Please fill in all required fields');
      setSubmitting(false);
      return;
    }

    try {
      if (selectedAppointment) {
        // Update existing
        const { error } = await api.updateAppointment(selectedAppointment.id, formData);
        if (error) {
          setFormError(error);
          setSubmitting(false);
          return;
        }
      } else {
        // Create new
        const { error } = await api.createAppointment(formData as CreateAppointmentInput);
        if (error) {
          setFormError(error);
          setSubmitting(false);
          return;
        }
      }

      setShowModal(false);
      fetchAppointments();
    } catch (err) {
      setFormError('An error occurred');
    }

    setSubmitting(false);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedAppointment || !confirm('Are you sure you want to delete this appointment?')) return;

    setSubmitting(true);
    const { error } = await api.deleteAppointment(selectedAppointment.id);

    if (error) {
      setFormError(error);
    } else {
      setShowModal(false);
      fetchAppointments();
    }
    setSubmitting(false);
  };

  // Handle status change
  const handleStatusChange = async (status: string) => {
    if (!selectedAppointment) return;

    setSubmitting(true);
    const { error } = await api.updateAppointment(selectedAppointment.id, { status });

    if (error) {
      setFormError(error);
    } else {
      setShowModal(false);
      fetchAppointments();
    }
    setSubmitting(false);
  };

  // Get color for appointment type
  const getAppointmentColor = (typeName: string) => {
    const type = appointmentTypes.find(t => t.name === typeName);
    return type?.color || '#486581';
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 dark:text-navy-400 font-body">Loading calendar...</span>
        </div>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 dark:text-navy-100">Calendar</h1>
          <p className="text-navy-500 dark:text-navy-400 font-body mt-1">Manage appointments and schedules</p>
        </div>

        {/* Actions and Provider Filter */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEventDate(new Date().toISOString().split('T')[0]);
              setEventTitle('');
              setEventNotes('');
              setShowEventModal(true);
            }}
            className="px-5 py-2 text-sm font-medium rounded-lg border-2 w-52 flex items-center justify-center gap-2 transition-all bg-amber-500 hover:bg-amber-600 text-white border-amber-500 hover:border-amber-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Event
          </button>
          {user?.role === 'provider' && (
            <button
              onClick={() => {
                setOnCallStartDate(new Date().toISOString().split('T')[0]);
                setOnCallEndDate(new Date().toISOString().split('T')[0]);
                setShowOnCallModal(true);
              }}
              className="px-5 py-2 text-sm font-medium rounded-lg border-2 w-52 flex items-center justify-center gap-2 transition-all bg-violet-500 hover:bg-violet-600 text-white border-violet-500 hover:border-violet-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Add On Call Period
            </button>
          )}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="input-clinical py-2 text-sm"
          >
            <option value="">All Providers</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                Dr. {provider.lastName}, {provider.firstName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="card-clinical overflow-hidden">
        {/* Calendar Header */}
        <div className="px-6 py-4 border-b border-clinical-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg hover:bg-clinical-100 dark:hover:bg-navy-800 transition-colors"
            >
              <svg className="w-5 h-5 text-navy-600 dark:text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-clinical-100 dark:hover:bg-navy-800 transition-colors"
            >
              <svg className="w-5 h-5 text-navy-600 dark:text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-clinical-200 dark:border-navy-700">
          {DAYS.map(day => (
            <div
              key={day}
              className="px-2 py-3 text-center text-sm font-medium text-navy-500 dark:text-navy-400 font-body"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, index) => {
            const dayAppointments = date ? getAppointmentsForDay(date) : [];
            const dayEvents = date ? getEventsForDay(date) : [];
            const onCall = date ? isOnCallDay(date) : false;
            const isCurrentDay = date && isToday(date);

            return (
              <div
                key={index}
                onClick={() => date && handleDayClick(date)}
                className={`min-h-[120px] border-b border-r border-clinical-200 dark:border-navy-700 p-2 cursor-pointer transition-colors
                  ${date ? 'hover:bg-clinical-50 dark:hover:bg-navy-800/50' : 'bg-clinical-100/50 dark:bg-navy-900/50'}
                  ${index % 7 === 6 ? 'border-r-0' : ''}
                  ${onCall ? 'bg-violet-50 dark:bg-violet-900/20' : ''}
                `}
              >
                {date && (() => {
                  const clinicCount = dayAppointments.filter(apt => apt.appointmentType !== 'Procedure').length;
                  const operationsCount = dayAppointments.filter(apt => apt.appointmentType === 'Procedure').length;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`text-sm font-medium ${
                          isCurrentDay
                            ? 'w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center'
                            : 'text-navy-700 dark:text-navy-300'
                        }`}>
                          {date.getDate()}
                        </div>
                        {onCall && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500 text-white font-medium">
                            On Call
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {clinicCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayClick(date, 'clinic');
                            }}
                            className="w-full text-xs px-2 py-1.5 rounded-md bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-semibold hover:bg-teal-200 dark:hover:bg-teal-900/50 hover:scale-105 transition-all shadow-sm text-left"
                          >
                            {clinicCount} Clinic
                          </button>
                        )}
                        {operationsCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayClick(date, 'operations');
                            }}
                            className="w-full text-xs px-2 py-1.5 rounded-md bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-400 font-semibold hover:bg-coral-200 dark:hover:bg-coral-900/50 hover:scale-105 transition-all shadow-sm text-left"
                          >
                            {operationsCount} Op{operationsCount !== 1 ? 's' : ''}
                          </button>
                        )}
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            className="w-full text-xs px-2 py-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold shadow-sm truncate"
                          >
                            {event.title}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Appointment Type Legend */}
      <div className="flex flex-wrap gap-4">
        {appointmentTypes.map(type => (
          <div key={type.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: type.color }}
            />
            <span className="text-sm text-navy-600 dark:text-navy-400 font-body">{type.name}</span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-lg w-full my-8 animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                  {selectedAppointment ? 'Edit Appointment' : 'New Appointment'}
                </h2>
                <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
                  {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 rounded-lg">
                    <p className="text-coral-700 dark:text-coral-400 text-sm font-body">{formError}</p>
                  </div>
                )}

                {/* Patient */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Patient <span className="text-coral-500">*</span>
                  </label>
                  <select
                    value={formData.patientId || ''}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className="input-clinical"
                    required
                  >
                    <option value="">Select patient...</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName} ({patient.mrn})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Provider */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Provider <span className="text-coral-500">*</span>
                  </label>
                  <select
                    value={formData.providerId || ''}
                    onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                    className="input-clinical"
                    required
                  >
                    <option value="">Select provider...</option>
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        Dr. {provider.lastName}, {provider.firstName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                      Start Time <span className="text-coral-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.startTime || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="input-clinical"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                      End Time <span className="text-coral-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.endTime || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="input-clinical"
                      required
                    />
                  </div>
                </div>

                {/* Appointment Type */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Appointment Type <span className="text-coral-500">*</span>
                  </label>
                  <select
                    value={formData.appointmentType || ''}
                    onChange={(e) => {
                      const type = appointmentTypes.find(t => t.name === e.target.value);
                      if (type && formData.startTime) {
                        const [hours, minutes] = formData.startTime.split(':').map(Number);
                        const endDate = new Date(2000, 0, 1, hours, minutes + type.durationMinutes);
                        const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                        setFormData({ ...formData, appointmentType: e.target.value, endTime });
                      } else {
                        setFormData({ ...formData, appointmentType: e.target.value });
                      }
                    }}
                    className="input-clinical"
                    required
                  >
                    <option value="">Select type...</option>
                    {appointmentTypes.map(type => (
                      <option key={type.id} value={type.name}>
                        {type.name} ({type.durationMinutes} min)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-1">
                    Reason for Visit
                  </label>
                  <input
                    type="text"
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="e.g., Hearing evaluation"
                    className="input-clinical"
                  />
                </div>

                {/* Status (for editing) */}
                {selectedAppointment && (
                  <div>
                    <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 font-body mb-2">
                      Status
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'].map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChange(status)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            selectedAppointment.status === status
                              ? 'bg-teal-600 text-white'
                              : 'bg-clinical-100 dark:bg-navy-800 text-navy-600 dark:text-navy-300 hover:bg-clinical-200 dark:hover:bg-navy-700'
                          }`}
                        >
                          {status.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
                <div>
                  {selectedAppointment && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="text-coral-600 hover:text-coral-700 text-sm font-medium"
                      disabled={submitting}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : selectedAppointment ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day View Modal */}
      {showDayView && dayViewDate && (() => {
        const allAppointments = getAppointmentsForDay(dayViewDate);
        const clinicAppointments = allAppointments.filter(apt => apt.appointmentType !== 'Procedure');
        const operationAppointments = allAppointments.filter(apt => apt.appointmentType === 'Procedure');
        const filteredAppointments = dayViewFilter === 'clinic'
          ? clinicAppointments
          : dayViewFilter === 'operations'
            ? operationAppointments
            : allAppointments;

        return (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-2xl w-full my-8 animate-slide-up max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700 flex-shrink-0">
              <div>
                <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                  {dayViewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
                  {dayViewFilter === 'clinic' ? `${clinicAppointments.length} clinic appointment${clinicAppointments.length !== 1 ? 's' : ''}` :
                   dayViewFilter === 'operations' ? `${operationAppointments.length} operation${operationAppointments.length !== 1 ? 's' : ''}` :
                   `${allAppointments.length} appointment${allAppointments.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button
                onClick={() => setShowDayView(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 px-6 py-3 border-b border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50">
              <button
                onClick={() => setDayViewFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dayViewFilter === 'all'
                    ? 'bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900'
                    : 'text-navy-600 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-700'
                }`}
              >
                All ({allAppointments.length})
              </button>
              <button
                onClick={() => setDayViewFilter('clinic')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dayViewFilter === 'clinic'
                    ? 'bg-teal-600 text-white'
                    : 'text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30'
                }`}
              >
                Clinic ({clinicAppointments.length})
              </button>
              <button
                onClick={() => setDayViewFilter('operations')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dayViewFilter === 'operations'
                    ? 'bg-coral-600 text-white'
                    : 'text-coral-700 dark:text-coral-400 hover:bg-coral-100 dark:hover:bg-coral-900/30'
                }`}
              >
                Operations ({operationAppointments.length})
              </button>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto">
              {filteredAppointments.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-12 h-12 text-navy-300 dark:text-navy-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <p className="text-navy-500 dark:text-navy-400 font-body">
                    {dayViewFilter === 'clinic' ? 'No clinic appointments' :
                     dayViewFilter === 'operations' ? 'No operations scheduled' :
                     'No appointments scheduled'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-clinical-100 dark:divide-navy-700">
                  {filteredAppointments
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map(apt => {
                      const statusColors: Record<string, string> = {
                        scheduled: 'bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-300',
                        confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        checked_in: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        in_progress: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
                        completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        checked_out: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                        cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                        no_show: 'bg-coral-100 text-coral-700 dark:bg-coral-900/30 dark:text-coral-400',
                      };

                      return (
                        <Link
                          key={apt.id}
                          to={`/patients/${apt.patientId}`}
                          className="flex items-center gap-4 px-6 py-4 hover:bg-clinical-50 dark:hover:bg-navy-800/50 cursor-pointer transition-colors"
                        >
                          {/* Time */}
                          <div className="w-20 text-right flex-shrink-0">
                            <p className="font-display font-semibold text-navy-900 dark:text-navy-100">
                              {apt.startTime.substring(0, 5).replace(/^0/, '').replace(':00', ':00').split(':').map((p, i) => {
                                if (i === 0) {
                                  const h = parseInt(p);
                                  return h > 12 ? h - 12 : h || 12;
                                }
                                return p;
                              }).join(':')} {parseInt(apt.startTime.substring(0, 2)) >= 12 ? 'PM' : 'AM'}
                            </p>
                            <p className="text-xs text-navy-400 dark:text-navy-500">
                              {apt.endTime.substring(0, 5).replace(/^0/, '').split(':').map((p, i) => {
                                if (i === 0) {
                                  const h = parseInt(p);
                                  return h > 12 ? h - 12 : h || 12;
                                }
                                return p;
                              }).join(':')} {parseInt(apt.endTime.substring(0, 2)) >= 12 ? 'PM' : 'AM'}
                            </p>
                          </div>

                          {/* Color bar */}
                          <div
                            className="w-1 h-12 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getAppointmentColor(apt.appointmentType) }}
                          />

                          {/* Patient info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-semibold text-teal-600 dark:text-teal-400 hover:underline">
                              {apt.patientFirstName} {apt.patientLastName}
                            </p>
                            <p className="text-sm text-navy-500 dark:text-navy-400 truncate">
                              {apt.appointmentType}
                              {apt.reason && ` · ${apt.reason}`}
                            </p>
                          </div>

                          {/* Status badge */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusColors[apt.status] || statusColors.scheduled}`}>
                            {apt.status.replace('_', ' ')}
                          </span>

                          {/* Arrow */}
                          <svg className="w-5 h-5 text-navy-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl flex-shrink-0">
              <button
                onClick={() => openNewAppointmentModal(dayViewDate)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Appointment
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
              <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">Add Event</h2>
              <button
                onClick={() => setShowEventModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-1">Event Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Enter event title..."
                  className="input-clinical"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-1">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="input-clinical"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-1">Notes</label>
                <textarea
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                  className="input-clinical resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
              <button onClick={() => setShowEventModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (eventTitle && eventDate) {
                    const { error } = await api.createCalendarEvent({
                      eventDate,
                      title: eventTitle,
                      notes: eventNotes || undefined,
                    });
                    if (!error) {
                      await fetchEventsAndOnCall();
                      setShowEventModal(false);
                    }
                  }
                }}
                className="btn-primary bg-amber-500 hover:bg-amber-600"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add On Call Period Modal */}
      {showOnCallModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-clinical-xl max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200 dark:border-navy-700">
              <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">Add On Call Period</h2>
              <button
                onClick={() => setShowOnCallModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={onCallStartDate}
                  onChange={(e) => setOnCallStartDate(e.target.value)}
                  className="input-clinical"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={onCallEndDate}
                  onChange={(e) => setOnCallEndDate(e.target.value)}
                  className="input-clinical"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 dark:border-navy-700 bg-clinical-50 dark:bg-navy-800/50 rounded-b-2xl">
              <button onClick={() => setShowOnCallModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onCallStartDate && onCallEndDate) {
                    const { error } = await api.createOnCallPeriod({
                      startDate: onCallStartDate,
                      endDate: onCallEndDate,
                    });
                    if (!error) {
                      await fetchEventsAndOnCall();
                      setShowOnCallModal(false);
                    }
                  }
                }}
                className="btn-primary bg-violet-500 hover:bg-violet-600"
              >
                Add On Call Period
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
