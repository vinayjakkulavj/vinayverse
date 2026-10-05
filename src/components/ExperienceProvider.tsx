'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

type Experience = {
  reducedMotion: boolean;
  visited: string[];
  entered: boolean;
  ready: boolean;
  enter: () => void;
  restartOpening: () => void;
  markVisited: (slug: string) => void;
};

const Context = createContext<Experience | null>(null);

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [systemReduced, setSystemReduced] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches);
    update();
    query.addEventListener('change', update);
    try {
      const stored = JSON.parse(localStorage.getItem('douknowme-discovered') || '[]');
      if (Array.isArray(stored)) setVisited(stored.filter((value) => typeof value === 'string'));
      setEntered(sessionStorage.getItem('douknowme-entered') === 'yes' && new URLSearchParams(window.location.search).get('intro') !== '1');
    } catch { /* Storage is optional. */ }
    setReady(true);
    return () => query.removeEventListener('change', update);
  }, []);

  const enter = useCallback(() => {
    setEntered(true);
    try { sessionStorage.setItem('douknowme-entered', 'yes'); } catch { /* Optional session storage. */ }
  }, []);
  const restartOpening = useCallback(() => setEntered(false), []);

  const markVisited = useCallback((slug: string) => {
    enter();
    setVisited((previous) => {
      if (previous.includes(slug)) return previous;
      const next = [...previous, slug];
      try { localStorage.setItem('douknowme-discovered', JSON.stringify(next)); } catch { /* Optional storage. */ }
      return next;
    });
  }, [enter]);

  return <Context.Provider value={{
    reducedMotion: systemReduced, visited, entered, ready, enter, restartOpening, markVisited,
  }}>{children}</Context.Provider>;
}

export function useExperience() {
  const context = useContext(Context);
  if (!context) throw new Error('ExperienceProvider is required');
  return context;
}
