import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

function queryMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}

/**
 * Returns true when the viewport width is below the mobile breakpoint (768px).
 * Also detects coarse pointer (touch) devices regardless of viewport width.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth < MOBILE_BREAKPOINT ||
      queryMatches('(pointer: coarse)')
    );
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const pointerQuery = window.matchMedia('(pointer: coarse)');

    const update = () => {
      setIsMobile(mediaQuery.matches || pointerQuery.matches);
    };

    mediaQuery.addEventListener('change', update);
    pointerQuery.addEventListener('change', update);

    return () => {
      mediaQuery.removeEventListener('change', update);
      pointerQuery.removeEventListener('change', update);
    };
  }, []);

  return isMobile;
}
