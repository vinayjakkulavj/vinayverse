'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { gsap } from 'gsap';
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { worlds, topics, getWorld, getTopic, type WorldId } from '@/data/portfolio';
import { useExperience } from './ExperienceProvider';
import EntryGate from './EntryGate';
import MobileUniversePanel from './MobileUniversePanel';
import PlanetFlight from './PlanetFlight';

const UniverseScene = dynamic(() => import('./UniverseScene'), { ssr: false, loading: () => <div className="scene-loading"><span>Finding your orbit</span></div> });

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? <div className="scene-loading"><span>Explore with the universe map</span></div> : this.props.children; }
}

function UniverseAtlas({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = panel.current?.querySelectorAll<HTMLElement>('a[href], button');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = oldOverflow; previouslyFocused.current?.focus(); };
  }, [onClose]);

  return <div className="atlas-backdrop" onClick={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <div className="atlas" ref={panel} role="dialog" aria-modal="true" aria-labelledby="atlas-title">
      <div className="atlas-top"><div><span className="eyebrow">Every orbit, at a glance</span><h2 id="atlas-title">A map of my universe.</h2></div><button className="atlas-close" aria-label="Close universe map" onClick={onClose}>×</button></div>
      <div className="atlas-worlds">{worlds.map((world) => <section key={world.id}><h3 style={{ color: world.color }}><Link href={`/explore/${world.slug}/`}>{world.title}</Link></h3>{world.topics.map((slug) => <Link key={slug} href={`/explore/${slug}/`}>{getTopic(slug)?.title}</Link>)}</section>)}</div>
      <div className="atlas-hidden"><p>Constellations to discover</p><div className="atlas-hidden-links">{topics.filter((topic) => topic.kind === 'constellation').map((topic) => <Link key={topic.slug} href={`/explore/${topic.slug}/`}>{topic.title}</Link>)}</div></div>
    </div>
  </div>;
}

export default function UniverseExperience() {
  const { entered, ready, enter, restartOpening, reducedMotion, visited, markVisited } = useExperience();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryWorld = searchParams.get('world');
  const replayIntro = searchParams.get('intro') === '1';
  const [focus, setFocus] = useState<WorldId | null>(() => queryWorld && worlds.some((world) => world.id === queryWorld) ? queryWorld as WorldId : null);
  const lastQueryWorld = useRef(queryWorld);
  const [atlas, setAtlas] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [formationId, setFormationId] = useState(0);
  const [forming, setForming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [small, setSmall] = useState(false);
  const [stageNode, setStageNode] = useState<HTMLDivElement | null>(null);
  const labelPortal = useMemo(() => stageNode ? { current: stageNode } : null, [stageNode]);
  const rotation = useRef({ x: -0.19, y: -0.12 });
  const inertia = useRef({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; distance: number; moved: boolean; capture: HTMLCanvasElement } | null>(null);
  const suppressClick = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const main = useRef<HTMLElement>(null);
  const sunLabel = useRef<HTMLDivElement>(null);
  const transitionLock = useRef(false);
  const mapButton = useRef<HTMLButtonElement>(null);
  const flightProgress = useRef(0);
  const flightTween = useRef<gsap.core.Tween | null>(null);
  const formationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishFormation = useCallback(() => {
    if (formationTimeout.current) clearTimeout(formationTimeout.current);
    formationTimeout.current = null;
    setForming(false);
    setFormationId(0);
  }, []);
  const beginOpening = useCallback(() => {
    if (reducedMotion || sceneFailed) return;
    setForming(true);
    setFormationId((previous) => previous + 1);
    if (formationTimeout.current) clearTimeout(formationTimeout.current);
    formationTimeout.current = setTimeout(finishFormation, 4300);
  }, [reducedMotion, sceneFailed, finishFormation]);
  const failScene = useCallback(() => { setSceneFailed(true); finishFormation(); }, [finishFormation]);

  useEffect(() => () => {
    flightTween.current?.kill();
    if (formationTimeout.current) clearTimeout(formationTimeout.current);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => setSmall(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (lastQueryWorld.current === queryWorld) return;
    lastQueryWorld.current = queryWorld;
    setFocus(queryWorld && worlds.some((world) => world.id === queryWorld) ? queryWorld as WorldId : null);
  }, [queryWorld]);

  useEffect(() => {
    if (replayIntro) restartOpening();
  }, [replayIntro, restartOpening]);

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;
    const decay = (now: number) => {
      const steps = lastTime ? Math.min((now - lastTime) / 1000, .05) * 60 : 1;
      lastTime = now;
      if (!pointer.current && !reducedMotion) {
        rotation.current.y += inertia.current.y * steps;
        rotation.current.x = Math.max(-1.1, Math.min(.9, rotation.current.x + inertia.current.x * steps));
        const damping = Math.pow(.93, steps);
        inertia.current.x *= damping; inertia.current.y *= damping;
      }
      frame = requestAnimationFrame(decay);
    };
    if (entered && !reducedMotion && !small) frame = requestAnimationFrame(decay);
    return () => cancelAnimationFrame(frame);
  }, [entered, reducedMotion, small]);

  const focusWorld = useCallback((world: WorldId | null) => { if (!transitionLock.current && !pointer.current?.moved && !suppressClick.current) setFocus(world); }, []);
  const openTopic = useCallback((slug: string) => {
    if (transitionLock.current || suppressClick.current || forming) return;
    transitionLock.current = true;
    setEntering(slug);
    markVisited(slug);
    const href = `/explore/${slug}/`;
    router.prefetch(href);
    if (reducedMotion || sceneFailed) { router.push(href); return; }
    flightTween.current?.kill();
    flightProgress.current = 0;
    const flight = { progress: 0 };
    flightTween.current = gsap.to(flight, {
      progress: 1,
      duration: 2.05,
      ease: 'none',
      onUpdate: () => {
        flightProgress.current = flight.progress;
        main.current?.style.setProperty('--flight-progress', String(flight.progress));
      },
      onComplete: () => { flightTween.current = null; router.push(href); },
    });
  }, [markVisited, router, reducedMotion, sceneFailed, forming]);

  useEffect(() => {
    if (!ready || !entered) return;
    // Static content can be ready in the router cache before a world is opened.
    const preload = () => topics.forEach((topic) => router.prefetch(`/explore/${topic.slug}/`));
    const idle = window.requestIdleCallback?.(preload, { timeout: 1200 });
    const fallback = idle === undefined ? setTimeout(preload, 0) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (fallback !== undefined) clearTimeout(fallback);
    };
  }, [ready, entered, router]);

  const closeAtlas = useCallback(() => setAtlas(false), []);
  const revealOpening = useCallback((progress: number) => main.current?.style.setProperty('--intro-reveal', String(progress)), []);
  const opening = !ready || !entered;
  // Reset navigation on home activation, including cached returns that skip the intro.
  useLayoutEffect(() => {
    flightTween.current?.kill();
    flightTween.current = null;
    flightProgress.current = 0;
    transitionLock.current = false;
    setEntering(null);
    setAtlas(false);
    const captured = pointer.current;
    if (captured?.capture.hasPointerCapture(captured.id)) captured.capture.releasePointerCapture(captured.id);
    pointer.current = null;
    suppressClick.current = false;
    setDragging(false);
    inertia.current = { x: 0, y: 0 };
    main.current?.style.setProperty('--intro-reveal', opening ? '0' : '1');
    main.current?.style.setProperty('--flight-progress', '0');
  }, [opening]);
  useEffect(() => {
    if (!reducedMotion) return;
    finishFormation();
    flightTween.current?.progress(1);
  }, [reducedMotion, finishFormation]);
  const finishOpening = () => {
    enter();
    if (searchParams.get('intro') === '1') router.replace('/', { scroll: false });
    setTimeout(() => heading.current?.focus({ preventScroll: true }), 0);
  };
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (small || opening || entering || !(event.target instanceof HTMLCanvasElement) || event.button !== 0) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, moved: false, capture: event.target };
    suppressClick.current = false;
    event.target.setPointerCapture(event.pointerId);
    inertia.current = { x: 0, y: 0 };
  };
  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointer.current;
    if (!previous || previous.id !== event.pointerId) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    previous.distance += Math.abs(dx) + Math.abs(dy);
    if (previous.distance > 4) { previous.moved = true; setDragging(true); }
    rotation.current.y += dx * .0035;
    rotation.current.x = Math.max(-1.1, Math.min(.9, rotation.current.x + dy * .003));
    inertia.current = { x: dy * .0025, y: dx * .0035 };
    previous.x = event.clientX; previous.y = event.clientY;
    window.dispatchEvent(new Event('douknowme-rotate'));
  };
  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id !== event.pointerId) return;
    const captured = pointer.current.capture;
    suppressClick.current = pointer.current.moved;
    if (captured.hasPointerCapture(event.pointerId)) captured.releasePointerCapture(event.pointerId);
    pointer.current = null; setDragging(false);
    setTimeout(() => { suppressClick.current = false; }, 80);
  };
  const world = focus ? getWorld(focus) : null;
  useEffect(() => {
    if (!focus || opening || small) return;
    const dismissOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target instanceof HTMLCanvasElement) return;
      if (target.closest('button, a, input, textarea, select, [role="dialog"]')) return;
      focusWorld(null);
    };
    document.addEventListener('click', dismissOutside);
    return () => document.removeEventListener('click', dismissOutside);
  }, [focus, opening, small, focusWorld]);

  return <>
    <main ref={main} id="main-content" className={`universe-shell${small ? ' compact-universe' : ''}`} inert={opening || forming || !!entering} data-opening={opening} data-forming={forming} data-entering={!!entering}>
      <div className="universe-heading"><h1 className="eyebrow" ref={heading} tabIndex={-1}>Welcome to my universe</h1><p>{!small && world ? world.subtitle : 'Engineer. Builder. Curious human.'}</p></div>
      <div ref={setStageNode} className={`universe-stage ${dragging ? 'is-dragging' : ''}`} onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { pointer.current = null; setDragging(false); }}>
        {labelPortal && <SceneBoundary onError={failScene}><UniverseScene focus={focus} onFocus={focusWorld} onEnter={openTopic} rotation={rotation} reducedMotion={reducedMotion} visited={visited} small={small} destination={entering} sunLabel={sunLabel} labelPortal={labelPortal} formationId={formationId} onFormationComplete={finishFormation} flightProgress={flightProgress}/></SceneBoundary>}
        <div ref={sunLabel} className="sun-position" data-gravity><div className="sun-label"><strong>VINAY</strong><span>Engineer · Builder · Curious Human</span>{visited.length > 7 && <em>You know a little more now.</em>}</div></div>
      </div>
      {small ? <MobileUniversePanel focus={focus} onFocus={focusWorld} onEnter={openTopic} onOpenAtlas={() => setAtlas(true)} sceneFailed={sceneFailed} entering={!!entering}/> : <>
      {world && !entering && <section className="focus-panel" data-world={world.id} aria-label={`${world.title} navigation`} style={{ '--accent': world.color } as React.CSSProperties}>
        <div className="focus-panel-top"><span className="eyebrow">In focus</span><button aria-label="Return to full universe" onClick={() => setFocus(null)}>×</button></div>
        <h2 style={{ color: world.color }}>{world.title}</h2><p>{getTopic(world.slug)?.description}</p>
        <nav className="focus-topics" aria-label={`${world.title} topics`}>{world.topics.map((slug, index) => <Link key={slug} href={`/explore/${slug}/`}><i>{String(index + 1).padStart(2, '0')}</i>{getTopic(slug)?.title}</Link>)}</nav>
        <button className="focus-enter" style={{ background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, padding: '0 0 5px' }} onClick={() => openTopic(world.slug)}>Enter {world.title}</button>
      </section>}
      <nav className="universe-toolbar" aria-label="Focus a world">{worlds.map((item) => <button key={item.id} aria-pressed={focus === item.id} onClick={() => focusWorld(focus === item.id ? null : item.id)}>{item.title}</button>)}</nav>
      <div className="universe-footer"><p className="universe-instruction">{small ? 'Swipe to rotate' : 'Drag space to rotate'}<span>·</span>{small ? 'Tap a world to explore' : 'Hover a world to discover'}</p><button ref={mapButton} className="atlas-button" onClick={() => setAtlas(true)}>{sceneFailed ? 'Explore the universe map' : 'Universe map'}</button></div>
      </>}
      {entering && !reducedMotion && !sceneFailed && <PlanetFlight color={getWorld(getTopic(entering)?.world ?? 'professional').color} title={getTopic(entering)?.title ?? 'this world'}/>}
    </main>
    {opening && <EntryGate reducedMotion={reducedMotion} onEnter={finishOpening} onProgress={revealOpening} onBeginEnter={beginOpening}/>}
    {atlas && <UniverseAtlas onClose={closeAtlas}/>}
  </>;
}
