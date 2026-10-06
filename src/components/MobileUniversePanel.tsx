'use client';

import Link from 'next/link';
import { useId, useState, type CSSProperties } from 'react';
import { getTopic, getWorld, worlds, type World, type WorldId } from '@/data/portfolio';
import styles from './MobileUniversePanel.module.css';

type MobileUniversePanelProps = {
  focus: WorldId | null;
  onFocus: (world: WorldId | null) => void;
  onEnter: (slug: string) => void;
  onOpenAtlas: () => void;
  sceneFailed: boolean;
  entering: boolean;
};

function WorldDetails({ world, onEnter, entering }: {
  world: World;
  onEnter: (slug: string) => void;
  entering: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const topicsId = useId();

  return <section className={styles.details} aria-label={`${world.title} navigation`}>
    <div className={styles.detailsHeading}>
      <div>
        <p className={styles.eyebrow}>In focus</p>
        <h2 style={{ color: world.color }}>{world.title}</h2>
      </div>
      <button
        className={styles.expandButton}
        aria-expanded={expanded}
        aria-controls={topicsId}
        onClick={() => setExpanded((value) => !value)}
        disabled={entering}
      >
        <span>{expanded ? 'Hide topics' : 'Show topics'}</span>
        <span className={styles.chevron} data-expanded={expanded} aria-hidden="true">⌄</span>
      </button>
    </div>
    <div id={topicsId} className={styles.topicBody} hidden={!expanded}>
      <p className={styles.description}>{getTopic(world.slug)?.description}</p>
      <nav className={styles.topics} aria-label={`${world.title} topics`}>
        {world.topics.map((slug, index) => <Link key={slug} href={`/explore/${slug}/`}>
          <span className={styles.topicNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span>{getTopic(slug)?.title}</span>
          <span className={styles.topicArrow} aria-hidden="true">↗</span>
        </Link>)}
      </nav>
    </div>
    <button className={styles.enterButton} onClick={() => onEnter(world.slug)} disabled={entering}>
      Enter {world.title}<span aria-hidden="true">→</span>
    </button>
  </section>;
}

export default function MobileUniversePanel({ focus, onFocus, onEnter, onOpenAtlas, sceneFailed, entering }: MobileUniversePanelProps) {
  const world = focus ? getWorld(focus) : null;

  return <div className={styles.panel} data-universe-controls inert={entering} style={{ '--world-accent': world?.color ?? 'var(--accent)' } as CSSProperties}>
    <nav className={styles.selector} aria-label="Choose a world">
      {worlds.map((item) => <button
        key={item.id}
        className={styles.worldButton}
        aria-pressed={focus === item.id}
        style={{ '--button-accent': item.color } as CSSProperties}
        onClick={() => onFocus(item.id)}
        disabled={entering}
      >{item.title}</button>)}
    </nav>
    {world ? <WorldDetails key={world.id} world={world} onEnter={onEnter} entering={entering}/> : <section className={styles.browsePrompt} aria-label="Explore a world">
      <h2>Choose a world</h2>
      <p>{sceneFailed ? 'Choose a world above, or find every topic in the universe map.' : 'Tap a planet or choose a world above to explore.'}</p>
    </section>}
    <footer className={styles.footer}>
      <button className={styles.mapButton} onClick={onOpenAtlas} disabled={entering}>
        Universe map<span aria-hidden="true">↗</span>
      </button>
      <p>All worlds, topics and constellations</p>
    </footer>
  </div>;
}
