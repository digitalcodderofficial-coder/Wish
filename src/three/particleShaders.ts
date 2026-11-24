import * as THREE from 'three';
import { BONE_COUNT } from './riggedCouple';

export function createRiggedFigureMaterial(pixelRatio: number): THREE.ShaderMaterial {
  const initialBones = Array.from({ length: BONE_COUNT }, () => new THREE.Matrix4());

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAppear: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uBones: { value: initialBones },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uAppear;
      uniform float uPixelRatio;
      uniform mat4 uBones[${BONE_COUNT}];

      attribute vec3 aScatter;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aDelay;
      attribute vec4 aRandom;
      attribute float aContour;
      attribute vec2 aBoneIndex;
      attribute float aBoneWeight;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vTwinkle;

      float easeInOutCubic(float t) {
        return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;
      }

      void main() {
        // Compute articulated rigged world position via linear-blend bone skinning
        int idxA = int(aBoneIndex.x + 0.5);
        int idxB = int(aBoneIndex.y + 0.5);
        vec4 pos4 = vec4(position, 1.0);
        vec4 skinnedA = uBones[idxA] * pos4;
        vec4 skinnedB = uBones[idxB] * pos4;
        vec3 targetPos = mix(skinnedB.xyz, skinnedA.xyz, aBoneWeight);

        // Cosmic wide-swirl scatter-to-form materialization around proposal spot
        float localT = clamp((uAppear - aDelay * 0.42) / (1.0 - aDelay * 0.42), 0.0, 1.0);
        float ease = easeInOutCubic(localT);

        float swirlAngle = (1.0 - ease) * (3.6 + aRandom.y * 2.4) * (aRandom.z > 0.5 ? 1.0 : -1.0);
        vec3 anchor = vec3(0.28, 0.0, 0.35);
        vec3 baseRel = mix(aScatter - anchor, targetPos - anchor, ease);
        float cs = cos(swirlAngle * (1.0 - ease));
        float sn = sin(swirlAngle * (1.0 - ease));
        vec3 swirled = anchor + vec3(
          baseRel.x * cs - baseRel.z * sn,
          baseRel.y + sin((1.0 - ease) * 3.14159) * (0.28 + aRandom.x * 0.36),
          baseRel.x * sn + baseRel.z * cs
        );
        vec3 finalPos = mix(swirled, targetPos, pow(ease, 1.65));

        // Gentle living hair / dress hem micro-flow once formed
        float alive = smoothstep(0.55, 1.0, ease);
        float hairFlow = aRandom.w * alive * sin(uTime * 1.8 + aRandom.y * 6.2831 + finalPos.y * 3.2) * 0.018;
        finalPos.x += hairFlow;
        finalPos.z += hairFlow * 0.6;

        vec4 mvPosition = viewMatrix * vec4(finalPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(1.2, -mvPosition.z);
        float twinkle = 0.84 + 0.16 * sin(uTime * (2.2 + aRandom.z * 3.0) + aRandom.y * 16.0);

        // Rich, clearly readable 4K particle dots against the real 3D environment
        gl_PointSize = aSize * mix(1.45, 1.18, ease) * uPixelRatio * (10.2 / dist);
        gl_PointSize = clamp(gl_PointSize, 1.8, 8.5);

        vColor = aColor;
        vTwinkle = twinkle;
        float baseAlpha = mix(0.84, 1.0, aContour);
        vAlpha = mix(0.45, baseAlpha, ease);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vTwinkle;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.46) discard;

        // Deep saturated outer body + luminous inner pinpoint core so particles never wash out!
        float core = exp(-d * d * 24.0);
        float rim = smoothstep(0.46, 0.14, d);
        vec3 deepCol = vColor * 0.88;
        vec3 brightCore = mix(vColor, vec3(1.0), 0.42) * 1.35;
        vec3 col = mix(deepCol, brightCore, core) * vTwinkle;

        gl_FragColor = vec4(col, vAlpha * rim);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
  });
}

export function createPropParticleMaterial(pixelRatio: number, pointScale = 9.5): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPixelRatio;

      attribute vec3 aColor;
      attribute float aSize;
      attribute vec4 aRandom;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(0.8, -mvPosition.z);
        float glint = 0.82 + 0.25 * sin(uTime * (3.5 + aRandom.x * 4.0) + aRandom.y * 20.0);

        gl_PointSize = aSize * uPixelRatio * (${pointScale.toFixed(1)} / dist) * (0.95 + 0.15 * glint);
        gl_PointSize = clamp(gl_PointSize, 1.8, 9.5);

        vColor = aColor;
        vAlpha = uOpacity * glint;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.46) discard;

        float core = exp(-d * d * 22.0);
        float rim = smoothstep(0.46, 0.12, d);
        vec3 col = mix(vColor * 0.95, mix(vColor, vec3(1.0), 0.55) * 1.4, core);
        gl_FragColor = vec4(col, vAlpha * rim);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
  });
}

export function createDustParticleMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;

      attribute vec3 aColor;
      attribute float aSize;
      attribute vec4 aRandom;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float isFloor = aRandom.w;
        float angle = (1.0 - isFloor) * uTime * (0.04 + aRandom.x * 0.05) * (aRandom.y > 0.5 ? 1.0 : -1.0);
        float cs = cos(angle);
        float sn = sin(angle);
        vec3 pos = vec3(
          position.x * cs - position.z * sn,
          position.y + (1.0 - isFloor) * sin(uTime * 0.6 + aRandom.z * 6.2831) * 0.12,
          position.x * sn + position.z * cs
        );

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(1.5, -mvPosition.z);
        float twinkle = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (1.8 + aRandom.y * 3.2) + aRandom.x * 20.0), 2.0);

        gl_PointSize = aSize * uPixelRatio * (8.5 / dist) * (0.7 + 0.45 * twinkle);
        gl_PointSize = clamp(gl_PointSize, 1.0, 6.5);

        vColor = aColor;
        vAlpha = mix(twinkle * 0.5, 0.45, isFloor);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        float glow = exp(-d * d * 26.0);
        vec3 col = mix(vColor, vec3(1.0), glow * 0.35);
        gl_FragColor = vec4(col * glow, vAlpha * smoothstep(0.5, 0.0, d));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createRingBurstMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBurst: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uBurst;
      uniform float uPixelRatio;

      attribute vec3 aColor;
      attribute vec4 aRandom;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        // Expand radially outward in sparkling ring celebration
        float speed = 0.25 + aRandom.x * 0.45;
        float progress = fract(uBurst * 0.8 + aRandom.y * 0.35);
        vec3 dir = normalize(position + vec3(0.0001));
        vec3 pos = dir * (uBurst * speed * (0.6 + progress * 1.4));
        pos.y += sin(uTime * 2.0 + aRandom.z * 6.28) * 0.04 * uBurst;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(1.0, -mvPosition.z);
        gl_PointSize = (0.7 + aRandom.w * 0.8) * uPixelRatio * (10.0 / dist);
        gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);

        vColor = aColor;
        vAlpha = uBurst * (1.0 - progress * 0.55) * 0.85;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float glow = exp(-d * d * 28.0);
        gl_FragColor = vec4(mix(vColor, vec3(1.0), glow * 0.5) * glow, vAlpha * smoothstep(0.5, 0.0, d));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createStaticEnvMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;

      attribute vec3 aColor;
      attribute float aSize;
      attribute vec4 aRandom; // x: twinkle, y: sway, z: seed, w: isFloor

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 pos = position;
        // Wind sway on tree branches and cherry blossom canopies
        float swayAmt = aRandom.y;
        if (swayAmt > 0.01) {
          float wind = sin(uTime * 1.45 + pos.z * 0.6 + pos.x * 0.4 + aRandom.z * 3.14) * 0.065;
          float gust = sin(uTime * 0.55 + pos.x * 0.3) * 0.04;
          pos.x += (wind + gust + 0.03) * swayAmt;
          pos.y += cos(uTime * 1.8 + aRandom.z * 6.28) * 0.015 * swayAmt;
        }

        // Subtle wet ripple shimmer on street surface
        float isFloor = aRandom.w;
        float twinkle = 0.72 + 0.28 * sin(uTime * (1.5 + aRandom.x * 2.5) + aRandom.z * 16.0);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(1.5, -mvPosition.z);
        gl_PointSize = aSize * uPixelRatio * (13.8 / dist);
        gl_PointSize = clamp(gl_PointSize, 1.8, 8.2);

        float distFade = smoothstep(32.0, 6.0, dist);
        vColor = aColor;
        vAlpha = mix(0.88, 0.72, isFloor) * twinkle * distFade;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        float core = exp(-d * d * 15.0);
        float halo = exp(-d * d * 4.5) * 0.30;
        vec3 col = mix(vColor, vec3(1.0), core * 0.24);
        gl_FragColor = vec4(col * (core + halo), vAlpha * smoothstep(0.5, 0.02, d));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createFallingBlossomMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;

      attribute vec3 aColor;
      attribute float aSize;
      attribute vec4 aRandom; // x: speed, y: swayAmp, z: phase, w: spin

      varying vec3 vColor;
      varying float vAlpha;
      varying float vSpin;

      void main() {
        float minY = -1.52;
        float spanY = 5.4;

        // Fall downward + blow diagonally across in the wind!
        float fallT = fract((position.y - minY) / spanY - uTime * (aRandom.x * 0.12));
        float y = minY + fallT * spanY;

        float windDrift = mod(position.x + uTime * (0.42 + aRandom.x * 0.35) + 5.0, 10.0) - 5.0;
        float flutterX = sin(uTime * 2.1 + aRandom.z * 6.2831) * aRandom.y * 0.35;
        float flutterZ = cos(uTime * 1.7 + aRandom.z * 6.2831) * aRandom.y * 0.25;

        vec3 pos = vec3(windDrift + flutterX, y, position.z + flutterZ);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(1.2, -mvPosition.z);
        gl_PointSize = aSize * uPixelRatio * (10.5 / dist);
        gl_PointSize = clamp(gl_PointSize, 1.5, 9.5);

        float edgeFade = smoothstep(0.0, 0.12, fallT) * smoothstep(1.0, 0.85, fallT);
        vColor = aColor;
        vAlpha = 0.82 * edgeFade * smoothstep(16.0, 2.5, dist);
        vSpin = uTime * (1.8 + aRandom.w * 2.5) + aRandom.z * 6.28;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSpin;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float cs = cos(vSpin);
        float sn = sin(vSpin);
        vec2 ruv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);
        // Elongated sakura petal silhouette
        ruv.x *= 1.55;
        float d = length(ruv);
        if (d > 0.48) discard;

        float petal = smoothstep(0.48, 0.08, d);
        gl_FragColor = vec4(mix(vColor, vec3(1.0), petal * 0.25), vAlpha * petal);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createRainStreakMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRainOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uRainOpacity;

      attribute vec4 aSeed; // x: speed, y: offset, z: len, w: isBottom

      varying float vAlpha;

      void main() {
        float minY = -1.52;
        float spanY = 5.8;
        float t = fract(aSeed.y - uTime * (aSeed.x * 0.26));
        float topY = minY + t * spanY;

        // Wind slant (+X drift as rain falls)
        float windX = mod(position.x + uTime * 1.15 + 5.5, 11.0) - 5.5;
        float isBot = aSeed.w;
        float len = aSeed.z;

        vec3 pos = vec3(
          windX - isBot * len * 0.22,
          topY - isBot * len,
          position.z
        );

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(1.5, -mvPosition.z);
        float fade = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.88, t);
        vAlpha = 0.26 * uRainOpacity * fade * smoothstep(18.0, 3.0, dist) * (isBot > 0.5 ? 1.0 : 0.35);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;

      void main() {
        gl_FragColor = vec4(0.84, 0.76, 1.0, vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

