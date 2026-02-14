import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
  children: ReactNode;
}

// Sponsor logos displayed as styled brand marks
const SPONSORS = [
  { name: 'Ambu', display: 'ambu', style: 'lowercase', bgColor: '#003366', textColor: '#fff' },
  { name: 'CCMed', display: 'CC Med', style: 'normal', bgColor: '#0d9488', textColor: '#fff' },
  { name: 'Eurosurgical', display: 'ES', style: 'bold', bgColor: '#6d28d9', textColor: '#fff' },
  { name: 'Fannin', display: 'fannin', style: 'lowercase', bgColor: '#059669', textColor: '#fff' },
  { name: 'Irish Hospital Supplies', display: 'IHS', style: 'bold', bgColor: '#0284c7', textColor: '#fff' },
  { name: 'NBCL', display: 'nbcl', style: 'lowercase', bgColor: '#dc2626', textColor: '#fff' },
  { name: 'NeilMed', display: 'NeilMed', style: 'normal', bgColor: '#1e40af', textColor: '#fff' },
  { name: 'Nutricia', display: 'nutricia', style: 'lowercase', bgColor: '#0891b2', textColor: '#fff' },
  { name: 'Sentient Healthcare', display: 'SH', style: 'bold', bgColor: '#7c3aed', textColor: '#fff' },
  { name: 'Severn', display: 'SEVERN', style: 'uppercase', bgColor: '#4f46e5', textColor: '#fff' },
  { name: 'Terumo', display: 'TERUMO', style: 'uppercase', bgColor: '#be123c', textColor: '#fff' },
  { name: 'Thor Medical', display: 'THOR', style: 'uppercase', bgColor: '#b45309', textColor: '#fff' },
  { name: 'Baxter', display: 'Baxter', style: 'normal', bgColor: '#1d4ed8', textColor: '#fff' },
  { name: 'Gemini', display: 'GEMINI', style: 'uppercase', bgColor: '#0d9488', textColor: '#fff' },
  { name: 'HC21 Healthcare', display: 'HC21', style: 'bold', bgColor: '#16a34a', textColor: '#fff' },
  { name: 'Soluvos Medical', display: 'Soluvos', style: 'normal', bgColor: '#65a30d', textColor: '#fff' },
  { name: 'Tekno Surgical', display: 'TEKNO', style: 'uppercase', bgColor: '#c2410c', textColor: '#fff' },
  { name: 'Viatris', display: 'VIATRIS', style: 'uppercase', bgColor: '#047857', textColor: '#fff' },
  { name: 'Ethicon', display: 'ETHICON', style: 'uppercase', bgColor: '#1e40af', textColor: '#fff' },
  { name: 'Bicara Therapeutics', display: 'BICARA', style: 'uppercase', bgColor: '#a21caf', textColor: '#fff' },
  { name: 'DP Medical', display: 'DP', style: 'bold', bgColor: '#0284c7', textColor: '#fff' },
  { name: 'RCSI', display: 'RCSI', style: 'uppercase', bgColor: '#991b1b', textColor: '#fff' },
  { name: 'Diploma Life Sciences', display: 'DLS', style: 'bold', bgColor: '#7e22ce', textColor: '#fff' },
  { name: 'A. Menarini', display: 'Menarini', style: 'normal', bgColor: '#1d4ed8', textColor: '#fff' },
];

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { theme, setTheme, isAuto, setIsAuto } = useTheme();
  const [sponsorIndex, setSponsorIndex] = useState(0);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Cycle through sponsors every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setSponsorIndex((prev) => (prev + 2) % SPONSORS.length);
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  const baseNavItems = [
    { path: '/', label: 'Dashboard', icon: DashboardIcon },
    { path: '/patients', label: 'Patients', icon: PatientsIcon },
    { path: '/documents', label: 'Documents', icon: DocumentsIcon },
    { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
  ];

  // Add Schedule link for secretaries (after Dashboard)
  const navItems = user?.role === 'secretary'
    ? [
        { path: '/', label: 'Dashboard', icon: DashboardIcon },
        { path: '/schedule', label: 'Schedule', icon: ScheduleIcon },
        { path: '/patients', label: 'Patients', icon: PatientsIcon },
        { path: '/documents', label: 'Documents', icon: DocumentsIcon },
        { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
      ]
    : baseNavItems;

  // Bottom nav: show primary items + More drawer for the rest
  const bottomNavItems = user?.role === 'secretary'
    ? [
        { path: '/', label: 'Home', icon: DashboardIcon },
        { path: '/schedule', label: 'Schedule', icon: ScheduleIcon },
        { path: '/patients', label: 'Patients', icon: PatientsIcon },
        { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
      ]
    : [
        { path: '/', label: 'Home', icon: DashboardIcon },
        { path: '/patients', label: 'Patients', icon: PatientsIcon },
        { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
        { path: '/documents', label: 'Docs', icon: DocumentsIcon },
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
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg focus:font-medium focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-navy-900 z-50 shadow-clinical-lg safe-area-top" role="banner">
        <div className="h-full flex items-center justify-between px-4 md:px-6">
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
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
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
                aria-label={isAuto ? `Auto theme (currently ${theme})` : `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
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
              aria-label="Sign out"
              title="Sign out"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-navy-900 border-t border-clinical-200 dark:border-navy-700 safe-area-bottom">
        <div className="flex items-stretch">
          {bottomNavItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path ||
              (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  isActive
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-navy-400 dark:text-navy-500 active:text-navy-600 dark:active:text-navy-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium font-display">{label}</span>
              </Link>
            );
          })}
          {/* More / Resources button */}
          {user?.role !== 'secretary' && (
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                mobileDrawerOpen
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-navy-400 dark:text-navy-500 active:text-navy-600 dark:active:text-navy-300'
              }`}
            >
              <MoreIcon className="w-5 h-5" />
              <span className="text-[10px] font-medium font-display">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Resources Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Resources">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileDrawerOpen(false)} aria-hidden="true" />
          <div className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-navy-900 shadow-xl overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-white dark:bg-navy-900 border-b border-clinical-200 dark:border-navy-700 px-4 py-4 flex items-center justify-between z-10">
              <h2 className="font-display font-bold text-navy-900 dark:text-navy-100">Resources</h2>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-clinical-100 dark:hover:bg-navy-800 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Extra nav links not in bottom bar */}
              {user?.role === 'secretary' && (
                <div className="space-y-2">
                  <Link
                    to="/documents"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-display font-medium text-navy-700 dark:text-navy-200 hover:bg-clinical-50 dark:hover:bg-navy-800 transition-colors"
                  >
                    <DocumentsIcon className="w-5 h-5" />
                    Documents
                  </Link>
                </div>
              )}

              {/* Training Videos */}
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide flex items-center gap-2">
                  <VideoIcon className="w-4 h-4 text-teal-500" />
                  Training Videos
                </h3>
                <div className="space-y-1">
                  <VideoLink title="Neck Dissection" url="https://vimeo.com/1012424850/6cf73d3755" />
                  <VideoLink title="Endoscopic Ear Surgery" url="https://vimeo.com/1021002624/b9d0af20bd" />
                  <VideoLink title="Facial Nerve Palsy & Reanimation" url="https://vimeo.com/1070998239/ec00424d73" />
                </div>
                <a
                  href="https://msurgery.ie/home/surgical-training-programmes/higher-surgical-training/higher-surgical-training-otolaryngology-surgery-ent/remote-training-sessions-ent/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-teal-600 dark:text-teal-400 hover:underline font-body py-2"
                >
                  View all 100+ videos
                </a>
              </div>

              {/* Quick Links */}
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                  Resources
                </h3>
                <div className="space-y-1">
                  <QuickLink label="Cancer Staging App" url="https://tdmoran.github.io/CancerStageApp/" />
                  <QuickLink label="AAO-HNS Guidelines" url="https://www.entnet.org/quality-practice/quality-products/clinical-practice-guidelines/" />
                  <QuickLink label="ICD-10 Lookup" url="https://www.icd10data.com/" />
                  <QuickLink label="Drug Interactions" url="https://www.drugs.com/drug_interactions.html" />
                </div>
              </div>

              {/* Medical News */}
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                  Medical News
                </h3>
                <div className="space-y-2">
                  <RSSFeedItem title="New ENT Treatment Guidelines Released" source="JAMA Otolaryngology" time="2h ago" />
                  <RSSFeedItem title="Advances in Cochlear Implant Technology" source="ENT Today" time="4h ago" />
                  <RSSFeedItem title="Sleep Apnea Screening Recommendations Updated" source="AAO-HNS" time="6h ago" />
                </div>
              </div>

              {/* Sponsors */}
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                  Sponsors
                </h3>
                {[0, 1].map((offset) => {
                  const sponsor = SPONSORS[(sponsorIndex + offset) % SPONSORS.length];
                  const getFontStyle = () => {
                    switch (sponsor.style) {
                      case 'uppercase': return 'uppercase tracking-wider';
                      case 'lowercase': return 'lowercase';
                      case 'bold': return 'font-black tracking-tight';
                      default: return '';
                    }
                  };
                  const fontSize = sponsor.display.length > 6 ? 'text-[9px]' : sponsor.display.length > 4 ? 'text-[10px]' : 'text-xs';
                  return (
                    <a
                      key={`drawer-${sponsor.name}-${offset}`}
                      href="#"
                      className="block bg-white dark:bg-navy-800 rounded-xl p-3 border border-clinical-200 dark:border-navy-700"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: sponsor.bgColor }}
                        >
                          <span
                            className={`font-display font-bold ${fontSize} ${getFontStyle()}`}
                            style={{ color: sponsor.textColor }}
                          >
                            {sponsor.display}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm truncate">{sponsor.name}</h4>
                          <p className="text-xs text-navy-500 dark:text-navy-400">Sponsored</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content with Right Sidebar */}
      <div className="pt-16 pb-16 md:pb-0 min-h-screen flex">
        {/* Main Content */}
        <main id="main-content" className="flex-1" role="main">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>

        {/* Right Sidebar - Resources, Videos, News & Ads (hidden for secretaries) */}
        {user?.role !== 'secretary' && (
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
              <div className="space-y-1">
                <VideoLink title="Neck Dissection" url="https://vimeo.com/1012424850/6cf73d3755" />
                <VideoLink title="Endoscopic Ear Surgery" url="https://vimeo.com/1021002624/b9d0af20bd" />
                <VideoLink title="Facial Nerve Palsy & Reanimation" url="https://vimeo.com/1070998239/ec00424d73" />
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

            {/* Cycling Sponsor Ads */}
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                Sponsors
              </h3>
              {[0, 1].map((offset) => {
                const sponsor = SPONSORS[(sponsorIndex + offset) % SPONSORS.length];
                const getFontStyle = () => {
                  switch (sponsor.style) {
                    case 'uppercase': return 'uppercase tracking-wider';
                    case 'lowercase': return 'lowercase';
                    case 'bold': return 'font-black tracking-tight';
                    default: return '';
                  }
                };
                const fontSize = sponsor.display.length > 6 ? 'text-[9px]' : sponsor.display.length > 4 ? 'text-[10px]' : 'text-xs';
                return (
                  <a
                    key={`${sponsor.name}-${offset}`}
                    href="#"
                    className="block bg-white dark:bg-navy-800 rounded-xl p-4 border border-clinical-200 dark:border-navy-700 hover:shadow-md transition-all duration-500 hover:border-clinical-300 dark:hover:border-navy-600"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: sponsor.bgColor }}
                      >
                        <span
                          className={`font-display font-bold ${fontSize} ${getFontStyle()}`}
                          style={{ color: sponsor.textColor }}
                        >
                          {sponsor.display}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm truncate">{sponsor.name}</h4>
                        <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">Sponsored</p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 text-sm uppercase tracking-wide">
                Resources
              </h3>
              <div className="space-y-2">
                <QuickLink label="Cancer Staging App" url="https://tdmoran.github.io/CancerStageApp/" />
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
        )}
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

function ScheduleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function DocumentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
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

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}
