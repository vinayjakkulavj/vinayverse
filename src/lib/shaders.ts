export const planetVertex = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}`;

export const planetFragment = `
uniform float uTime;
uniform vec3 uColor;
uniform float uKind;
uniform float uBrightness;
uniform float uEnergy;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.01)*.14; }
void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition-vWorldPosition);
  float fresnel = pow(1.0-max(dot(normal,viewDirection),0.0),3.0);
  float light = max(dot(normal,normalize(vec3(-.7,1.0,1.1))),0.0);
  vec3 color;
  if (uKind < .5) {
    vec3 source = normalize(vec3(-.6,.8,1.4));
    float facingLight = max(dot(normal,source),0.0);
    // Surface coordinates rotate with the sphere, keeping the convection visible.
    vec3 surface = normalize(vPosition);
    vec3 cells = surface*5.5;
    vec3 warp = vec3(fbm(cells),fbm(cells+13.7),fbm(cells-8.4));
    float convection = fbm(surface*9.0+warp*2.8);
    float grain = noise(surface*37.0+warp*4.0);
    float ember = smoothstep(.22,.72,convection*.78+grain*.22);
    float sunspots = smoothstep(.61,.78,fbm(surface*3.7+2.9));
    color = mix(vec3(.13,.026,.012),uColor*1.65,ember);
    color *= (1.0-sunspots*.42)*(.38+.62*pow(facingLight,.7));
    color += vec3(.16,.035,.012)*pow(grain,9.0)*facingLight*.15;
    color += fresnel*uColor*.11 + uEnergy*uColor*.025;
  } else if (uKind < 1.5) {
    float terrain = fbm(vPosition*5.4+vec3(uTime*.035,0,0));
    float bands = sin(vPosition.y*48.0+terrain*11.0)*.5+.5;
    float grid = pow(abs(sin(vPosition.x*24.0)*sin(vPosition.y*28.0)),12.0);
    color = mix(uColor*.16,uColor*.7,terrain);
    color += uColor*(bands*.085+grid*.18);
    color *= light*.85+.16;
    color += fresnel*uColor*.44;
  } else if (uKind < 2.5) {
    float cloud = fbm(vPosition*4.0+vec3(uTime*.018,0,0));
    color = mix(uColor*.18,uColor*.75,smoothstep(.28,.75,cloud));
    color += vec3(.55,.42,.75)*smoothstep(.58,.7,cloud)*.18;
    color *= light*.9+.13;
    color += fresnel*uColor*.32;
  } else {
    float terrain = fbm(vPosition*5.4+vec3(uTime*.035,0,0));
    float continents = fbm(vPosition*7.0);
    float currents = pow(abs(sin(vPosition.y*31.0+terrain*22.0)),14.0);
    color = mix(vec3(.015,.05,.065),uColor*.55,smoothstep(.3,.7,continents));
    color *= light*.95+.12;
    color += currents*uColor*.28;
    color += fresnel*uColor*.4;
  }
  gl_FragColor = vec4(color*uBrightness,1.0);
  #include <colorspace_fragment>
}`;

export const atmosphereFragment = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 direction=normalize(cameraPosition-vWorldPosition);
  float rim=pow(1.0-abs(dot(normalize(vNormal),direction)),2.7);
  gl_FragColor=vec4(uColor,rim*uOpacity);
  #include <colorspace_fragment>
}`;

export const haloVertex = `
varying vec2 vUv;
void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;
export const haloFragment = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
 float distance=length(vUv-.5)*2.0;
 float glow=exp(-distance*distance*5.5)*(1.0-smoothstep(.2,1.0,distance));
 gl_FragColor=vec4(uColor,glow*uOpacity);
 #include <colorspace_fragment>
}`;
