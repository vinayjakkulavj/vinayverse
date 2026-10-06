"use client";

import { gsap } from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import styles from "./ExperienceEffects.module.css";
import TitleDrawing from "./TitleDrawing";

type EntryGateProps = {
  onEnter: () => void;
  reducedMotion: boolean;
  onProgress?: (progress: number) => void;
  onBeginEnter?: () => void;
};

const DRAG_DISTANCE = 96;
const OPEN_THRESHOLD = 0.6;
const DRAG_REVEAL_LIMIT = 0.52;
const REVEAL_DURATION = 0.9;
const TITLE_LINES = ["DO YOU", "KNOW ME?"];

export default function EntryGate({ onEnter, reducedMotion, onProgress, onBeginEnter }: EntryGateProps) {
  const gateRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const resetRef = useRef<gsap.core.Tween | null>(null);
  const titleReadyRef = useRef(reducedMotion);
  const callbacksRef = useRef({ onEnter, onProgress, onBeginEnter });
  const motionRef = useRef(reducedMotion);
  const completedRef = useRef(false);
  const enteredCallbackRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
  const captureRef = useRef<HTMLElement | null>(null);
  const originRef = useRef(0);
  const revealRef = useRef({ progress: 0, handleY: 0, pull: 0 });
  const apertureRef = useRef({ x: 0, y: 0, maxRadius: 1 });
  const [dragging, setDragging] = useState(false);
  const [entering, setEntering] = useState(false);
  const [titleReady, setTitleReady] = useState(reducedMotion);

  useEffect(() => {
    callbacksRef.current = { onEnter, onProgress, onBeginEnter };
    motionRef.current = reducedMotion;
  }, [onEnter, onProgress, onBeginEnter, reducedMotion]);

  const revealTitleControls = useCallback(() => {
    titleReadyRef.current = true;
    setTitleReady(true);
  }, []);

  const measureAperture = useCallback(() => {
    const gate = gateRef.current;
    if (!gate) return;
    const bounds = gate.getBoundingClientRect();
    const handle = handleRef.current?.getBoundingClientRect();
    const x = handle && handle.width ? handle.left + handle.width / 2 - bounds.left : bounds.width / 2;
    const y = handle && handle.height
      ? handle.top + handle.height / 2 - bounds.top - revealRef.current.handleY
      : bounds.height * 0.76;
    const maxRadius = Math.hypot(Math.max(x, bounds.width - x), Math.max(y, bounds.height - y)) + 64;
    apertureRef.current = { x, y, maxRadius };
    gate.style.setProperty("--aperture-x", `${x}px`);
    gate.style.setProperty("--aperture-y", `${y}px`);
  }, []);

  const renderReveal = useCallback(() => {
    const gate = gateRef.current;
    if (!gate) return;
    const progress = Math.min(1, Math.max(0, revealRef.current.progress));
    const radius = progress * apertureRef.current.maxRadius;
    // The opaque veil is masked away; the real scene remains visible through this aperture.
    gate.style.setProperty("--gate-progress", String(progress));
    gate.style.setProperty("--intro-pull", String(revealRef.current.pull));
    gate.style.setProperty("--handle-y", `${revealRef.current.handleY}px`);
    gate.style.setProperty("--aperture-radius", `${radius}px`);
    gate.style.setProperty("--aperture-inner", `${Math.max(0, radius - 24)}px`);
    gate.style.setProperty("--portal-scale", String(Math.max(0.01, radius / 64)));
    gate.style.setProperty("--portal-opacity", String(Math.sin(progress * Math.PI) * 0.46));
    gate.toggleAttribute("data-release-ready", revealRef.current.pull >= OPEN_THRESHOLD);
    callbacksRef.current.onProgress?.(progress);
  }, []);

  useEffect(() => {
    measureAperture();
    renderReveal();
    gateRef.current?.focus({ preventScroll: true });
    const resize = () => {
      measureAperture();
      renderReveal();
    };
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      timelineRef.current?.kill();
      resetRef.current?.kill();
      window.removeEventListener("resize", resize);
    };
  }, [measureAperture, renderReveal]);

  const releasePointer = useCallback(() => {
    const pointer = pointerRef.current;
    pointerRef.current = null;
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture && pointer !== null && capture.hasPointerCapture(pointer)) {
      capture.releasePointerCapture(pointer);
    }
    setDragging(false);
  }, []);

  const notifyEntered = useCallback(() => {
    if (enteredCallbackRef.current) return;
    enteredCallbackRef.current = true;
    callbacksRef.current.onEnter();
  }, []);

  const finishReducedMotion = useCallback(() => {
    timelineRef.current?.kill();
    timelineRef.current = gsap.timeline({
      onComplete: () => {
        revealRef.current.progress = 1;
        callbacksRef.current.onProgress?.(1);
        notifyEntered();
      },
    }).to(gateRef.current, { opacity: 0, duration: 0.14 });
  }, [notifyEntered]);

  const enter = useCallback(() => {
    if (!titleReadyRef.current || completedRef.current || !gateRef.current) return;
    completedRef.current = true;
    callbacksRef.current.onBeginEnter?.();
    resetRef.current?.kill();
    releasePointer();
    measureAperture();
    setEntering(true);

    if (motionRef.current) {
      finishReducedMotion();
      return;
    }

    // A drag previews the universe; release completes one continuous reveal.
    const duration = REVEAL_DURATION;
    const fadeDuration = 0.22;
    timelineRef.current = gsap.timeline({
      onComplete: notifyEntered,
    })
      .to(revealRef.current, {
        progress: 1,
        pull: 1,
        duration,
        ease: "power3.inOut",
        onUpdate: renderReveal,
      }, 0)
      .to(controlsRef.current, {
        opacity: 0,
        duration: 0.35,
        ease: "power1.out",
      }, 0)
      .to(gateRef.current, {
        opacity: 0,
        duration: fadeDuration,
        ease: "none",
      }, duration - fadeDuration);
  }, [finishReducedMotion, measureAperture, notifyEntered, releasePointer, renderReveal]);

  const resetDrag = useCallback(() => {
    if (completedRef.current) return;
    resetRef.current?.kill();
    if (motionRef.current) {
      revealRef.current = { progress: 0, handleY: 0, pull: 0 };
      renderReveal();
      return;
    }
    resetRef.current = gsap.to(revealRef.current, {
      progress: 0,
      handleY: 0,
      pull: 0,
      duration: 0.45,
      ease: "elastic.out(1, 0.4)",
      onUpdate: renderReveal,
      onComplete: () => {
        revealRef.current.progress = 0;
        revealRef.current.handleY = 0;
        revealRef.current.pull = 0;
        renderReveal();
      },
    });
  }, [renderReveal]);

  useEffect(() => {
    if (!reducedMotion || enteredCallbackRef.current) return;
    resetRef.current?.kill();
    if (completedRef.current) finishReducedMotion();
    else if (pointerRef.current === null) {
      revealRef.current = { progress: 0, handleY: 0, pull: 0 };
      renderReveal();
    }
  }, [finishReducedMotion, reducedMotion, renderReveal]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!titleReadyRef.current || completedRef.current || pointerRef.current !== null || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    resetRef.current?.kill();
    measureAperture();
    pointerRef.current = event.pointerId;
    originRef.current = event.clientY - revealRef.current.handleY;
    captureRef.current = event.currentTarget;
    // Keep the capture surface still while the handle moves. Window listeners
    // also finish a pull if capture is unavailable or the release leaves it.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Window listeners remain active. */ }
    setDragging(true);
  };

  const updateDragPosition = useCallback((clientY: number) => {
    const distance = Math.max(0, clientY - originRef.current);
    revealRef.current.handleY = distance;
    revealRef.current.pull = Math.min(1, distance / DRAG_DISTANCE);
    revealRef.current.progress = revealRef.current.pull * DRAG_REVEAL_LIMIT;
    renderReveal();
  }, [renderReveal]);

  const finishDrag = useCallback((event: PointerEvent) => {
    if (pointerRef.current !== event.pointerId) return;
    // Fast drags can deliver the last coordinate only on pointerup.
    updateDragPosition(event.clientY);
    releasePointer();
    if (revealRef.current.pull >= OPEN_THRESHOLD) enter();
    else resetDrag();
  }, [enter, releasePointer, resetDrag, updateDragPosition]);

  const cancelDrag = useCallback(() => {
    releasePointer();
    resetDrag();
  }, [releasePointer, resetDrag]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (pointerRef.current !== event.pointerId || completedRef.current) return;
      if (event.cancelable) event.preventDefault();
      updateDragPosition(event.clientY);
    };
    const cancel = (event: PointerEvent) => {
      if (pointerRef.current === event.pointerId) cancelDrag();
    };
    const blur = () => {
      if (pointerRef.current !== null) cancelDrag();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
    };
  }, [cancelDrag, finishDrag, updateDragPosition]);

  return (
    <section
      ref={gateRef}
      className={styles.entryGate}
      data-dragging={dragging || undefined}
      data-entering={entering || undefined}
      data-title-ready={titleReady || undefined}
      data-title-writing={!titleReady && !reducedMotion}
      data-reduced-motion={reducedMotion || undefined}
      aria-labelledby="entry-title"
      aria-describedby="entry-description"
      tabIndex={-1}
    >
      <div className={styles.entryVeil} aria-hidden="true" />
      <div className={styles.entryPortal} aria-hidden="true" />
      <div className={styles.entryFlight}>
        <TitleDrawing titleRef={titleRef} reducedMotion={reducedMotion} onReady={revealTitleControls}/>
        <div className={styles.entryCopy}>
          <div className={styles.entryEyebrow}><span /> A PERSONAL UNIVERSE BY VINAY</div>
          <h1 ref={titleRef} id="entry-title" className={styles.entryTitle} aria-label="Do you know me?">
            <span className={styles.titleLine} aria-hidden="true">{Array.from(TITLE_LINES[0]).map((character, index) => <span key={index} data-type-character className={styles.typingCharacter}>{character === " " ? "\u00a0" : character}</span>)}</span>
            <br className={styles.mobileBreak} aria-hidden="true" />
            <span className={styles.titleSpace} aria-hidden="true"> </span>
            <span className={styles.titleLine} aria-hidden="true">{Array.from(TITLE_LINES[1]).map((character, index) => <span key={index} data-type-character className={`${styles.typingCharacter}${character === "?" ? ` ${styles.titleQuestion}` : ""}`}>{character === " " ? "\u00a0" : character}</span>)}</span>
          </h1>
          <p id="entry-description" className={styles.entryDescription}>There is more than one answer.</p>
          <div className={styles.entryCoordinates} aria-hidden="true">ENGINEER. BUILDER. CURIOUS HUMAN.</div>
        </div>
        <div ref={controlsRef} className={styles.entryControls} aria-hidden={!titleReady}>
          <div
            className={styles.dragZone}
            onPointerDown={startDrag}
            onLostPointerCapture={(event) => {
              if (pointerRef.current === event.pointerId) cancelDrag();
            }}
          >
            <div className={styles.dragTrack} aria-hidden="true" />
            <span className={styles.dragDestination} aria-hidden="true" />
            <button
              ref={handleRef}
              className={styles.dragHandle}
              type="button"
              disabled={!titleReady || entering}
              aria-label="Drag down and release to reveal the universe, or press Enter"
              onClick={(event) => {
                if (event.detail === 0) enter();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v13m-5-5 5 5 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className={styles.dragLabel}>Drag to know me</span>
            <span className={styles.releaseLabel} aria-hidden="true">Release to explore</span>
          </div>
          <button id="enter-universe" className={styles.enterButton} type="button" onClick={enter} disabled={!titleReady || entering}>
            Enter universe
          </button>
        </div>
        <div className={styles.entryFooter} aria-hidden="true"><span>THREE WORLDS. ONE HUMAN.</span></div>
      </div>
      <span className={styles.screenReaderOnly} role="status">{entering ? "Opening your universe." : titleReady ? "Drag down and release, or choose Enter universe to begin." : "Your universe is getting ready."}</span>
    </section>
  );
}
