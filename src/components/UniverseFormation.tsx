'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import { AdditiveBlending, Color, Group, Points, ShaderMaterial, Vector3 } from 'three';
import { worlds } from '@/data/portfolio';

type FormationProps = {
  progress: MutableRefObject<number>;
  targets: MutableRefObject<Map<string, Group>>;
  small: boolean;
  reducedMotion: boolean;
  preview?: boolean;
};

const targetKeys = ['sun', 'professional', 'know-me', 'project-pandora'];
const targetColors = ['#bc4b2e', ...worlds.map((world) => world.color)];
const accentColors = ['#f1c184', '#b48cf0', '#79cbed', '#ef896d', '#71dac8'];

const vertexShader = /* glsl */ `
  attribute vec4 aFlow;
  attribute float aLane;
  attribute vec3 aSphere;
  attribute vec3 aTint;
  attribute vec3 aPlanetColor;
  uniform float uProgress;
  uniform float uClock;
  uniform float uPreview;
  uniform float uLaneCount;
  uniform float uDpr;
  uniform float uPointScale;
  uniform vec3 uTargets[4];
  uniform vec4 uRadii;
  uniform vec3 uRight;
  uniform vec3 uUp;
  uniform vec3 uForward;
  uniform vec3 uSpan;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vStretch;

  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;

  vec3 destination(float bucket) {
    if (bucket < .5) return uTargets[0];
    if (bucket < 1.5) return uTargets[1];
    if (bucket < 2.5) return uTargets[2];
    return uTargets[3];
  }

  float radius(float bucket) {
    if (bucket < .5) return uRadii.x;
    if (bucket < 1.5) return uRadii.y;
    if (bucket < 2.5) return uRadii.z;
    return uRadii.w;
  }

  vec3 ribbon(float phase, float clock) {
    float lane = (aLane + .5) / uLaneCount * 2.0 - 1.0;
    float wave = phase * PI * 1.65 + aLane * 1.21 + clock * .075;
    float width = .07 + .06 * pow(sin(phase * PI), 2.0);
    float strand = aFlow.z * TAU + wave * .8;
    float crossSection = sqrt(aFlow.y) * width;
    float across = phase * 2.0 - 1.0;
    float x = across * uSpan.x;
    float diagonal = sin(aLane * 1.71 + .2) * .14;
    float y = (lane * .86 + across * diagonal + sin(wave) * .095
      + cos(phase * PI * 3.0 + aLane) * .026) * uSpan.y;
    float z = (cos(wave * .65 + aLane) + lane * .3) * uSpan.z;
    // Nine graceful ribbons share a slow current across the full viewport.
    return uTargets[0]
      + uRight * (x + cos(strand) * crossSection * .3)
      + uUp * (y + cos(strand) * crossSection)
      + uForward * (z + sin(strand) * crossSection);
  }

  vec3 cubic(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
    float q = 1.0 - t;
    return q*q*q*a + 3.0*q*q*t*b + 3.0*q*t*t*c + t*t*t*d;
  }

  void main() {
    float p = clamp(uProgress, 0.0, 1.0);
    float phase = fract(aFlow.x + uClock * .035);
    float gather = smoothstep(.55, .9, p - aFlow.y * .025) * (1.0 - uPreview);
    float settle = smoothstep(.75, .97, p) * (1.0 - uPreview);
    float bucket = aFlow.w;
    float orbitAngle = p * 1.5 + aFlow.z * .35;
    mat2 spin = mat2(cos(orbitAngle), -sin(orbitAngle), sin(orbitAngle), cos(orbitAngle));
    vec3 sphere = aSphere;
    sphere.xz = spin * sphere.xz;

    vec3 start = ribbon(phase, uClock);
    vec3 target = destination(bucket);
    float shell = radius(bucket) * (1.0 + (1.0 - settle) * 1.7);
    vec3 surface = target + sphere * shell;
    float branchAngle = bucket * TAU / 4.0 + .38;
    vec3 bend = uRight * cos(branchAngle) + uUp * sin(branchAngle);
    vec3 firstControl = start + bend * uSpan.y * .52
      + uForward * sin(branchAngle) * 1.15;
    vec3 secondControl = target + bend * (1.0 - settle) * 1.6
      + sphere * shell * .9 + uForward * cos(branchAngle) * (1.0 - settle);
    vec3 worldPosition = cubic(start, firstControl, secondControl, surface, gather);
    vec4 viewPosition = viewMatrix * vec4(worldPosition, 1.0);
    vec4 clipPosition = projectionMatrix * viewPosition;
    gl_Position = clipPosition;

    // A short, directional light trace follows the same ribbon and assembly path.
    vec3 ahead = cubic(ribbon(fract(phase + .005), uClock), firstControl, secondControl, surface, gather);
    vec4 nextClip = projectionMatrix * viewMatrix * vec4(ahead, 1.0);
    vec2 direction = nextClip.xy / nextClip.w - clipPosition.xy / clipPosition.w;
    vAngle = dot(direction, direction) > .000000000001 ? atan(direction.y, direction.x) : 0.0;
    vStretch = mix(1.85, 1.0, settle);
    vColor = mix(aTint, aPlanetColor, smoothstep(.58, .91, p) * (1.0 - uPreview));

    float edge = smoothstep(0.0, .08, phase) * (1.0 - smoothstep(.92, 1.0, phase));
    // Preview and release share the same clock and brightness, avoiding a restart.
    float dissolve = mix(1.0 - smoothstep(.92, 1.0, p), 1.0, uPreview);
    vAlpha = dissolve * mix(edge, 1.0, gather) * (.68 + aFlow.z * .32);
    float perspective = clamp(14.0 / max(-viewPosition.z, 1.0), .65, 2.15);
    gl_PointSize = (3.2 + aFlow.y * 2.2) * uDpr * uPointScale * perspective;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vStretch;
  void main() {
    vec2 point = gl_PointCoord - .5;
    float c = cos(vAngle), s = sin(vAngle);
    point = mat2(c, -s, s, c) * point;
    point.y *= vStretch;
    float radius = length(point);
    if (radius > .5 || vAlpha < .001) discard;
    float core = exp(-radius * radius * 65.0);
    float halo = exp(-radius * radius * 15.0);
    float edge = 1.0 - smoothstep(.36, .5, radius);
    gl_FragColor = vec4(vColor * (1.0 + core * .3), (core * .95 + halo * .52) * edge * vAlpha);
    #include <colorspace_fragment>
  }
`;

/** One GPU draw carries the preview ribbons into the four existing spheres. */
export default function UniverseFormation({ progress, targets, small, reducedMotion, preview = false }: FormationProps) {
  const cloud = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const clock = useRef(0);
  const { camera, gl, viewport } = useThree();
  const particles = useMemo(() => {
    const count = small ? 4000 : 11000;
    const positions = new Float32Array(count * 3);
    const flow = new Float32Array(count * 4);
    const lane = new Float32Array(count);
    const sphere = new Float32Array(count * 3);
    const tint = new Float32Array(count * 3);
    const planetColor = new Float32Array(count * 3);
    const palette = targetColors.map((color) => new Color(color));
    const accents = accentColors.map((color) => new Color(color));
    const shade = new Color();
    let seed = 827361;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Construction only: animation never touches individual particle buffers.
    for (let index = 0; index < count; index++) {
      const proportion = index / count;
      const bucket = proportion < .3 ? 0 : proportion < .535 ? 1 : proportion < .77 ? 2 : 3;
      flow.set([random(), random(), random(), bucket], index * 4);
      lane[index] = index % 9;
      const height = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const horizontal = Math.sqrt(1 - height * height);
      sphere.set([Math.cos(angle) * horizontal, height, Math.sin(angle) * horizontal], index * 3);
      shade.copy(palette[bucket]).lerp(accents[Math.floor(random() * accents.length)], .12 + random() * .48);
      shade.toArray(tint, index * 3);
      palette[bucket].toArray(planetColor, index * 3);
    }
    return { count, positions, flow, lane, sphere, tint, planetColor };
  }, [small]);

  const uniforms = useMemo(() => ({
    uProgress: { value: 0 },
    uClock: { value: 0 },
    uPreview: { value: 0 },
    uLaneCount: { value: 9 },
    uDpr: { value: 1 },
    uPointScale: { value: small ? .9 : 1 },
    uTargets: { value: [new Vector3(), new Vector3(), new Vector3(), new Vector3()] },
    uRadii: { value: small ? [.67, .48, .46, .53] : [.9, .5, .52, .57] },
    uRight: { value: new Vector3(1, 0, 0) },
    uUp: { value: new Vector3(0, 1, 0) },
    uForward: { value: new Vector3(0, 0, 1) },
    uSpan: { value: new Vector3(8, 4, 1) },
  }), [small]);

  useFrame((_, delta) => {
    if (!cloud.current || !material.current) return;
    const active = !reducedMotion && (preview || progress.current >= 0 && progress.current < 1);
    cloud.current.visible = active;
    if (!active) return;
    // The material owns the live uniform objects after R3F applies its props.
    const live = material.current.uniforms;
    clock.current += Math.min(delta, .1);
    live.uProgress.value = progress.current;
    live.uClock.value = clock.current;
    live.uPreview.value = preview ? 1 : 0;
    live.uDpr.value = Math.min(gl.getPixelRatio(), 2);
    for (let index = 0; index < targetKeys.length; index++) {
      const group = targets.current.get(targetKeys[index]);
      if (group) {
        group.updateWorldMatrix(true, false);
        group.getWorldPosition(live.uTargets.value[index]);
      }
    }
    camera.updateMatrixWorld();
    live.uRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
    live.uUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
    live.uForward.value.setFromMatrixColumn(camera.matrixWorld, 2);
    const view = viewport.getCurrentViewport(camera, live.uTargets.value[0]);
    live.uSpan.value.set(view.width * .55, view.height * .49, small ? .65 : 1.15);
    material.current.uniformsNeedUpdate = true;
  });

  if (reducedMotion) return null;

  return <points ref={cloud} visible={false} frustumCulled={false} raycast={() => undefined} renderOrder={3}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[particles.positions, 3]}/>
      <bufferAttribute attach="attributes-aFlow" args={[particles.flow, 4]}/>
      <bufferAttribute attach="attributes-aLane" args={[particles.lane, 1]}/>
      <bufferAttribute attach="attributes-aSphere" args={[particles.sphere, 3]}/>
      <bufferAttribute attach="attributes-aTint" args={[particles.tint, 3]}/>
      <bufferAttribute attach="attributes-aPlanetColor" args={[particles.planetColor, 3]}/>
    </bufferGeometry>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} transparent blending={AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false}/>
  </points>;
}
