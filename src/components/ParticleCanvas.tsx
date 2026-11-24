import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  buildCoupleAndEnvironment,
  type RiggedPointCloudData,
  updateCoupleChoreography,
} from '../three/riggedCouple';
import { buildRomanticEnvironment } from '../three/environmentScene';
import {
  createDustParticleMaterial,
  createPropParticleMaterial,
  createRiggedFigureMaterial,
  createRingBurstMaterial,
} from '../three/particleShaders';

interface ParticleCanvasProps {
  timeline: number; // 0..1 continuous story timeline
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function makeRiggedGeometry(data: RiggedPointCloudData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(data.scatterPositions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1));
  geo.setAttribute('aDelay', new THREE.BufferAttribute(data.delays, 1));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(data.randoms, 4));
  geo.setAttribute('aContour', new THREE.BufferAttribute(data.isContour, 1));
  geo.setAttribute('aBoneIndex', new THREE.BufferAttribute(data.boneIndices, 2));
  geo.setAttribute('aBoneWeight', new THREE.BufferAttribute(data.boneWeights, 1));
  return geo;
}

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({ timeline }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef(timeline);
  const userInteractingRef = useRef(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x000000, 1);

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060f);
    scene.fog = new THREE.FogExp2(0x0b0b1a, 0.02);

    const aspect = width / height;
    const baseDist = aspect < 1 ? 7.7 : 6.15;
    const camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 80);
    camera.position.set(0.15, 0.34, baseDist);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(-0.08, 0.08, -0.4);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 10.0;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.update();

    const onControlsStart = () => {
      userInteractingRef.current = true;
    };
    controls.addEventListener('start', onControlsStart);

    // Build Couple + Props + Romantic Night Street Environment
    const env = buildCoupleAndEnvironment();
    const streetEnv = buildRomanticEnvironment();
    scene.add(env.boyRig.root);
    scene.add(env.girlRig.root);

    // 1. Boy Point Cloud
    const boyGeo = makeRiggedGeometry(env.boyCloud);
    const boyMat = createRiggedFigureMaterial(pixelRatio);
    const boyPoints = new THREE.Points(boyGeo, boyMat);
    boyPoints.frustumCulled = false;
    scene.add(boyPoints);

    // 2. Girl Point Cloud
    const girlGeo = makeRiggedGeometry(env.girlCloud);
    const girlMat = createRiggedFigureMaterial(pixelRatio);
    const girlPoints = new THREE.Points(girlGeo, girlMat);
    girlPoints.frustumCulled = false;
    scene.add(girlPoints);

    // 3. 3D Particle Rose
    const roseGeo = new THREE.BufferGeometry();
    roseGeo.setAttribute('position', new THREE.BufferAttribute(env.rose.positions, 3));
    roseGeo.setAttribute('aColor', new THREE.BufferAttribute(env.rose.colors, 3));
    roseGeo.setAttribute('aSize', new THREE.BufferAttribute(env.rose.sizes, 1));
    roseGeo.setAttribute('aRandom', new THREE.BufferAttribute(env.rose.randoms, 4));
    const roseMat = createPropParticleMaterial(pixelRatio, 8.6);
    const rosePoints = new THREE.Points(roseGeo, roseMat);
    rosePoints.frustumCulled = false;
    scene.add(rosePoints);

    // 4. 3D Particle Diamond Ring (Anguthi)
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(env.ring.positions, 3));
    ringGeo.setAttribute('aColor', new THREE.BufferAttribute(env.ring.colors, 3));
    ringGeo.setAttribute('aSize', new THREE.BufferAttribute(env.ring.sizes, 1));
    ringGeo.setAttribute('aRandom', new THREE.BufferAttribute(env.ring.randoms, 4));
    const ringMat = createPropParticleMaterial(pixelRatio, 7.6);
    const ringPoints = new THREE.Points(ringGeo, ringMat);
    ringPoints.frustumCulled = false;
    scene.add(ringPoints);

    // 5. Ring Placement Celebration Spark Burst
    const burstCount = 460;
    const burstPos = new Float32Array(burstCount * 3);
    const burstCol = new Float32Array(burstCount * 3);
    const burstRand = new Float32Array(burstCount * 4);
    for (let i = 0; i < burstCount; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      burstPos[i * 3] = Math.cos(th) * Math.sin(ph);
      burstPos[i * 3 + 1] = Math.cos(ph);
      burstPos[i * 3 + 2] = Math.sin(th) * Math.sin(ph);
      const roll = Math.random();
      burstCol[i * 3] = 1.0;
      burstCol[i * 3 + 1] = roll < 0.45 ? 1.0 : 0.45;
      burstCol[i * 3 + 2] = roll < 0.45 ? 1.0 : 0.85;
      burstRand[i * 4] = Math.random();
      burstRand[i * 4 + 1] = Math.random();
      burstRand[i * 4 + 2] = Math.random();
      burstRand[i * 4 + 3] = Math.random();
    }
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
    burstGeo.setAttribute('aColor', new THREE.BufferAttribute(burstCol, 3));
    burstGeo.setAttribute('aRandom', new THREE.BufferAttribute(burstRand, 4));
    const burstMat = createRingBurstMaterial(pixelRatio);
    const burstPoints = new THREE.Points(burstGeo, burstMat);
    burstPoints.frustumCulled = false;
    scene.add(burstPoints);

    // 6. Real 3D Night Street, Buildings, Cherry Blossom Trees, Shrubs, Left Bench, Petals & Rain
    scene.add(streetEnv.group);

    // 9. Ambient Sparkling Stardust
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(env.dust.positions, 3));
    dustGeo.setAttribute('aColor', new THREE.BufferAttribute(env.dust.colors, 3));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(env.dust.sizes, 1));
    dustGeo.setAttribute('aRandom', new THREE.BufferAttribute(env.dust.randoms, 4));
    const dustMat = createDustParticleMaterial(pixelRatio);
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.frustumCulled = false;
    scene.add(dustPoints);

    // Calibrated GPU Bloom
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.34, 0.32, 0.65);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
      renderer.compile(scene, camera);
    }

    let currentBaseDist = baseDist;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, Math.floor(entry.contentRect.width));
        const h = Math.max(1, Math.floor(entry.contentRect.height));
        const asp = w / h;
        currentBaseDist = asp < 1 ? 7.7 : 6.15;
        camera.aspect = asp;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer?.setSize(w, h);
        bloomPass?.resolution.set(w, h);
      }
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const t = timelineRef.current;

      const appearProgress = Math.min(1, t / 0.16);
      const propPose = updateCoupleChoreography(t, elapsed, env.boyRig, env.girlRig);

      boyMat.uniforms.uTime.value = elapsed;
      boyMat.uniforms.uAppear.value = appearProgress;
      for (let i = 0; i < env.boyRig.boneMatrices.length; i++) {
        boyMat.uniforms.uBones.value[i].copy(env.boyRig.boneMatrices[i]);
      }

      girlMat.uniforms.uTime.value = elapsed;
      girlMat.uniforms.uAppear.value = appearProgress;
      for (let i = 0; i < env.girlRig.boneMatrices.length; i++) {
        girlMat.uniforms.uBones.value[i].copy(env.girlRig.boneMatrices[i]);
      }

      rosePoints.position.copy(propPose.rosePos);
      rosePoints.quaternion.copy(propPose.roseQuat);
      rosePoints.scale.setScalar(propPose.roseScale);
      roseMat.uniforms.uTime.value = elapsed;
      roseMat.uniforms.uOpacity.value = propPose.roseOpacity;

      ringPoints.position.copy(propPose.ringPos);
      ringPoints.quaternion.copy(propPose.ringQuat);
      ringPoints.scale.setScalar(propPose.ringScale);
      ringMat.uniforms.uTime.value = elapsed;
      ringMat.uniforms.uOpacity.value = propPose.ringOpacity;

      burstPoints.position.copy(propPose.sparkOrigin);
      burstMat.uniforms.uTime.value = elapsed;
      burstMat.uniforms.uBurst.value = propPose.sparkIntensity;

      streetEnv.update(elapsed, propPose.rainOpacity, propPose.coupleCenter);
      dustMat.uniforms.uTime.value = elapsed;

      // Cinematic camera choreography across all 7 acts (yields immediately if user orbits)
      if (!userInteractingRef.current) {
        const kneelDip =
          THREE.MathUtils.smoothstep(t, 0.12, 0.24) *
          (1 - THREE.MathUtils.smoothstep(t, 0.46, 0.54));
        const ringClose =
          THREE.MathUtils.smoothstep(t, 0.28, 0.42) *
          (1 - THREE.MathUtils.smoothstep(t, 0.48, 0.56));
        const walkTrack = THREE.MathUtils.smoothstep(t, 0.60, 0.78);
        const benchSettle = THREE.MathUtils.smoothstep(t, 0.78, 0.90);

        const driftX = Math.sin(elapsed * 0.22) * 0.14;
        const curAspect = camera.aspect || 1;

        // Proposal target -> Walking LEFT pair center -> Bench + Moonlit River & Flying Birds Vista
        const benchVistaTargetX = THREE.MathUtils.lerp(
          propPose.coupleCenter.x + 0.15,
          0.18,
          benchSettle,
        );
        const benchVistaTargetY = THREE.MathUtils.lerp(
          propPose.coupleCenter.y + 0.2,
          -0.32,
          benchSettle,
        );
        const benchVistaTargetZ = THREE.MathUtils.lerp(
          propPose.coupleCenter.z,
          -3.45,
          benchSettle,
        );

        const baseTargetX = THREE.MathUtils.lerp(0.18, benchVistaTargetX, walkTrack);
        const baseTargetY = THREE.MathUtils.lerp(0.08 - kneelDip * 0.2, benchVistaTargetY, walkTrack);
        const baseTargetZ = THREE.MathUtils.lerp(-0.35, benchVistaTargetZ, walkTrack);

        const benchCamX = propPose.coupleCenter.x - (curAspect < 1 ? 0.95 : 1.32);
        const benchCamY = propPose.coupleCenter.y + 0.72;
        const benchCamZ = propPose.coupleCenter.z + (curAspect < 1 ? 3.85 : 3.05);

        const baseCamX = THREE.MathUtils.lerp(0.15 + driftX, benchCamX, walkTrack);
        const baseCamY = THREE.MathUtils.lerp(0.32 - kneelDip * 0.16, benchCamY, walkTrack);
        const baseCamZ = THREE.MathUtils.lerp(
          currentBaseDist - kneelDip * 0.45 - ringClose * 0.45,
          benchCamZ,
          walkTrack,
        );

        camera.position.x = THREE.MathUtils.damp(camera.position.x, baseCamX, 2.2, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, baseCamY, 2.2, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, baseCamZ, 2.2, delta);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, baseTargetX, 2.4, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, baseTargetY, 2.4, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, baseTargetZ, 2.4, delta);
      }

      controls.update();

      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      boyGeo.dispose();
      boyMat.dispose();
      girlGeo.dispose();
      girlMat.dispose();
      roseGeo.dispose();
      roseMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      burstGeo.dispose();
      burstMat.dispose();
      streetEnv.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      composer?.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-center px-6">
          <p className="font-display-serif text-2xl text-white">
            WebGL Context Unavailable
          </p>
        </div>
      )}
    </div>
  );
};
