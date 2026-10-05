'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html, Line } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { AdditiveBlending, BackSide, Color, Group, Mesh, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { worlds, topics, getTopic, type World, type WorldId } from '@/data/portfolio';
import { planetVertex, planetFragment, atmosphereFragment, haloVertex, haloFragment } from '@/lib/shaders';
import CosmicBackdrop from './CosmicBackdrop';
import PlanetImpacts from './PlanetImpacts';
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
};
type ObjectMap = MutableRefObject<Map<string, Group>>;

const orbital = [
  { radius: 3.35, height: .68, depth: .45, node: -.06, phase: 3.48, speed: .027 },
  { radius: 4.75, height: .72, depth: -.7, node: .08, phase: 1.53, speed: .018 },
  { radius: 6.25, height: .74, depth: 1.05, node: -.035, phase: 6.10, speed: .012 },
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

function Planet({ radius, color, kind, dim, reducedMotion, energy = 0 }: { radius: number; color: string; kind: number; dim: boolean; reducedMotion: boolean; energy?: number }) {
  const surface = useRef<ShaderMaterial>(null);
  const atmosphere = useRef<ShaderMaterial>(null);
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new Color(color) }, uKind: { value: kind }, uBrightness: { value: 1 }, uEnergy: { value: energy } }), [color, kind, energy]);
  const atmosphereUniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uOpacity: { value: .35 } }), [color]);
  const tiny = radius < .2;
  useFrame((_, delta) => {
    if (surface.current) {
      if (!reducedMotion) surface.current.uniforms.uTime.value += Math.min(delta,.05);
      surface.current.uniforms.uBrightness.value += ((dim ? .34 : 1) - surface.current.uniforms.uBrightness.value) * (reducedMotion ? 1 : damping(5, delta));
    }
    if (atmosphere.current) atmosphere.current.uniforms.uOpacity.value = dim ? .07 : kind === 0 ? .19 : .3;
    if (mesh.current && !reducedMotion) mesh.current.rotation.y += delta * (kind === 0 ? .14 : .045);
  });
  return <group>
    <group rotation={[0,0,kind === 0 ? -.12 : 0]}><mesh ref={mesh}><sphereGeometry args={tiny ? [radius, 24, 16] : [radius, 56, 40]}/><shaderMaterial ref={surface} uniforms={uniforms} vertexShader={planetVertex} fragmentShader={planetFragment} toneMapped={false}/></mesh></group>
    <mesh scale={kind === 0 ? 1.035 : 1.09}><sphereGeometry args={tiny ? [radius, 20, 14] : [radius, 40, 28]}/><shaderMaterial ref={atmosphere} uniforms={atmosphereUniforms} vertexShader={planetVertex} fragmentShader={atmosphereFragment} side={BackSide} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
  </group>;
}

function Halo({ color, size, opacity }: { color: string; size: number; opacity: number }) {
  const uniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uOpacity: { value: opacity } }), [color, opacity]);
  return <Billboard position={[0,0,-.25]}><mesh raycast={() => undefined}><planeGeometry args={[size,size]}/><shaderMaterial uniforms={uniforms} vertexShader={haloVertex} fragmentShader={haloFragment} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh></Billboard>;
}

function Sun({ visited, reducedMotion }: { visited: string[]; focus: WorldId | null; reducedMotion: boolean }) {
  const energy = Math.min(visited.length/12,1);
  return <Planet radius={.9} color="#bc4b2e" kind={0} dim={false} reducedMotion={reducedMotion} energy={energy}/>;
}

function Moon({ slug, color, kind, index, count, active, reducedMotion, onEnter, objects, visited, labelPortal, small }: { slug: string; color: string; kind: number; index: number; count: number; active: boolean; reducedMotion: boolean; onEnter: (slug: string) => void; objects: ObjectMap; visited: string[]; labelPortal: RefObject<HTMLElement>; small: boolean }) {
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
      const target = active ? 1 : 0;
      const scale = reducedMotion ? target : body.current.scale.x + (target-body.current.scale.x)*damping(6,delta);
      body.current.scale.setScalar(scale);
      body.current.visible = active && scale > .001;
    }
  }, -1);
  // Keep the orbit anchor and HTML label at full scale from their first render.
  return <group ref={group} position={initialPosition}>
    <group ref={body} scale={0} visible={active} onPointerOver={(event) => { event.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)} onClick={(event) => { event.stopPropagation(); if (active) onEnter(slug); }}>
      <group scale={hover ? 1.16 : 1}>
        <Planet radius={.135+(index===0?.035:0)} color={color} kind={kind} dim={!active} reducedMotion={reducedMotion}/>
        {visited.includes(slug) && <mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[.21,.22,40]}/><meshBasicMaterial color={color} transparent opacity={.5} side={2}/></mesh>}
      </group>
    </group>
    {active && <Billboard><Html portal={labelPortal} center position={[0,-.36,0]} zIndexRange={[7,0]}><button className="moon-label" data-gravity onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} onClick={() => onEnter(slug)} aria-label={`Explore ${topic.title}`}>{small ? String(index+1).padStart(2,'0') : topic.title}</button></Html></Billboard>}
  </group>;
}

function WorldSystem({ world, index, focus, onFocus, onEnter, reducedMotion, objects, visited, labelPortal, small }: { world: World; index: number; focus: WorldId | null; onFocus: SceneProps['onFocus']; onEnter: SceneProps['onEnter']; reducedMotion: boolean; objects: ObjectMap; visited: string[]; labelPortal: RefObject<HTMLElement>; small: boolean }) {
  const group = useRef<Group>(null);
  const phase = useRef(orbital[index].phase);
  const [hover, setHover] = useState(false);
  const active = focus === world.id;
  const dim = focus !== null && !active;
  const radius = index===0 ? .5 : index===1 ? .52 : .57;
  const initialPosition = useMemo(()=>orbitSamplers[index](new Vector3(),orbital[index].phase),[index]);
  useEffect(() => { if (group.current) objects.current.set(world.slug, group.current); return () => { objects.current.delete(world.slug); }; }, [world.slug, objects]);
  useFrame((_, delta) => {
    if (!group.current) return;
    if (!reducedMotion) phase.current += delta*orbital[index].speed;
    orbitSamplers[index](group.current.position,phase.current);
  }, -1);
  const choose = () => active ? onEnter(world.slug) : onFocus(world.id);
  const hoverWorld = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); setHover(true); if (event.pointerType === 'mouse') onFocus(world.id); };
  return <group ref={group} position={initialPosition}>
    <group onPointerOver={hoverWorld} onPointerOut={() => setHover(false)} onClick={(event) => { event.stopPropagation(); choose(); }}>
      <Halo color={world.color} size={2.8} opacity={dim ? .06 : hover ? .23 : .12}/>
      <Planet radius={radius} color={world.color} kind={index+1} dim={dim} reducedMotion={reducedMotion}/>
      <PlanetImpacts radius={radius} index={index} dim={dim} reducedMotion={reducedMotion}/>
      {index===2 && <mesh rotation={[1.15,.25,-.38]}><ringGeometry args={[.77,1.03,100]}/><meshBasicMaterial color="#75b9ba" transparent opacity={dim?.07:.23} side={2} depthWrite={false}/></mesh>}
    </group>
    <Billboard><Html portal={labelPortal} center position={[0,-radius-.37,0]} zIndexRange={[6,0]}><button className="planet-label" data-gravity data-active={active} style={{ opacity: dim ? .4 : 1 }} onFocus={(event) => { if(event.currentTarget.matches(':focus-visible')) onFocus(world.id); }} onClick={choose} aria-label={`${active ? 'Enter' : 'Focus'} ${world.title}`}><strong>{world.title}</strong><small>{world.subtitle}</small></button></Html></Billboard>
    {active && <Orbit radius={1.65} height={index===1?.83:.95} color={world.color} opacity={.2} tilt={.22}/>}
    {world.topics.map((slug, moonIndex) => <Moon key={slug} slug={slug} index={moonIndex} count={world.topics.length} color={world.color} kind={index+1} active={active} reducedMotion={reducedMotion} onEnter={onEnter} objects={objects} visited={visited} labelPortal={labelPortal} small={small}/>)}
  </group>;
}

const constellationPositions: Record<string, [number,number,number]> = {
  soundtrack: [3.7,-2.9,-1],
  'on-the-road': [-3.0,-3.2,-1],
  'small-things': [-5.5,.9,-1],
  science: [1.75,-3.15,-1],
  'what-if': [5.3,1.1,-1],
};

function Constellations({ onEnter, focus, objects, labelPortal }: { onEnter: SceneProps['onEnter']; focus: WorldId | null; objects: ObjectMap; labelPortal: RefObject<HTMLElement> }) {
  const constellationTopics = topics.filter((topic)=>topic.kind==='constellation');
  const [active, setActive] = useState<string | null>(null);
  const points = useMemo(() => [new Vector3(-.4,.05,0),new Vector3(-.13,.26,0),new Vector3(.05,-.08,0),new Vector3(.35,.14,0)],[]);
  return <group>{constellationTopics.map((topic) => <group key={topic.slug} position={constellationPositions[topic.slug]} ref={(node) => { if (node) objects.current.set(topic.slug, node); else objects.current.delete(topic.slug); }}>
    <Line points={points} color="#8da8d1" transparent opacity={active===topic.slug?.45:.035} lineWidth={.7}/>
    {points.map((point,starIndex)=><mesh key={starIndex} position={point}><sphereGeometry args={[active===topic.slug?.026:.015,8,6]}/><meshBasicMaterial color="#b5cbe9" transparent opacity={focus?.2:.6}/></mesh>)}
    <Html portal={labelPortal} center position={[0,-.27,0]} zIndexRange={[4,0]}><button className="constellation-label" onPointerEnter={()=>setActive(topic.slug)} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive(topic.slug)} onBlur={()=>setActive(null)} onClick={()=>onEnter(topic.slug)} aria-label={`Discover ${topic.title}`} style={{ opacity: focus?.2:1 }}>{active===topic.slug?topic.title:'✧'}</button></Html>
  </group>)}</group>;
}

function DiscoveryTrail({ visited }: { visited: string[] }) {
  const points = useMemo(() => visited.map((slug,index) => {
    const hash = [...slug].reduce((sum,char)=>sum+char.charCodeAt(0),0);
    return new Vector3(Math.sin(hash*.7)*5.8,Math.cos(hash*.3)*3.6,-2-index*.015);
  }),[visited]);
  return <group>{points.length>1 && <Line points={points} color="#89a7cc" transparent opacity={.13} lineWidth={.7}/>} {points.map((point,index)=><mesh key={visited[index]} position={point}><sphereGeometry args={[.02,8,6]}/><meshBasicMaterial color="#c2d5ef" transparent opacity={.8}/></mesh>)}</group>;
}

function CameraRig({ focus, objects, small, destination, reducedMotion }: { focus: WorldId | null; objects: ObjectMap; small: boolean; destination: string | null; reducedMotion: boolean }) {
  const { camera, size, invalidate } = useThree();
  const target = useRef(new Vector3());
  const point = useMemo(()=>new Vector3(),[]);
  const cameraGoal = useMemo(()=>new Vector3(),[]);
  useEffect(() => {
    if (camera instanceof PerspectiveCamera && size.width > 0 && size.height > 0) {
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, focus, destination, small, reducedMotion, size.width, size.height, invalidate]);
  useFrame((_,delta)=>{
    const aspect=size.width/Math.max(size.height,1);
    const baseDistance=Math.max(14.8,(small ? 18 : 16.5)/(2*Math.tan(42*Math.PI/360)*aspect));
    let z=baseDistance;
    point.set(0,.1,0);
    const focusWorld=focus?worlds.find(world=>world.id===focus):undefined;
    if (focusWorld && small) {
      const object=objects.current.get(focusWorld.slug);
      if(object) object.getWorldPosition(point);
      z=Math.max(13.3,baseDistance*.62);
    }
    if(destination) {
      const object=objects.current.get(destination);
      if(object) { object.getWorldPosition(point); z=2.15; }
    }
    if(small && focus && !destination) point.y -= 3.6;
    cameraGoal.copy(point); cameraGoal.z += z;
    const speed=reducedMotion?1:damping(destination?12:7.5,delta);
    camera.position.lerp(cameraGoal,speed);
    target.current.lerp(point,speed);
    camera.lookAt(target.current);
    // HTML labels must project through this frame's updated view matrix.
    camera.updateMatrixWorld();
  }, -.5);
  return null;
}

const compactWorldPositions: [number, number, number][] = [
  [-1.95, -1.05, 0], // Professional: lower left.
  [-1.95, 1.45, 0], // Know Me: upper left.
  [2.12, .35, 0], // Project Pandora: right.
];
const compactSunPosition: [number, number, number] = [0, .12, -.2];

function CompactWorld({ world, index, selected, onFocus, reducedMotion, labelPortal }: { world: World; index: number; selected: boolean; onFocus: SceneProps['onFocus']; reducedMotion: boolean; labelPortal: RefObject<HTMLElement> }) {
  const radius = index === 0 ? .48 : index === 1 ? .46 : .53;
  const select = () => onFocus(world.id);
  return <group position={compactWorldPositions[index]}>
    <group onClick={(event) => { event.stopPropagation(); select(); }}>
      <Halo color={world.color} size={2.15} opacity={selected ? .2 : .07}/>
      <Planet radius={radius} color={world.color} kind={index + 1} dim={false} reducedMotion={reducedMotion}/>
      {index === 2 && <mesh rotation={[1.15,.25,-.38]}><ringGeometry args={[.77,1.03,64]}/><meshBasicMaterial color="#75b9ba" transparent opacity={.23} side={2} depthWrite={false}/></mesh>}
      {/* A generous hit sphere supports taps around the visible planet. */}
      <mesh>
        <sphereGeometry args={[radius + .3, 16, 12]}/>
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false}/>
      </mesh>
    </group>
    <Html portal={labelPortal} center position={[0,-radius-.6,0]} zIndexRange={[6,0]}>
      <button className="planet-label compact-planet-label" data-world={world.id} data-selected={selected} aria-pressed={selected} aria-label={`Select ${world.title}`} onClick={(event) => { event.stopPropagation(); select(); }}>
        <strong>{world.title}</strong>
      </button>
    </Html>
  </group>;
}

function CompactCamera({ sunLabel }: { sunLabel: SceneProps['sunLabel'] }) {
  const { camera, size, invalidate } = useThree();
  const labelPoint = useMemo(() => new Vector3(), []);
  const labelStyle = useRef<{ node: HTMLDivElement | null; transform: string }>({ node: null, transform: '' });
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || size.width <= 0 || size.height <= 0) return;
    const aspect = size.width / size.height;
    // Fit the fixed stations and their 104px labels into the actual short canvas.
    const halfHeight = Math.max(2.7, 3.5 / aspect);
    camera.aspect = aspect;
    camera.position.set(0,-.22,halfHeight / Math.tan(42 * Math.PI / 360));
    camera.lookAt(0,-.22,0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useFrame(() => {
    const label = sunLabel.current;
    if (!label) return;
    // Project just below the compact sun, rather than the desktop scene origin.
    labelPoint.set(compactSunPosition[0],compactSunPosition[1]-.97,compactSunPosition[2]).project(camera);
    const transform = `translate3d(${((labelPoint.x*.5+.5)*size.width).toFixed(2)}px,${((-labelPoint.y*.5+.5)*size.height).toFixed(2)}px,0) translate(-50%,-50%)`;
    if (labelStyle.current.node !== label || labelStyle.current.transform !== transform) label.style.transform = transform;
    label.style.opacity = '1';
    label.style.visibility = 'visible';
    labelStyle.current.node = label;
    labelStyle.current.transform = transform;
  }, -.5);
  return null;
}

function CompactScene({ focus, onFocus, reducedMotion, visited, sunLabel, labelPortal }: SceneProps) {
  const backdropRotation = useRef({ x: -.06, y: -.02 });
  return <>
    <color attach="background" args={['#03050a']}/>
    <CompactCamera sunLabel={sunLabel}/>
    {/* Static phone stars retain the setting without travellers or parallax. */}
    <CosmicBackdrop rotation={backdropRotation} reducedMotion={true} small={true}/>
    <group position={compactSunPosition}>
      <Orbit radius={2.42} height={.69} color="#8da4bf" opacity={.09}/>
      <Orbit radius={2.75} height={.84} color="#8da4bf" opacity={.055}/>
      <Planet radius={.67} color="#bc4b2e" kind={0} dim={false} reducedMotion={reducedMotion} energy={Math.min(visited.length / 12, 1)}/>
    </group>
    {worlds.map((world,index) => <CompactWorld key={world.id} world={world} index={index} selected={focus === world.id} onFocus={onFocus} reducedMotion={reducedMotion} labelPortal={labelPortal}/>)}
  </>;
}

function Scene({ focus, onFocus, onEnter, rotation, reducedMotion, visited, small, destination, sunLabel, labelPortal }: SceneProps) {
  const group=useRef<Group>(null);
  const objects=useRef(new Map<string,Group>());
  const labelPoint = useMemo(() => new Vector3(), []);
  const labelStyle = useRef<{ node: HTMLDivElement | null; transform: string; opacity: string; visibility: string }>({ node: null, transform: '', opacity: '', visibility: '' });
  const { invalidate } = useThree();
  useEffect(()=>{ const refresh=()=>invalidate(); window.addEventListener('douknowme-rotate',refresh); return ()=>window.removeEventListener('douknowme-rotate',refresh); },[invalidate]);
  // Rotate and advance orbit anchors before CameraRig follows them.
  useFrame((_,delta)=>{
    if(!group.current) return;
    const speed=reducedMotion?1:damping(14,delta);
    group.current.rotation.x+=(rotation.current.x-group.current.rotation.x)*speed;
    group.current.rotation.y+=(rotation.current.y-group.current.rotation.y)*speed;
  }, -1);
  useFrame(({ camera, size })=>{
    const label = sunLabel.current;
    if (!label) return;
    labelPoint.set(0,small ? -2.08 : -1.45,0).project(camera);
    const transform = `translate3d(${((labelPoint.x*.5+.5)*size.width).toFixed(2)}px,${((-labelPoint.y*.5+.5)*size.height).toFixed(2)}px,0) translate(-50%,-50%)`;
    const opacity = focus ? '.5' : '1';
    const visibility = labelPoint.z > 1 || labelPoint.z < -1 ? 'hidden' : 'visible';
    const previous = labelStyle.current;
    const replaced = previous.node !== label;
    if (replaced || transform !== previous.transform) label.style.transform = transform;
    if (replaced || opacity !== previous.opacity) label.style.opacity = opacity;
    if (replaced || visibility !== previous.visibility) label.style.visibility = visibility;
    previous.node = label;
    previous.transform = transform;
    previous.opacity = opacity;
    previous.visibility = visibility;
  });
  return <>
    <color attach="background" args={['#03050a']}/>
    <CameraRig focus={focus} objects={objects} small={small} destination={destination} reducedMotion={reducedMotion}/>
    <CosmicBackdrop rotation={rotation} reducedMotion={reducedMotion} small={small}/>
    <group ref={group} rotation={[-.19,-.12,0]}>
      <Sun visited={visited} focus={focus} reducedMotion={reducedMotion}/>
      {worlds.map((world,index)=><group key={world.id}><WorldTrack index={index} focus={focus}/><WorldSystem world={world} index={index} focus={focus} onFocus={onFocus} onEnter={onEnter} reducedMotion={reducedMotion} objects={objects} visited={visited} labelPortal={labelPortal} small={small}/></group>)}
      <Constellations onEnter={onEnter} focus={focus} objects={objects} labelPortal={labelPortal}/>
      <DiscoveryTrail visited={visited}/>
    </group>
  </>;
}

export default function UniverseScene(props: SceneProps) {
  if (props.small) return <Canvas style={{ touchAction: 'pan-y pinch-zoom' }} camera={{ position: [0,-.22,10], fov: 42, near: .1, far: 260 }} dpr={[1,1.2]} frameloop={props.reducedMotion?'demand':'always'} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<div className="scene-loading"><span>Explore with the universe map</span></div>}>
    <CompactScene {...props}/>
  </Canvas>;
  const aspect = typeof window === 'undefined' ? 1.5 : window.innerWidth / Math.max(window.innerHeight,1);
  const distance = Math.max(14.8,(props.small ? 18 : 16.5)/(2*Math.tan(42*Math.PI/360)*aspect));
  return <Canvas onPointerMissed={() => props.onFocus(null)} camera={{ position: [0,.1,distance], fov: 42, near: .1, far: 260 }} dpr={props.small?[1,1.35]:[1,1.75]} frameloop={props.reducedMotion?'demand':'always'} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<div className="scene-loading"><span>Explore with the universe map</span></div>}>
    <Scene {...props}/>
  </Canvas>;
}
