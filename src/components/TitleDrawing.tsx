'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type RefObject } from 'react';

const DRAW_DURATION = 2.5;
const DRAW_START = .12;
const ROW_TRANSFER = .10;

export default function TitleDrawing({ titleRef, reducedMotion, visualReady, onReady }: {
  titleRef: RefObject<HTMLHeadingElement | null>;
  reducedMotion: boolean;
  visualReady: boolean;
  onReady: () => void;
}) {
  const finished = useRef(false);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const lines = Array.from(title.querySelectorAll<HTMLElement>('[data-type-line]'));
    const showTitle = () => {
      for (const line of lines) {
        line.style.opacity = '1';
        line.style.clipPath = 'none';
        line.style.willChange = 'auto';
      }
    };
    if (reducedMotion || finished.current) {
      showTitle();
      finished.current = true;
      onReady();
      return;
    }
    if (!visualReady) return;
    let active = true;
    let sequence: gsap.core.Timeline | null = null;
    // Font metrics and shader preparation are finished before the sweep starts.
    // Only two isolated layers animate, with no per-frame glyph measurements.
    void document.fonts.ready.then(() => {
      if (!active) return;
      const boxes = lines.map(line => line.getBoundingClientRect());
      const transfer = boxes.length > 1 && Math.abs(boxes[0].top - boxes[1].top) > boxes[0].height * .4 ? ROW_TRANSFER : 0;
      const totalWidth = boxes.reduce((sum, box) => sum + box.width, 0);
      const sweep = DRAW_DURATION - transfer * Math.max(0, lines.length - 1);
      let cursor = DRAW_START;
      sequence = gsap.timeline();
      lines.forEach((line, index) => {
        const duration = sweep * boxes[index].width / Math.max(1, totalWidth);
        line.style.willChange = 'clip-path, opacity';
        sequence!.fromTo(line,
          { clipPath: 'inset(-12% 100% -12% 0%)', opacity: 1 },
          { clipPath: 'inset(-12% -2% -12% -2%)', duration, ease: 'none', immediateRender: true }, cursor);
        cursor += duration + transfer;
      });
      sequence.call(() => { showTitle(); finished.current = true; onReady(); }, [], DRAW_START + DRAW_DURATION + .08);
    });
    return () => { active = false; sequence?.kill(); };
  }, [titleRef, reducedMotion, visualReady, onReady]);

  return null;
}
