import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';

interface TranscriptionLayoutProps {
  readonly children: ReactNode;
}

const NAV_TABS = [
  { path: '/transcriptions', label: 'Sessions', exact: true },
  { path: '/transcriptions/new', label: 'New Recording', exact: true },
] as const;

export default function TranscriptionLayout({ children }: TranscriptionLayoutProps) {
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white font-display">
            AI Transcriptions
          </h1>
          <p className="text-sm text-navy-500 dark:text-navy-400 font-body mt-1">
            Record visits, generate clinical notes with AITranscription AI
          </p>
        </div>
        {/* Keyboard shortcuts — hidden on mobile/touch devices */}
        {!isMobile && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-navy-400 dark:text-navy-500 font-body">
            <kbd className="px-1.5 py-0.5 bg-clinical-100 dark:bg-navy-800 border border-clinical-200 dark:border-navy-700 rounded text-[10px] font-mono">
              Ctrl+N
            </kbd>
            <span>New session</span>
            <span className="mx-1">|</span>
            <kbd className="px-1.5 py-0.5 bg-clinical-100 dark:bg-navy-800 border border-clinical-200 dark:border-navy-700 rounded text-[10px] font-mono">
              Ctrl+S
            </kbd>
            <span>Save</span>
            <span className="mx-1">|</span>
            <kbd className="px-1.5 py-0.5 bg-clinical-100 dark:bg-navy-800 border border-clinical-200 dark:border-navy-700 rounded text-[10px] font-mono">
              Space
            </kbd>
            <span>Pause/Resume</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 border-b border-clinical-200 dark:border-navy-700" aria-label="Transcription tabs">
        {NAV_TABS.map(({ path, label, exact }) => {
          const isActive = exact
            ? location.pathname === path
            : location.pathname.startsWith(path);

          return (
            <Link
              key={path}
              to={path}
              className={`px-4 py-3 text-sm font-medium font-display border-b-2 transition-colors ${
                isActive
                  ? 'border-teal-500 text-teal-700 dark:text-teal-400'
                  : 'border-transparent text-navy-500 dark:text-navy-400 hover:text-navy-700 dark:hover:text-navy-300 hover:border-clinical-300 dark:hover:border-navy-600'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
