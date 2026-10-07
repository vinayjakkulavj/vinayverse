'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html, Line } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { AdditiveBlending, BackSide, Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import type { Line2 } from 'three/addons/lines/Line2.js';
import { worlds, topics, getTopic, type World, type WorldId } from '@/data/portfolio';
import { planetVertex, planetFragment, atmosphereFragment, haloVertex, haloFragment } from '@/lib/shaders';
import CosmicBackdrop from './CosmicBackdrop';
import PlanetImpacts from './PlanetImpacts';
import UniverseFormation from './UniverseFormation';
import MobilePlanetFocus from './MobilePlanetFocus';
import { createOrbitSampler } from '@/lib/orbits';
import { eclipseCoverage, type EclipseReading } from '@/lib/eclipse';
import { FORMATION_DURATION_MS } from '@/lib/formation';

type SceneProps = {
  focus: WorldId | null;
  onFocus: (world: WorldId | null) => void;
  onEnter: (slug: string) => void;
  rotation: MutableRefObject<{ x: number; y: number }>;
  reducedMotion: boolean;
  visited: string[];
  small: boolean;
  destination: string | null;
  sunLabel: RefObject<HTMLDivElement | null>;
  labelPortal: RefObject<HTMLElement>;
  formationId: number;
  formationStartedAt: MutableRefObject<number>;
  openingReveal: MutableRefObject<number>;
  onFormationComplete: () => void;
  onVisualReady: () => void;
  flightProgress: MutableRefObject<number>;
  opening: boolean;
  forming: boolean;
};
type ObjectMap = MutableRefObject<Map<string, Group>>;
type FormationProgress = MutableRefObject<number> & { compact: boolean };

function smootherstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function formationReveal(progress: FormationProgress) {
  return smootherstep((progress.current - .855) / .135);
}

// A single frame clock keeps the travelling particles and solid spheres together.
function useFormation(formationId: number, startedAt: SceneProps['formationStartedAt'], onComplete: () => void, reducedMotion: boolean, opening: boolean, compact = false) {
  const progress = useRef<FormationProgress>({ current: reducedMotion ? 1 : formationId > 0 ? 0 : opening ? .14 : 1, compact }).current;
  const pending = useRef(false);
  const activeId = useRef(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useLayoutEffect(() => {
    if (formationId <= 0) {
      progress.current = reducedMotion ? 1 : opening ? .14 : 1;
      pending.current = false;
      activeId.current = 0;
      return;
    }
    // Removing the gate during the running formation must keep its clock.
    if (activeId.current === formationId && !reducedMotion) return;
    const alreadyComplete = activeId.current === formationId && !pending.current && progress.current === 1;
    activeId.current = formationId;
    progress.current = reducedMotion ? 1 : 0;
    pending.current = !reducedMotion;
    if (reducedMotion && !alreadyComplete) complete.current();
  }, [formationId, reducedMotion, opening]);
  useFrame(() => {
    if (!pending.current) return;
    progress.current = Math.min(1, (performance.now() - startedAt.current) / FORMATION_DURATION_MS);
    if (progress.current === 1) {
      pending.current = false;
      complete.current();
    }
  }, -2);
  return progress;
}

function useTravellerVisibility(formation: FormationProgress, opening: boolean, forming: boolean) {
  const visible = useRef(!opening && !forming && formation.current === 1);
  // Root forming also includes the phone canvas settling into its final space.
  useFrame(() => { visible.current = !opening && !forming && formation.current === 1; }, -1.5);
  return visible;
}

function FormationBody({ formation, children, grow = true }: { formation: FormationProgress; children: ReactNode; grow?: boolean }) {
  const group = useRef<Group>(null);
  const opacities = useMemo(() => new WeakMap<MeshBasicMaterial, number>(), []);
  const restoring = useRef(false);
  useFrame(() => {
    if (!group.current) return;
    const amount = formationReveal(formation);
    group.current.visible = amount > .001;
    group.current.scale.setScalar(grow ? .82 + amount * .18 : 1);
    if (formation.current === 1 && !restoring.current) return;
    group.current.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof MeshBasicMaterial) || !material.transparent) continue;
        if (!opacities.has(material)) opacities.set(material, material.opacity);
        material.opacity = opacities.get(material)! * amount;
      }
    });
    restoring.current = formation.current < 1;
  });
  return <group ref={group} visible={formationReveal(formation) > .001}>{children}</group>;
}

type FormationLabelProps = Omit<ComponentProps<typeof Html>, 'children'> & { formation: FormationProgress; children: ReactNode; passive?: boolean };

function FormationLabel({ formation, children, passive = false, ...htmlProps }: FormationLabelProps) {
  const node = useRef<HTMLDivElement>(null);
  const previous = useRef('');
  useFrame(() => {
    if (!node.current) return;
    const amount = smootherstep((formation.current - .95) / .05);
    const opacity = amount.toFixed(3);
    if (previous.current === opacity) return;
    node.current.style.opacity = opacity;
    node.current.style.visibility = amount > .001 ? 'visible' : 'hidden';
    node.current.style.pointerEvents = !passive && amount > .99 ? 'auto' : 'none';
    previous.current = opacity;
  });
  return <Html {...htmlProps} wrapperClass={passive ? 'compact-passive-label' : htmlProps.wrapperClass} style={passive ? { ...htmlProps.style, pointerEvents: 'none' } : htmlProps.style}><div ref={node} style={{ opacity: formation.current === 1 ? 1 : 0 }}>{children}</div></Html>;
}

const formingPlanetFragment = planetFragment
  .replace('uniform float uTime;', 'uniform float uTime;\nuniform float uReveal;')
  .replace('vec4(color*uBrightness,1.0)', 'vec4(color*uBrightness,uReveal)');

const orbital = [
  // The canonical formation ends as lower-left / upper-left / right stations.
  { radius: 3.35, height: .68, depth: .45, node: -.06, phase: 4.16, speed: .027 },
  { radius: 4.75, height: .72, depth: -.7, node: .08, phase: 2.10, speed: .018 },
  { radius: 6.25, height: .74, depth: 1.05, node: -.035, phase: .02, speed: .012 },
];
const orbitSamplers = orbital.map(createOrbitSampler);

// Exponential damping has the same response time at every refresh rate.
function damping(rate: number, delta: number) {
  return -Math.expm1(-Math.max(delta, 0) * rate);
}

function useEclipses(objects: ObjectMap, formation: FormationProgress, small: boolean, reducedMotion: boolean) {
  const readings = useMemo<EclipseReading[]>(() => worlds.map(() => ({ amount: 0, occluder: null })), []);
  const positions = useMemo(() => worlds.map(() => new Vector3()), []);
  const present = useMemo(() => new Uint8Array(worlds.length), []);
  const radii = useMemo(() => small ? [.48, .46, .53] : [.5, .52, .57], [small]);
  const sunPosition = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const sun = objects.current.get('sun');
    if (!sun) return;
    sun.updateWorldMatrix(true, false);
    sun.getWorldPosition(sunPosition);
    worlds.forEach((world, index) => {
      const object = objects.current.get(world.slug);
      present[index] = object ? 1 : 0;
      if (!object) return;
      object.updateWorldMatrix(true, false);
      object.getWorldPosition(positions[index]);
    });
    for (let receiver = 0; receiver < worlds.length; receiver += 1) {
      let coverage = 0;
      let source: string | null = null;
      if (formation.current === 1 && present[receiver]) {
        for (let occluder = 0; occluder < worlds.length; occluder += 1) {
          if (occluder === receiver || !present[occluder]) continue;
          const overlap = eclipseCoverage(sunPosition, small ? .67 : .9, positions[occluder], radii[occluder], positions[receiver]);
          if (overlap > coverage) { coverage = overlap; source = worlds[occluder].slug; }
        }
      }
      const reading = readings[receiver];
      reading.amount += (coverage - reading.amount) * (reducedMotion ? 1 : damping(4, delta));
      reading.occluder = source ?? (reading.amount > .005 ? reading.occluder : null);
    }
  }, -.75);
  return readings;
}

function useEclipseCaption<Element extends HTMLElement = HTMLButtonElement>(eclipse: EclipseReading) {
  const caption = useRef<Element>(null);
  useFrame(() => {
    if (!caption.current) return;
    const amount = (Math.round(eclipse.amount * 50) / 50).toFixed(2);
    if (caption.current.dataset.eclipse !== amount) caption.current.dataset.eclipse = amount;
    const source = eclipse.occluder ?? '';
    if (caption.current.dataset.eclipseSource !== source) caption.current.dataset.eclipseSource = source;
  });
  return caption;
}

type OrbitPreview = { start: number; target: number; elapsed: number };

function useOrbitPreview(phase: MutableRefObject<number>, formation: FormationProgress, reducedMotion: boolean) {
  const preview = useRef<OrbitPreview | null>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    const align = () => {
      if (formation.current !== 1) return;
      const wrapped = ((phase.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const shortest = wrapped > Math.PI ? Math.PI * 2 - wrapped : -wrapped;
      if (reducedMotion) phase.current += shortest;
      else preview.current = { start: phase.current, target: phase.current + shortest, elapsed: 0 };
      invalidate();
    };
    window.addEventListener('vinayverse-preview-eclipse', align);
    return () => window.removeEventListener('vinayverse-preview-eclipse', align);
  }, [formation, invalidate, phase, reducedMotion]);
  return preview;
}

function advanceOrbitalPhase(phase: MutableRefObject<number>, preview: MutableRefObject<OrbitPreview | null>, initial: number, speed: number, formation: FormationProgress, reducedMotion: boolean, delta: number) {
  if (formation.current < 1) { phase.current = initial; preview.current = null; }
  else if (preview.current) {
    const alignment = preview.current;
    alignment.elapsed += Math.min(delta, .1);
    const amount = smootherstep(alignment.elapsed / 2.8);
    phase.current = alignment.start + (alignment.target - alignment.start) * amount;
    if (amount === 1) preview.current = null;
  } else if (!reducedMotion) phase.current += delta * speed;
}

function WorldTrack({ index, focus }: { index: number; focus: WorldId | null }) {
  const points = useMemo(() => Array.from({length:241},(_,step)=>orbitSamplers[index](new Vector3(),step/240*Math.PI*2)),[index]);
  const selected = focus === worlds[index].id;
  return <Line points={points} color={worlds[index].color} transparent opacity={selected ? .43 : focus ? .12 : .25} lineWidth={selected ? 1.15 : .9} depthWrite={false}/>;
}

function Orbit({ radius, height = 1, color, opacity, tilt = 0 }: { radius: number; height?: number; color: string; opacity: number; tilt?: number }) {
  const points = useMemo(() => {
    const sampleOrbit = createOrbitSampler({ radius, height, depth: tilt, node: 0 });
    return Array.from({ length: 161 }, (_, index) => sampleOrbit(new Vector3(),index/160*Math.PI*2));
  }, [radius, height, tilt]);
  return <Line points={points} color={color} transparent opacity={opacity} lineWidth={.65} depthWrite={false}/>;
}

function Planet({ radius, color, kind, dim, reducedMotion, formation, eclipse, energy = 0, selected }: { radius: number; color: string; kind: number; dim: boolean; reducedMotion: boolean; formation: FormationProgress; eclipse?: EclipseReading; energy?: number; selected?: boolean }) {
  const surface = useRef<ShaderMaterial>(null);
  const atmosphere = useRef<ShaderMaterial>(null);
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new Color(color) }, uKind: { value: kind }, uBrightness: { value: 1 }, uEnergy: { value: energy }, uReveal: { value: 1 } }), [color, kind, energy]);
  const atmosphereUniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uOpacity: { value: .35 } }), [color]);
  const tiny = radius < .2;
  useFrame((_, delta) => {
    const illumination = 1 - (eclipse?.amount ?? 0) * .86;
    if (surface.current) {
      if (!reducedMotion) surface.current.uniforms.uTime.value += Math.min(delta,.05);
      surface.current.uniforms.uBrightness.value += ((dim ? .34 : selected ? 1.18 : 1) * illumination - surface.current.uniforms.uBrightness.value) * (reducedMotion ? 1 : damping(5, delta));
      surface.current.uniforms.uReveal.value = formationReveal(formation);
    }
    if (atmosphere.current) {
      const opacity = (dim ? .07 : selected ? .75 : kind === 0 ? .19 : .3) * illumination * formationReveal(formation);
      if (selected === undefined) atmosphere.current.uniforms.uOpacity.value = opacity;
      else atmosphere.current.uniforms.uOpacity.value += (opacity - atmosphere.current.uniforms.uOpacity.value) * (reducedMotion ? 1 : damping(12, delta));
    }
    if (mesh.current && !reducedMotion) mesh.current.rotation.y += delta * (kind === 0 ? .14 : .045);
  });
  return <group>
    <group rotation={[0,0,kind === 0 ? -.12 : 0]}><mesh ref={mesh}><sphereGeometry args={tiny ? [radius, 24, 16] : [radius, 56, 40]}/><shaderMaterial ref={surface} uniforms={uniforms} vertexShader={planetVertex} fragmentShader={formingPlanetFragment} transparent toneMapped={false}/></mesh></group>
    <mesh scale={kind === 0 ? 1.035 : 1.09}><sphereGeometry args={tiny ? [radius, 20, 14] : [radius, 40, 28]}/><shaderMaterial ref={atmosphere} uniforms={atmosphereUniforms} vertexShader={planetVertex} fragmentShader={atmosphereFragment} side={BackSide} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
  </group>;
}

function Halo({ color, size, opacity, formation, eclipse }: { color: string; size: number; opacity: number; formation: FormationProgress; eclipse?: EclipseReading }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uOpacity: { value: opacity } }), [color, opacity]);
  useFrame(() => { if (material.current) material.current.uniforms.uOpacity.value = opacity * (1 - (eclipse?.amount ?? 0) * .86) * formationReveal(formation); });
  return <Billboard position={[0,0,-.25]}><mesh raycast={() => undefined}><planeGeometry args={[size,size]}/><shaderMaterial ref={material} uniforms={uniforms} vertexShader={haloVertex} fragmentShader={haloFragment} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh></Billboard>;
}

function PlanetRing({ dim, eclipse, formation, compact = false }: { dim: boolean; eclipse: EclipseReading; formation: FormationProgress; compact?: boolean }) {
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => { if (material.current) material.current.opacity = (dim ? .07 : .23) * (1 - eclipse.amount * .86) * formationReveal(formation); });
  return <mesh rotation={[1.15,.25,-.38]}><ringGeometry args={[.77,1.03,compact ? 64 : 100]}/><meshBasicMaterial ref={material} color="#75b9ba" transparent opacity={dim ? .07 : .23} side={2} depthWrite={false}/></mesh>;
}

function Sun({ visited, reducedMotion, formation }: { visited: string[]; focus: WorldId | null; reducedMotion: boolean; formation: FormationProgress }) {
  const energy = Math.min(visited.length/12,1);
  return <Planet radius={.9} color="#bc4b2e" kind={0} dim={false} reducedMotion={reducedMotion} formation={formation} energy={energy}/>;
}

function Moon({ slug, color, kind, index, count, active, reducedMotion, onEnter, objects, visited, labelPortal, small, formation }: { slug: string; color: string; kind: number; index: number; count: number; active: boolean; reducedMotion: boolean; onEnter: (slug: string) => void; objects: ObjectMap; visited: string[]; labelPortal: RefObject<HTMLElement>; small: boolean; formation: FormationProgress }) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const phase = useRef(index*Math.PI*2/count + .45);
  const sampleOrbit = useMemo(() => createOrbitSampler({ radius: 1.65, height: kind === 2 ? .83 : .95, depth: .22, node: 0 }), [kind]);
  const initialPosition = useMemo(() => sampleOrbit(new Vector3(),phase.current), [sampleOrbit]);
  const topic = getTopic(slug)!;
  const [hover, setHover] = useState(false);
  useEffect(() => { if (group.current) objects.current.set(slug, group.current); return () => { objects.current.delete(slug); }; }, [slug, objects]);
  useFrame((_, delta) => {
    if (!group.current) return;
    if (!reducedMotion) phase.current += delta*.065*(kind === 3 ? (index % 2 ? -.7 : 1.2) : 1);
    sampleOrbit(group.current.position,phase.current);
    if (body.current) {
      const target = active ? formationReveal(formation) : 0;
      const scale = reducedMotion ? target : body.current.scale.x + (target-body.current.scale.x)*damping(6,delta);
      body.current.scale.setScalar(scale);
      body.current.visible = formation.current >= .86 && active && scale > .001;
    }
  }, -1);
  // Keep the orbit anchor and HTML label at full scale from their first render.
  return <group ref={group} position={initialPosition}>
    <group ref={body} scale={0} visible={active} onPointerOver={(event) => { event.stopPropagation(); if (formation.current === 1) setHover(true); }} onPointerOut={() => setHover(false)} onClick={(event) => { event.stopPropagation(); if (active && formation.current === 1) onEnter(slug); }}>
      <group scale={hover ? 1.16 : 1}>
        <Planet radius={.135+(index===0?.035:0)} color={color} kind={kind} dim={!active} reducedMotion={reducedMotion} formation={formation}/>
        {visited.includes(slug) && <mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[.21,.22,40]}/><meshBasicMaterial color={color} transparent opacity={.5} side={2}/></mesh>}
      </group>
    </group>
    {active && <Billboard><FormationLabel portal={labelPortal} center position={[0,-.36,0]} zIndexRange={[7,0]} formation={formation}><button className="moon-label" data-gravity onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} onClick={() => onEnter(slug)} aria-label={`Explore ${topic.title}`}>{small ? String(index+1).padStart(2,'0') : topic.title}</button></FormationLabel></Billboard>}
  </group>;
}

function WorldSystem({ world, index, focus, onFocus, onEnter, reducedMotion, objects, visited, labelPortal, small, formation, formationId, opening, forming, eclipse }: { world: World; index: number; focus: WorldId | null; onFocus: SceneProps['onFocus']; onEnter: SceneProps['onEnter']; reducedMotion: boolean; objects: ObjectMap; visited: string[]; labelPortal: RefObject<HTMLElement>; small: boolean; formation: FormationProgress; formationId: number; opening: boolean; forming: boolean; eclipse: EclipseReading }) {
  const group = useRef<Group>(null);
  const phase = useRef(orbital[index].phase);
  const preview = useOrbitPreview(phase, formation, reducedMotion);
  const caption = useEclipseCaption(eclipse);
  const [hover, setHover] = useState(false);
  const active = focus === world.id;
  const dim = focus !== null && !active;
  const radius = index===0 ? .5 : index===1 ? .52 : .57;
  const initialPosition = useMemo(()=>orbitSamplers[index](new Vector3(),orbital[index].phase),[index]);
  useEffect(() => { if (group.current) objects.current.set(world.slug, group.current); return () => { objects.current.delete(world.slug); }; }, [world.slug, objects]);
  useLayoutEffect(() => {
    if (!opening && formationId === 0) return;
    phase.current = orbital[index].phase;
    if (group.current) orbitSamplers[index](group.current.position, phase.current);
  }, [index, opening, formationId]);
  useFrame((_, delta) => {
    if (!group.current) return;
    advanceOrbitalPhase(phase, preview, orbital[index].phase, orbital[index].speed, formation, reducedMotion, delta);
    orbitSamplers[index](group.current.position,phase.current);
  }, -1);
  const choose = () => { if (formation.current === 1) { if (active) onEnter(world.slug); else onFocus(world.id); } };
  const hoverWorld = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); if (formation.current < 1) return; setHover(true); if (event.pointerType === 'mouse') onFocus(world.id); };
  return <group ref={group} position={initialPosition}>
    <FormationBody formation={formation}><group onPointerOver={hoverWorld} onPointerOut={() => setHover(false)} onClick={(event) => { event.stopPropagation(); choose(); }}>
      <Halo color={world.color} size={2.8} opacity={dim ? .06 : hover ? .23 : .12} formation={formation} eclipse={eclipse}/>
      <Planet radius={radius} color={world.color} kind={index+1} dim={dim} reducedMotion={reducedMotion} formation={formation} eclipse={eclipse}/>
      {!opening && !forming && <PlanetImpacts radius={radius} index={index} dim={dim} reducedMotion={reducedMotion}/>}
      {index===2 && <PlanetRing dim={dim} eclipse={eclipse} formation={formation}/>}
    </group></FormationBody>
    <Billboard><FormationLabel portal={labelPortal} center position={[0,-radius-.37,0]} zIndexRange={[6,0]} formation={formation}><button ref={caption} className="planet-label" data-gravity data-active={active} data-eclipse="0.00" data-eclipse-source="" style={{ opacity: dim ? .4 : 1 }} onFocus={(event) => { if(event.currentTarget.matches(':focus-visible') && formation.current === 1) onFocus(world.id); }} onClick={(event) => { event.stopPropagation(); choose(); }} aria-label={`${active ? 'Enter' : 'Focus'} ${world.title}`}><strong>{world.title}</strong><small>{world.subtitle}</small></button></FormationLabel></Billboard>
    {active && <FormationBody formation={formation} grow={false}><Orbit radius={1.65} height={index===1?.83:.95} color={world.color} opacity={.2} tilt={.22}/></FormationBody>}
    {world.topics.map((slug, moonIndex) => <Moon key={slug} slug={slug} index={moonIndex} count={world.topics.length} color={world.color} kind={index+1} active={active} reducedMotion={reducedMotion} onEnter={onEnter} objects={objects} visited={visited} labelPortal={labelPortal} small={small} formation={formation}/>)}
  </group>;
}

const constellationPositions: Record<string, [number,number,number]> = {
  soundtrack: [3.7,-2.9,-1],
  'on-the-road': [-3.0,-3.2,-1],
  'small-things': [-5.5,.9,-1],
  science: [1.75,-3.15,-1],
  'what-if': [5.3,1.1,-1],
};

function Constellations({ onEnter, focus, objects, labelPortal, formation }: { onEnter: SceneProps['onEnter']; focus: WorldId | null; objects: ObjectMap; labelPortal: RefObject<HTMLElement>; formation: FormationProgress }) {
  const constellationTopics = topics.filter((topic)=>topic.kind==='constellation');
  const [active, setActive] = useState<string | null>(null);
  const points = useMemo(() => [new Vector3(-.4,.05,0),new Vector3(-.13,.26,0),new Vector3(.05,-.08,0),new Vector3(.35,.14,0)],[]);
  return <group>{constellationTopics.map((topic) => <group key={topic.slug} position={constellationPositions[topic.slug]} ref={(node) => { if (node) objects.current.set(topic.slug, node); else objects.current.delete(topic.slug); }}>
    <Line points={points} color="#8da8d1" transparent opacity={active===topic.slug?.45:.035} lineWidth={.7}/>
    {points.map((point,starIndex)=><mesh key={starIndex} position={point}><sphereGeometry args={[active===topic.slug?.026:.015,8,6]}/><meshBasicMaterial color="#b5cbe9" transparent opacity={focus?.2:.6}/></mesh>)}
    <FormationLabel portal={labelPortal} center position={[0,-.27,0]} zIndexRange={[4,0]} formation={formation}><button className="constellation-label" onPointerEnter={()=>setActive(topic.slug)} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive(topic.slug)} onBlur={()=>setActive(null)} onClick={()=>onEnter(topic.slug)} aria-label={`Discover ${topic.title}`} style={{ opacity: focus?.2:1 }}>{active===topic.slug?topic.title:'✧'}</button></FormationLabel>
  </group>)}</group>;
}

function DiscoveryTrail({ visited }: { visited: string[] }) {
  const points = useMemo(() => visited.map((slug,index) => {
    const hash = [...slug].reduce((sum,char)=>sum+char.charCodeAt(0),0);
    return new Vector3(Math.sin(hash*.7)*5.8,Math.cos(hash*.3)*3.6,-2-index*.015);
  }),[visited]);
  return <group>{points.length>1 && <Line points={points} color="#89a7cc" transparent opacity={.13} lineWidth={.7}/>} {points.map((point,index)=><mesh key={visited[index]} position={point}><sphereGeometry args={[.02,8,6]}/><meshBasicMaterial color="#c2d5ef" transparent opacity={.8}/></mesh>)}</group>;
}

function destinationRadius(destination: string, small: boolean) {
  const index = worlds.findIndex((world) => world.slug === destination);
  if (index >= 0) return small ? [.48,.46,.53][index] : [.5,.52,.57][index];
  const topic = getTopic(destination);
  return topic?.kind === 'constellation' ? .06 : .16;
}

function compactCameraDistance(width: number, height: number) {
  const verticalHalfAngle = 42 * Math.PI / 360;
  const compactHeight = Math.max(300, Math.min(380, width * .78));
  const settledAspect = width / compactHeight;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * Math.max(settledAspect, .01));
  const settledDistance = 4.95 / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle));
  // Keep the same pixels per world unit while the full-screen canvas settles.
  // An aspect-dependent fit otherwise changes planet size partway through the morph.
  return settledDistance * height / compactHeight;
}

function CameraRig({ objects, small, destination, reducedMotion, flightProgress }: { objects: ObjectMap; small: boolean; destination: string | null; reducedMotion: boolean; flightProgress: SceneProps['flightProgress'] }) {
  const { camera, size, invalidate } = useThree();
  const target = useRef(new Vector3(0, small ? -.22 : .1, 0));
  const point = useMemo(() => new Vector3(), []);
  const cameraGoal = useMemo(() => new Vector3(), []);
  const start = useRef(new Vector3());
  const startLook = useRef(new Vector3());
  const direction = useRef(new Vector3(0,0,1));
  const side = useRef(new Vector3(1,0,0));
  const flightDestination = useRef<string | null>(null);
  const up = useMemo(() => new Vector3(0,1,0), []);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || size.width <= 0 || size.height <= 0) return;
    camera.aspect = size.width / size.height;
    if (small && !destination) {
      camera.position.set(0,-.22,compactCameraDistance(size.width, size.height));
      camera.lookAt(0,-.22,0);
      target.current.set(0,-.22,0);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, destination, small, size.width, size.height, invalidate]);
  useFrame((_, delta) => {
    if (destination) {
      const object = objects.current.get(destination);
      if (!object) return;
      object.updateWorldMatrix(true, false);
      object.getWorldPosition(point);
      if (flightDestination.current !== destination) {
        flightDestination.current = destination;
        start.current.copy(camera.position);
        startLook.current.copy(target.current);
        direction.current.copy(start.current).sub(point).normalize();
        side.current.crossVectors(up, direction.current).normalize();
      }
      const progress = reducedMotion ? 1 : Math.max(0, Math.min(1, flightProgress.current));
      const travel = smootherstep(progress);
      // Finish just inside the rim. The view crosses the atmosphere instead of
      // snapping to a fixed zoom, and the endpoint follows the moving planet.
      cameraGoal.copy(point).addScaledVector(direction.current, destinationRadius(destination, small) * .92);
      camera.position.lerpVectors(start.current, cameraGoal, travel);
      camera.position.addScaledVector(side.current, Math.sin(progress * Math.PI) * (small ? .09 : .18));
      target.current.lerpVectors(startLook.current, point, smootherstep(progress / .65));
      if (camera instanceof PerspectiveCamera) {
        const fov = 42 + smootherstep((progress - .5) / .5) * 6;
        if (Math.abs(camera.fov - fov) > .005) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
      }
    } else {
      flightDestination.current = null;
      const aspect = size.width / Math.max(size.height, 1);
      const z = small
        ? compactCameraDistance(size.width, size.height)
        : Math.max(14.8, 16.5 / (2 * Math.tan(42 * Math.PI / 360) * aspect));
      point.set(0,small ? -.22 : .1,0);
      cameraGoal.copy(point);
      cameraGoal.z += z;
      const speed = reducedMotion ? 1 : damping(7.5, delta);
      camera.position.lerp(cameraGoal, speed);
      target.current.lerp(point, speed);
      if (camera instanceof PerspectiveCamera && camera.fov !== 42) {
        camera.fov = 42;
        camera.updateProjectionMatrix();
      }
    }
    camera.lookAt(target.current);
    // HTML labels project through this frame's updated view matrix.
    camera.updateMatrixWorld();
  }, -.5);
  return null;
}

function SunLabel({ sunLabel, objects, small, focus, formation, destination }: { sunLabel: SceneProps['sunLabel']; objects: ObjectMap; small: boolean; focus: WorldId | null; formation: FormationProgress; destination: string | null }) {
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  const previous = useRef<{ node: HTMLDivElement | null; transform: string; opacity: string; visibility: string }>({ node: null, transform: '', opacity: '', visibility: '' });
  useFrame(() => {
    const label = sunLabel.current;
    const sun = objects.current.get('sun');
    if (!label || !sun) return;
    sun.updateWorldMatrix(true, false);
    sun.getWorldPosition(point);
    point.y += small ? .94 : -1.45;
    point.project(camera);
    const transform = `translate3d(${((point.x*.5+.5)*size.width).toFixed(2)}px,${((-point.y*.5+.5)*size.height).toFixed(2)}px,0) translate(-50%,-50%)`;
    const opacity = (formationReveal(formation) * (focus && !small ? .5 : 1)).toFixed(3);
    const visibility = destination || formation.current < .95 || point.z > 1 || point.z < -1 ? 'hidden' : 'visible';
    const replaced = previous.current.node !== label;
    if (replaced || previous.current.transform !== transform) label.style.transform = transform;
    if (replaced || previous.current.opacity !== opacity) label.style.opacity = opacity;
    if (replaced || previous.current.visibility !== visibility) label.style.visibility = visibility;
    previous.current.node = label;
    previous.current.transform = transform;
    previous.current.opacity = opacity;
    previous.current.visibility = visibility;
  });
  return null;
}

const compactWorldPositions: [number, number, number][] = [
  [-1.95, -1.05, 0], // Professional: lower left.
  [-1.95, 1.45, 0], // Know Me: upper left.
  [2.12, .35, 0], // Project Pandora: right.
];
const compactSunPosition: [number, number, number] = [0, .12, -.2];

// Separated tracks allow real alignments without the stylized planet bodies
// crossing each other. The camera still fits them inside the compact canvas.
const compactOrbital = [
  { radius: 1.4, height: .93, depth: 0, node: 0, speed: .055 },
  { radius: 2.5, height: .93, depth: 0, node: 0, speed: .034 },
  { radius: 3.7, height: .93, depth: 0, node: 0, speed: .022 },
];
const compactOrbitSamplers = compactOrbital.map(createOrbitSampler);
const compactInitialPhases = compactWorldPositions.map((position, index) => {
  const height = compactOrbital[index].height;
  const angle = (Math.atan2((position[1] - compactSunPosition[1]) / height, position[0]) + Math.PI * 2) % (Math.PI * 2);
  const point = new Vector3();
  let low = 0;
  let high = Math.PI * 2;
  // Solve arc phase once, so the familiar triangle also starts at constant
  // geometric orbit speed rather than changing speed around the ellipse.
  for (let step = 0; step < 28; step += 1) {
    const middle = (low + high) / 2;
    compactOrbitSamplers[index](point, middle);
    const sampledAngle = (Math.atan2(point.y / height, point.x) + Math.PI * 2) % (Math.PI * 2);
    if (sampledAngle < angle) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
});

function CompactTrack({ index, selected, formation, reducedMotion }: { index: number; selected: boolean; formation: FormationProgress; reducedMotion: boolean }) {
  const line = useRef<Line2>(null);
  const points = useMemo(() => Array.from({ length: 161 }, (_, step) => compactOrbitSamplers[index](new Vector3(), step / 160 * Math.PI * 2)), [index]);
  useFrame((_, delta) => {
    if (!line.current) return;
    const target = (selected ? .66 : .34) * formationReveal(formation);
    if (reducedMotion) line.current.material.opacity = target;
    else line.current.material.opacity += (target - line.current.material.opacity) * damping(15, delta);
  });
  return <group position={compactSunPosition}><Line ref={line} points={points} color={worlds[index].color} transparent opacity={0} lineWidth={selected ? 2 : 1.3} depthWrite={false}/></group>;
}

function CompactWorld({ world, index, selected, onFocus, onEnter, reducedMotion, labelPortal, objects, formation, formationId, opening, eclipse }: { world: World; index: number; selected: boolean; onFocus: SceneProps['onFocus']; onEnter: SceneProps['onEnter']; reducedMotion: boolean; labelPortal: RefObject<HTMLElement>; objects: ObjectMap; formation: FormationProgress; formationId: number; opening: boolean; eclipse: EclipseReading }) {
  const radius = index === 0 ? .48 : index === 1 ? .46 : .53;
  const group = useRef<Group>(null);
  const phase = useRef(compactInitialPhases[index]);
  const preview = useOrbitPreview(phase, formation, reducedMotion);
  const caption = useEclipseCaption<HTMLDivElement>(eclipse);
  const initialPosition = useMemo(() => compactOrbitSamplers[index](new Vector3(), compactInitialPhases[index]).add(new Vector3(...compactSunPosition)), [index]);
  useEffect(() => { if (group.current) objects.current.set(world.slug, group.current); return () => { objects.current.delete(world.slug); }; }, [world.slug, objects]);
  useLayoutEffect(() => {
    if (!opening && formationId === 0) return;
    phase.current = compactInitialPhases[index];
    if (group.current) {
      compactOrbitSamplers[index](group.current.position, phase.current);
      group.current.position.x += compactSunPosition[0];
      group.current.position.y += compactSunPosition[1];
      group.current.position.z += compactSunPosition[2];
    }
  }, [index, opening, formationId]);
  useFrame((_, delta) => {
    if (!group.current) return;
    advanceOrbitalPhase(phase, preview, compactInitialPhases[index], compactOrbital[index].speed, formation, reducedMotion, delta);
    compactOrbitSamplers[index](group.current.position, phase.current);
    group.current.position.x += compactSunPosition[0];
    group.current.position.y += compactSunPosition[1];
    group.current.position.z += compactSunPosition[2];
  }, -1);
  const select = () => { if (formation.current === 1) { if (selected) onEnter(world.slug); else onFocus(world.id); } };
  return <group ref={group} position={initialPosition}>
    <FormationBody formation={formation}><group>
      <Halo color={world.color} size={2.15} opacity={.07} formation={formation} eclipse={eclipse}/>
      <Planet radius={radius} color={world.color} kind={index + 1} dim={false} selected={selected} reducedMotion={reducedMotion} formation={formation} eclipse={eclipse}/>
      <MobilePlanetFocus color={world.color} radius={radius} selected={selected} reducedMotion={reducedMotion}/>
      {index === 2 && <PlanetRing dim={false} eclipse={eclipse} formation={formation} compact/>}
      {/* Only the planet body handles taps; captions, rings and glow are decorative. */}
      <mesh onClick={(event) => { event.stopPropagation(); select(); }}>
        <sphereGeometry args={[radius, 32, 24]}/>
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false}/>
      </mesh>
    </group></FormationBody>
    <Billboard><FormationLabel portal={labelPortal} center position={[0,-radius-.65,0]} zIndexRange={[6,0]} formation={formation} passive><div ref={caption} className="planet-label compact-planet-label" data-world={world.id} data-selected={selected} style={{ '--planet-accent': world.color } as CSSProperties} data-eclipse="0.00" data-eclipse-source="">
        <strong>{world.title}</strong>
      </div></FormationLabel></Billboard>
  </group>;
}

function CompactScene({ focus, onFocus, onEnter, rotation, reducedMotion, visited, sunLabel, labelPortal, formationId, formationStartedAt, openingReveal, onFormationComplete, onVisualReady, destination, flightProgress, opening, forming }: SceneProps) {
  const group = useRef<Group>(null);
  const objects = useRef(new Map<string, Group>());
  const formation = useFormation(formationId, formationStartedAt, onFormationComplete, reducedMotion, opening, true);
  const eclipses = useEclipses(objects, formation, true, reducedMotion);
  const travellersVisible = useTravellerVisibility(formation, opening, forming);
  const { invalidate } = useThree();
  useEffect(() => { const refresh = () => invalidate(); window.addEventListener('douknowme-rotate', refresh); return () => window.removeEventListener('douknowme-rotate', refresh); }, [invalidate]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const speed = reducedMotion ? 1 : damping(14, delta);
    const pitch = Math.max(-.55, Math.min(.55, rotation.current.x + .13));
    group.current.rotation.x += (pitch - group.current.rotation.x) * speed;
    group.current.rotation.y += (rotation.current.y + .12 - group.current.rotation.y) * speed;
    group.current.rotation.z += (.025 - group.current.rotation.z) * speed;
  }, -1);
  return <>
    <color attach="background" args={['#03050a']}/>
    <CameraRig objects={objects} small={true} destination={destination} reducedMotion={reducedMotion} flightProgress={flightProgress}/>
    <SunLabel sunLabel={sunLabel} objects={objects} small={true} focus={focus} formation={formation} destination={destination}/>
    <CosmicBackdrop rotation={rotation} reducedMotion={reducedMotion} small={true} travellersVisible={travellersVisible}/>
    <group ref={group} rotation={[-.06,0,.025]}>
    <group position={compactSunPosition} ref={(node) => { if (node) objects.current.set('sun', node); else objects.current.delete('sun'); }}>
      <FormationBody formation={formation}><Planet radius={.67} color="#bc4b2e" kind={0} dim={false} reducedMotion={reducedMotion} formation={formation} energy={Math.min(visited.length / 12, 1)}/></FormationBody>
    </group>
    {worlds.map((world,index) => <group key={world.id}>
      <FormationBody formation={formation} grow={false}><CompactTrack index={index} selected={focus === world.id} formation={formation} reducedMotion={reducedMotion}/></FormationBody>
      <CompactWorld world={world} index={index} selected={focus === world.id} onFocus={onFocus} onEnter={onEnter} reducedMotion={reducedMotion} labelPortal={labelPortal} objects={objects} formation={formation} formationId={formationId} opening={opening} eclipse={eclipses[index]}/>
    </group>)}
    </group>
    {!reducedMotion && (opening || forming) && <UniverseFormation progress={formation} targets={objects} small={true} reducedMotion={reducedMotion} preview={opening && formationId === 0} onReady={onVisualReady} openingReveal={openingReveal}/>}
  </>;
}

function Scene({ focus, onFocus, onEnter, rotation, reducedMotion, visited, small, destination, sunLabel, labelPortal, formationId, formationStartedAt, openingReveal, onFormationComplete, onVisualReady, flightProgress, opening, forming }: SceneProps) {
  const group = useRef<Group>(null);
  const objects = useRef(new Map<string, Group>());
  const formation = useFormation(formationId, formationStartedAt, onFormationComplete, reducedMotion, opening);
  const eclipses = useEclipses(objects, formation, small, reducedMotion);
  const travellersVisible = useTravellerVisibility(formation, opening, forming);
  const { invalidate } = useThree();
  useEffect(() => { const refresh = () => invalidate(); window.addEventListener('douknowme-rotate', refresh); return () => window.removeEventListener('douknowme-rotate', refresh); }, [invalidate]);
  // The modest axial tilt sits underneath the existing drag rotation. Canonical
  // orbit anchors remain still until formation ends, then resume constant speed.
  useFrame((_, delta) => {
    if (!group.current) return;
    const speed = reducedMotion ? 1 : damping(14, delta);
    group.current.rotation.x += (rotation.current.x - .08 - group.current.rotation.x) * speed;
    group.current.rotation.y += (rotation.current.y - group.current.rotation.y) * speed;
    group.current.rotation.z += (.14 - group.current.rotation.z) * speed;
  }, -1);
  return <>
    <color attach="background" args={['#03050a']}/>
    <CameraRig objects={objects} small={small} destination={destination} reducedMotion={reducedMotion} flightProgress={flightProgress}/>
    <SunLabel sunLabel={sunLabel} objects={objects} small={small} focus={focus} formation={formation} destination={destination}/>
    <CosmicBackdrop rotation={rotation} reducedMotion={reducedMotion} small={small} travellersVisible={travellersVisible}/>
    <group ref={group} rotation={[-.27,-.12,.14]}>
      <group ref={(node) => { if (node) objects.current.set('sun', node); else objects.current.delete('sun'); }}><FormationBody formation={formation}><Sun visited={visited} focus={focus} reducedMotion={reducedMotion} formation={formation}/></FormationBody></group>
      {worlds.map((world,index) => <group key={world.id}>
        <FormationBody formation={formation} grow={false}><WorldTrack index={index} focus={focus}/></FormationBody>
        <WorldSystem world={world} index={index} focus={focus} onFocus={onFocus} onEnter={onEnter} reducedMotion={reducedMotion} objects={objects} visited={visited} labelPortal={labelPortal} small={small} formation={formation} formationId={formationId} opening={opening} forming={forming} eclipse={eclipses[index]}/>
      </group>)}
      <FormationBody formation={formation} grow={false}>
        <Constellations onEnter={onEnter} focus={focus} objects={objects} labelPortal={labelPortal} formation={formation}/>
        <DiscoveryTrail visited={visited}/>
      </FormationBody>
    </group>
    {!reducedMotion && (opening || forming) && <UniverseFormation progress={formation} targets={objects} small={small} reducedMotion={reducedMotion} preview={opening && formationId === 0} onReady={onVisualReady} openingReveal={openingReveal}/>}
  </>;
}

export default function UniverseScene(props: SceneProps) {
  if (props.small) return <Canvas className="universe-canvas" style={{ touchAction: 'none' }} camera={{ position: [0,-.22,10], fov: 42, near: .03, far: 260 }} dpr={[1,1.65]} frameloop={props.reducedMotion?'demand':'always'} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<div className="scene-loading"><span>Explore with the universe map</span></div>}>
    <CompactScene {...props}/>
  </Canvas>;
  const aspect = typeof window === 'undefined' ? 1.5 : window.innerWidth / Math.max(window.innerHeight,1);
  const distance = Math.max(14.8,(props.small ? 18 : 16.5)/(2*Math.tan(42*Math.PI/360)*aspect));
  return <Canvas onPointerMissed={() => props.onFocus(null)} camera={{ position: [0,.1,distance], fov: 42, near: .03, far: 260 }} dpr={[1,2]} frameloop={props.reducedMotion?'demand':'always'} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<div className="scene-loading"><span>Explore with the universe map</span></div>}>
    <Scene {...props}/>
  </Canvas>;
}
