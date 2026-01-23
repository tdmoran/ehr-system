import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isAuto: boolean;
  setIsAuto: (auto: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// Calculate sunrise and sunset times based on date and approximate latitude
function getSunTimes(date: Date, latitude: number): { sunrise: Date; sunset: Date } {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Approximate calculation using simplified formula
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
  const latRad = latitude * (Math.PI / 180);
  const declRad = declination * (Math.PI / 180);

  // Hour angle for sunrise/sunset
  const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declRad)) * (180 / Math.PI);

  // Convert to hours from solar noon (approximately 12:00)
  const sunriseHour = 12 - hourAngle / 15;
  const sunsetHour = 12 + hourAngle / 15;

  const sunrise = new Date(date);
  sunrise.setHours(Math.floor(sunriseHour), (sunriseHour % 1) * 60, 0, 0);

  const sunset = new Date(date);
  sunset.setHours(Math.floor(sunsetHour), (sunsetHour % 1) * 60, 0, 0);

  return { sunrise, sunset };
}

// Get approximate latitude from timezone
function getApproximateLatitude(): number {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Approximate latitudes for common timezone regions
  const timezoneLatitudes: Record<string, number> = {
    'America/New_York': 40.7,
    'America/Chicago': 41.9,
    'America/Denver': 39.7,
    'America/Los_Angeles': 34.0,
    'America/Phoenix': 33.4,
    'Europe/London': 51.5,
    'Europe/Paris': 48.9,
    'Europe/Berlin': 52.5,
    'Asia/Tokyo': 35.7,
    'Asia/Shanghai': 31.2,
    'Australia/Sydney': -33.9,
  };

  // Default to 40° latitude (approximate US average)
  return timezoneLatitudes[timezone] || 40;
}

function shouldBeDark(): boolean {
  const now = new Date();
  const latitude = getApproximateLatitude();
  const { sunrise, sunset } = getSunTimes(now, latitude);

  // It's dark if before sunrise or after sunset
  return now < sunrise || now > sunset;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return shouldBeDark() ? 'dark' : 'light';
  });

  const [isAuto, setIsAuto] = useState(() => {
    return localStorage.getItem('themeAuto') !== 'false';
  });

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save auto preference
  useEffect(() => {
    localStorage.setItem('themeAuto', String(isAuto));
  }, [isAuto]);

  // Auto-update theme based on time
  useEffect(() => {
    if (!isAuto) return;

    const checkTime = () => {
      const newTheme = shouldBeDark() ? 'dark' : 'light';
      setTheme(newTheme);
    };

    // Check immediately
    checkTime();

    // Check every minute
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [isAuto]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isAuto, setIsAuto }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
