'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { AdditiveBlending, Group, Matrix4, ShaderMaterial, Vector2, Vector3 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { cosmicPalette, createParticleOrigin, originEvent, originMotionGLSL, smoothRange } from '@/lib/particleOrigin';

type FormationProps = {
  progress: MutableRefObject<number>;
  targets: MutableRefObject<Map<string, Group>>;
  small: boolean;
  reducedMotion: boolean;
  preview?: boolean;
  openingReveal: MutableRefObject<number>;
  onReady?: () => void;
};
const keys = ['sun', 'professional', 'know-me', 'project-pandora'];
const compositeVertex = /* glsl */ `
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const compositeFragment = /* glsl */ `
  uniform sampler2D uFrame;uniform float uOpacity;varying vec2 vUv;
  void main(){gl_FragColor=vec4(texture2D(uFrame,vUv).rgb,uOpacity);}
`;
const particleVertex = /* glsl */ `
  attribute vec3 aSphere;attribute vec4 aMeta;
  uniform float uProgress;uniform float uClock;uniform float uDpr;uniform float uPreview;uniform float uCompact;
  uniform mat4 uOriginView;uniform mat4 uOriginProjection;
  uniform vec3 uTargets[4];uniform vec3 uPalette[4];uniform vec4 uRadii;
  uniform vec3 uSpan;uniform vec3 uCenter;uniform vec3 uRight;uniform vec3 uUp;uniform vec3 uForward;
  varying vec3 vColor;varying float vAlpha;varying float vAngle;varying float vStretch;
  ${originMotionGLSL}
  vec3 destination(float bucket){
    if(bucket<.5)return uTargets[0];if(bucket<1.5)return uTargets[1];
    if(bucket<2.5)return uTargets[2];return uTargets[3];
  }
  vec3 tint(float bucket){
    if(bucket<.5)return uPalette[0];if(bucket<1.5)return uPalette[1];
    if(bucket<2.5)return uPalette[2];return uPalette[3];
  }
  float radius(float bucket){
    if(bucket<.5)return uRadii.x;if(bucket<1.5)return uRadii.y;
    if(bucket<2.5)return uRadii.z;return uRadii.w;
  }
  float ease(float t){t=clamp(t,0.0,1.0);return t*t*t*(t*(t*6.0-15.0)+10.0);}
  vec3 cubic(vec3 a,vec3 b,vec3 c,vec3 d,float t){
    float q=1.0-t;return q*q*q*a+3.0*q*q*t*b+3.0*q*t*t*c+t*t*t*d;
  }
  void main(){
    float p=uProgress;
    float departure=.653+aMeta.x*.014;
    float flight=clamp((p-departure)/(.944-departure),0.0,1.0);
    // A prompt burst eases into a slow arrival at the planet's surface.
    float gather=mix(flight,1.0-pow(1.0-flight,2.0),.35);
    float settle=ease((p-.87)/.09);
    float reveal=ease((p-.855)/.135);
    vec3 source=originPoint(position,min(p,.65),uClock,uPreview);
    vec4 sourceClip=uOriginProjection*uOriginView*vec4(source,1.0);
    vec2 ndc=sourceClip.xy/max(sourceClip.w,.1);
    vec3 start=uCenter+uRight*ndc.x*uSpan.x+uUp*ndc.y*uSpan.y;
    vec3 target=destination(aMeta.y);
    // Match the real body scale during the crossfade, including on phones.
    vec3 surface=target+aSphere*radius(aMeta.y)*(.82+.18*reveal);
    vec3 flow=normalize(originPoint(position,0.0,uClock,uPreview));
    vec3 outward=uRight*flow.x*uSpan.x*.76+uUp*flow.y*uSpan.y*.78+uForward*flow.z*.45;
    vec3 heading=target-uCenter;
    vec3 tangent=normalize(cross(uForward,heading+uRight*.01));
    float curl=sin(aMeta.x*6.2831853+aMeta.y*1.5)*.30;
    vec3 first=start+outward*(.65+aMeta.z*.4)+heading*.20;
    vec3 second=surface+outward*.16+tangent*curl+uForward*flow.z*.24;
    vec3 world=cubic(start,first,second,surface,gather);
    vec4 view=viewMatrix*vec4(world,1.0);vec4 clip=projectionMatrix*view;gl_Position=clip;
    vec4 ahead=projectionMatrix*viewMatrix*vec4(cubic(start,first,second,surface,min(1.0,gather+.012)),1.0);
    vec2 direction=ahead.xy/ahead.w-clip.xy/clip.w;
    vAngle=dot(direction,direction)>.0000000001?atan(direction.y,direction.x):0.0;
    vStretch=mix(1.0,2.7,sin(flight*3.14159265))*(1.0-settle)+settle;
    vAlpha=smoothstep(departure,departure+.020,p)*(1.0-smoothstep(.91,.995,p))
      *(.58+aMeta.x*.32)*mix(1.0,.74,uCompact)*mix(1.0,.40,settle);
    vColor=tint(aMeta.y)*(1.6+aMeta.w*.4);
    float perspective=clamp(14.0/max(-view.z,1.0),.65,1.5);
    gl_PointSize=(2.5+aMeta.x*1.8)*uDpr*perspective;
  }
`;
const particleFragment = /* glsl */ `
  varying vec3 vColor;varying float vAlpha;varying float vAngle;varying float vStretch;
  void main(){
    vec2 p=gl_PointCoord-.5;float c=cos(vAngle),s=sin(vAngle);
    p=mat2(c,-s,s,c)*p;p.y*=vStretch;
    float r=length(p);if(r>.5||vAlpha<.001)discard;
    float core=exp(-r*r*65.0),halo=exp(-r*r*16.0);
    gl_FragColor=vec4(vColor*(1.0+core*.3),(core+halo*.28)*vAlpha*(1.0-smoothstep(.37,.5,r)));
    #include <colorspace_fragment>
  }
`;

/** The origin volume and planet streams share their source positions. Their
 * cameras meet at the same screen-space seed when it bursts. */
export default function UniverseFormation({progress,targets,small,reducedMotion,preview=false,onReady,openingReveal}:FormationProps){
  const {gl,camera,scene,size,viewport}=useThree();
  const clock=useRef(0),preparedFrames=useRef(0),shadersPrepared=useRef(false),readySent=useRef(false);
  const readyCallback=useRef(onReady);readyCallback.current=onReady;
  const material=useRef<ShaderMaterial>(null);
  const aspect=size.width/Math.max(size.height,1);
  const medium=typeof navigator!=='undefined'&&navigator.hardwareConcurrency<=4;
  const origin=useMemo(()=>createParticleOrigin(aspect,small,medium),[small,medium]);
  const center=useMemo(()=>new Vector3(),[]);
  const renderSize=useRef('');
  const pipeline=useMemo(()=>{
    const composer=new EffectComposer(gl);composer.renderToScreen=false;
    const render=new RenderPass(origin.scene,origin.camera);composer.addPass(render);
    const bloom=new UnrealBloomPass(new Vector2(512,512),.48,.30,1.12);composer.addPass(bloom);
    const output=new OutputPass();composer.addPass(output);
    const antialias=new ShaderPass(FXAAShader);composer.addPass(antialias);
    const compositeMaterial=new ShaderMaterial({uniforms:{uFrame:{value:null},uOpacity:{value:1}},
      vertexShader:compositeVertex,fragmentShader:compositeFragment,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
    const quad=new FullScreenQuad(compositeMaterial);
    return{composer,bloom,antialias,quad,compositeMaterial,dispose(){
      render.dispose();bloom.dispose();output.dispose();antialias.dispose();
      composer.dispose();quad.dispose();compositeMaterial.dispose();
    }};
  },[gl,origin]);
  const uniforms=useMemo(()=>({
    uProgress:{value:0},uClock:{value:0},uDpr:{value:1},uPreview:{value:0},uCompact:{value:small?1:0},
    uOriginView:{value:new Matrix4()},uOriginProjection:{value:new Matrix4()},
    uTargets:{value:keys.map(()=>new Vector3())},uPalette:{value:cosmicPalette.map(color=>new Vector3(color.r,color.g,color.b))},
    uRadii:{value:small?[.67,.48,.46,.53]:[.9,.5,.52,.57]},uSpan:{value:new Vector3()},uCenter:{value:new Vector3()},
    uRight:{value:new Vector3(1,0,0)},uUp:{value:new Vector3(0,1,0)},uForward:{value:new Vector3(0,0,1)},
  }),[small]);
  useEffect(()=>{
    let active=true;
    // Compile the destination while the title writes, before the first pull.
    void gl.compileAsync(scene,camera).then(()=>{if(active)shadersPrepared.current=true;})
      .catch(()=>{if(active)shadersPrepared.current=true;});
    return()=>{active=false;pipeline.dispose();origin.dispose();};
  },[gl,scene,camera,pipeline,origin]);

  useFrame((_,delta)=>{
    if(preview&&readySent.current&&openingReveal.current<.001
      &&renderSize.current.startsWith(`${size.width}:${size.height}:`))return;
    const p=preview?0:progress.current;
    clock.current+=Math.min(delta,.05);
    const pull=preview?Math.min(1,openingReveal.current/.52):1-smoothRange(.1,.4,p);
    const event=originEvent(p);
    origin.uniforms.uClock.value=clock.current;origin.uniforms.uAspect.value=aspect;
    origin.uniforms.uProgress.value=p;origin.uniforms.uPreview.value=pull;
    const originCamera=origin.camera;
    if(originCamera.aspect!==aspect){originCamera.aspect=aspect;originCamera.updateProjectionMatrix();}
    // A restrained arc exposes depth while the sphere carries the motion.
    // On phones the whole sphere fits the available width.
    const distance=Math.max(10.4,3.2/(.46630766*aspect*.84));
    const dolly=smoothRange(0,.4,p)*.025;
    const turn=Math.sin(clock.current*.22)*.032+smoothRange(0,.40,p)*.035;
    originCamera.position.set(Math.sin(turn)*distance,.12+Math.sin(clock.current*.17)*.055,
      Math.cos(turn)*distance*(1-dolly));
    originCamera.lookAt(0,0,0);originCamera.updateMatrixWorld();
    for(let index=0;index<4;index++){
      const object=targets.current.get(keys[index]);
      if(object){object.updateWorldMatrix(true,false);object.getWorldPosition(uniforms.uTargets.value[index]);}
    }
    // Freeze the burst's projection at the seed for both devices.
    if(p<=.65){uniforms.uOriginView.value.copy(originCamera.matrixWorldInverse);uniforms.uOriginProjection.value.copy(originCamera.projectionMatrix);}
    camera.updateMatrixWorld();
    uniforms.uRight.value.setFromMatrixColumn(camera.matrixWorld,0);uniforms.uUp.value.setFromMatrixColumn(camera.matrixWorld,1);
    uniforms.uForward.value.setFromMatrixColumn(camera.matrixWorld,2);
    // The seed stays centered even when the mobile sun is vertically offset.
    center.copy(uniforms.uTargets.value[0]).project(camera);center.x=0;center.y=0;center.unproject(camera);
    uniforms.uCenter.value.copy(center);
    const view=viewport.getCurrentViewport(camera,center);uniforms.uSpan.value.set(view.width*.5,view.height*.5,1);
    uniforms.uProgress.value=p;uniforms.uClock.value=clock.current;uniforms.uDpr.value=gl.getPixelRatio();uniforms.uPreview.value=pull;
    if(material.current){
      material.current.uniforms.uProgress.value=p;material.current.uniforms.uClock.value=clock.current;
      material.current.uniforms.uDpr.value=gl.getPixelRatio();material.current.uniforms.uPreview.value=pull;
    }
    const opacity=1-smoothRange(.655,.752,p);
    gl.setRenderTarget(null);if(opacity<.999||reducedMotion)gl.render(scene,camera);
    if(reducedMotion||opacity<.001)return;
    const ratio=Math.max(1,Math.min(gl.getPixelRatio(),small?1.65:2,Math.sqrt(3300000/Math.max(1,size.width*size.height))));
    const signature=`${size.width}:${size.height}:${ratio}`;
    if(renderSize.current!==signature){
      pipeline.composer.setPixelRatio(ratio);pipeline.composer.setSize(size.width,size.height);
      pipeline.antialias.uniforms.resolution.value.set(1/(size.width*ratio),1/(size.height*ratio));renderSize.current=signature;
    }
    origin.uniforms.uPixelHeight.value=size.height*ratio;origin.uniforms.uDpr.value=ratio;
    pipeline.bloom.strength=(small?.40:.48)+event*.12;pipeline.composer.render(delta);
    if(preparedFrames.current<2)preparedFrames.current+=1;
    if(!readySent.current&&preparedFrames.current===2&&shadersPrepared.current){readySent.current=true;readyCallback.current?.();}
    pipeline.compositeMaterial.uniforms.uFrame.value=pipeline.composer.readBuffer.texture;
    pipeline.compositeMaterial.uniforms.uOpacity.value=opacity;
    const autoClear=gl.autoClear;gl.autoClear=false;gl.setRenderTarget(null);pipeline.quad.render(gl);gl.autoClear=autoClear;
  },1);

  return <points frustumCulled={false} raycast={()=>undefined} renderOrder={5}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[origin.starts,3]}/>
      <bufferAttribute attach="attributes-aSphere" args={[origin.spheres,3]}/>
      <bufferAttribute attach="attributes-aMeta" args={[origin.particleMeta,4]}/>
    </bufferGeometry>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={particleVertex} fragmentShader={particleFragment} transparent blending={AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false}/>
  </points>;
}
