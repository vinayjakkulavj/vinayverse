'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html, Line } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { AdditiveBlending, BackSide, Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { worlds, topics, getTopic, type World, type WorldId } from '@/data/portfolio';
import { planetVertex, planetFragment, atmosphereFragment, haloVertex, haloFragment } from '@/lib/shaders';
import CosmicBackdrop from './CosmicBackdrop';
import PlanetImpacts from './PlanetImpacts';
import UniverseFormation from './UniverseFormation';
import { createOrbitSampler } from '@/lib/orbits';

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
  onFormationComplete: () => void;
  flightProgress: MutableRefObject<number>;
  opening: boolean;
  forming: boolean;
};
type ObjectMap = MutableRefObject<Map<string, Group>>;
type FormationProgress = MutableRefObject<number>;

function smootherstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function formationReveal(progress: FormationProgress) {
  return smootherstep((progress.current - .86) / .14);
}

// A single frame clock keeps the travelling particles and solid spheres together.
function useFormation(formationId: number, onComplete: () => void, reducedMotion: boolean, opening: boolean) {
  const progress = useRef(reducedMotion ? 1 : formationId > 0 ? 0 : opening ? .14 : 1);
  const elapsed = useRef(0);
  const pending = useRef(false);
  const activeId = useRef(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useLayoutEffect(() => {
    if (formationId <= 0) {
      progress.current = reducedMotion ? 1 : opening ? .14 : 1;
      pending.current = false;
      elapsed.current = 0;
      activeId.current = 0;
      return;
    }
    // Removing the gate during the running formation must keep its clock.
    if (activeId.current === formationId && !reducedMotion) return;
    const alreadyComplete = activeId.current === formationId && !pending.current && progress.current === 1;
    activeId.current = formationId;
    elapsed.current = 0;
    progress.current = reducedMotion ? 1 : 0;
    pending.current = !reducedMotion;
    if (reducedMotion && !alreadyComplete) complete.current();
  }, [formationId, reducedMotion, opening]);
  useFrame((_, delta) => {
    if (!pending.current) return;
    elapsed.current += Math.min(delta, .1);
    progress.current = Math.min(1, elapsed.current / 3.5);
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
  return <group ref={group} visible={formation.current >= .86}>{children}</group>;
}

type FormationLabelProps = Omit<ComponentProps<typeof Html>, 'children'> & { formation: FormationProgress; children: ReactNode };

function FormationLabel({ formation, children, ...htmlProps }: FormationLabelProps) {
  const node = useRef<HTMLDivElement>(null);
  const previous = useRef('');
  useFrame(() => {
    if (!node.current) return;
    const amount = smootherstep((formation.current - .95) / .05);
    const opacity = amount.toFixed(3);
    if (previous.current === opacity) return;
    node.current.style.opacity = opacity;
    node.current.style.visibility = amount > .001 ? 'visible' : 'hidden';
    node.current.style.pointerEvents = amount > .99 ? 'auto' : 'none';
    previous.current = opacity;
  });
  return <Html {...htmlProps}><div ref={node} style={{ opacity: formation.current === 1 ? 1 : 0 }}>{children}</div></Html>;
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

function Planet({ radius, color, kind, dim, reducedMotion, formation, energy = 0 }: { radius: number; color: string; kind: number; dim: boolean; reducedMotion: boolean; formation: FormationProgress; energy?: number }) {
  const surface = useRef<ShaderMaterial>(null);
  const atmosphere = useRef<ShaderMaterial>(null);
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new Color(color) }, uKind: { value: kind }, uBrightness: { value: 1 }, uEnergy: { value: energy }, uReveal: { value: 1 } }), [color, kind, energy]);
  const atmosphereUniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uOpacity: { value: .35 } }), [color]);
  const tiny = radius < .2;
  useFrame((_, delta) => {
    if (surface.current) {
      if (!reducedMotion) surface.current.uniforms.uTime.value += Math.min(delta,.05);
      surface.current.uniforms.uBrightness.value += ((dim ? .34 : 1) - surface.current.uniforms.uBrightness.value) * (reducedMotion ? 1 : damping(5, delta));
      surface.current.uniforms.uReveal.value = formationReveal(formation);
    }
    if (atmosphere.current) atmosphere.current.uniforms.uOpacity.value = (dim ? .07 : kind === 0 ? .19 : .3) * formationReveal(formation);
    if (mesh.current && !reducedMotion) mesh.current.rotation.y += delta * (kind === 0 ? .14 : .045);
  });
  return <group>
    <group rotation={[0,0,kind === 0 ? -.12 : 0]}><mesh ref={mesh}><sphereGeometry args={tiny ? [radius, 24, 16] : [radius, 56, 40]}/><shaderMaterial ref={surface} uniforms={uniforms} vertexShader={planetVertex} fragmentShader={formingPlanetFragment} transparent toneMapped={false}/></mesh></group>
    <mesh scale={kind === 0 ? 1.035 : 1.09}><sphereGeometry args={tiny ? [radius, 20, 14] : [radius, 40, 28]}/><shaderMaterial ref={atmosphere} uniforms={atmosphereUniforms} vertexShader={planetVertex} fragmentShader={atmosphereFragment} side={BackSide} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
  </group>;
}

function Halo({ color, size, opacity, formation }: { color: string; size: number; opacity: number; formation: FormationProgress }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uOpacity: { value: opacity } }), [color, opacity]);
  useFrame(() => { if (material.current) material.current.uniforms.uOpacity.value = opacity * formationReveal(formation); });
  return <Billboard position={[0,0,-.25]}><mesh raycast={() => undefined}><planeGeometry args={[size,size]}/><shaderMaterial ref={material} uniforms={uniforms} vertexShader={haloVertex} fragmentShader={haloFragment} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh></Billboard>;
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

function WorldSystem({ world, index, focus, onFocus, onEnter, reducedMotion, objects, visited, labelPortal, small, formation, formationId, opening, forming }: { world: World; index: number; focus: WorldId | null; onFocus: SceneProps['onFocus']; onEnter: SceneProps['onEnter']; reducedMotion: boolean; objects: ObjectMap; visited: string[]; labelPortal: RefObject<HTMLElement>; small: boolean; formation: FormationProgress; formationId: number; opening: boolean; forming: boolean }) {
  const group = useRef<Group>(null);
  const phase = useRef(orbital[index].phase);
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
    if (formation.current < 1) phase.current = orbital[index].phase;
    else if (!reducedMotion) phase.current += delta*orbital[index].speed;
    orbitSamplers[index](group.current.position,phase.current);
  }, -1);
  const choose = () => { if (formation.current === 1) { if (active) onEnter(world.slug); else onFocus(world.id); } };
  const hoverWorld = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); if (formation.current < 1) return; setHover(true); if (event.pointerType === 'mouse') onFocus(world.id); };
  return <group ref={group} position={initialPosition}>
    <FormationBody formation={formation}><group onPointerOver={hoverWorld} onPointerOut={() => setHover(false)} onClick={(event) => { event.stopPropagation(); choose(); }}>
      <Halo color={world.color} size={2.8} opacity={dim ? .06 : hover ? .23 : .12} formation={formation}/>
      <Planet radius={radius} color={world.color} kind={index+1} dim={dim} reducedMotion={reducedMotion} formation={formation}/>
      {!opening && !forming && <PlanetImpacts radius={radius} index={index} dim={dim} reducedMotion={reducedMotion}/>}
      {index===2 && <mesh rotation={[1.15,.25,-.38]}><ringGeometry args={[.77,1.03,100]}/><meshBasicMaterial color="#75b9ba" transparent opacity={dim?.07:.23} side={2} depthWrite={false}/></mesh>}
    </group></FormationBody>
    <Billboard><FormationLabel portal={labelPortal} center position={[0,-radius-.37,0]} zIndexRange={[6,0]} formation={formation}><button className="planet-label" data-gravity data-active={active} style={{ opacity: dim ? .4 : 1 }} onFocus={(event) => { if(event.currentTarget.matches(':focus-visible') && formation.current === 1) onFocus(world.id); }} onClick={(event) => { event.stopPropagation(); choose(); }} aria-label={`${active ? 'Enter' : 'Focus'} ${world.title}`}><strong>{world.title}</strong><small>{world.subtitle}</small></button></FormationLabel></Billboard>
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

function compactCameraDistance(aspect: number) {
  const verticalHalfAngle = 42 * Math.PI / 360;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * Math.max(aspect, .01));
  // Fit the full rotating system, including Pandora's ring and screen-facing labels.
  return 3.45 / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle));
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
      camera.position.set(0,-.22,compactCameraDistance(camera.aspect));
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
        ? compactCameraDistance(aspect)
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
    point.y -= small ? .97 : 1.45;
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

function CompactWorld({ world, index, selected, onFocus, onEnter, reducedMotion, labelPortal, objects, formation }: { world: World; index: number; selected: boolean; onFocus: SceneProps['onFocus']; onEnter: SceneProps['onEnter']; reducedMotion: boolean; labelPortal: RefObject<HTMLElement>; objects: ObjectMap; formation: FormationProgress }) {
  const radius = index === 0 ? .48 : index === 1 ? .46 : .53;
  const select = () => { if (formation.current === 1) { if (selected) onEnter(world.slug); else onFocus(world.id); } };
  return <group position={compactWorldPositions[index]} ref={(node) => { if (node) objects.current.set(world.slug, node); else objects.current.delete(world.slug); }}>
    <FormationBody formation={formation}><group onClick={(event) => { event.stopPropagation(); select(); }}>
      <Halo color={world.color} size={2.15} opacity={selected ? .2 : .07} formation={formation}/>
      <Planet radius={radius} color={world.color} kind={index + 1} dim={false} reducedMotion={reducedMotion} formation={formation}/>
      {index === 2 && <mesh rotation={[1.15,.25,-.38]}><ringGeometry args={[.77,1.03,64]}/><meshBasicMaterial color="#75b9ba" transparent opacity={.23} side={2} depthWrite={false}/></mesh>}
      {/* A generous hit sphere supports taps around the visible planet. */}
      <mesh>
        <sphereGeometry args={[radius + .3, 16, 12]}/>
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false}/>
      </mesh>
    </group></FormationBody>
    <Billboard><FormationLabel portal={labelPortal} center position={[0,-radius-.6,0]} zIndexRange={[6,0]} formation={formation}><button className="planet-label compact-planet-label" data-world={world.id} data-selected={selected} aria-pressed={selected} aria-label={`${selected ? 'Enter' : 'Select'} ${world.title}`} onClick={(event) => { event.stopPropagation(); select(); }}>
        <strong>{world.title}</strong>
      </button></FormationLabel></Billboard>
  </group>;
}

function CompactScene({ focus, onFocus, onEnter, rotation, reducedMotion, visited, sunLabel, labelPortal, formationId, onFormationComplete, destination, flightProgress, opening, forming }: SceneProps) {
  const group = useRef<Group>(null);
  const objects = useRef(new Map<string, Group>());
  const formation = useFormation(formationId, onFormationComplete, reducedMotion, opening);
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
      <FormationBody formation={formation} grow={false}>
        <Orbit radius={2.42} height={.69} color="#8da4bf" opacity={.09}/>
        <Orbit radius={2.75} height={.84} color="#8da4bf" opacity={.055}/>
      </FormationBody>
      <FormationBody formation={formation}><Planet radius={.67} color="#bc4b2e" kind={0} dim={false} reducedMotion={reducedMotion} formation={formation} energy={Math.min(visited.length / 12, 1)}/></FormationBody>
    </group>
    {worlds.map((world,index) => <CompactWorld key={world.id} world={world} index={index} selected={focus === world.id} onFocus={onFocus} onEnter={onEnter} reducedMotion={reducedMotion} labelPortal={labelPortal} objects={objects} formation={formation}/>)}
    </group>
    <UniverseFormation progress={formation} targets={objects} small={true} reducedMotion={reducedMotion} preview={opening && formationId === 0}/>
  </>;
}

function Scene({ focus, onFocus, onEnter, rotation, reducedMotion, visited, small, destination, sunLabel, labelPortal, formationId, onFormationComplete, flightProgress, opening, forming }: SceneProps) {
  const group = useRef<Group>(null);
  const objects = useRef(new Map<string, Group>());
  const formation = useFormation(formationId, onFormationComplete, reducedMotion, opening);
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
        <WorldSystem world={world} index={index} focus={focus} onFocus={onFocus} onEnter={onEnter} reducedMotion={reducedMotion} objects={objects} visited={visited} labelPortal={labelPortal} small={small} formation={formation} formationId={formationId} opening={opening} forming={forming}/>
      </group>)}
      <FormationBody formation={formation} grow={false}>
        <Constellations onEnter={onEnter} focus={focus} objects={objects} labelPortal={labelPortal} formation={formation}/>
        <DiscoveryTrail visited={visited}/>
      </FormationBody>
    </group>
    <UniverseFormation progress={formation} targets={objects} small={small} reducedMotion={reducedMotion} preview={opening && formationId === 0}/>
  </>;
}

export default function UniverseScene(props: SceneProps) {
  if (props.small) return <Canvas style={{ touchAction: 'none' }} camera={{ position: [0,-.22,10], fov: 42, near: .03, far: 260 }} dpr={[1,1.2]} frameloop={props.reducedMotion?'demand':'always'} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<div className="scene-loading"><span>Explore with the universe map</span></div>}>
    <CompactScene {...props}/>
  </Canvas>;
  const aspect = typeof window === 'undefined' ? 1.5 : window.innerWidth / Math.max(window.innerHeight,1);
  const distance = Math.max(14.8,(props.small ? 18 : 16.5)/(2*Math.tan(42*Math.PI/360)*aspect));
  return <Canvas onPointerMissed={() => props.onFocus(null)} camera={{ position: [0,.1,distance], fov: 42, near: .03, far: 260 }} dpr={props.small?[1,1.35]:[1,1.75]} frameloop={props.reducedMotion?'demand':'always'} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<div className="scene-loading"><span>Explore with the universe map</span></div>}>
    <Scene {...props}/>
  </Canvas>;
}
