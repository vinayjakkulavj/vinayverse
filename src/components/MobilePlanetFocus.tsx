'use client';

import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Mesh, ShaderMaterial } from 'three';

type MobilePlanetFocusProps = {
  color: string;
  radius: number;
  selected: boolean;
  reducedMotion: boolean;
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float distance = length((vUv - .5) * 2.0);
    if (distance > .98 || uOpacity < .001) discard;

    // Derivatives keep the rim legible even when a planet is only 25 px wide.
    float aa = max(fwidth(distance), .001);
    float halfWidth = max(.012, aa * .52);
    float ringDistance = abs(distance - .706);
    float rim = 1.0 - smoothstep(halfWidth, halfWidth + aa, ringDistance);
    float glow = exp(-pow((distance - .706) * 12.0, 2.0));
    glow *= smoothstep(.575, .635, distance);
    float edge = 1.0 - smoothstep(.90, .98, distance);

    vec3 color = uColor * (1.0 + rim * .28) + vec3(.055) * rim;
    gl_FragColor = vec4(color, (rim * .88 + glow * .21) * edge * uOpacity);
    #include <colorspace_fragment>
  }
`;

/** A screen-facing selection marker; it stays visible during an eclipse. */
export default function MobilePlanetFocus({ color, radius, selected, reducedMotion }: MobilePlanetFocusProps) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const amount = useRef(selected ? 1 : 0);
  const uniforms = useMemo(() => ({
    uColor: { value: new Color(color) },
    uOpacity: { value: 0 },
  }), [color]);

  useFrame((_, delta) => {
    const target = selected ? 1 : 0;
    // Roughly 200 ms to reach 95%, independent of the display refresh rate.
    amount.current += (target - amount.current) * (reducedMotion ? 1 : -Math.expm1(-15 * Math.max(delta, 0)));
    if (Math.abs(target - amount.current) < .001) amount.current = target;
    if (material.current) material.current.uniforms.uOpacity.value = amount.current;
    if (mesh.current) {
      mesh.current.visible = amount.current > .001;
      mesh.current.scale.setScalar(.96 + amount.current * .04);
    }
  });

  return <Billboard>
    <mesh ref={mesh} visible={selected} renderOrder={4} raycast={() => undefined}>
      <planeGeometry args={[radius * 3.4, radius * 3.4]}/>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  </Billboard>;
}
