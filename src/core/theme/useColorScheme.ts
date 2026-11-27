import { useCallback, useEffect, useState } from 'react';

export type ResolvedColorScheme = 'light' | 'dark';
export type StoredColorScheme = 'light' | 'dark' | null;

const STORAGE_KEY = 'color-scheme';

function getSystemScheme(): ResolvedColorScheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredScheme(): StoredColorScheme {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
    return null;
  } catch {
    return null;
  }
}

function applyMetaScheme(stored: StoredColorScheme): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = stored ?? 'light dark';
  }
}

/**
 * Two-state dark/light override backed by `<meta name="color-scheme">` and `localStorage`,
 * following modern-web-guidance `dark-mode-toggle` rules:
 * - Toggling selects the opposite of the currently rendered scheme.
 * - If the target matches current system preference, removes the stored override so system preference resumes.
 * - Never retroactively clears stored overrides when the OS scheme later changes.
 * - Syncs across tabs via the `storage` event.
 */
export function useColorScheme() {
  const [stored, setStored] = useState<StoredColorScheme>(readStoredScheme);
  const [system, setSystem] = useState<ResolvedColorScheme>(getSystemScheme);

  const resolved: ResolvedColorScheme = stored ?? system;

  useEffect(() => {
    applyMetaScheme(stored);
  }, [stored]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;

    const handleSystemChange = (e: MediaQueryListEvent) => {
      setSystem(e.matches ? 'dark' : 'light');
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next = e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : null;
        setStored(next);
        applyMetaScheme(next);
      }
    };

    mq.addEventListener?.('change', handleSystemChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      mq.removeEventListener?.('change', handleSystemChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    const currentSystem = getSystemScheme();
    const currentlyRendered: ResolvedColorScheme = stored ?? currentSystem;
    const target: ResolvedColorScheme = currentlyRendered === 'dark' ? 'light' : 'dark';

    const nextStored: StoredColorScheme = target === currentSystem ? null : target;
    setStored(nextStored);
    applyMetaScheme(nextStored);

    try {
      if (nextStored === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, nextStored);
      }
    } catch {
      // Theme still applies even if storage is unavailable
    }
  }, [stored]);

  return { resolved, stored, toggle };
}
