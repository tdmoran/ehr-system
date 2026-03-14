import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  /** Key to listen for (e.g. 'n', 's', ' ') */
  readonly key: string;
  /** Require Ctrl/Cmd modifier */
  readonly ctrl?: boolean;
  /** Handler function */
  readonly handler: () => void;
  /** Whether this shortcut is currently active */
  readonly enabled?: boolean;
}

/**
 * Register keyboard shortcuts. Ignores events from input/textarea/select elements
 * unless the shortcut requires Ctrl/Cmd.
 */
export function useKeyboardShortcuts(shortcuts: readonly ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const ctrlRequired = shortcut.ctrl ?? false;
        const ctrlPressed = e.ctrlKey || e.metaKey;

        if (ctrlRequired && !ctrlPressed) continue;
        if (!ctrlRequired && ctrlPressed) continue;

        // Skip non-ctrl shortcuts when typing in inputs
        if (!ctrlRequired && isInputFocused) continue;

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() || e.key === shortcut.key) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
