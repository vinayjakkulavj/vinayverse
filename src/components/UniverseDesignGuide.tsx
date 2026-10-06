'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './UniverseDesignGuide.module.css';

const references = {
  bigBang: 'https://science.nasa.gov/mission/webb/big-bang-q-and-a/',
  orbits: 'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/',
  eclipses: 'https://science.nasa.gov/eclipses/geometry/',
};

function Reference({ href, children }: { href: string; children: string }) {
  return <a className={styles.reference} href={href} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens in a new tab)</span></a>;
}

function UniverseDiagram() {
  const id = useId();
  return <svg className={styles.diagram} viewBox="0 0 680 172" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-sun`}><stop stopColor="#eea377"/><stop offset=".45" stopColor="#c55e44"/><stop offset="1" stopColor="#52291f"/></radialGradient>
      <linearGradient id={`${id}-flow`} x1="0" y1="60" x2="240" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#c2aeed" stopOpacity="0"/><stop offset=".45" stopColor="#a592de" stopOpacity=".7"/><stop offset="1" stopColor="#f1a078" stopOpacity=".85"/></linearGradient>
      <linearGradient id={`${id}-shadow`} x1="404" y1="89" x2="520" y2="89" gradientUnits="userSpaceOnUse"><stop stopColor="#354050" stopOpacity=".15"/><stop offset="1" stopColor="#182230" stopOpacity=".9"/></linearGradient>
    </defs>
    <g stroke={`url(#${id}-flow)`} strokeWidth="1.2">
      <path d="M0 26C75 5 80 147 145 76S220 51 280 85"/>
      <path d="M0 66C69 9 112 153 171 95S222 65 280 85"/>
      <path d="M0 112C78 171 92 21 158 89S222 114 280 85"/>
      <path d="M0 150C53 117 108 162 143 120S222 97 280 85"/>
    </g>
    <g fill="#c5b5ec"><circle cx="69" cy="67" r="2"/><circle cx="122" cy="112" r="1.5"/><circle cx="160" cy="84" r="2.5"/></g>
    <ellipse cx="310" cy="87" rx="87" ry="45" stroke="#7d91ad" strokeOpacity=".24" transform="rotate(-12 310 87)"/>
    <ellipse cx="310" cy="87" rx="128" ry="65" stroke="#7d91ad" strokeOpacity=".2" transform="rotate(-12 310 87)"/>
    <ellipse cx="310" cy="87" rx="167" ry="77" stroke="#7d91ad" strokeOpacity=".14" transform="rotate(-12 310 87)"/>
    <circle cx="310" cy="87" r="24" fill={`url(#${id}-sun)`}/>
    <circle cx="253" cy="130" r="11" fill="#80afd1"/><circle cx="299" cy="24" r="12" fill="#b4a4d9"/>
    <path d="M401 79L510 69L510 106L401 95Z" fill={`url(#${id}-shadow)`}/>
    <path d="M334 87H550" stroke="#dea374" strokeOpacity=".35" strokeDasharray="3 5"/>
    <circle cx="400" cy="87" r="12" fill="#8bcab4"/>
    <circle cx="516" cy="87" r="16" fill="#172931" stroke="#6c928b" strokeOpacity=".42"/>
    <g fill="#bdcadb" fillOpacity=".55"><circle cx="574" cy="39" r="1.2"/><circle cx="615" cy="123" r="1"/><circle cx="643" cy="64" r="1.6"/><circle cx="225" cy="20" r="1"/><circle cx="552" cy="145" r="1.3"/></g>
  </svg>;
}

export default function UniverseDesignGuide({ onClose, onPreviewEclipse }: { onClose: () => void; onPreviewEclipse?: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
      .filter((item) => item.getClientRects().length > 0 && !item.closest('[hidden], [inert]'));
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); panel.current?.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const retainFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) closeButton.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('focusin', retainFocus);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('focusin', retainFocus);
      document.body.style.overflow = oldOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  return <div className={styles.backdrop} onClick={(event) => { if (event.currentTarget === event.target) close.current(); }}>
    <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Behind the universe</p><h2 id={titleId}>Design insights</h2></div>
        <button ref={closeButton} className={styles.close} aria-label="Close design insights" onClick={() => close.current()}>×</button>
      </header>
      <div className={styles.body}>
        <p id={descriptionId} className={styles.introduction}>An invitation to explore, with a little astronomy woven into every movement.</p>
        <div className={styles.visual}><UniverseDiagram/><p>Energy <span aria-hidden="true">→</span> worlds <span aria-hidden="true">→</span> discovery</p></div>
        <div className={styles.sections}>
          <section className={styles.section}>
            <p className={styles.number}>01 <span>The idea</span></p><h3>One identity. Three worlds.</h3>
            <p>The rust-red sun anchors Vinayverse. Three distinct planets organize work, personality, and projects: Professional, Know Me, and Project Pandora. Their colors keep each world recognizable as it moves.</p>
            <p>Moons lead to smaller topics. Constellations invite you to find connections beyond the main planets. The universe becomes a map you can explore.</p>
          </section>
          <section className={styles.section}>
            <p className={styles.number}>02 <span>The opening</span></p><h3>Energy finding form.</h3>
            <p>A small drag reveals colorful strings. Release them and particles expand, rebound, mingle, and gather into the worlds. Their shared rhythm carries the scene from restless energy to a readable solar system.</p>
            <div className={styles.spaceNote}><p><strong>In space</strong>The Big Bang describes an expanding universe that began hot and dense. It happened throughout space. The strings and collisions here are a visual metaphor; this sequence compresses cosmic history into a few seconds.</p><Reference href={references.bigBang}>NASA: Understanding the Big Bang</Reference></div>
          </section>
          <section className={styles.section}>
            <p className={styles.number}>03 <span>The rhythm</span></p><h3>Every world has its own orbit.</h3>
            <p>Each planet follows a calculated path around the central sun, with its own radius and pace. A clear triangular opening gives you time to recognize the worlds before they continue their journey.</p>
            <div className={styles.spaceNote}><p><strong>In space</strong>Planetary orbits are ellipses. Planets move faster nearer the Sun and slower farther away. Vinayverse uses steady motion and simplified spacing so the navigation stays easy to follow.</p><Reference href={references.orbits}>NASA: Orbits and Kepler’s laws</Reference></div>
          </section>
          <section className={styles.section}>
            <p className={styles.number}>04 <span>The alignment</span></p><h3>Watch the light change.</h3>
            <p>When a planet crosses between the sun and another world, the world behind it gradually darkens. As the alignment passes, its color and light return. The change follows the planets’ positions.</p>
            {onPreviewEclipse && <div className={styles.preview}><button className={styles.previewButton} onClick={onPreviewEclipse}>Watch an eclipse<span aria-hidden="true">↗</span></button><p>Bring the worlds into alignment, then watch them continue their orbits.</p></div>}
            <div className={styles.spaceNote}><p><strong>In space</strong>An eclipse happens when one body blocks light and casts a shadow on another. Real eclipse shadows cover specific areas; the broader dimming here makes the alignment visible at this scale.</p><Reference href={references.eclipses}>NASA: Why eclipses happen</Reference></div>
          </section>
          <section className={styles.section}>
            <p className={styles.number}>05 <span>The perspective</span></p><h3>A universe with depth.</h3>
            <p>Drag the scene to turn the system and reveal a different view of its tilted orbital plane. Surface rotation gives the sun and planets their own sense of time. Entering a world moves you toward its atmosphere before its story opens.</p>
            <p>Size, distance, texture, and color are chosen for this imagined universe. Its layout brings the destinations within reach.</p>
          </section>
          <section className={styles.section}>
            <p className={styles.number}>06 <span>The passing moments</span></p><h3>The sky keeps moving.</h3>
            <p>Distant stars and constellations make space feel wider than the solar system. Passing comets and meteoroids add brief motion; occasional impacts create a small flash, then the scene settles again.</p>
            <p>These events are timed for atmosphere. Their frequency, trajectories, and scale are artistic choices.</p>
          </section>
          <section className={`${styles.section} ${styles.lastSection}`}>
            <p className={styles.number}>07 <span>The experience</span></p><h3>Explore at your own pace.</h3>
            <p>On a phone, the system fits into a compact space you can still rotate. The world selector lets you change destinations while details are open. The Universe map offers a direct route, and your device’s reduced-motion preference makes the experience calmer.</p>
          </section>
        </div>
        <p className={styles.closing}>Curiosity is the way in. Exploration is the point.</p>
      </div>
    </div>
  </div>;
}
