'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type RefObject } from 'react';

const DRAW_DURATION = 2.5;
const DRAW_START = .18;
const ROW_TRANSFER = .14;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
type Letter = { node: HTMLElement; left: number; width: number };
type Row = { letters: Letter[]; top: number; from: number; to: number; start: number; end: number };

export default function TitleDrawing({ titleRef, reducedMotion, onReady }: {
  titleRef: RefObject<HTMLHeadingElement | null>;
  reducedMotion: boolean;
  onReady: () => void;
}) {
  const finished = useRef(false);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const letters = Array.from(title.querySelectorAll<HTMLElement>('[data-type-character]'));
    const showTitle = () => {
      for (const letter of letters) {
        letter.style.opacity = '1';
        letter.style.clipPath = 'none';
      }
    };
    if (reducedMotion || finished.current) {
      showTitle();
      finished.current = true;
      onReady();
      return;
    }

    const clock = { elapsed: 0 };
    let rows: Row[] = [];
    let active = true;

    const measure = () => {
      const bounds = title.getBoundingClientRect();
      rows = [];
      for (const node of letters) {
        const box = node.getBoundingClientRect();
        const left = box.left - bounds.left, top = box.top - bounds.top;
        let row = rows.find((item) => Math.abs(item.top - top) < box.height * .4);
        if (!row) {
          // Measure the actual glyphs so the reveal stays aligned on either layout.
          row = { letters: [], top, from: left, to: left + box.width, start: 0, end: 0 };
          rows.push(row);
        }
        row.letters.push({ node, left, width: Math.max(1, box.width) });
        row.to = Math.max(row.to, left + box.width);
      }
      const sweepDuration = DRAW_DURATION - ROW_TRANSFER * Math.max(0, rows.length - 1);
      const totalWidth = rows.reduce((sum, row) => sum + row.to - row.from, 0);
      let cursor = 0;
      for (const row of rows) {
        row.start = cursor;
        row.end = cursor + sweepDuration * (row.to - row.from) / Math.max(1, totalWidth);
        cursor = row.end + ROW_TRANSFER;
      }
    };

    const render = () => {
      if (finished.current) {
        showTitle();
        return;
      }
      for (const row of rows) {
        const amount = clamp((clock.elapsed - row.start) / Math.max(.001, row.end - row.start));
        const x = row.from + (row.to - row.from) * amount;
        for (const letter of row.letters) {
          const visible = clamp((x - letter.left) / letter.width);
          letter.node.style.opacity = '1';
          letter.node.style.clipPath = visible <= 0 ? 'inset(0 100% 0 0)' : visible >= 1 ? 'none' : `inset(-12% ${(1 - visible) * 100}% -12% -8%)`;
        }
      }
    };

    measure(); render();
    const sequence = gsap.timeline()
      .to(clock, { elapsed: DRAW_DURATION, duration: DRAW_DURATION, ease: 'none', onUpdate: render }, DRAW_START)
      .call(showTitle, [], DRAW_START + DRAW_DURATION)
      .call(() => { finished.current = true; onReady(); }, [], 2.8);
    const update = () => { measure(); render(); };
    const observer = new ResizeObserver(update);
    observer.observe(title);
    window.addEventListener('resize', update, { passive: true });
    void document.fonts.ready.then(() => { if (active) update(); });
    return () => { active = false; sequence.kill(); observer.disconnect(); window.removeEventListener('resize', update); };
  }, [titleRef, reducedMotion, onReady]);

  return null;
}
