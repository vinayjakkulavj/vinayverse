'use client';

import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import { AdditiveBlending, Color, Group, ShaderMaterial, Vector3 } from 'three';

type CosmicBackdropProps = {
  rotation: MutableRefObject<{ x: number; y: number }>;
  reducedMotion: boolean;
  small: boolean;
};

type Particles = {
  position: Float32Array;
  color: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  phase: Float32Array;
};

type StarUniforms = { uTime: { value: number }; uPixelRatio: { value: number } };

function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function allocateParticles(count: number): Particles {
  return {
    position: new Float32Array(count * 3),
    color: new Float32Array(count * 3),
    size: new Float32Array(count),
    alpha: new Float32Array(count),
    phase: new Float32Array(count),
  };
}

function makeStars(count: number, layer: number): Particles {
  const random = seededRandom(82123 + layer * 517);
  const data = allocateParticles(count);
  const palette = ['#dce8fa', '#b2c9ed', '#c0b9dd', '#dfc6b1', '#efe7d4'].map((hex) => new Color(hex));
  const direction = new Vector3();
  const radii = [[62, 74], [79, 91], [96, 108]][layer];

  for (let index = 0; index < count; index += 1) {
    const y = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const horizontal = Math.sqrt(1 - y * y);
    direction.set(horizontal * Math.cos(angle), y, horizontal * Math.sin(angle));
    direction.multiplyScalar(radii[0] + random() * (radii[1] - radii[0]));
    direction.toArray(data.position, index * 3);
    palette[Math.floor(random() * palette.length)].toArray(data.color, index * 3);
    const bright = random() > 0.966;
    data.size[index] = bright ? 3.0 + random() * 1.7 : (layer === 0 ? 1.3 : layer === 1 ? 1.0 : 0.72) + random() * (layer === 2 ? 1.2 : 1.65);
    data.alpha[index] = bright ? 0.82 + random() * 0.18 : (layer === 2 ? 0.3 : 0.4) + random() * 0.45;
    data.phase[index] = random() * Math.PI * 2;
  }
  return data;
}

const starVertex = `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float depth = max(1.0, -viewPosition.z);
  gl_PointSize = max(1.0, aSize * uPixelRatio * clamp(85.0 / depth, 0.7, 1.45));
  gl_Position = projectionMatrix * viewPosition;
  vColor = aColor;
  vAlpha = aAlpha * (0.91 + 0.09 * sin(uTime * 0.2 + aPhase));
}`;

const starFragment = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (radius > 1.0) discard;
  float glow = exp(-radius * radius * 6.0) + exp(-radius * radius * 27.0) * 0.5;
  gl_FragColor = vec4(vColor, min(1.0, vAlpha * glow));
  #include <colorspace_fragment>
}`;

function StarLayer({ data, uniforms }: { data: Particles; uniforms: StarUniforms }) {
  const material = useRef<ShaderMaterial>(null);
  useFrame(({ gl }) => {
    if (!material.current) return;
    // R3F copies uniform entries, so animate the mounted material itself.
    material.current.uniforms.uTime.value = uniforms.uTime.value;
    // Read the renderer directly: demand mode may only draw one frame after resizing.
    material.current.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });
  return <points frustumCulled={false} renderOrder={-10} raycast={() => undefined}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.position, 3]}/>
      <bufferAttribute attach="attributes-aColor" args={[data.color, 3]}/>
      <bufferAttribute attach="attributes-aSize" args={[data.size, 1]}/>
      <bufferAttribute attach="attributes-aAlpha" args={[data.alpha, 1]}/>
      <bufferAttribute attach="attributes-aPhase" args={[data.phase, 1]}/>
    </bufferGeometry>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={starVertex} fragmentShader={starFragment} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
  </points>;
}

function makeConstellations(aspect: number) {
  const random = seededRandom(45231);
  const layouts = [
    [-0.8, 0.62, -82], [0.75, 0.7, -86], [-0.82, 0.05, -79], [0.82, 0.08, -87],
    [-0.72, -0.65, -84], [0.68, -0.67, -82], [-0.20, 0.84, -89], [0.15, -0.86, -83],
    [-0.34, -0.10, -94], [0.42, 0.12, -97], [-0.65, 0.3, 85], [0.6, -0.5, 87],
  ];
  const shapes: { nodes: [number, number][]; links: [number, number][] }[] = [
    { nodes: [[-1.4, 0.5], [-0.8, -0.5], [0.0, -0.3], [0.7, 0.6], [1.4, 0.15]], links: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { nodes: [[-1.2, 0.0], [-0.4, 0.7], [0.5, 0.8], [1.0, 0.1], [0.4, -0.65], [-0.5, -0.5]], links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4]] },
    { nodes: [[-1.1, -0.6], [-0.4, 0.2], [0.0, 0.8], [0.45, 0.0], [1.3, -0.3], [0.2, -0.7]], links: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 4]] },
    { nodes: [[-1.4, 0.4], [-0.65, 0.6], [-0.15, 0.0], [0.4, -0.45], [1.0, -0.2], [1.3, 0.55]], links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 5]] },
  ];
  const count = layouts.reduce((sum, _, index) => sum + shapes[index % shapes.length].nodes.length, 0);
  const stars = allocateParticles(count);
  const lines: number[] = [];
  const up = new Vector3(0, 1, 0);
  const color = new Color('#c1d1ee');
  let index = 0;

  for (let constellation = 0; constellation < layouts.length; constellation += 1) {
    const [x, y, z] = layouts[constellation];
    const halfHeight = Math.abs(z) * Math.tan(42 * Math.PI / 360);
    const center = new Vector3(x * halfHeight * aspect, y * halfHeight, z);
    const normal = center.clone().normalize();
    const tangent = new Vector3().crossVectors(normal, up).normalize();
    const bitangent = new Vector3().crossVectors(tangent, normal).normalize();
    const shape = shapes[constellation % shapes.length];
    const scale = (1.9 + random() * 0.8) * Math.min(1, Math.max(0.45, aspect));
    const points = shape.nodes.map(([nodeX, nodeY]) => center.clone().addScaledVector(tangent, nodeX * scale).addScaledVector(bitangent, nodeY * scale));
    for (const point of points) {
      point.toArray(stars.position, index * 3);
      color.toArray(stars.color, index * 3);
      stars.size[index] = 2.6 + random() * 1.5;
      stars.alpha[index] = 0.75 + random() * 0.25;
      stars.phase[index] = random() * Math.PI * 2;
      index += 1;
    }
    for (const [start, end] of shape.links) lines.push(...points[start].toArray(), ...points[end].toArray());
  }
  return { stars, lines: new Float32Array(lines) };
}

function DecorativeConstellations({ aspect, uniforms }: { aspect: number; uniforms: StarUniforms }) {
  const data = useMemo(() => makeConstellations(aspect), [aspect]);
  return <group>
    <lineSegments renderOrder={-9} raycast={() => undefined}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.lines, 3]}/></bufferGeometry>
      <lineBasicMaterial color="#93a7c9" transparent opacity={0.25} depthWrite={false} toneMapped={false}/>
    </lineSegments>
    <StarLayer data={data.stars} uniforms={uniforms}/>
  </group>;
}

const tailVertex = `
attribute float aAlong;
attribute float aSide;
uniform vec3 uDirection;
uniform float uLength;
uniform float uWidth;
varying float vAlong;
varying float vSide;
void main() {
  vec4 head = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 direction = normalize((modelViewMatrix * vec4(uDirection, 0.0)).xyz);
  vec2 perpendicular = normalize(vec2(-direction.y, direction.x));
  head.xyz -= direction * aAlong * uLength;
  float width = uWidth * pow(1.0 - aAlong, 0.8) + 0.004;
  head.xy += perpendicular * aSide * width;
  gl_Position = projectionMatrix * head;
  vAlong = aAlong;
  vSide = aSide;
}`;

const tailFragment = `
uniform vec3 uColor;
uniform float uAlpha;
varying float vAlong;
varying float vSide;
void main() {
  float across = exp(-vSide * vSide * 4.2) * (1.0 - smoothstep(0.78, 1.0, abs(vSide)));
  float taper = pow(1.0 - vAlong, 1.25);
  float alpha = uAlpha * across * taper;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}`;

const glowVertex = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const glowFragment = `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float radius = length(vUv - 0.5) * 2.0;
  float glow = exp(-radius * radius * 6.0) * (1.0 - smoothstep(0.65, 1.0, radius));
  gl_FragColor = vec4(uColor, glow * uAlpha);
  #include <colorspace_fragment>
}`;
const nucleusVertex = `
varying vec3 vNormal;
void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const nucleusFragment = `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vNormal;
void main() {
  float center = pow(max(normalize(vNormal).z, 0.0), 2.0);
  gl_FragColor = vec4(mix(uColor * 0.6, vec3(0.95, 0.98, 1.0), center), uAlpha);
  #include <colorspace_fragment>
}`;

function makeRibbon() {
  const segments = 64;
  const count = (segments + 1) * 2;
  const position = new Float32Array(count * 3);
  const along = new Float32Array(count);
  const side = new Float32Array(count);
  const indices: number[] = [];
  for (let segment = 0; segment <= segments; segment += 1) {
    along[segment * 2] = along[segment * 2 + 1] = segment / segments;
    side[segment * 2] = -1;
    side[segment * 2 + 1] = 1;
    if (segment < segments) {
      const start = segment * 2;
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }
  return { position, along, side, indices: new Uint16Array(indices) };
}

type TailUniforms = {
  uDirection: { value: Vector3 };
  uLength: { value: number };
  uWidth: { value: number };
  uColor: { value: Color };
  uAlpha: { value: number };
};

function ContinuousTail({ uniforms, materialRef }: { uniforms: TailUniforms; materialRef: MutableRefObject<ShaderMaterial | null> }) {
  const ribbon = useMemo(makeRibbon, []);
  return <mesh frustumCulled={false} renderOrder={-8} raycast={() => undefined}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[ribbon.position, 3]}/>
      <bufferAttribute attach="attributes-aAlong" args={[ribbon.along, 1]}/>
      <bufferAttribute attach="attributes-aSide" args={[ribbon.side, 1]}/>
      <bufferAttribute attach="index" args={[ribbon.indices, 1]}/>
    </bufferGeometry>
    <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={tailVertex} fragmentShader={tailFragment} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={2}/>
  </mesh>;
}

type TravellerProps = {
  time: MutableRefObject<number>;
  start: [number, number, number];
  end: [number, number, number];
  period: number;
  delay: number;
  duration: number;
  comet?: boolean;
  color: string;
};

function SkyTraveller({ time, start, end, period, delay, duration, comet = false, color }: TravellerProps) {
  const head = useRef<Group>(null);
  const nucleus = useRef<ShaderMaterial>(null);
  const tailMaterial = useRef<ShaderMaterial>(null);
  const gasMaterial = useRef<ShaderMaterial>(null);
  const glowMaterial = useRef<ShaderMaterial>(null);
  const trajectory = useMemo(() => {
    const from = new Vector3(...start), to = new Vector3(...end);
    return { from, to, direction: to.clone().sub(from).normalize() };
  }, [start, end]);
  const tail = useMemo<TailUniforms>(() => ({
    uDirection: { value: trajectory.direction }, uLength: { value: comet ? 15 : 8.5 }, uWidth: { value: comet ? 0.30 : 0.14 }, uColor: { value: new Color(color) }, uAlpha: { value: 0 },
  }), [trajectory, comet, color]);
  const gasTail = useMemo<TailUniforms>(() => ({
    uDirection: { value: trajectory.direction }, uLength: { value: 19 }, uWidth: { value: 1.0 }, uColor: { value: new Color('#7cb5d9') }, uAlpha: { value: 0 },
  }), [trajectory]);
  const glow = useMemo(() => ({ uColor: { value: new Color(color) }, uAlpha: { value: 0 } }), [color]);
  const core = useMemo(() => ({ uColor: { value: new Color(color) }, uAlpha: { value: 0 } }), [color]);

  useFrame(() => {
    if (!head.current) return;
    const elapsed = time.current - delay;
    const phase = elapsed < 0 ? -1 : elapsed % period;
    const visible = phase >= 0 && phase < duration;
    head.current.visible = visible;
    if (!visible) return;
    head.current.position.lerpVectors(trajectory.from, trajectory.to, phase / duration);
    const envelope = Math.min(1, phase / 0.35) * Math.min(1, (duration - phase) / 0.7);
    // The GPU's uniforms are separate from these initial props in current R3F.
    if (tailMaterial.current) tailMaterial.current.uniforms.uAlpha.value = envelope * (comet ? 0.8 : 0.7);
    if (gasMaterial.current) gasMaterial.current.uniforms.uAlpha.value = envelope * 0.19;
    if (glowMaterial.current) glowMaterial.current.uniforms.uAlpha.value = envelope * (comet ? 0.58 : 0.42);
    if (nucleus.current) nucleus.current.uniforms.uAlpha.value = envelope * 0.95;
  });

  return <group ref={head} visible={false}>
    {comet && <ContinuousTail uniforms={gasTail} materialRef={gasMaterial}/>}
    <ContinuousTail uniforms={tail} materialRef={tailMaterial}/>
    <Billboard><mesh renderOrder={-7} raycast={() => undefined}>
      <planeGeometry args={comet ? [2.8, 2.8] : [1.0, 1.0]}/>
      <shaderMaterial ref={glowMaterial} uniforms={glow} vertexShader={glowVertex} fragmentShader={glowFragment} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
    </mesh></Billboard>
    <mesh renderOrder={-6} raycast={() => undefined}>
      <sphereGeometry args={[comet ? 0.24 : 0.09, 18, 12]}/>
      <shaderMaterial ref={nucleus} uniforms={core} vertexShader={nucleusVertex} fragmentShader={nucleusFragment} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
    </mesh>
  </group>;
}

export default function CosmicBackdrop({ rotation, reducedMotion, small }: CosmicBackdropProps) {
  const surround = useRef<Group>(null);
  const near = useRef<Group>(null), middle = useRef<Group>(null), far = useRef<Group>(null);
  const time = useRef(0);
  const size = useThree((state) => state.size);
  const aspect = size.width / Math.max(size.height, 1);
  const stars = useMemo(() => {
    const count = small ? 6500 : 13000;
    return [makeStars(Math.round(count * 0.24), 0), makeStars(Math.round(count * 0.31), 1), makeStars(Math.round(count * 0.45), 2)];
  }, [small]);
  const uniforms = useMemo<StarUniforms>(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), []);
  const travellers = useMemo<Omit<TravellerProps, 'time'>[]>(() => [
    { start: [-43, 27, -81], end: [42, -21, -81], period: 8.8, delay: 0.4, duration: 2.8, color: '#c8ddf1' },
    { start: [40, 18, -88], end: [-34, -28, -88], period: 11.4, delay: 4.5, duration: 3.7, color: '#d4c7eb' },
    { start: [-36, -22, -79], end: [33, 19, -79], period: 12, delay: 1.7, duration: 7.5, comet: true, color: '#b9e3ee' },
  ], []);

  useFrame(({ camera, gl }, delta) => {
    if (!reducedMotion) time.current += Math.min(delta, 0.08);
    if (surround.current) surround.current.position.copy(camera.position);
    const amount = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.08) * 4);
    const layers = [near.current, middle.current, far.current];
    const yaw = [0.42, 0.24, 0.13], pitch = [0.32, 0.18, 0.09];
    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index];
      if (!layer) continue;
      layer.rotation.x += (rotation.current.x * pitch[index] - layer.rotation.x) * amount;
      layer.rotation.y += (rotation.current.y * yaw[index] - layer.rotation.y) * amount;
    }
    uniforms.uTime.value = time.current;
    uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return <group ref={surround}>
    <group ref={far}><StarLayer data={stars[2]} uniforms={uniforms}/></group>
    <group ref={middle}>
      <StarLayer data={stars[1]} uniforms={uniforms}/>
      <DecorativeConstellations aspect={aspect} uniforms={uniforms}/>
      {!reducedMotion && travellers.map((traveller, index) => <SkyTraveller key={index} time={time} {...traveller}/>)}
    </group>
    <group ref={near}><StarLayer data={stars[0]} uniforms={uniforms}/></group>
  </group>;
}
