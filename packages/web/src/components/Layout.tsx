import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme, isAuto, setIsAuto } = useTheme();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: DashboardIcon },
    { path: '/patients', label: 'Patients', icon: PatientsIcon },
    { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
  ];

  const toggleTheme = () => {
    if (isAuto) {
      setIsAuto(false);
      setTheme(theme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  const enableAutoTheme = () => {
    setIsAuto(true);
  };

  return (
    <div className="min-h-screen bg-clinical-50 dark:bg-navy-950 transition-colors duration-300">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-navy-900 z-50 shadow-clinical-lg safe-area-top">
        <div className="h-full flex items-center justify-between px-4 md:px-6">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-navy-300 hover:bg-white/10 hover:text-white transition-all"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 md:gap-3 group">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-shadow">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg md:text-xl text-white tracking-tight">
                Rooms
              </span>
              <span className="hidden md:block text-xs md:text-sm text-teal-400 font-display font-medium tracking-wide">
                Otolaryngology & Head and Neck EHR
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path ||
                (path !== '/' && location.pathname.startsWith(path));
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-display text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-navy-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Theme Toggle */}
            <div className="relative group">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-navy-300 hover:bg-white/10 hover:text-white transition-all duration-200"
                title={isAuto ? `Auto (${theme})` : theme === 'dark' ? 'Dark mode' : 'Light mode'}
              >
                {theme === 'dark' ? (
                  <MoonIcon className="w-4 h-4" />
                ) : (
                  <SunIcon className="w-4 h-4" />
                )}
                {isAuto && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-teal-500 rounded-full" />
                )}
              </button>
              {!isAuto && (
                <button
                  onClick={enableAutoTheme}
                  className="absolute top-full mt-1 right-0 hidden group-hover:block bg-navy-800 text-navy-300 text-xs px-2 py-1 rounded whitespace-nowrap"
                >
                  Enable auto
                </button>
              )}
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-white font-display font-medium text-sm">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-navy-400 text-xs capitalize">{user?.role}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-navy-300 hover:bg-white/10 hover:text-white transition-all duration-200"
              title="Sign out"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <nav className="fixed top-16 left-0 right-0 bg-navy-800 dark:bg-navy-900 border-b border-navy-700 shadow-lg safe-area-left safe-area-right">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path ||
                (path !== '/' && location.pathname.startsWith(path));
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-6 py-4 font-display text-base font-medium border-b border-navy-700 ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-navy-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              );
            })}
            <div className="px-6 py-4 border-b border-navy-700 sm:hidden">
              <span className="text-white font-display font-medium text-sm">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-navy-400 text-xs capitalize block">{user?.role}</span>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content with Right Sidebar */}
      <div className="pt-16 min-h-screen flex">
        {/* Main Content */}
        <main className="flex-1 safe-area-bottom">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>

        {/* Right Sidebar - Resources, Videos, News & Ads */}
        <aside className="hidden lg:block w-80 xl:w-96 border-l border-clinical-200 dark:border-navy-700 bg-white dark:bg-navy-900">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4 space-y-6">
            {/* RCSI Training Videos */}
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide flex items-center gap-2">
                <VideoIcon className="w-4 h-4 text-teal-500" />
                Training Videos
              </h3>
              <p className="text-xs text-navy-500 dark:text-navy-400 font-body">
                RCSI ENT Remote Training Sessions
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                <VideoLink title="Neck Dissection" url="https://vimeo.com/1012424850/6cf73d3755" />
                <VideoLink title="Endoscopic Ear Surgery" url="https://vimeo.com/1021002624/b9d0af20bd" />
                <VideoLink title="Facial Nerve Palsy & Reanimation" url="https://vimeo.com/1070998239/ec00424d73" />
                <VideoLink title="Paediatric Otitis Media & Mastoiditis" url="https://vimeo.com/1065805536/223e4ac6f4" />
                <VideoLink title="CSF Leakage and Repair" url="https://vimeo.com/1100321147/860c9b7607" />
                <VideoLink title="Tympanoplasty" url="https://vimeo.com/1023230651/83674f0265" />
                <VideoLink title="Adult OSA" url="https://vimeo.com/1128817393/219275d6a1" />
                <VideoLink title="Cholesteatoma Management" url="https://vimeo.com/756418806/9652b023e0" />
                <VideoLink title="Laser Principles & Cordectomy" url="https://vimeo.com/1123518047/b1cdb3cb99" />
                <VideoLink title="FESS Surgery Workshop" url="https://vimeo.com/933660505/2e42d0aec9" />
                <VideoLink title="Septo-Rhinoplasty" url="https://vimeo.com/949927371/d5250b09fb" />
                <VideoLink title="Sinonasal Cancer" url="https://vimeo.com/953558028/66c20666aa" />
                <VideoLink title="Thyroid Nodule Assessment" url="https://vimeo.com/876336179/7e79a709ed" />
                <VideoLink title="Laryngeal Cancer Management" url="https://vimeo.com/793360404/d5f92951ff" />
                <VideoLink title="Pituitary Surgery" url="https://vimeo.com/782897249/fc9fc123e9" />
              </div>
              <a
                href="https://msurgery.ie/home/surgical-training-programmes/higher-surgical-training/higher-surgical-training-otolaryngology-surgery-ent/remote-training-sessions-ent/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-teal-600 dark:text-teal-400 hover:underline font-body py-2"
              >
                View all 100+ videos →
              </a>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                Resources
              </h3>
              <div className="space-y-2">
                <QuickLink label="AAO-HNS Guidelines" url="https://www.entnet.org/quality-practice/quality-products/clinical-practice-guidelines/" />
                <QuickLink label="ICD-10 Lookup" url="https://www.icd10data.com/" />
                <QuickLink label="Drug Interactions" url="https://www.drugs.com/drug_interactions.html" />
              </div>
            </div>

            {/* RSS Feed Section */}
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                Medical News
              </h3>
              <div className="space-y-3">
                <RSSFeedItem
                  title="New ENT Treatment Guidelines Released"
                  source="JAMA Otolaryngology"
                  time="2h ago"
                />
                <RSSFeedItem
                  title="Advances in Cochlear Implant Technology"
                  source="ENT Today"
                  time="4h ago"
                />
                <RSSFeedItem
                  title="Sleep Apnea Screening Recommendations Updated"
                  source="AAO-HNS"
                  time="6h ago"
                />
                <RSSFeedItem
                  title="Pediatric Tonsillectomy Best Practices"
                  source="Otolaryngology News"
                  time="8h ago"
                />
                <RSSFeedItem
                  title="AI in Head and Neck Cancer Detection"
                  source="Medical AI Journal"
                  time="12h ago"
                />
              </div>
              <button className="w-full text-center text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 text-sm font-medium font-body py-2">
                View All News →
              </button>
            </div>

            {/* Advertisement Section */}
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                Sponsored
              </h3>
              <div className="bg-gradient-to-br from-clinical-50 to-clinical-100 dark:from-navy-800 dark:to-navy-800 rounded-xl p-4 border border-clinical-200 dark:border-navy-700">
                <div className="aspect-[4/3] bg-navy-100 dark:bg-navy-700 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-navy-400 dark:text-navy-500 text-sm font-body">Ad Space 300x250</span>
                </div>
                <p className="text-xs text-navy-500 dark:text-navy-400 text-center font-body">Advertisement</p>
              </div>
              <div className="bg-gradient-to-br from-clinical-50 to-clinical-100 dark:from-navy-800 dark:to-navy-800 rounded-xl p-4 border border-clinical-200 dark:border-navy-700">
                <div className="aspect-[2/1] bg-navy-100 dark:bg-navy-700 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-navy-400 dark:text-navy-500 text-sm font-body">Ad Space 300x150</span>
                </div>
                <p className="text-xs text-navy-500 dark:text-navy-400 text-center font-body">Advertisement</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RSSFeedItem({ title, source, time }: { title: string; source: string; time: string }) {
  return (
    <a href="#" className="block p-3 rounded-lg hover:bg-clinical-50 dark:hover:bg-navy-800 transition-colors group">
      <p className="font-body text-sm text-navy-900 dark:text-navy-100 font-medium group-hover:text-teal-600 dark:group-hover:text-teal-400 line-clamp-2">
        {title}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-navy-500 dark:text-navy-400 font-body">{source}</span>
        <span className="text-navy-300 dark:text-navy-600">•</span>
        <span className="text-xs text-navy-400 dark:text-navy-500 font-body">{time}</span>
      </div>
    </a>
  );
}

function QuickLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-body text-navy-600 dark:text-navy-300 hover:bg-clinical-50 dark:hover:bg-navy-800 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
      {label}
    </a>
  );
}

function VideoLink({ title, url }: { title: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-body text-navy-600 dark:text-navy-300 hover:bg-clinical-50 dark:hover:bg-navy-800 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
    >
      <svg className="w-3 h-3 flex-shrink-0 text-coral-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
      <span className="truncate">{title}</span>
    </a>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function PatientsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
