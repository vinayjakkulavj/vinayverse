'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type RefObject } from 'react';
import styles from './ExperienceEffects.module.css';

const DRAW_DURATION = 5.4;
const DRAW_START = .25;
const ROW_TRANSFER = .5;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
type Point = { x: number; y: number };
type Letter = { node: HTMLElement; left: number; width: number };
type Row = { letters: Letter[]; top: number; height: number; from: Point; to: Point; start: number; end: number };

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
    const showTitle = () => {
      for (const letter of letters) {
        letter.style.opacity = '1';
        letter.style.clipPath = 'none';
      }
    };
    if (reducedMotion || finished.current) {
      showTitle();
      gsap.set([svg, ship], { opacity: 0 });
      finished.current = true;
      onReady();
      return;
    }

    const clock = { elapsed: 0, opacity: 0 };
    let rows: Row[] = [];
    let noseX = 27.55, noseY = 16;
    let active = true;

    const measure = () => {
      const bounds = svg.getBoundingClientRect();
      noseX = ship.clientWidth * 31 / 36;
      noseY = ship.clientHeight / 2;
      svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      rows = [];
      for (const node of letters) {
        const box = node.getBoundingClientRect();
        const left = box.left - bounds.left, top = box.top - bounds.top;
        let row = rows.find((item) => Math.abs(item.top - top) < box.height * .4);
        if (!row) {
          // A quiet horizontal flight reveals each line at the spacecraft's nose.
          // Measuring the real HTML keeps the reveal aligned with responsive type.
          row = { letters: [], top, height: box.height, from: { x: left - 12, y: top + box.height * .48 }, to: { x: left + box.width + 16, y: top + box.height * .48 }, start: 0, end: 0 };
          rows.push(row);
        }
        row.letters.push({ node, left, width: Math.max(1, box.width) });
        row.to.x = Math.max(row.to.x, left + box.width + 16);
      }
      const sweepDuration = DRAW_DURATION - ROW_TRANSFER * Math.max(0, rows.length - 1);
      const totalWidth = rows.reduce((sum, row) => sum + row.to.x - row.from.x, 0);
      let cursor = 0;
      for (const row of rows) {
        row.start = cursor;
        row.end = cursor + sweepDuration * (row.to.x - row.from.x) / Math.max(1, totalWidth);
        cursor = row.end + ROW_TRANSFER;
      }
    };

    const render = () => {
      if (!rows.length) return;
      if (finished.current) {
        showTitle();
        ship.style.opacity = '0';
        svg.style.opacity = '0';
        return;
      }
      const elapsed = clock.elapsed;
      let point = rows[0].from;
      let shipOpacity = clock.opacity;
      let tipOpacity = .72;
      let angle = 0;

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const amount = clamp((elapsed - row.start) / Math.max(.001, row.end - row.start));
        const x = row.from.x + (row.to.x - row.from.x) * amount;
        for (const letter of row.letters) {
          const visible = clamp((x - letter.left) / letter.width);
          letter.node.style.opacity = '1';
          letter.node.style.clipPath = visible <= 0 ? 'inset(0 100% 0 0)' : visible >= 1 ? 'none' : `inset(-12% ${(1 - visible) * 100}% -12% -8%)`;
        }
        if (elapsed >= row.start && elapsed <= row.end) {
          point = { x, y: row.from.y + Math.sin(amount * Math.PI) * 1.5 };
        } else if (elapsed > row.end && index < rows.length - 1 && elapsed < rows[index + 1].start) {
          const next = rows[index + 1];
          const transfer = clamp((elapsed - row.end) / ROW_TRANSFER);
          // Fade at the edge and return at the next line's start. A hidden middle
          // avoids a fast, distracting flight back across already written text.
          if (transfer < .25) {
            const departure = transfer / .25;
            point = { x: row.to.x + departure * 9, y: row.to.y - departure * 2 };
            shipOpacity *= 1 - departure;
            angle = -5;
          } else if (transfer > .75) {
            const arrival = (transfer - .75) / .25;
            point = { x: next.from.x - (1 - arrival) * 9, y: next.from.y };
            shipOpacity *= arrival;
          } else {
            point = next.from;
            shipOpacity = 0;
          }
          tipOpacity = 0;
        } else if (index === rows.length - 1 && elapsed >= row.end) {
          point = row.to;
          tipOpacity = 0;
        }
      }
      ship.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) rotate(${angle}deg) translate(-${noseX}px, -${noseY}px)`;
      ship.style.opacity = String(shipOpacity);
      svg.style.opacity = String(clock.opacity);
      tip.current?.setAttribute('cx', String(point.x));
      tip.current?.setAttribute('cy', String(point.y));
      tip.current?.style.setProperty('opacity', String(tipOpacity));
    };

    ship.style.transformOrigin = '0 0';
    measure(); render();
    const sequence = gsap.timeline()
      .to(clock, { opacity: 1, duration: .18, ease: 'power1.out', onUpdate: render }, .08)
      .to(clock, { elapsed: DRAW_DURATION, duration: DRAW_DURATION, ease: 'none', onUpdate: render }, DRAW_START)
      .call(showTitle, [], DRAW_START + DRAW_DURATION)
      .to(clock, { opacity: 0, duration: .22, ease: 'power1.out', onUpdate: render }, DRAW_START + DRAW_DURATION)
      .call(() => { finished.current = true; onReady(); }, [], 5.9);
    const update = () => { measure(); render(); };
    const observer = new ResizeObserver(update);
    observer.observe(title);
    window.addEventListener('resize', update, { passive: true });
    void document.fonts.ready.then(() => { if (active) update(); });
    return () => { active = false; sequence.kill(); observer.disconnect(); window.removeEventListener('resize', update); };
  }, [titleRef, reducedMotion, onReady]);

  return <>
    <svg ref={drawing} className={styles.titleTrajectory} preserveAspectRatio="none" aria-hidden="true">
      <circle ref={tip} className={styles.drawingTip} r="1.25"/>
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
