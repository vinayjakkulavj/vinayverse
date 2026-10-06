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
// Each braid keeps its own saturated hue while target colors take over later.
const flowColors = ['#ff7756', '#edab55', '#ff596b', '#59aaff', '#32ddeb', '#5bddad', '#b27eff', '#9274ff', '#f781bc'];
const collisionColors = ['#ffac66', '#4bdfff', '#ae87ff', '#6de7ba'];

const vertexShader = /* glsl */ `
  attribute vec4 aFlow;
  attribute float aLane;
  attribute vec3 aCollision;
  attribute vec3 aSphere;
  attribute vec3 aTint;
  attribute vec3 aPlanetColor;
  uniform float uProgress;
  uniform float uClock;
  uniform float uPreview;
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
  varying float vSpark;

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

  vec3 inCameraPlane(vec3 point) {
    // Keep the active weave near the drag handle during a small pull. Release
    // lifts the same currents toward the sun without resetting their clock.
    float lift = mix(1.0 - smoothstep(0.0, .42, uProgress), 1.0, uPreview);
    return uTargets[0] + uRight * point.x * uSpan.x
      + uUp * (point.y - lift * .4) * uSpan.y + uForward * point.z * uSpan.z;
  }

  vec3 ribbon(float phase, float clock, float p) {
    float family = floor(aLane / 3.0);
    float branch = mod(aLane, 3.0) - 1.0;
    float across = phase * 2.0 - 1.0;
    float angle = family * PI / 3.0 + sin(clock * .38) * .13;
    float wave = across * PI * 1.35 + clock * .88 + family * 1.4;
    float breath = .85 + .15 * sin(clock * 1.05);
    float braid = across * TAU * 1.8 - clock * 1.28 + branch * TAU / 3.0;
    float centerEnvelope = 1.0 - smoothstep(.22, .9, abs(across));
    float elasticWave = sin(clock * 1.6 - abs(across) * 5.5 + family * .65)
      * centerEnvelope;

    // Three crossing families each carry a three-strand braid. The shared
    // waves weave through the center, so even a small peek exposes motion.
    float x = across + elasticWave * .055;
    float y = branch * .15 + sin(wave) * .19 * breath
      + cos(braid) * (.045 + centerEnvelope * .042)
      + elasticWave * .09;
    vec2 plane = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * vec2(x, y);
    float tube = sqrt(aFlow.y) * (.009 + .014 * centerEnvelope);
    float strand = aFlow.z * TAU + braid * .5;
    plane += vec2(-sin(angle), cos(angle)) * cos(strand) * tube;
    float depth = sin(wave * .75 + family * 1.7) * .5
      + sin(braid) * .08 + sin(strand) * tube * 2.0;

    // Release adds a coordinated expansion, elastic rebound, and mixing turn.
    // At p=0 the preview path is unchanged; there is no visual restart.
    float release = (1.0 - uPreview) * sin(PI * clamp(p / .68, 0.0, 1.0));
    float radial = length(plane);
    vec2 outward = plane / max(radial, .04);
    float waveFront = sin(radial * 7.0 - p * TAU * 2.0) * release * .085;
    float rebound = sin(p * TAU * 1.8) * release * .13;
    plane = plane * (1.0 + release * .26 + rebound) + outward * waveFront;
    float turn = release * .23 * sin(p * PI * 1.4 + family * .45);
    plane = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * plane;
    depth += release * sin(across * 5.0 + family * 1.2 + p * TAU) * .4;
    return inCameraPlane(vec3(plane, depth));
  }

  vec3 collision(float clock, float p, out float sparkle, out float visible) {
    float pair = aCollision.x;
    float side = aCollision.y;
    float trail = aCollision.z;
    float cycle = fract(clock / 4.6 + pair / 3.0 + .28);
    float t = max(0.0, cycle - trail * .038);
    float approach = 1.0 - smoothstep(.05, .59, t);
    float recoil = smoothstep(.61, .89, t);
    float angle = pair * TAU / 3.0 + .35 + sin(clock * .32) * .09;
    vec2 incoming = vec2(cos(angle), sin(angle));
    vec2 outgoing = vec2(cos(angle + side * .78), sin(angle + side * .78));
    vec2 center = pair < .5 ? vec2(0.0) : vec2(cos(angle), sin(angle)) * .32;
    vec2 plane = center + incoming * side * approach * .31
      + outgoing * side * recoil * .28;
    plane.y += sin(t * PI) * side * .035 * (approach + recoil);
    float impact = exp(-pow((t - .6) / .048, 2.0));
    sparkle = impact * (1.0 - trail) * (1.0 - smoothstep(.45, .78, p) * (1.0 - uPreview));
    visible = smoothstep(.02, .08, cycle) * (1.0 - smoothstep(.9, .99, cycle))
      * (1.0 - trail * .75);
    return inCameraPlane(vec3(plane, side * (.12 + trail * .05)));
  }

  vec3 cubic(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
    float q = 1.0 - t;
    return q*q*q*a + 3.0*q*q*t*b + 3.0*q*t*t*c + t*t*t*d;
  }

  void main() {
    float p = clamp(uProgress, 0.0, 1.0);
    float flowDirection = mod(aLane, 2.0) < .5 ? 1.0 : -1.0;
    float current = uClock * (.09 + mod(aLane, 3.0) * .008) + sin(uClock * 1.5) * .012;
    float phase = fract(aFlow.x + flowDirection * current);
    float gather = smoothstep(.48, .91, p - aFlow.y * .018) * (1.0 - uPreview);
    float settle = smoothstep(.75, .97, p) * (1.0 - uPreview);
    float bucket = aFlow.w;
    float orbitAngle = p * 1.5 + aFlow.z * .35;
    mat2 spin = mat2(cos(orbitAngle), -sin(orbitAngle), sin(orbitAngle), cos(orbitAngle));
    vec3 sphere = aSphere;
    sphere.xz = spin * sphere.xz;

    float spark = 0.0;
    float collisionAlpha = 1.0;
    bool isCollision = aCollision.x >= 0.0;
    vec3 start = ribbon(phase, uClock, p);
    if (isCollision) start = collision(uClock, p, spark, collisionAlpha);
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
    vec3 ahead = cubic(ribbon(fract(phase + flowDirection * .005), uClock, p), firstControl, secondControl, surface, gather);
    if (isCollision) {
      float nextSpark, nextAlpha;
      ahead = cubic(collision(uClock + .018, p, nextSpark, nextAlpha), firstControl, secondControl, surface, gather);
    }
    vec4 nextClip = projectionMatrix * viewMatrix * vec4(ahead, 1.0);
    vec2 screenDirection = nextClip.xy / nextClip.w - clipPosition.xy / clipPosition.w;
    vAngle = dot(screenDirection, screenDirection) > .000000000001 ? atan(screenDirection.y, screenDirection.x) : 0.0;
    vStretch = mix(isCollision ? 1.1 : 1.75, 1.0, settle);
    vSpark = spark;
    vColor = mix(aTint, aPlanetColor, smoothstep(.58, .91, p) * (1.0 - uPreview));
    vColor = mix(vColor, vec3(1.0, .78, .52), spark * .18);

    float edge = smoothstep(0.0, .08, phase) * (1.0 - smoothstep(.92, 1.0, phase));
    // Preview and release share the same clock and brightness, avoiding a restart.
    float dissolve = mix(1.0 - smoothstep(.92, 1.0, p), 1.0, uPreview);
    float flowAlpha = isCollision ? collisionAlpha : edge;
    vAlpha = dissolve * mix(flowAlpha, 1.0, gather) * (.7 + aFlow.z * .22);
    float perspective = clamp(14.0 / max(-viewPosition.z, 1.0), .65, 2.15);
    // A few larger colored collision heads and their small trails read clearly
    // without a bloom pass or a flash across the whole screen.
    float size = isCollision ? mix(9.0, 3.2, aCollision.z) + spark * 21.0 : 3.2 + aFlow.y * 1.8;
    gl_PointSize = size * uDpr * uPointScale * perspective;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vStretch;
  varying float vSpark;
  void main() {
    vec2 point = gl_PointCoord - .5;
    float c = cos(vAngle), s = sin(vAngle);
    point = mat2(c, -s, s, c) * point;
    point.y *= vStretch;
    float radius = length(point);
    if (radius > .5 || vAlpha < .001) discard;
    float core = exp(-radius * radius * 55.0);
    float halo = exp(-radius * radius * mix(16.0, 11.0, vSpark));
    float edge = 1.0 - smoothstep(.36, .5, radius);
    gl_FragColor = vec4(vColor * (1.0 + core * .4 + vSpark * .32),
      (core * 1.0 + halo * (.64 + vSpark * .16)) * edge * vAlpha);
    #include <colorspace_fragment>
  }
`;

/** One GPU draw carries braided currents, choreographed collisions, and formation. */
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
    const collision = new Float32Array(count * 3);
    const sphere = new Float32Array(count * 3);
    const tint = new Float32Array(count * 3);
    const planetColor = new Float32Array(count * 3);
    const palette = targetColors.map((color) => new Color(color));
    const strands = flowColors.map((color) => new Color(color));
    const collisions = collisionColors.map((color) => new Color(color));
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
      // A handful of opposing pairs and their short trails share this draw.
      // Their collisions are deterministic animation, not an N-body model.
      if (index < (small ? 36 : 72)) {
        const trailCount = small ? 6 : 12;
        const pair = Math.floor(index / (trailCount * 2));
        const side = Math.floor(index / trailCount) % 2 === 0 ? -1 : 1;
        collision.set([pair, side, (index % trailCount) / trailCount], index * 3);
      } else collision.set([-1, 0, 0], index * 3);
      const height = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const horizontal = Math.sqrt(1 - height * height);
      sphere.set([Math.cos(angle) * horizontal, height, Math.sin(angle) * horizontal], index * 3);
      if (collision[index * 3] >= 0) {
        const pair = collision[index * 3];
        const side = collision[index * 3 + 1];
        shade.copy(collisions[(pair + (side < 0 ? 0 : 1)) % collisions.length]);
      } else {
        shade.copy(strands[lane[index]]).lerp(palette[bucket], .06 + random() * .13)
          .multiplyScalar(.86 + random() * .16);
      }
      shade.toArray(tint, index * 3);
      palette[bucket].toArray(planetColor, index * 3);
    }
    return { count, positions, flow, lane, collision, sphere, tint, planetColor };
  }, [small]);

  const uniforms = useMemo(() => ({
    uProgress: { value: 0 },
    uClock: { value: 0 },
    uPreview: { value: 0 },
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
      <bufferAttribute attach="attributes-aCollision" args={[particles.collision, 3]}/>
      <bufferAttribute attach="attributes-aSphere" args={[particles.sphere, 3]}/>
      <bufferAttribute attach="attributes-aTint" args={[particles.tint, 3]}/>
      <bufferAttribute attach="attributes-aPlanetColor" args={[particles.planetColor, 3]}/>
    </bufferGeometry>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} transparent blending={AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false}/>
  </points>;
}
