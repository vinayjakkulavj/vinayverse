'use client';

import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Group, Mesh, ShaderMaterial, Vector3 } from 'three';

type PlanetImpactsProps = {
  radius: number;
  index: number;
  reducedMotion: boolean;
  dim: boolean;
};

const IMPACT_PERIOD = 210;
const APPROACH_DURATION = 2.8;
const FLASH_DURATION = 0.8;
const COOLDOWN = 6;
const RESPAWN_DURATION = 1.2;

const rockVertex = `
varying vec3 vPosition;
varying vec3 vNormal;
void main() {
  vPosition = normalize(position);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const rockFragment = `
uniform float uOpacity;
varying vec3 vPosition;
varying vec3 vNormal;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(cell), hash(cell + vec3(1,0,0)), f.x), mix(hash(cell + vec3(0,1,0)), hash(cell + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(cell + vec3(0,0,1)), hash(cell + vec3(1,0,1)), f.x), mix(hash(cell + vec3(0,1,1)), hash(cell + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
void main() {
  float grain = noise(vPosition * 7.0) * 0.65 + noise(vPosition * 17.0) * 0.35;
  float pits = smoothstep(0.27, 0.48, noise(vPosition * 13.0));
  float light = 0.22 + max(dot(normalize(vNormal), normalize(vec3(-0.4, 0.7, 1.0))), 0.0) * 0.78;
  vec3 stone = mix(vec3(0.14, 0.16, 0.20), vec3(0.43, 0.44, 0.48), grain);
  stone *= 0.68 + pits * 0.32;
  gl_FragColor = vec4(stone * light, uOpacity);
  #include <colorspace_fragment>
}`;

const flashVertex = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const flashFragment = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uAge;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  if (r > 0.92) discard;
  float core = exp(-r * r * 35.0);
  float halo = exp(-r * r * 7.0) * 0.36;
  float angle = atan(p.y, p.x);
  float rays = pow(abs(cos(angle * 2.0 + 0.2)), 28.0) * smoothstep(0.08, 0.19, r) * (1.0 - smoothstep(0.25, 0.72, r)) * 0.17;
  float ringRadius = 0.12 + uAge * 0.42;
  float dust = exp(-pow((r - ringRadius) * 24.0, 2.0)) * (1.0 - uAge) * 0.1;
  float edge = 1.0 - smoothstep(0.72, 0.92, r);
  float alpha = (core + halo + rays + dust) * uOpacity * edge;
  gl_FragColor = vec4(mix(uColor, vec3(0.96, 0.97, 1.0), core * 0.55), alpha);
  #include <colorspace_fragment>
}`;

function smooth01(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Mount next to Planet inside its attraction group, sharing the planet center. */
export default function PlanetImpacts({ radius, index, reducedMotion, dim }: PlanetImpactsProps) {
  const rock = useRef<Mesh>(null);
  const flash = useRef<Group>(null);
  const rockMaterial = useRef<ShaderMaterial>(null);
  const flashMaterial = useRef<ShaderMaterial>(null);
  const elapsed = useRef(0);
  const impactDirection = useMemo(() => new Vector3(), []);
  const orbit = useMemo(() => {
    const tilt = [0.48, -0.56, 0.70][index % 3];
    const node = [0.20, 0.83, -0.46][index % 3];
    const speed = 0.205 + index * 0.025;
    const firstImpact = 40 + index * 70;
    const contactAngle = tilt > 0 ? Math.PI / 2 : -Math.PI / 2;
    return {
      axisX: new Vector3(Math.cos(node), Math.sin(node), 0),
      axisY: new Vector3(-Math.sin(node) * Math.cos(tilt), Math.cos(node) * Math.cos(tilt), Math.sin(tilt)),
      speed,
      firstImpact,
      phase: contactAngle - firstImpact * speed,
    };
  }, [index]);
  const rockSize = radius * 0.070;
  const orbitRadius = radius * 1.85;
  const rockUniforms = useMemo(() => ({ uOpacity: { value: 1 } }), []);
  const flashUniforms = useMemo(() => ({
    uColor: { value: new Color(['#c8deef', '#d9ceea', '#cde7df'][index % 3]) },
    uOpacity: { value: 0 },
    uAge: { value: 0 },
  }), [index]);

  useFrame((_, delta) => {
    if (reducedMotion || !rock.current || !flash.current) return;
    elapsed.current += delta;
    const time = elapsed.current;
    const phase = ((time - orbit.firstImpact) % IMPACT_PERIOD + IMPACT_PERIOD) % IMPACT_PERIOD;
    const approaching = phase >= IMPACT_PERIOD - APPROACH_DURATION;
    const cooling = phase < COOLDOWN;
    const opacity = dim ? 0.25 : 1;
    const angle = orbit.phase + time * orbit.speed;
    const approach = approaching ? smooth01((phase - (IMPACT_PERIOD - APPROACH_DURATION)) / APPROACH_DURATION) : 0;
    // The rock's inner edge reaches the actual planet sphere at contact.
    const distance = orbitRadius + (radius + rockSize - orbitRadius) * approach;
    rock.current.position.copy(orbit.axisX).multiplyScalar(Math.cos(angle) * distance).addScaledVector(orbit.axisY, Math.sin(angle) * distance);
    rock.current.rotation.x = time * 0.37 + index;
    rock.current.rotation.y = time * 0.52;
    const respawn = smooth01((phase - COOLDOWN) / RESPAWN_DURATION);
    rock.current.visible = !cooling;
    rock.current.scale.setScalar(0.75 + respawn * 0.25);
    if (rockMaterial.current) rockMaterial.current.uniforms.uOpacity.value = opacity * respawn;

    const flashing = phase < FLASH_DURATION;
    flash.current.visible = flashing;
    if (!flashing) return;
    const cycle = Math.floor((time - orbit.firstImpact) / IMPACT_PERIOD);
    const contactTime = orbit.firstImpact + cycle * IMPACT_PERIOD;
    const contact = orbit.phase + contactTime * orbit.speed;
    impactDirection.copy(orbit.axisX).multiplyScalar(Math.cos(contact)).addScaledVector(orbit.axisY, Math.sin(contact));
    // A small outward offset keeps the glare attached to the contact surface.
    flash.current.position.copy(impactDirection).multiplyScalar(radius + radius * 0.012);
    const age = phase / FLASH_DURATION;
    const envelope = Math.sin(age * Math.PI) * Math.exp(-age * 0.7);
    flash.current.scale.setScalar(0.85 + age * 0.35);
    // R3F copies incoming uniform entries; always update the mounted material.
    if (flashMaterial.current) {
      flashMaterial.current.uniforms.uOpacity.value = envelope * opacity * 0.55;
      flashMaterial.current.uniforms.uAge.value = age;
    }
  });

  if (reducedMotion) return null;

  return <group>
    <mesh ref={rock} raycast={() => undefined}>
      <icosahedronGeometry args={[rockSize, 2]}/>
      <shaderMaterial ref={rockMaterial} uniforms={rockUniforms} vertexShader={rockVertex} fragmentShader={rockFragment} transparent depthWrite={false} toneMapped={false}/>
    </mesh>
    <group ref={flash} visible={false}>
      <Billboard><mesh raycast={() => undefined}>
        <planeGeometry args={[radius * 0.48, radius * 0.48]}/>
        <shaderMaterial ref={flashMaterial} uniforms={flashUniforms} vertexShader={flashVertex} fragmentShader={flashFragment} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
      </mesh></Billboard>
    </group>
  </group>;
}
