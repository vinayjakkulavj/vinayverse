'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { site } from '@/data/site';
import { useExperience } from './ExperienceProvider';

function SignalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M8.5 8.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { restartOpening } = useExperience();
  return <header className="site-header">
    <Link href="/" className="brand" aria-label={`${site.author} · Return to Universe`} onClick={restartOpening}>
      <span className="brand-mark" aria-hidden="true">✳</span>
      <span>{site.author}</span>
    </Link>
    <div className="header-right">
      {pathname !== '/' && <Link className="orbit-link" href="/" onClick={restartOpening}>Universe</Link>}
      <nav className="comms" aria-label="Contact Vinay">
        <a className="comms-link signal-link" href={`mailto:${site.email}`} data-gravity title="Email Vinay">
          <SignalIcon/><span>Send Signal<small>Email</small></span>
        </a>
        <a className="comms-link" href={site.linkedin} target="_blank" rel="noopener noreferrer" data-gravity title="Vinay on LinkedIn (opens in a new tab)">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.2"/><circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M9 12h6" stroke="currentColor" strokeWidth="1.2"/></svg>
          <span>Open Comms<small>LinkedIn</small></span>
        </a>
      </nav>

    </div>
  </header>;
}
