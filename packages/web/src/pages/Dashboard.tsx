import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, Appointment } from '../api/client';

type ViewMode = 'work' | 'personal' | 'merge';

interface PersonalTask {
  id: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  endTime?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface OnCallPeriod {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
}

interface OnCallSettings {
  rotationType: 'day' | 'week';
  startDay: number; // 0 = Sunday, 1 = Monday, etc.
  defaultStartTime: string;
  defaultEndTime: string;
}

interface TimeSlot {
  type: 'work' | 'personal' | 'oncall';
  id: string;
  title: string;
  subtitle?: string;
  startTime?: string;
  endTime?: string;
  date: string;
  status?: string;
  hasConflict?: boolean;
  conflictsWith?: string;
  patientId?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('dashboardViewMode') as ViewMode) || 'work';
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<Map<string, Appointment[]>>(new Map());
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>(() => {
    const saved = localStorage.getItem('personalTasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskEndTime, setNewTaskEndTime] = useState('');
  const [onCallPeriods, setOnCallPeriods] = useState<OnCallPeriod[]>(() => {
    const saved = localStorage.getItem('onCallPeriods');
    return saved ? JSON.parse(saved) : [];
  });
  const [newOnCallDate, setNewOnCallDate] = useState('');
  const [newOnCallStart, setNewOnCallStart] = useState('');
  const [newOnCallEnd, setNewOnCallEnd] = useState('');
  const [newOnCallNote, setNewOnCallNote] = useState('');
  const [showOnCallForm, setShowOnCallForm] = useState(false);
  const [showOnCallSettings, setShowOnCallSettings] = useState(false);
  const [onCallSettings, setOnCallSettings] = useState<OnCallSettings>(() => {
    const saved = localStorage.getItem('onCallSettings');
    return saved ? JSON.parse(saved) : {
      rotationType: 'week',
      startDay: 1, // Monday
      defaultStartTime: '09:00',
      defaultEndTime: '09:00',
    };
  });
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentHour = now.getHours();

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('dashboardViewMode', viewMode);
  }, [viewMode]);

  // Save personal tasks
  useEffect(() => {
    localStorage.setItem('personalTasks', JSON.stringify(personalTasks));
  }, [personalTasks]);

  // Save on-call periods
  useEffect(() => {
    localStorage.setItem('onCallPeriods', JSON.stringify(onCallPeriods));
  }, [onCallPeriods]);

  // Save on-call settings
  useEffect(() => {
    localStorage.setItem('onCallSettings', JSON.stringify(onCallSettings));
  }, [onCallSettings]);

  // Time-based greeting
  const getGreeting = () => {
    if (currentHour < 12) return 'Good morning';
    if (currentHour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Get week dates (today through end of week + next week start)
  const getWeekDates = () => {
    const dates: Date[] = [];
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Get remaining days of this week plus all of next week (up to 14 days)
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Fetch today's and week's appointments
  useEffect(() => {
    const fetchData = async () => {
      const today = now.toISOString().split('T')[0];

      // Get end of week (7 days from now)
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const { data } = await api.getAppointments(today, weekEndStr);
      if (data) {
        // Sort all appointments by date and time
        const sorted = data.appointments.sort((a, b) => {
          const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
          if (dateCompare !== 0) return dateCompare;
          return a.startTime.localeCompare(b.startTime);
        });

        // Separate today's appointments
        const todayApts = sorted.filter(apt => apt.appointmentDate === today);
        setTodayAppointments(todayApts);

        // Group remaining by date for the week view
        const weekMap = new Map<string, Appointment[]>();
        sorted.filter(apt => apt.appointmentDate !== today).forEach(apt => {
          const existing = weekMap.get(apt.appointmentDate) || [];
          existing.push(apt);
          weekMap.set(apt.appointmentDate, existing);
        });
        setWeekAppointments(weekMap);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Get next upcoming appointment
  const getNextAppointment = () => {
    const currentTime = now.toTimeString().slice(0, 5);
    return todayAppointments.find(apt => apt.startTime > currentTime && apt.status !== 'completed' && apt.status !== 'cancelled');
  };

  // Personal task functions
  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: PersonalTask = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      dueDate: newTaskDate || undefined,
      dueTime: newTaskTime || undefined,
      endTime: newTaskEndTime || undefined,
      completed: false,
      priority: 'medium',
    };
    setPersonalTasks([...personalTasks, newTask]);
    setNewTaskTitle('');
    setNewTaskDate('');
    setNewTaskTime('');
    setNewTaskEndTime('');
  };

  // On-call functions
  const addOnCall = () => {
    if (!newOnCallDate || !newOnCallStart || !newOnCallEnd) return;
    const newPeriod: OnCallPeriod = {
      id: Date.now().toString(),
      date: newOnCallDate,
      startTime: newOnCallStart,
      endTime: newOnCallEnd,
      note: newOnCallNote || undefined,
    };
    setOnCallPeriods([...onCallPeriods, newPeriod]);
    setNewOnCallDate('');
    setNewOnCallStart('');
    setNewOnCallEnd('');
    setNewOnCallNote('');
    setShowOnCallForm(false);
  };

  const deleteOnCall = (id: string) => {
    setOnCallPeriods(onCallPeriods.filter(p => p.id !== id));
  };

  // Get day name
  const getDayName = (dayNum: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum];
  };

  // Generate on-call for current rotation period
  const generateOnCallForRotation = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (onCallSettings.rotationType === 'day') {
      // Daily rotation - add for today
      const dateStr = today.toISOString().split('T')[0];
      const exists = onCallPeriods.some(p => p.date === dateStr);
      if (!exists) {
        const newPeriod: OnCallPeriod = {
          id: Date.now().toString(),
          date: dateStr,
          startTime: onCallSettings.defaultStartTime,
          endTime: onCallSettings.defaultEndTime,
          note: 'Daily on-call',
        };
        setOnCallPeriods([...onCallPeriods, newPeriod]);
      }
    } else {
      // Weekly rotation - add for the whole week starting from startDay
      const currentDay = today.getDay();
      const daysUntilStart = (onCallSettings.startDay - currentDay + 7) % 7;
      const weekStart = new Date(today);

      // If we're past the start day this week, use this week's start day (go back)
      if (daysUntilStart !== 0) {
        weekStart.setDate(today.getDate() - (7 - daysUntilStart));
      }

      // Add 7 days of on-call starting from the start day
      const newPeriods: OnCallPeriod[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Skip if already exists
        if (!onCallPeriods.some(p => p.date === dateStr)) {
          newPeriods.push({
            id: `${Date.now()}-${i}`,
            date: dateStr,
            startTime: onCallSettings.defaultStartTime,
            endTime: onCallSettings.defaultEndTime,
            note: `Week starting ${getDayName(onCallSettings.startDay)}`,
          });
        }
      }

      if (newPeriods.length > 0) {
        setOnCallPeriods([...onCallPeriods, ...newPeriods]);
      }
    }
  };

  // Get on-call periods for a date
  const getOnCallForDate = (date: string) => {
    return onCallPeriods.filter(p => p.date === date);
  };

  // Check if two time ranges overlap
  const timesOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    return start1 < end2 && start2 < end1;
  };

  // Get merged timeline with conflict detection
  const getMergedTimeline = (date: string): TimeSlot[] => {
    const slots: TimeSlot[] = [];

    // Add work appointments for this date
    const dayAppointments = date === now.toISOString().split('T')[0]
      ? todayAppointments
      : weekAppointments.get(date) || [];

    dayAppointments.forEach(apt => {
      slots.push({
        type: 'work',
        id: apt.id,
        title: `${apt.patientLastName}, ${apt.patientFirstName}`,
        subtitle: apt.appointmentType,
        startTime: apt.startTime,
        endTime: apt.endTime,
        date: apt.appointmentDate,
        status: apt.status,
        patientId: apt.patientId,
      });
    });

    // Add on-call periods for this date
    getOnCallForDate(date).forEach(period => {
      slots.push({
        type: 'oncall',
        id: period.id,
        title: 'On Call',
        subtitle: period.note,
        startTime: period.startTime,
        endTime: period.endTime,
        date: date,
      });
    });

    // Add personal tasks for this date
    personalTasks
      .filter(task => task.dueDate === date && !task.completed)
      .forEach(task => {
        slots.push({
          type: 'personal',
          id: task.id,
          title: task.title,
          startTime: task.dueTime,
          endTime: task.endTime,
          date: date,
        });
      });

    // Sort by time (items without time go to the end)
    slots.sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });

    // Detect conflicts (on-call conflicts with personal, but NOT with work)
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slotA = slots[i];
        const slotB = slots[j];

        // Only check if both have times
        if (slotA.startTime && slotA.endTime && slotB.startTime && slotB.endTime) {
          if (timesOverlap(slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime)) {
            // On-call only conflicts with personal
            const isOnCallVsPersonal =
              (slotA.type === 'oncall' && slotB.type === 'personal') ||
              (slotA.type === 'personal' && slotB.type === 'oncall');

            // Work conflicts with personal (but not on-call)
            const isWorkVsPersonal =
              (slotA.type === 'work' && slotB.type === 'personal') ||
              (slotA.type === 'personal' && slotB.type === 'work');

            if (isOnCallVsPersonal || isWorkVsPersonal) {
              slots[i].hasConflict = true;
              slots[j].hasConflict = true;
              slots[i].conflictsWith = slotB.type;
              slots[j].conflictsWith = slotA.type;
            }
          }
        }
      }
    }

    return slots;
  };

  // Get all conflicts for today and week
  const getConflictCount = () => {
    let count = 0;
    const today = now.toISOString().split('T')[0];
    const dates = [today, ...getWeekDates().map(d => d.toISOString().split('T')[0])];

    dates.forEach(date => {
      const slots = getMergedTimeline(date);
      count += slots.filter(s => s.hasConflict).length / 2; // Divide by 2 since conflicts are counted twice
    });

    return Math.floor(count);
  };

  const toggleTask = (id: string) => {
    setPersonalTasks(personalTasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: string) => {
    setPersonalTasks(personalTasks.filter(task => task.id !== id));
  };

  const incompleteTasks = personalTasks.filter(t => !t.completed);
  const completedTasks = personalTasks.filter(t => t.completed);

  // Get appointments by status
  const completedToday = todayAppointments.filter(a => a.status === 'completed').length;
  const remainingToday = todayAppointments.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length;
  const inProgress = todayAppointments.find(a => a.status === 'in_progress' || a.status === 'checked_in');

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

      {/* Work/Personal/Merge Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-clinical-100 dark:bg-navy-800 p-1">
          <button
            onClick={() => setViewMode('work')}
            className={`px-4 md:px-6 py-2.5 rounded-lg font-body font-medium text-sm transition-all ${
              viewMode === 'work'
                ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-navy-100 shadow-sm'
                : 'text-navy-500 dark:text-navy-400 hover:text-navy-700 dark:hover:text-navy-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <BriefcaseIcon className="w-4 h-4" />
              Work
            </span>
          </button>
          <button
            onClick={() => setViewMode('personal')}
            className={`px-4 md:px-6 py-2.5 rounded-lg font-body font-medium text-sm transition-all ${
              viewMode === 'personal'
                ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-navy-100 shadow-sm'
                : 'text-navy-500 dark:text-navy-400 hover:text-navy-700 dark:hover:text-navy-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <HomeIcon className="w-4 h-4" />
              Personal
            </span>
          </button>
          <button
            onClick={() => setViewMode('merge')}
            className={`px-4 md:px-6 py-2.5 rounded-lg font-body font-medium text-sm transition-all relative ${
              viewMode === 'merge'
                ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-navy-100 shadow-sm'
                : 'text-navy-500 dark:text-navy-400 hover:text-navy-700 dark:hover:text-navy-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <MergeIcon className="w-4 h-4" />
              Merge
              {getConflictCount() > 0 && viewMode !== 'merge' && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-coral-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {getConflictCount()}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* WORK VIEW */}
      {viewMode === 'work' && (
        <>
      {/* Current Status Card */}
      {inProgress ? (
        <div className="card-clinical p-6 border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50 to-white dark:from-teal-900/20 dark:to-navy-900">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-sm font-medium font-body uppercase tracking-wide">In Progress</span>
          </div>
          <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
            {inProgress.patientLastName}, {inProgress.patientFirstName}
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
          <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
            {nextAppointment.patientLastName}, {nextAppointment.patientFirstName}
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

      {/* Today's Timeline */}
      {todayAppointments.length > 0 && (
        <div className="card-clinical overflow-hidden">
          <div className="px-6 py-4 border-b border-clinical-200 dark:border-navy-700 flex items-center justify-between">
            <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100">Today's Schedule</h2>
            <Link to="/calendar" className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline font-body">
              View Calendar
            </Link>
          </div>
          <div className="divide-y divide-clinical-100 dark:divide-navy-700">
            {todayAppointments.map((apt, index) => {
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
                    {index < todayAppointments.length - 1 && (
                      <div className="w-0.5 h-12 bg-clinical-200 dark:bg-navy-700 -mb-4" />
                    )}
                  </div>

                  {/* Appointment Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-display font-medium ${isPast ? 'text-navy-500 dark:text-navy-400' : 'text-navy-900 dark:text-navy-100'}`}>
                        {apt.patientLastName}, {apt.patientFirstName}
                      </p>
                      {isCurrent && (
                        <span className="badge badge-success">In Progress</span>
                      )}
                      {apt.status === 'checked_in' && (
                        <span className="badge badge-warning">Checked In</span>
                      )}
                    </div>
                    <p className="text-sm text-navy-500 dark:text-navy-400 font-body">
                      {apt.appointmentType}
                      {apt.reason && ` · ${apt.reason}`}
                    </p>
                  </div>

                  {/* Action */}
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
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/patients"
          className="card-clinical p-4 flex flex-col items-center gap-3 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 flex items-center justify-center transition-colors">
            <SearchIcon className="w-6 h-6 text-navy-500 dark:text-navy-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
          </div>
          <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">Find Patient</span>
        </Link>

        <Link
          to="/calendar"
          className="card-clinical p-4 flex flex-col items-center gap-3 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 flex items-center justify-center transition-colors">
            <CalendarIcon className="w-6 h-6 text-navy-500 dark:text-navy-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
          </div>
          <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">New Appointment</span>
        </Link>

        <Link
          to="/patients"
          className="card-clinical p-4 flex flex-col items-center gap-3 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 flex items-center justify-center transition-colors">
            <ClipboardIcon className="w-6 h-6 text-navy-500 dark:text-navy-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
          </div>
          <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">New Encounter</span>
        </Link>

        <Link
          to="/patients"
          className="card-clinical p-4 flex flex-col items-center gap-3 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 flex items-center justify-center transition-colors">
            <UserPlusIcon className="w-6 h-6 text-navy-500 dark:text-navy-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
          </div>
          <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">New Patient</span>
        </Link>
      </div>

      {/* Week Ahead */}
      <div className="card-clinical overflow-hidden">
        <div className="px-6 py-4 border-b border-clinical-200 dark:border-navy-700 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100">This Week</h2>
          <Link to="/calendar" className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline font-body">
            Full Calendar
          </Link>
        </div>
        <div className="divide-y divide-clinical-100 dark:divide-navy-700">
          {getWeekDates().map(date => {
            const dateStr = date.toISOString().split('T')[0];
            const dayAppointments = weekAppointments.get(dateStr) || [];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const monthName = date.toLocaleDateString('en-US', { month: 'short' });

            return (
              <div
                key={dateStr}
                className={`flex items-start gap-4 px-6 py-4 ${isWeekend ? 'bg-clinical-50/50 dark:bg-navy-800/30' : ''}`}
              >
                {/* Date */}
                <div className="w-16 flex-shrink-0 text-center">
                  <p className="text-xs font-body text-navy-400 dark:text-navy-500 uppercase">{dayName}</p>
                  <p className="font-display text-2xl font-bold text-navy-900 dark:text-navy-100">{dayNum}</p>
                  <p className="text-xs font-body text-navy-400 dark:text-navy-500">{monthName}</p>
                </div>

                {/* Appointments for the day */}
                <div className="flex-1 min-w-0">
                  {dayAppointments.length === 0 ? (
                    <p className="text-navy-400 dark:text-navy-500 font-body text-sm py-2 italic">
                      {isWeekend ? 'Weekend' : 'No appointments'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayAppointments.slice(0, 3).map(apt => (
                        <div
                          key={apt.id}
                          className="flex items-center gap-3 py-1"
                        >
                          <span className="text-sm font-body text-navy-500 dark:text-navy-400 w-16 flex-shrink-0">
                            {formatTime(apt.startTime)}
                          </span>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(apt.status)}`} />
                          <span className="text-sm font-body text-navy-700 dark:text-navy-300 truncate">
                            {apt.patientLastName}, {apt.patientFirstName}
                          </span>
                          <span className="text-xs font-body text-navy-400 dark:text-navy-500 truncate hidden sm:inline">
                            {apt.appointmentType}
                          </span>
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <p className="text-xs text-teal-600 dark:text-teal-400 font-body">
                          +{dayAppointments.length - 3} more
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Day total */}
                {dayAppointments.length > 0 && (
                  <div className="flex-shrink-0 text-right">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-navy-100 dark:bg-navy-700 text-navy-600 dark:text-navy-300 font-display font-semibold text-sm">
                      {dayAppointments.length}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* On Call Section */}
      <div className="card-clinical overflow-hidden">
        <div className="px-6 py-4 border-b border-clinical-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneIcon className="w-5 h-5 text-amber-500" />
            <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100">On Call</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 font-body">
              {onCallSettings.rotationType === 'week' ? 'Weekly' : 'Daily'} · {getDayName(onCallSettings.startDay)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOnCallSettings(!showOnCallSettings)}
              className="text-navy-400 hover:text-navy-600 dark:hover:text-navy-300 transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowOnCallForm(!showOnCallForm)}
              className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline font-body flex items-center gap-1"
            >
              {showOnCallForm ? 'Cancel' : '+ Add'}
            </button>
          </div>
        </div>

        {/* On Call Settings */}
        {showOnCallSettings && (
          <div className="px-6 py-4 bg-navy-50 dark:bg-navy-800/50 border-b border-clinical-200 dark:border-navy-700">
            <h3 className="font-display font-medium text-navy-900 dark:text-navy-100 mb-4">On Call Settings</h3>
            <div className="space-y-4">
              {/* Rotation Type */}
              <div>
                <label className="block text-sm font-body text-navy-600 dark:text-navy-400 mb-2">
                  Rotation Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOnCallSettings({ ...onCallSettings, rotationType: 'day' })}
                    className={`px-4 py-2 rounded-lg font-body text-sm transition-all ${
                      onCallSettings.rotationType === 'day'
                        ? 'bg-amber-500 text-white'
                        : 'bg-white dark:bg-navy-700 text-navy-700 dark:text-navy-300 border border-clinical-200 dark:border-navy-600 hover:border-amber-300'
                    }`}
                  >
                    By Day
                  </button>
                  <button
                    onClick={() => setOnCallSettings({ ...onCallSettings, rotationType: 'week' })}
                    className={`px-4 py-2 rounded-lg font-body text-sm transition-all ${
                      onCallSettings.rotationType === 'week'
                        ? 'bg-amber-500 text-white'
                        : 'bg-white dark:bg-navy-700 text-navy-700 dark:text-navy-300 border border-clinical-200 dark:border-navy-600 hover:border-amber-300'
                    }`}
                  >
                    By Week
                  </button>
                </div>
              </div>

              {/* Start Day */}
              <div>
                <label className="block text-sm font-body text-navy-600 dark:text-navy-400 mb-2">
                  {onCallSettings.rotationType === 'week' ? 'Week Starts On' : 'Rotation Start Day'}
                </label>
                <select
                  value={onCallSettings.startDay}
                  onChange={(e) => setOnCallSettings({ ...onCallSettings, startDay: parseInt(e.target.value) })}
                  className="input-clinical w-full md:w-48"
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>

              {/* Default Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-body text-navy-600 dark:text-navy-400 mb-2">
                    Default Start Time
                  </label>
                  <input
                    type="time"
                    value={onCallSettings.defaultStartTime}
                    onChange={(e) => setOnCallSettings({ ...onCallSettings, defaultStartTime: e.target.value })}
                    className="input-clinical w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-body text-navy-600 dark:text-navy-400 mb-2">
                    Default End Time
                  </label>
                  <input
                    type="time"
                    value={onCallSettings.defaultEndTime}
                    onChange={(e) => setOnCallSettings({ ...onCallSettings, defaultEndTime: e.target.value })}
                    className="input-clinical w-full"
                  />
                </div>
              </div>

              {/* Quick Generate Button */}
              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-navy-500 dark:text-navy-400 font-body">
                  {onCallSettings.rotationType === 'week'
                    ? `Generates 7 days of on-call starting from ${getDayName(onCallSettings.startDay)}`
                    : 'Generates on-call for today'}
                </p>
                <button
                  onClick={() => {
                    generateOnCallForRotation();
                    setShowOnCallSettings(false);
                  }}
                  className="btn-primary bg-amber-500 hover:bg-amber-600"
                >
                  Generate {onCallSettings.rotationType === 'week' ? 'Week' : 'Today'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add On Call Form */}
        {showOnCallForm && !showOnCallSettings && (
          <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-clinical-200 dark:border-navy-700">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addOnCall();
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="date"
                  value={newOnCallDate}
                  onChange={(e) => setNewOnCallDate(e.target.value)}
                  className="input-clinical"
                  required
                />
                <input
                  type="time"
                  value={newOnCallStart}
                  onChange={(e) => setNewOnCallStart(e.target.value)}
                  placeholder="Start time"
                  className="input-clinical"
                  required
                />
                <input
                  type="time"
                  value={newOnCallEnd}
                  onChange={(e) => setNewOnCallEnd(e.target.value)}
                  placeholder="End time"
                  className="input-clinical"
                  required
                />
                <input
                  type="text"
                  value={newOnCallNote}
                  onChange={(e) => setNewOnCallNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="input-clinical"
                />
              </div>
              <button
                type="submit"
                disabled={!newOnCallDate || !newOnCallStart || !newOnCallEnd}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add On Call Period
              </button>
            </form>
          </div>
        )}

        {/* On Call List */}
        {onCallPeriods.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-navy-400 dark:text-navy-500 font-body text-sm">
              No on-call periods scheduled. Add one above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-clinical-100 dark:divide-navy-700">
            {onCallPeriods
              .filter(p => p.date >= now.toISOString().split('T')[0])
              .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
              .map(period => {
                const periodDate = new Date(period.date + 'T00:00:00');
                const isToday = period.date === now.toISOString().split('T')[0];
                const hasConflict = personalTasks.some(task =>
                  task.dueDate === period.date &&
                  task.dueTime &&
                  task.endTime &&
                  timesOverlap(period.startTime, period.endTime, task.dueTime, task.endTime)
                );

                return (
                  <div
                    key={period.id}
                    className={`flex items-center gap-4 px-6 py-3 ${
                      hasConflict ? 'bg-coral-50 dark:bg-coral-900/20' : ''
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-body text-sm font-medium text-navy-900 dark:text-navy-100">
                          {isToday ? 'Today' : periodDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-navy-500 dark:text-navy-400 font-body text-sm">
                          {formatTime(period.startTime)} - {formatTime(period.endTime)}
                        </span>
                        {hasConflict && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-coral-100 text-coral-700 dark:bg-coral-900/50 dark:text-coral-300 font-body">
                            Conflicts with personal
                          </span>
                        )}
                      </div>
                      {period.note && (
                        <p className="text-xs text-navy-400 dark:text-navy-500 font-body mt-0.5">
                          {period.note}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteOnCall(period.id)}
                      className="text-navy-400 hover:text-coral-500 transition-colors flex-shrink-0"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>
        </>
      )}

      {/* PERSONAL VIEW */}
      {viewMode === 'personal' && (
        <>
          {/* Today's Focus */}
          <div className="card-clinical p-6 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-navy-900">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
              <StarIcon className="w-4 h-4" />
              <span className="text-sm font-medium font-body uppercase tracking-wide">Today's Focus</span>
            </div>
            <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
              {incompleteTasks.length === 0
                ? 'All caught up!'
                : `${incompleteTasks.length} task${incompleteTasks.length !== 1 ? 's' : ''} to complete`}
            </h2>
            {incompleteTasks.length > 0 && (
              <p className="text-navy-600 dark:text-navy-400 font-body mt-1">
                {completedTasks.length} completed today
              </p>
            )}
          </div>

          {/* Add Task */}
          <div className="card-clinical p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTask();
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add a personal task..."
                className="input-clinical flex-1"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </form>
          </div>

          {/* Tasks List */}
          {personalTasks.length > 0 && (
            <div className="card-clinical overflow-hidden">
              <div className="px-6 py-4 border-b border-clinical-200 dark:border-navy-700">
                <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100">My Tasks</h2>
              </div>

              {/* Incomplete Tasks */}
              {incompleteTasks.length > 0 && (
                <div className="divide-y divide-clinical-100 dark:divide-navy-700">
                  {incompleteTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-clinical-50 dark:hover:bg-navy-800/50 transition-colors"
                    >
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="w-5 h-5 rounded-full border-2 border-navy-300 dark:border-navy-600 hover:border-teal-500 dark:hover:border-teal-400 transition-colors flex-shrink-0"
                      />
                      <span className="flex-1 font-body text-navy-900 dark:text-navy-100">
                        {task.title}
                      </span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-navy-400 hover:text-coral-500 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <>
                  <div className="px-6 py-3 bg-clinical-50 dark:bg-navy-800/50 border-t border-clinical-200 dark:border-navy-700">
                    <span className="text-sm font-body text-navy-500 dark:text-navy-400">
                      Completed ({completedTasks.length})
                    </span>
                  </div>
                  <div className="divide-y divide-clinical-100 dark:divide-navy-700">
                    {completedTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 px-6 py-4 opacity-60"
                      >
                        <button
                          onClick={() => toggleTask(task.id)}
                          className="w-5 h-5 rounded-full border-2 border-teal-500 bg-teal-500 flex-shrink-0 flex items-center justify-center"
                        >
                          <CheckIcon className="w-3 h-3 text-white" />
                        </button>
                        <span className="flex-1 font-body text-navy-700 dark:text-navy-300 line-through">
                          {task.title}
                        </span>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-navy-400 hover:text-coral-500 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Empty state */}
          {personalTasks.length === 0 && (
            <div className="card-clinical p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
                <CheckIcon className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="font-display text-xl font-semibold text-navy-900 dark:text-navy-100">
                No tasks yet
              </h2>
              <p className="text-navy-500 dark:text-navy-400 font-body mt-2">
                Add a personal task above to get started
              </p>
            </div>
          )}

          {/* Quick Personal Actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setNewTaskTitle('');
                document.querySelector<HTMLInputElement>('input[placeholder="Add a personal task..."]')?.focus();
              }}
              className="card-clinical p-4 flex flex-col items-center gap-3 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 flex items-center justify-center transition-colors">
                <PlusIcon className="w-6 h-6 text-navy-500 dark:text-navy-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </div>
              <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">New Task</span>
            </button>

            <button
              onClick={() => setPersonalTasks(personalTasks.filter(t => !t.completed))}
              className="card-clinical p-4 flex flex-col items-center gap-3 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 flex items-center justify-center transition-colors">
                <TrashIcon className="w-6 h-6 text-navy-500 dark:text-navy-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </div>
              <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">Clear Completed</span>
            </button>

            <button
              onClick={() => setViewMode('work')}
              className="card-clinical p-4 flex flex-col items-center gap-3 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 flex items-center justify-center transition-colors">
                <BriefcaseIcon className="w-6 h-6 text-navy-500 dark:text-navy-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </div>
              <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">Switch to Work</span>
            </button>
          </div>
        </>
      )}

      {/* MERGE VIEW */}
      {viewMode === 'merge' && (
        <>
          {/* Conflict Alert */}
          {getConflictCount() > 0 ? (
            <div className="card-clinical p-6 border-l-4 border-l-coral-500 bg-gradient-to-r from-coral-50 to-white dark:from-coral-900/20 dark:to-navy-900">
              <div className="flex items-center gap-2 text-coral-600 dark:text-coral-400 mb-2">
                <AlertIcon className="w-4 h-4" />
                <span className="text-sm font-medium font-body uppercase tracking-wide">Schedule Conflicts</span>
              </div>
              <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                {getConflictCount()} conflict{getConflictCount() !== 1 ? 's' : ''} detected
              </h2>
              <p className="text-navy-600 dark:text-navy-400 font-body mt-1">
                Review your schedule below to resolve overlapping commitments
              </p>
            </div>
          ) : (
            <div className="card-clinical p-6 border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50 to-white dark:from-teal-900/20 dark:to-navy-900">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-2">
                <CheckIcon className="w-4 h-4" />
                <span className="text-sm font-medium font-body uppercase tracking-wide">All Clear</span>
              </div>
              <h2 className="font-display text-xl font-bold text-navy-900 dark:text-navy-100">
                No conflicts found
              </h2>
              <p className="text-navy-600 dark:text-navy-400 font-body mt-1">
                Your work and personal schedules are well balanced
              </p>
            </div>
          )}

          {/* Today's Merged Timeline */}
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 dark:border-navy-700">
              <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100">Today - Combined View</h2>
            </div>
            {(() => {
              const today = now.toISOString().split('T')[0];
              const slots = getMergedTimeline(today);

              if (slots.length === 0) {
                return (
                  <div className="p-8 text-center">
                    <p className="text-navy-400 dark:text-navy-500 font-body">Nothing scheduled for today</p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-clinical-100 dark:divide-navy-700">
                  {slots.map((slot, index) => (
                    <div
                      key={`${slot.type}-${slot.id}`}
                      className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                        slot.hasConflict
                          ? 'bg-coral-50 dark:bg-coral-900/20 border-l-4 border-l-coral-500'
                          : slot.type === 'work'
                          ? 'hover:bg-clinical-50 dark:hover:bg-navy-800/50'
                          : slot.type === 'oncall'
                          ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20'
                          : 'hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      }`}
                    >
                      {/* Time */}
                      <div className="w-20 text-right flex-shrink-0">
                        {slot.startTime ? (
                          <p className="font-display font-semibold text-navy-900 dark:text-navy-100">
                            {formatTime(slot.startTime)}
                          </p>
                        ) : (
                          <p className="text-navy-400 dark:text-navy-500 text-sm italic">No time</p>
                        )}
                      </div>

                      {/* Type indicator */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          slot.hasConflict
                            ? 'bg-coral-500 ring-4 ring-coral-200 dark:ring-coral-800'
                            : slot.type === 'work'
                            ? 'bg-teal-500'
                            : slot.type === 'oncall'
                            ? 'bg-amber-500'
                            : 'bg-purple-500'
                        }`} />
                        {index < slots.length - 1 && (
                          <div className="w-0.5 h-12 bg-clinical-200 dark:bg-navy-700 -mb-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-body ${
                            slot.type === 'work'
                              ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300'
                              : slot.type === 'oncall'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                          }`}>
                            {slot.type === 'work' ? 'Work' : slot.type === 'oncall' ? 'On Call' : 'Personal'}
                          </span>
                          {slot.hasConflict && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-coral-100 text-coral-700 dark:bg-coral-900/50 dark:text-coral-300 font-body font-medium">
                              Conflict{slot.conflictsWith ? ` with ${slot.conflictsWith}` : ''}
                            </span>
                          )}
                        </div>
                        <p className="font-display font-medium text-navy-900 dark:text-navy-100 mt-1">
                          {slot.title}
                        </p>
                        {slot.subtitle && (
                          <p className="text-sm text-navy-500 dark:text-navy-400 font-body">
                            {slot.subtitle}
                          </p>
                        )}
                        {slot.startTime && slot.endTime && (
                          <p className="text-xs text-navy-400 dark:text-navy-500 font-body mt-1">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </p>
                        )}
                      </div>

                      {/* Action */}
                      {slot.type === 'work' && slot.patientId && (
                        <Link
                          to={`/patients/${slot.patientId}`}
                          className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      )}
                      {slot.type === 'oncall' && (
                        <PhoneIcon className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Week Merged View */}
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 dark:border-navy-700">
              <h2 className="font-display font-semibold text-navy-900 dark:text-navy-100">This Week - Combined</h2>
            </div>
            <div className="divide-y divide-clinical-100 dark:divide-navy-700">
              {getWeekDates().map(date => {
                const dateStr = date.toISOString().split('T')[0];
                const slots = getMergedTimeline(dateStr);
                const conflictCount = slots.filter(s => s.hasConflict).length / 2;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });

                return (
                  <div
                    key={dateStr}
                    className={`flex items-start gap-4 px-6 py-4 ${
                      conflictCount > 0
                        ? 'bg-coral-50/50 dark:bg-coral-900/10'
                        : isWeekend
                        ? 'bg-clinical-50/50 dark:bg-navy-800/30'
                        : ''
                    }`}
                  >
                    {/* Date */}
                    <div className="w-16 flex-shrink-0 text-center">
                      <p className="text-xs font-body text-navy-400 dark:text-navy-500 uppercase">{dayName}</p>
                      <p className={`font-display text-2xl font-bold ${
                        conflictCount > 0 ? 'text-coral-600' : 'text-navy-900 dark:text-navy-100'
                      }`}>{dayNum}</p>
                      <p className="text-xs font-body text-navy-400 dark:text-navy-500">{monthName}</p>
                      {conflictCount > 0 && (
                        <span className="inline-flex items-center justify-center mt-1 px-2 py-0.5 bg-coral-100 dark:bg-coral-900/50 text-coral-700 dark:text-coral-300 text-xs rounded-full font-body">
                          {conflictCount} clash
                        </span>
                      )}
                    </div>

                    {/* Slots */}
                    <div className="flex-1 min-w-0">
                      {slots.length === 0 ? (
                        <p className="text-navy-400 dark:text-navy-500 font-body text-sm py-2 italic">
                          {isWeekend ? 'Weekend' : 'Nothing scheduled'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {slots.slice(0, 4).map(slot => (
                            <div
                              key={`${slot.type}-${slot.id}`}
                              className={`flex items-center gap-3 py-1 ${slot.hasConflict ? 'text-coral-600 dark:text-coral-400' : ''}`}
                            >
                              <span className="text-sm font-body text-navy-500 dark:text-navy-400 w-16 flex-shrink-0">
                                {slot.startTime ? formatTime(slot.startTime) : '—'}
                              </span>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                slot.hasConflict
                                  ? 'bg-coral-500'
                                  : slot.type === 'work'
                                  ? 'bg-teal-500'
                                  : slot.type === 'oncall'
                                  ? 'bg-amber-500'
                                  : 'bg-purple-500'
                              }`} />
                              <span className={`text-sm font-body truncate ${
                                slot.hasConflict
                                  ? 'text-coral-700 dark:text-coral-300 font-medium'
                                  : 'text-navy-700 dark:text-navy-300'
                              }`}>
                                {slot.title}
                              </span>
                              <span className={`text-xs font-body px-1.5 py-0.5 rounded ${
                                slot.type === 'work'
                                  ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400'
                                  : slot.type === 'oncall'
                                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                                  : 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400'
                              }`}>
                                {slot.type === 'work' ? 'W' : slot.type === 'oncall' ? 'OC' : 'P'}
                              </span>
                            </div>
                          ))}
                          {slots.length > 4 && (
                            <p className="text-xs text-navy-500 dark:text-navy-400 font-body">
                              +{slots.length - 4} more
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Counts */}
                    <div className="flex-shrink-0 flex gap-2">
                      {slots.filter(s => s.type === 'work').length > 0 && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 font-display font-semibold text-xs">
                          {slots.filter(s => s.type === 'work').length}
                        </span>
                      )}
                      {slots.filter(s => s.type === 'oncall').length > 0 && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-display font-semibold text-xs">
                          {slots.filter(s => s.type === 'oncall').length}
                        </span>
                      )}
                      {slots.filter(s => s.type === 'personal').length > 0 && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-display font-semibold text-xs">
                          {slots.filter(s => s.type === 'personal').length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Add Personal with Time */}
          <div className="card-clinical p-4">
            <p className="text-sm font-body text-navy-500 dark:text-navy-400 mb-3">Quick add personal event (with time for conflict detection)</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTask();
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Event title..."
                className="input-clinical w-full"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="input-clinical"
                />
                <input
                  type="time"
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  placeholder="Start"
                  className="input-clinical"
                />
                <input
                  type="time"
                  value={newTaskEndTime}
                  onChange={(e) => setNewTaskEndTime(e.target.value)}
                  placeholder="End"
                  className="input-clinical"
                />
              </div>
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Personal Event
              </button>
            </form>
          </div>
        </>
      )}
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function MergeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
