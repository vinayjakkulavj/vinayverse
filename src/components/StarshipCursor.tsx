"use client";

import { useEffect, useRef } from "react";
import styles from "./ExperienceEffects.module.css";

type StarshipCursorProps = { reducedMotion: boolean };

const nativeCursorTarget = (target: EventTarget | null) => target instanceof Element && Boolean(
  target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [data-native-cursor]"),
);

export default function StarshipCursor({ reducedMotion }: StarshipCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const shipRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const ship = shipRef.current;
    if (!cursor || !ship || reducedMotion) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const root = document.documentElement;
    const previousCursorSetting = root.getAttribute("data-starship-cursor");
    const point = { x: 0, y: 0, targetX: 0, targetY: 0, angle: 0, targetAngle: 0, thrust: 0 };
    let frame = 0;
    let initialized = false;
    let inside = false;
    let hoveringNative = false;
    let visible = false;
    let disposed = false;
    let lastMove = 0;
    let lastFrame = 0;
    let speed = 0;
    let pulseAnimation: Animation | null = null;

    const restoreCursor = () => {
      if (previousCursorSetting === null) root.removeAttribute("data-starship-cursor");
      else root.setAttribute("data-starship-cursor", previousCursorSetting);
    };

    const setVisible = (next: boolean) => {
      if (visible === next) return;
      visible = next;
      cursor.style.opacity = next ? "1" : "0";
      if (next) {
        point.x = point.targetX;
        point.y = point.targetY;
        lastFrame = 0;
        cursor.style.transform = `translate3d(${point.x - 10}px, ${point.y - 3}px, 0)`;
        root.setAttribute("data-starship-cursor", "true");
      }
      else {
        restoreCursor();
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const canShow = () => finePointer.matches
      && inside
      && !hoveringNative
      && !nativeCursorTarget(document.activeElement)
      && !(window.getSelection()?.toString().length);

    const renderFrame = (time: number) => {
      frame = 0;
      if (!visible || disposed) return;
      const elapsed = Math.min(40, time - (lastFrame || time - 16.7));
      lastFrame = time;
      const positionEase = 1 - Math.pow(0.23, elapsed / 16.7);
      const directionEase = 1 - Math.pow(0.78, elapsed / 16.7);
      const angleDelta = ((point.targetAngle - point.angle + 540) % 360) - 180;
      point.x += (point.targetX - point.x) * positionEase;
      point.y += (point.targetY - point.y) * positionEase;
      point.angle = (point.angle + angleDelta * directionEase + 360) % 360;
      const desiredThrust = time - lastMove < 65 ? Math.min(2.2, speed * 1.5) : 0;
      point.thrust += (desiredThrust - point.thrust) * 0.22;

      cursor.style.transform = `translate3d(${point.x - 10}px, ${point.y - 3}px, 0)`;
      ship.style.transform = `rotate(${point.angle}deg)`;
      cursor.style.setProperty("--cursor-thrust", String(point.thrust));

      const unsettled = Math.abs(point.targetX - point.x) + Math.abs(point.targetY - point.y) > 0.08
        || Math.abs(angleDelta) > 0.12
        || point.thrust > 0.01
        || desiredThrust > 0;
      if (unsettled) frame = requestAnimationFrame(renderFrame);
    };

    const scheduleFrame = () => {
      if (!frame && visible) frame = requestAnimationFrame(renderFrame);
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !finePointer.matches) return;
      inside = true;
      hoveringNative = nativeCursorTarget(event.target);
      const now = performance.now();
      const dx = event.clientX - point.targetX;
      const dy = event.clientY - point.targetY;
      if (!initialized) {
        initialized = true;
        point.x = event.clientX;
        point.y = event.clientY;
      } else if (Math.abs(dx) + Math.abs(dy) > 0.5) {
        point.targetAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
        speed = Math.min(4, Math.hypot(dx, dy) / Math.max(8, now - lastMove));
        let nearest = 130;
        let gravityAngle: number | null = null;
        document.querySelectorAll<HTMLElement>('[data-gravity]').forEach((element) => {
          const bounds = element.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          const gx = bounds.x + bounds.width / 2 - event.clientX;
          const gy = bounds.y + bounds.height / 2 - event.clientY;
          const distance = Math.hypot(gx, gy);
          if (distance < nearest && distance > 12) {
            nearest = distance;
            gravityAngle = (Math.atan2(gy, gx) * 180 / Math.PI + 90 + 360) % 360;
          }
        });
        if (gravityAngle !== null) {
          const bend = ((gravityAngle - point.targetAngle + 540) % 360) - 180;
          point.targetAngle += Math.max(-18, Math.min(18, bend)) * (1 - nearest / 130);
        }
      }
      point.targetX = event.clientX;
      point.targetY = event.clientY;
      lastMove = now;
      setVisible(canShow());
      scheduleFrame();
    };

    const leave = () => {
      inside = false;
      lastFrame = 0;
      setVisible(false);
    };

    const pointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) leave();
    };

    const updateVisibility = () => {
      if (disposed) return;
      setVisible(canShow());
      scheduleFrame();
    };

    const focusChanged = () => queueMicrotask(updateVisibility);

    const click = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !visible || nativeCursorTarget(event.target)) return;
      pulseAnimation?.cancel();
      pulseAnimation = pulseRef.current?.animate([
        { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0.65 },
        { transform: "translate(-50%, -50%) scale(1.65)", opacity: 0 },
      ], { duration: 350, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }) ?? null;
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", click, { passive: true });
    window.addEventListener("blur", leave);
    document.addEventListener("pointerout", pointerOut, { passive: true });
    document.addEventListener("selectionchange", updateVisibility);
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("focusout", focusChanged);
    finePointer.addEventListener("change", updateVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      pulseAnimation?.cancel();
      restoreCursor();
      cursor.style.opacity = "0";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", click);
      window.removeEventListener("blur", leave);
      document.removeEventListener("pointerout", pointerOut);
      document.removeEventListener("selectionchange", updateVisibility);
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("focusout", focusChanged);
      finePointer.removeEventListener("change", updateVisibility);
    };
  }, [reducedMotion]);

  return (
    <div ref={cursorRef} className={styles.starshipCursor} aria-hidden="true">
      <span ref={pulseRef} className={styles.cursorPulse} />
      <div ref={shipRef} className={styles.cursorShip}>
        <span className={styles.cursorFlame} />
        <svg viewBox="0 0 20 24" fill="none" className={styles.cursorSvg}>
          <path d="m10 2 6.5 16-5-2.5L10 19l-1.5-3.5-5 2.5L10 2Z" fill="#d8e4ed" stroke="#eef4f7" strokeWidth="0.6" strokeLinejoin="round" />
          <path d="M10 4.5v9.8" stroke="#718595" strokeWidth="0.7" />
          <path d="m10 8.5 1.35 3.8H8.65L10 8.5Z" fill="#4e91a1" />
          <path d="m6.3 16.1 2.2-1.3m5.2 1.3-2.2-1.3" stroke="#8195a3" strokeWidth="0.6" />
        </svg>
      </div>
    </div>
  );
}
