"use client";

import { gsap } from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import styles from "./ExperienceEffects.module.css";

type EntryGateProps = {
  onEnter: () => void;
  reducedMotion: boolean;
  onProgress?: (progress: number) => void;
  onBeginEnter?: () => void;
};

const DRAG_DISTANCE = 96;
const OPEN_THRESHOLD = 0.6;
const DRAG_REVEAL_LIMIT = 0.44;
const REVEAL_DURATION = 1.25;
const TITLE_DURATION = 1.72;
const TITLE_READY_AT = 2.35;
const TITLE_LINES = ["DO YOU", "KNOW ME?"];

type FlightPoint = { x: number; y: number };

// A small interpolated spline keeps the ship continuous across the two mobile lines.
function pointAlongFlight(points: FlightPoint[], progress: number): FlightPoint {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const coordinate = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(coordinate));
  const amount = coordinate - index;
  const before = points[Math.max(0, index - 1)];
  const start = points[index];
  const end = points[index + 1];
  const after = points[Math.min(points.length - 1, index + 2)];
  const interpolate = (key: "x" | "y") => 0.5 * (
    2 * start[key]
    + (-before[key] + end[key]) * amount
    + (2 * before[key] - 5 * start[key] + 4 * end[key] - after[key]) * amount * amount
    + (-before[key] + 3 * start[key] - 3 * end[key] + after[key]) * amount * amount * amount
  );
  return { x: interpolate("x"), y: interpolate("y") };
}

export default function EntryGate({ onEnter, reducedMotion, onProgress, onBeginEnter }: EntryGateProps) {
  const gateRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shipRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const trajectoryRef = useRef<SVGSVGElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const resetRef = useRef<gsap.core.Tween | null>(null);
  const titleTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const titleReadyRef = useRef(reducedMotion);
  const callbacksRef = useRef({ onEnter, onProgress, onBeginEnter });
  const motionRef = useRef(reducedMotion);
  const completedRef = useRef(false);
  const enteredCallbackRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
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

  useEffect(() => {
    const title = titleRef.current;
    const gate = gateRef.current;
    const ship = shipRef.current;
    if (!title || !gate || !ship) return;
    const characters = Array.from(title.querySelectorAll<HTMLElement>("[data-type-character]"));
    const revealControls = () => {
      titleReadyRef.current = true;
      setTitleReady(true);
    };
    if (reducedMotion || titleReadyRef.current) {
      gsap.set(characters, { opacity: 1, y: 0 });
      gsap.set(ship, { opacity: 0 });
      revealControls();
      return;
    }

    const flight = { progress: 0 };
    let route: FlightPoint[] = [];
    let shownCharacters = 0;
    let active = true;
    const measureFlight = () => {
      const bounds = gate.getBoundingClientRect();
      const boxes = characters.map((character) => character.getBoundingClientRect());
      if (!boxes.length) return;
      route = [];
      boxes.forEach((box, index) => {
        // Alternating upper/lower arcs weave around the letters as they appear.
        const previous = boxes[index - 1];
        if (previous && Math.abs(box.top - previous.top) > box.height * 0.5) {
          route.push({ x: bounds.width * 0.85, y: previous.bottom - bounds.top + 18 });
          route.push({ x: bounds.width * 0.15, y: box.top - bounds.top - 18 });
        }
        route.push({
          x: box.left + box.width * 0.5 - bounds.left,
          y: (index % 2 === 0 ? box.top - 13 : box.bottom + 10) - bounds.top,
        });
      });
      const first = boxes[0];
      const last = boxes[boxes.length - 1];
      route.unshift({ x: first.left - bounds.left - 26, y: first.top - bounds.top + first.height * 0.5 });
      route.push({ x: last.right - bounds.left + 24, y: last.top - bounds.top + last.height * 0.5 });
      trajectoryRef.current?.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
      const samples = Array.from({ length: 100 }, (_, index) => pointAlongFlight(route, index / 99));
      routeRef.current?.setAttribute("d", samples.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "));
    };
    const renderFlight = () => {
      if (!route.length) return;
      const position = pointAlongFlight(route, flight.progress);
      const before = pointAlongFlight(route, flight.progress - 0.002);
      const after = pointAlongFlight(route, flight.progress + 0.002);
      const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      ship.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) rotate(${angle}deg)`;
      routeRef.current?.style.setProperty("stroke-dashoffset", String(1 - flight.progress));
      const count = Math.min(characters.length, Math.floor(flight.progress * (characters.length + 1)));
      if (count > shownCharacters) {
        for (let index = shownCharacters; index < count; index += 1) characters[index].style.opacity = "1";
        shownCharacters = count;
      }
    };
    gsap.set(characters, { opacity: 0 });
    measureFlight();
    renderFlight();
    titleTimelineRef.current = gsap.timeline()
      .to(ship, { opacity: 1, duration: 0.16, ease: "power1.out" }, 0.14)
      .to(flight, { progress: 1, duration: TITLE_DURATION, ease: "none", onUpdate: renderFlight }, 0.22)
      .set(characters, { opacity: 1 }, 0.22 + TITLE_DURATION)
      .to(ship, { opacity: 0, scale: 0.65, duration: 0.32, ease: "power2.in" }, 0.22 + TITLE_DURATION)
      .to(routeRef.current, { opacity: 0, duration: 0.42, ease: "power1.out" }, 0.22 + TITLE_DURATION)
      .call(revealControls, [], TITLE_READY_AT);
    const resizeObserver = new ResizeObserver(() => {
      measureFlight();
      renderFlight();
    });
    resizeObserver.observe(title);
    const resizeFlight = () => { measureFlight(); renderFlight(); };
    window.addEventListener("resize", resizeFlight, { passive: true });
    void document.fonts.ready.then(() => {
      if (active) { measureFlight(); renderFlight(); }
    });
    return () => {
      active = false;
      titleTimelineRef.current?.kill();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeFlight);
    };
  }, [reducedMotion]);

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
    gate.style.setProperty("--aperture-inner", `${Math.max(0, radius - 48)}px`);
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
    const handle = handleRef.current;
    if (handle && pointer !== null && handle.hasPointerCapture(pointer)) {
      handle.releasePointerCapture(pointer);
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

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!titleReadyRef.current || completedRef.current || pointerRef.current !== null || event.button !== 0) return;
    event.preventDefault();
    resetRef.current?.kill();
    measureAperture();
    pointerRef.current = event.pointerId;
    originRef.current = event.clientY - revealRef.current.handleY;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current !== event.pointerId || completedRef.current) return;
    event.preventDefault();
    const distance = Math.max(0, event.clientY - originRef.current);
    revealRef.current.handleY = distance;
    revealRef.current.pull = Math.min(1, distance / DRAG_DISTANCE);
    revealRef.current.progress = revealRef.current.pull * DRAG_REVEAL_LIMIT;
    renderReveal();
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    releasePointer();
    if (revealRef.current.pull >= OPEN_THRESHOLD) enter();
    else resetDrag();
  };

  const cancelDrag = () => {
    releasePointer();
    resetDrag();
  };

  return (
    <section
      ref={gateRef}
      className={styles.entryGate}
      data-dragging={dragging || undefined}
      data-entering={entering || undefined}
      data-title-ready={titleReady || undefined}
      data-reduced-motion={reducedMotion || undefined}
      aria-labelledby="entry-title"
      aria-describedby="entry-description"
      tabIndex={-1}
    >
      <div className={styles.entryVeil} aria-hidden="true" />
      <div className={styles.entryPortal} aria-hidden="true" />
      <div className={styles.entryFlight}>
        <svg ref={trajectoryRef} className={styles.titleTrajectory} preserveAspectRatio="none" aria-hidden="true">
          <path ref={routeRef} pathLength="1" strokeDasharray="1" strokeDashoffset="1" fill="none" />
        </svg>
        <div ref={shipRef} className={styles.titleShip} aria-hidden="true">
          <span className={styles.titleShipExhaust} />
          <svg viewBox="0 0 36 36" fill="none">
            <path d="m31 18-22-9 4 9-4 9 22-9Z" fill="#c7d7dd" stroke="#eaf7fa" strokeWidth=".8" strokeLinejoin="round" />
            <path d="m13 18 18 0m-12-2-3-1 2 6" stroke="#687f88" strokeWidth="1" />
            <path d="m10 11-4 3 7 4-7 4 4 3" fill="#708995" stroke="#a8c4d0" strokeWidth=".65" />
            <ellipse cx="23" cy="18" rx="3" ry="1.6" fill="#163447" stroke="#98d2df" strokeWidth=".6" />
          </svg>
        </div>
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
          <div className={styles.dragZone}>
            <div className={styles.dragTrack} aria-hidden="true" />
            <span className={styles.dragDestination} aria-hidden="true" />
            <button
              ref={handleRef}
              className={styles.dragHandle}
              type="button"
              disabled={!titleReady || entering}
              aria-label="Drag down and release to reveal the universe, or press Enter"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={() => {
                if (pointerRef.current !== null) cancelDrag();
              }}
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
