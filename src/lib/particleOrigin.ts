import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, PerspectiveCamera,
  Points, Scene, ShaderMaterial, Vector3,
} from 'three';
import { worlds } from '@/data/portfolio';

/** The colors belong to the existing sun and three worlds. */
export const cosmicPalette = ['#bc4b2e', ...worlds.map(world => world.color)].map(hex => new Color(hex));
const TAU = Math.PI * 2;
export const smoothRange = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const originEvent = (p: number) => Math.exp(-Math.pow((p - .665) / .016, 2));
export const originRotation = (clock: number, p: number) => clock * .30 + smoothRange(0, .60, p) * .26;
export function originRadius(p: number, clock: number, previewStrength = 0) {
  const collapse = Math.pow(smoothRange(.40, .615, p), 1.55);
  const beat = Math.exp(-Math.pow((p - .175) / .054, 2)) * .105
    - Math.exp(-Math.pow((p - .263) / .054, 2)) * .025;
  const breathing = (.015 * Math.sin(clock * 2.6) + previewStrength * .026)
    * (1 - smoothRange(.32, .40, p));
  return 3 * (1 + beat + breathing) * (1 - collapse) + .025 * collapse;
}

/** Shared with the destination particles: their source is the same moving
 * particle shell rather than a separately projected approximation. */
export const originMotionGLSL = /* glsl */ `
  float originSmooth(float a,float b,float x){
    float t=clamp((x-a)/(b-a),0.0,1.0);return t*t*(3.0-2.0*t);
  }
  float originRadius(float p,float clock,float preview){
    float collapse=pow(originSmooth(.40,.615,p),1.55);
    float beat=exp(-pow((p-.175)/.054,2.0))*.105-exp(-pow((p-.263)/.054,2.0))*.025;
    float breathing=(.015*sin(clock*2.6)+preview*.026)*(1.0-originSmooth(.32,.40,p));
    return 3.0*(1.0+beat+breathing)*(1.0-collapse)+.025*collapse;
  }
  float originRotation(float clock,float p){return clock*.30+originSmooth(0.0,.60,p)*.26;}
  mat3 originOrientation(float clock,float p){
    float a=originRotation(clock,p),c=cos(a),s=sin(a);
    mat3 axis=mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);
    float tx=.30,tz=-.23;
    mat3 tiltX=mat3(1.0,0.0,0.0,0.0,cos(tx),sin(tx),0.0,-sin(tx),cos(tx));
    mat3 tiltZ=mat3(cos(tz),sin(tz),0.0,-sin(tz),cos(tz),0.0,0.0,0.0,1.0);
    return tiltZ*tiltX*axis;
  }
  vec3 originPoint(vec3 seed,float p,float clock,float preview){
    float radial=max(length(seed),.0001);
    vec3 n=seed/radial;
    float life=1.0-originSmooth(.40,.60,p);
    vec3 current=vec3(
      sin(n.y*6.0+n.z*2.4+clock*1.35),
      sin(n.z*6.7-n.x*2.1-clock*1.10),
      sin(n.x*6.4+n.y*2.0+clock*1.21));
    current-=n*dot(n,current);
    // Dense neighboring stars circulate together, with smaller convection
    // cells rising and sinking through the surface. The silhouette stays round.
    vec3 direction=normalize(n+current*(.062+preview*.012)*life);
    float cells=sin(n.x*13.0+clock*2.8)*sin(n.y*11.0-clock*2.2)*sin(n.z*10.0+clock*1.8);
    radial+=(sin(n.x*7.0+n.y*5.1+n.z*3.7+clock*2.4)*.029+cells*.012)*life;
    return originOrientation(clock,p)*direction*radial*originRadius(p,clock,preview);
  }
`;

type Grain = { x: number; y: number; z: number; bucket: number; mix: number; density: number; layer: number };
function createOriginData(small: boolean, medium: boolean) {
  let state = 871392;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  // Noise modulates the star currents. A continuous population underneath
  // those currents preserves density everywhere, including shadowed regions.
  const hash = (x: number, y: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number, z: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let fx = x - ix, fy = y - iy, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const plane = (dz: number) => mix(
      mix(hash(ix, iy, iz + dz), hash(ix + 1, iy, iz + dz), fx),
      mix(hash(ix, iy + 1, iz + dz), hash(ix + 1, iy + 1, iz + dz), fx), fy);
    return mix(plane(0), plane(1), fz);
  };
  const grainCount = small ? 108000 : medium ? 170000 : 240000;
  const uniformCount = Math.floor(grainCount * .74);
  const positions = new Float32Array(grainCount * 3);
  const hues = new Float32Array(grainCount * 3);
  const details = new Float32Array(grainCount * 4);
  const grains: Grain[] = [];
  const color = new Color();
  let attempts = 0;
  while (grains.length < grainCount) {
    attempts++;
    const y = random() * 2 - 1, theta = random() * TAU, ring = Math.sqrt(1 - y * y);
    const nx = Math.cos(theta) * ring, nz = Math.sin(theta) * ring;
    const large = noise(nx * 2.75 + 14.1, y * 2.75 + 5.7, nz * 2.75 + 18.4);
    const fine = noise(nx * 6.2 + 31.2, y * 6.2 + 7.9, nz * 6.2 + 11.5);
    const ridge = 1 - Math.abs(noise(nx * 4.1 + 18.4, y * 4.1 + 22.7, nz * 4.1 + 3.2) * 2 - 1);
    const field = large * .68 + ridge * .22 + fine * .10;
    const dense = smoothRange(.45, .64, field);
    // Three quarters of the stars cover the entire sphere. Denser currents
    // sit over that layer, so the noise never cuts sponge-like holes into it.
    const clustered = grains.length >= uniformCount;
    if (clustered && random() > .30 + dense * .70) continue;
    const layer = clustered ? 1 : 0;
    const thickness = clustered ? .925 + random() * .070 : .965 + random() * .040;
    const radial = thickness + (fine - .5) * .010;
    const angle = ((Math.atan2(y, nx) + .45 + (large - .5) * .85) / TAU * 4 + 4) % 4;
    const bucket = Math.floor(angle);
    const transition = smoothRange(.62, 1, angle - bucket) * .45;
    const density = .76 + dense * .18 + fine * .06;
    grains.push({ x: nx * radial, y: y * radial, z: nz * radial, bucket, mix: transition, density, layer });
    const index = grains.length - 1;
    positions.set([nx * radial, y * radial, nz * radial], index * 3);
    color.copy(cosmicPalette[bucket]).lerp(cosmicPalette[(bucket + 1) % 4], transition);
    hues.set([color.r, color.g, color.b], index * 3);
    details.set([.010 + random() * .013, density, random(), layer], index * 4);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aHue', new BufferAttribute(hues, 3));
  geometry.setAttribute('aDetail', new BufferAttribute(details, 4));

  // Every glow point is attached to an existing grain. It never forms an
  // unrelated fog layer that could flatten the sphere.
  const glowCount = small ? 2400 : medium ? 4000 : 6000;
  const glowPosition = new Float32Array(glowCount * 3), glowHue = new Float32Array(glowCount * 3), glowDetail = new Float32Array(glowCount * 4);
  for (let index = 0; index < glowCount; index++) {
    const source = Math.floor(index / glowCount * grainCount);
    glowPosition.set(positions.subarray(source * 3, source * 3 + 3), index * 3);
    glowHue.set(hues.subarray(source * 3, source * 3 + 3), index * 3);
    glowDetail.set([.045 + random() * .05, details[source * 4 + 1], random(), random()], index * 4);
  }
  const glowGeometry = new BufferGeometry();
  glowGeometry.setAttribute('position', new BufferAttribute(glowPosition, 3));
  glowGeometry.setAttribute('aHue', new BufferAttribute(glowHue, 3));
  glowGeometry.setAttribute('aDetail', new BufferAttribute(glowDetail, 4));

  const assemblyCount = small ? 12000 : medium ? 20000 : 26000;
  const starts = new Float32Array(assemblyCount * 3), spheres = new Float32Array(assemblyCount * 3), particleMeta = new Float32Array(assemblyCount * 4);
  for (let index = 0; index < assemblyCount; index++) {
    const source = Math.floor(index / assemblyCount * grainCount), grain = grains[source];
    starts.set(positions.subarray(source * 3, source * 3 + 3), index * 3);
    const y = random() * 2 - 1, theta = random() * TAU, radius = Math.sqrt(1 - y * y);
    spheres.set([Math.cos(theta) * radius, y, Math.sin(theta) * radius], index * 3);
    particleMeta.set([random(), grain.bucket, random(), random()], index * 4);
  }
  return { geometry, glowGeometry, starts, spheres, particleMeta, random, grainCount, attempts };
}

const grainVertex = /* glsl */ `
  attribute vec3 aHue;
  attribute vec4 aDetail;
  uniform float uClock;
  uniform float uProgress;
  uniform float uPreview;
  uniform float uDpr;
  uniform float uPixelHeight;
  uniform float uHalo;
  varying vec3 vHue;
  varying float vAlpha;
  varying float vFront;
  varying float vPulse;
  varying float vStar;
  varying float vHalo;
  ${originMotionGLSL}
  void main(){
    vec3 world=originPoint(position,uProgress,uClock,uPreview);
    vec3 normal=normalize(world);
    vec3 eye=normalize(cameraPosition-world);
    float facing=dot(normal,eye);
    float front=smoothstep(-.35,.8,facing);
    float rim=pow(1.0-abs(facing),3.0)*.12;
    float keyLight=.74+.26*max(0.0,dot(normal,normalize(vec3(-.42,.65,1.0))));
    float depthShade=.055+front*.945*keyLight+rim;
    vec4 view=modelViewMatrix*vec4(world,1.0);
    gl_Position=projectionMatrix*view;
    float depth=max(-view.z,.1);
    float angle=atan(normal.z,normal.x);
    float wave=sin(angle*4.0+normal.y*6.0-uClock*2.1);
    float traveling=pow(max(0.0,wave),18.0);
    float beat=exp(-pow((uProgress-.175)/.054,2.0));
    float remaining=originRadius(uProgress,uClock,uPreview)/3.0;
    float concentration=max(.000035,pow(remaining,1.82));
    float fade=1.0-smoothstep(.65,.705,uProgress);
    vHue=aHue;
    vFront=front;
    vStar=step(.968,aDetail.z);
    float hotCells=pow(max(0.0,sin(normal.x*12.0+uClock*2.8)*sin(normal.y*10.0-uClock*2.2)),3.0);
    vPulse=traveling*(.25+uPreview*.15)+beat*.16+hotCells*.18;
    vAlpha=(.36+aDetail.y*.32)*depthShade*fade*concentration;
    // Native physical footprints stay fine and detailed. The back hemisphere
    // is softer and darker, while the front grains retain their sharp cores.
    float pixelSize=aDetail.x*uPixelHeight/(.9326153*depth);
    float compact=max(.40,originRadius(uProgress,uClock,uPreview)/3.0);
    gl_PointSize=clamp(pixelSize*compact*(1.0+(1.0-front)*.65)*uHalo*(1.0+vStar*.65),1.10*uDpr,9.0*uDpr*uHalo);
    vHalo=uHalo;
  }
`;
const grainFragment = /* glsl */ `
  varying vec3 vHue;varying float vAlpha;varying float vFront;
  varying float vPulse;varying float vStar;varying float vHalo;
  void main(){
    vec2 point=gl_PointCoord-.5;
    float r2=dot(point,point);if(r2>.25||vAlpha<.00001)discard;
    float core=exp(-r2*mix(28.0,48.0,vFront));
    float halo=exp(-r2*13.0)*(1.0-smoothstep(.14,.25,r2));
    float granular=core*(.73+.27*sqrt(max(0.0,1.0-r2*4.0)));
    float glint=(exp(-abs(point.x)*62.0)+exp(-abs(point.y)*62.0))*exp(-sqrt(r2)*11.0)*vStar*.15;
    vec3 hue=mix(vHue,vec3(.80,.85,.95),core*.070*vFront);
    float emissive=2.15+vPulse*1.8+vStar*.35;
    float density=(granular+halo*.25+glint)*vAlpha;
    gl_FragColor=vec4(hue*emissive,density);
  }
`;
const glowFragment = /* glsl */ `
  varying vec3 vHue;varying float vAlpha;varying float vFront;
  varying float vPulse;varying float vStar;varying float vHalo;
  void main(){
    vec2 point=gl_PointCoord-.5;float r2=dot(point,point);if(r2>.25||vAlpha<.00001)discard;
    float halo=exp(-r2*16.0)*(1.0-smoothstep(.12,.25,r2));
    float light=.065+vPulse*.17;
    float core=exp(-r2*78.0);
    float glint=(exp(-abs(point.x)*72.0)+exp(-abs(point.y)*72.0))*exp(-sqrt(r2)*11.0)*.055;
    gl_FragColor=vec4(mix(vHue,vec3(.8,.86,.97),core*.18)*1.65,(halo*light+core*.10+glint)*vAlpha);
  }
`;

const starVertex = /* glsl */ `
  attribute vec4 aStar;
  uniform float uClock;
  uniform float uDpr;
  varying vec3 vHue;
  varying float vAlpha;
  varying float vStar;
  void main(){
    vec4 view=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*view;
    float tint=aStar.x;
    vHue=mix(vec3(.28,.46,.69),vec3(.84,.71,.56),tint);
    float twinkle=.82+.18*sin(uClock*(.32+aStar.y*.45)+aStar.z*19.0);
    vAlpha=(.035+pow(aStar.y,5.0)*.26)*twinkle;
    vStar=step(.97,aStar.y);
    gl_PointSize=(1.1+pow(aStar.y,8.0)*3.2)*uDpr;
  }
`;
const starFragment = /* glsl */ `
  varying vec3 vHue;varying float vAlpha;varying float vStar;
  void main(){
    vec2 p=gl_PointCoord-.5;float r2=dot(p,p);if(r2>.25)discard;
    float core=exp(-r2*40.0),halo=exp(-r2*15.0);
    float glint=(exp(-abs(p.x)*60.0)+exp(-abs(p.y)*60.0))*exp(-sqrt(r2)*11.0)*vStar*.13;
    gl_FragColor=vec4(vHue,(core+halo*.15+glint)*vAlpha);
  }
`;

const seedVertex = /* glsl */ `
  attribute vec3 aHue;
  attribute vec3 aSeed;
  uniform float uProgress;
  uniform float uDpr;
  uniform float uPixelHeight;
  varying vec3 vHue;
  varying float vAlpha;
  void main(){
    float tension=smoothstep(.555,.625,uProgress)*(1.0-smoothstep(.685,.715,uProgress));
    float burst=exp(-pow((uProgress-.665)/.016,2.0));
    float radius=mix(.058,.018,smoothstep(.59,.645,uProgress));
    vec3 world=position*radius;
    vec4 view=modelViewMatrix*vec4(world,1.0);gl_Position=projectionMatrix*view;
    vHue=aHue;
    vAlpha=tension*(.014+burst*.017)*(1.0-aSeed.z*.35);
    gl_PointSize=(3.0+aSeed.x*3.0+burst*8.0)*uDpr;
  }
`;
const seedFragment = /* glsl */ `
  varying vec3 vHue;varying float vAlpha;
  void main(){
    vec2 p=gl_PointCoord-.5;float r2=dot(p,p);if(r2>.25||vAlpha<.0001)discard;
    gl_FragColor=vec4(vHue*1.25,exp(-r2*22.0)*vAlpha);
  }
`;
const shockVertex = /* glsl */ `
  attribute vec4 aShock;
  uniform float uProgress;
  uniform float uDpr;
  varying vec3 vHue;
  varying float vAlpha;
  uniform vec3 uPalette[4];
  vec3 shockHue(float bucket){
    if(bucket<.5)return uPalette[0];if(bucket<1.5)return uPalette[1];
    if(bucket<2.5)return uPalette[2];return uPalette[3];
  }
  void main(){
    float life=clamp((uProgress-.654)/.108,0.0,1.0);
    float distance=pow(life,.72)*(4.5+aShock.z*2.5);
    vec3 world=position*distance;
    vec4 view=modelViewMatrix*vec4(world,1.0);gl_Position=projectionMatrix*view;
    float fade=smoothstep(0.0,.065,life)*(1.0-smoothstep(.32,1.0,life));
    vHue=shockHue(aShock.y);
    vAlpha=fade*(.22+aShock.x*.20);
    gl_PointSize=clamp((1.8+aShock.x*1.3)*uDpr*10.0/max(-view.z,1.0),1.0*uDpr,5.0*uDpr);
  }
`;
const shockFragment = /* glsl */ `
  varying vec3 vHue;varying float vAlpha;
  void main(){
    vec2 p=gl_PointCoord-.5;float r2=dot(p,p);if(r2>.25||vAlpha<.0001)discard;
    gl_FragColor=vec4(vHue*1.65,exp(-r2*28.0)*vAlpha);
  }
`;

/** A real spatial cloud: no sphere mesh, wire cage, or screen-space substitute. */
export function createParticleOrigin(aspect: number, small: boolean, medium: boolean) {
  const data = createOriginData(small, medium);
  const scene = new Scene();
  scene.background = new Color('#020409');
  const camera = new PerspectiveCamera(50, aspect, .06, 150);
  camera.position.set(0, 0, 10.4);camera.lookAt(0, 0, 0);camera.updateMatrixWorld();
  const uniforms = {
    uClock: { value: 0 }, uProgress: { value: 0 }, uPreview: { value: 0 },
    uDpr: { value: 1 }, uPixelHeight: { value: 900 }, uAspect: { value: aspect },
    uEvent: { value: 0 }, uHalo: { value: 1 },
    uPalette: { value: cosmicPalette.map(color => new Vector3(color.r, color.g, color.b)) },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader: grainVertex, fragmentShader: grainFragment,
    transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending, toneMapped: false });
  const grains = new Points(data.geometry, material);
  grains.frustumCulled = false;grains.renderOrder = 1;scene.add(grains);
  const glowUniforms = { ...uniforms, uHalo: { value: 1.8 } };
  const glowMaterial = new ShaderMaterial({ uniforms: glowUniforms, vertexShader: grainVertex, fragmentShader: glowFragment,
    transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending, toneMapped: false });
  const glow = new Points(data.glowGeometry, glowMaterial);
  glow.frustumCulled = false;glow.renderOrder = 2;scene.add(glow);

  // Stars occupy a distant cuboid much wider than the sphere and always live
  // outside it. Camera parallax therefore remains spatial on every viewport.
  const starCount = small ? 850 : 1800;
  const starPosition = new Float32Array(starCount * 3), starMeta = new Float32Array(starCount * 4);
  for (let index = 0; index < starCount; index++) {
    const z = -9 - data.random() * 36;
    const visibleHeight = (10.4 - z) * .4663;
    starPosition.set([(data.random() - .5) * visibleHeight * Math.max(aspect, .6) * 2.6,
      (data.random() - .5) * visibleHeight * 2.6, z], index * 3);
    starMeta.set([data.random(), data.random(), data.random(), data.random()], index * 4);
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(starPosition, 3));
  starGeometry.setAttribute('aStar', new BufferAttribute(starMeta, 4));
  const starMaterial = new ShaderMaterial({ uniforms, vertexShader: starVertex, fragmentShader: starFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
  const stars = new Points(starGeometry, starMaterial);
  stars.frustumCulled = false;stars.renderOrder = 0;scene.add(stars);

  const seedCount = 240;
  const seedPosition = new Float32Array(seedCount * 3), seedHue = new Float32Array(seedCount * 3), seedMeta = new Float32Array(seedCount * 3);
  for (let index = 0; index < seedCount; index++) {
    const y = data.random() * 2 - 1, theta = data.random() * TAU, ring = Math.sqrt(1 - y * y);
    seedPosition.set([Math.cos(theta) * ring, y, Math.sin(theta) * ring], index * 3);
    const hue = cosmicPalette[index % 4];seedHue.set([hue.r, hue.g, hue.b], index * 3);
    seedMeta.set([data.random(), data.random(), data.random()], index * 3);
  }
  const seedGeometry = new BufferGeometry();
  seedGeometry.setAttribute('position', new BufferAttribute(seedPosition, 3));
  seedGeometry.setAttribute('aHue', new BufferAttribute(seedHue, 3));
  seedGeometry.setAttribute('aSeed', new BufferAttribute(seedMeta, 3));
  const seedMaterial = new ShaderMaterial({ uniforms, vertexShader: seedVertex, fragmentShader: seedFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
  const seed = new Points(seedGeometry, seedMaterial);
  seed.frustumCulled = false;seed.renderOrder = 3;scene.add(seed);

  const shockCount = small ? 1600 : 3200;
  const shockPosition = new Float32Array(shockCount * 3), shockMeta = new Float32Array(shockCount * 4);
  for (let index = 0; index < shockCount; index++) {
    const y = data.random() * 2 - 1, theta = data.random() * TAU, ring = Math.sqrt(1 - y * y);
    shockPosition.set([Math.cos(theta) * ring, y, Math.sin(theta) * ring], index * 3);
    shockMeta.set([data.random(), index % 4, data.random(), data.random()], index * 4);
  }
  const shockGeometry = new BufferGeometry();
  shockGeometry.setAttribute('position', new BufferAttribute(shockPosition, 3));
  shockGeometry.setAttribute('aShock', new BufferAttribute(shockMeta, 4));
  const shockMaterial = new ShaderMaterial({ uniforms, vertexShader: shockVertex, fragmentShader: shockFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
  const shock = new Points(shockGeometry, shockMaterial);
  shock.frustumCulled = false;shock.renderOrder = 4;scene.add(shock);

  return {
    scene, camera, uniforms, starts: data.starts, spheres: data.spheres, particleMeta: data.particleMeta,
    grainCount: data.grainCount,
    dispose() {
      data.geometry.dispose();data.glowGeometry.dispose();material.dispose();glowMaterial.dispose();
      starGeometry.dispose();starMaterial.dispose();seedGeometry.dispose();seedMaterial.dispose();
      shockGeometry.dispose();shockMaterial.dispose();
    },
  };
}
