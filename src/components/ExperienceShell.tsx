'use client';

import { useEffect, type ReactNode } from 'react';
import { ExperienceProvider, useExperience } from './ExperienceProvider';
import SiteHeader from './SiteHeader';
import StarshipCursor from './StarshipCursor';
import { usePathname } from 'next/navigation';

function Shell({ children }: { children: ReactNode }) {
  const { reducedMotion, entered, restartOpening } = useExperience();
  const pathname = usePathname();
  useEffect(() => { document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'; }, [reducedMotion]);
  useEffect(() => { if (pathname === '/') restartOpening(); }, [pathname, restartOpening]);
  return <><a className="skip-link" href={pathname === '/' && !entered ? '#enter-universe' : '#main-content'}>Skip to content</a><SiteHeader/>{children}<StarshipCursor reducedMotion={reducedMotion}/></>;
}

export default function ExperienceShell({ children }: { children: ReactNode }) {
  return <ExperienceProvider><Shell>{children}</Shell></ExperienceProvider>;
}
