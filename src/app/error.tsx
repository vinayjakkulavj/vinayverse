'use client';
import UniverseLink from '@/components/UniverseLink';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main-content" className="message-page"><span className="eyebrow">Signal interrupted</span><h1>Let’s reconnect.</h1><p>This part of the universe couldn’t load.</p><button className="text-button" onClick={reset}>Try again</button><UniverseLink className="text-button" href="/">Return to Orbit</UniverseLink></main>; }
