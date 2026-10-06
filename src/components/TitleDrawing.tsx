'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type RefObject } from 'react';
import { openingTitleFont, openingTitleGlyphs } from './OpeningTitleGlyphs';
import styles from './ExperienceEffects.module.css';

const CHARACTERS = Array.from('DO YOUKNOW ME?');
const DRAW_DURATION = 4.3;
const DRAW_START = .25;
type Point = { x: number; y: number };
type Trace = { kind: 'trace'; path: SVGPathElement; length: number; x: number; baseline: number; scale: number; start: number; end: number; weight: number };
type Transfer = { kind: 'transfer'; from: Point; to: Point; lift: number; start: number; end: number; weight: number };
type Step = Trace | Transfer;
type Letter = { node: HTMLElement; paths: SVGPathElement[]; doneAt: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function tracePoint(step: Trace, progress: number): Point {
  const point = step.path.getPointAtLength(step.length * clamp(progress));
  return { x: step.x + point.x * step.scale, y: step.baseline + point.y * step.scale };
}

function transferPoint(step: Transfer, progress: number): Point {
  const amount = progress * progress * (3 - 2 * progress);
  return {
    x: step.from.x + (step.to.x - step.from.x) * amount,
    y: step.from.y + (step.to.y - step.from.y) * amount - Math.sin(progress * Math.PI) * step.lift,
  };
}

export default function TitleDrawing({ titleRef, reducedMotion, onReady }: {
  titleRef: RefObject<HTMLHeadingElement | null>;
  reducedMotion: boolean;
  onReady: () => void;
}) {
  const drawing = useRef<SVGSVGElement>(null);
  const jet = useRef<HTMLDivElement>(null);
  const tip = useRef<SVGCircleElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    const title = titleRef.current, svg = drawing.current, ship = jet.current;
    if (!title || !svg || !ship) return;
    const letters = Array.from(title.querySelectorAll<HTMLElement>('[data-type-character]'));
    if (reducedMotion || finished.current) {
      gsap.set(letters, { opacity: 1 });
      gsap.set([svg, ship], { opacity: 0 });
      finished.current = true;
      onReady();
      return;
    }

    const clock = { progress: 0 };
    let steps: Step[] = [];
    let glyphs: Letter[] = [];
    let angle = 0;
    let noseX = 27.55, noseY = 16;
    let active = true;
    const measure = () => {
      const bounds = svg.getBoundingClientRect();
      noseX = ship.clientWidth * 31 / 36;
      noseY = ship.clientHeight / 2;
      svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      steps = []; glyphs = [];
      let previous: Point | null = null;
      let previousRow = 0;
      for (let index = 0; index < letters.length; index++) {
        const node = letters[index];
        const outline = openingTitleGlyphs[node.textContent?.trim() ?? ''];
        const group = svg.querySelector<SVGGElement>(`[data-drawing-glyph="${index}"]`);
        if (!outline || !group) continue;
        const box = node.getBoundingClientRect();
        const size = Number.parseFloat(getComputedStyle(node).fontSize);
        const scale = size / openingTitleFont.unitsPerEm;
        const x = box.left - bounds.left;
        const baseline = box.top - bounds.top + (box.height - (openingTitleFont.ascent + openingTitleFont.descent) * scale) / 2 + openingTitleFont.ascent * scale;
        group.setAttribute('transform', `translate(${x} ${baseline}) scale(${scale})`);
        const paths = Array.from(group.querySelectorAll<SVGPathElement>('path'));
        const lengths = paths.map((path) => path.getTotalLength());
        const totalLength = lengths.reduce((sum, length) => sum + length, 0);
        const letterWeight = .29 + Math.min(totalLength / 26000, .15);
        for (let contour = 0; contour < paths.length; contour++) {
          const path = paths[contour];
          const trace: Trace = { kind: 'trace', path, length: lengths[contour], x, baseline, scale, start: 0, end: 0, weight: letterWeight * lengths[contour] / totalLength };
          const start = tracePoint(trace, 0);
          const newRow = !!previous && contour === 0 && Math.abs(box.top - previousRow) > box.height * .5;
          const from = previous ?? { x: x - 35, y: baseline - openingTitleFont.capHeight * scale * .55 };
          const distance = Math.hypot(start.x - from.x, start.y - from.y) / size;
          steps.push({ kind: 'transfer', from, to: start, lift: newRow ? 22 : Math.min(distance * 3, 10), start: 0, end: 0, weight: !previous ? .14 : newRow ? .26 : .025 + Math.min(distance * .015, .055) });
          steps.push(trace);
          previous = tracePoint(trace, 1);
        }
        previousRow = box.top;
        glyphs.push({ node, paths, doneAt: steps.length - 1 });
      }
      if (previous) steps.push({ kind: 'transfer', from: previous, to: { x: previous.x + 36, y: previous.y - 12 }, lift: 4, start: 0, end: 0, weight: .18 });
      const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);
      let cursor = 0;
      steps.forEach((step) => { step.start = cursor / totalWeight; cursor += step.weight; step.end = cursor / totalWeight; });
      glyphs.forEach((glyph) => { glyph.doneAt = steps[glyph.doneAt].end; });
    };

    const render = () => {
      if (!steps.length) return;
      const progress = clock.progress;
      const step = steps.find((item) => progress <= item.end) ?? steps[steps.length - 1];
      const local = clamp((progress - step.start) / (step.end - step.start));
      const pointAt = (value: number) => step.kind === 'trace' ? tracePoint(step, value) : transferPoint(step, clamp(value));
      const position = pointAt(local);
      const before = pointAt(Math.max(0, local - .006));
      const after = pointAt(Math.min(1, local + .006));
      const heading = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      angle += ((heading - angle + 540) % 360 - 180) * .5;
      // The spacecraft's nose sits on the live stroke, leaving the letter behind it.
      ship.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) rotate(${angle}deg) translate(-${noseX}px, -${noseY}px)`;
      tip.current?.setAttribute('cx', String(position.x));
      tip.current?.setAttribute('cy', String(position.y));
      tip.current?.style.setProperty('opacity', step.kind === 'trace' ? '1' : '.2');
      for (const item of steps) {
        if (item.kind !== 'trace') continue;
        item.path.style.strokeDashoffset = String(1 - clamp((progress - item.start) / (item.end - item.start)));
      }
      for (const glyph of glyphs) {
        const fill = clamp((progress - glyph.doneAt) / .025);
        glyph.node.style.opacity = String(fill);
        for (const path of glyph.paths) path.style.opacity = String(.9 * (1 - fill));
      }
    };

    gsap.set(letters, { opacity: 0 });
    ship.style.transformOrigin = '0 0';
    measure(); render();
    const sequence = gsap.timeline()
      .to(ship, { opacity: 1, duration: .18 }, .08)
      .to(clock, { progress: 1, duration: DRAW_DURATION, ease: 'none', onUpdate: render }, DRAW_START)
      .set(letters, { opacity: 1 }, DRAW_START + DRAW_DURATION)
      .to([ship, svg], { opacity: 0, duration: .28, ease: 'power1.out' }, DRAW_START + DRAW_DURATION)
      .call(() => { finished.current = true; onReady(); }, [], DRAW_START + DRAW_DURATION + .4);
    const update = () => { measure(); render(); };
    const observer = new ResizeObserver(update);
    observer.observe(title);
    window.addEventListener('resize', update, { passive: true });
    void document.fonts.ready.then(() => { if (active) update(); });
    return () => { active = false; sequence.kill(); observer.disconnect(); window.removeEventListener('resize', update); };
  }, [titleRef, reducedMotion, onReady]);

  return <>
    <svg ref={drawing} className={styles.titleTrajectory} preserveAspectRatio="none" aria-hidden="true">
      {CHARACTERS.map((character, index) => <g key={index} data-drawing-glyph={index}>
        {openingTitleGlyphs[character]?.contours.map((path, contour) => <path key={contour} d={path} pathLength="1" strokeDasharray="1" strokeDashoffset="1" fill="none" vectorEffect="non-scaling-stroke"/>)}
      </g>)}
      <circle ref={tip} className={styles.drawingTip} r="1.5"/>
    </svg>
    <div ref={jet} className={styles.titleShip} aria-hidden="true">
      <span className={styles.titleShipExhaust}/>
      <svg viewBox="0 0 36 36" fill="none">
        <path d="m31 18-22-9 4 9-4 9 22-9Z" fill="#c7d7dd" stroke="#eaf7fa" strokeWidth=".8" strokeLinejoin="round"/>
        <path d="m13 18 18 0m-12-2-3-1 2 6" stroke="#687f88" strokeWidth="1"/>
        <path d="m10 11-4 3 7 4-7 4 4 3" fill="#708995" stroke="#a8c4d0" strokeWidth=".65"/>
        <ellipse cx="23" cy="18" rx="3" ry="1.6" fill="#163447" stroke="#98d2df" strokeWidth=".6"/>
      </svg>
    </div>
  </>;
}
