'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useExperience } from './ExperienceProvider';

type UniverseLinkProps = Omit<ComponentProps<typeof Link>, 'onNavigate'>;

export default function UniverseLink({ children, ...props }: UniverseLinkProps) {
  const { enter } = useExperience();
  // onNavigate only runs for navigation in this tab, leaving modified clicks alone.
  return <Link {...props} onNavigate={enter}>{children}</Link>;
}
