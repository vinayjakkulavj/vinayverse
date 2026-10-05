import UniverseExperience from '@/components/UniverseExperience';
import { Suspense } from 'react';
import Link from 'next/link';
import { topics, worlds } from '@/data/portfolio';

function UniverseFallback() {
  return <main id="main-content" className="universe-shell">
    <div className="universe-heading"><h1 className="eyebrow">Welcome to my universe</h1><p>Engineer. Builder. Curious human.</p></div>
    <div className="scene-loading" role="status"><span>Finding your orbit</span></div>
    <nav className="universe-toolbar" aria-label="Explore a world">{worlds.map(world=><Link key={world.id} href={`/explore/${world.slug}/`}>{world.title}</Link>)}</nav>
    <div className="universe-footer"><p className="universe-instruction">Explore a world or open the universe map.</p><details className="fallback-map"><summary>Universe map</summary><nav aria-label="Every destination">{topics.map(topic=><Link key={topic.slug} href={`/explore/${topic.slug}/`}>{topic.title}</Link>)}</nav></details></div>
  </main>;
}

export default function Home() { return <Suspense fallback={<UniverseFallback/>}><UniverseExperience/></Suspense>; }
