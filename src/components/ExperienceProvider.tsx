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
    const resetRestoredVisit = (event: PageTransitionEvent) => {
      if (event.persisted) setEntered(false);
    };
    window.addEventListener('pageshow', resetRestoredVisit);
    try {
      const stored = JSON.parse(localStorage.getItem('douknowme-discovered') || '[]');
      if (Array.isArray(stored)) setVisited(stored.filter((value) => typeof value === 'string'));
    } catch { /* Storage is optional. */ }
    setReady(true);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('pageshow', resetRestoredVisit);
    };
  }, []);

  const enter = useCallback(() => setEntered(true), []);
  const restartOpening = useCallback(() => setEntered(false), []);

  const markVisited = useCallback((slug: string) => {
    setVisited((previous) => {
      if (previous.includes(slug)) return previous;
      const next = [...previous, slug];
      try { localStorage.setItem('douknowme-discovered', JSON.stringify(next)); } catch { /* Optional storage. */ }
      return next;
    });
  }, []);

  return <Context.Provider value={{
    reducedMotion: systemReduced, visited, entered, ready, enter, restartOpening, markVisited,
  }}>{children}</Context.Provider>;
}

export function useExperience() {
  const context = useContext(Context);
  if (!context) throw new Error('ExperienceProvider is required');
  return context;
}
