import { Link } from 'react-router-dom';

export default function QuickActions() {
  return (
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
        <span className="font-body text-sm text-navy-700 dark:text-navy-300 text-center">Note Task</span>
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
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
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
