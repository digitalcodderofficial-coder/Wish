import * as THREE from 'three';
import { BENCH_ROT_Y, BENCH_WORLD_POS } from './environmentScene';

export const BONE_COUNT = 13;

export const BONE = {
  PELVIS: 0,
  CHEST: 1,
  HEAD: 2,
  L_UPPER_ARM: 3,
  L_FOREARM: 4,
  L_HAND: 5,
  R_UPPER_ARM: 6,
  R_FOREARM: 7,
  R_HAND: 8,
  L_THIGH: 9,
  L_SHIN: 10,
  R_THIGH: 11,
  R_SHIN: 12,
} as const;

export interface RiggedPointCloudData {
  count: number;
  positions: Float32Array;
  scatterPositions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  delays: Float32Array;
  randoms: Float32Array;
  isContour: Float32Array;
  boneIndices: Float32Array;
  boneWeights: Float32Array;
}

export interface PropPointCloudData {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  randoms: Float32Array;
}

export interface RigDefinition {
  bindPositions: THREE.Vector3[];
  invBindMatrices: THREE.Matrix4[];
  root: THREE.Group;
  joints: THREE.Object3D[];
  boneMatrices: THREE.Matrix4[];
  basePos: THREE.Vector3;
  baseRotY: number;
}

function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const COL_WHITE = new THREE.Color('#ffffff');
const COL_SOFT_PINK = new THREE.Color('#ff52a8');
const COL_NEON_PINK = new THREE.Color('#e6007a');
const COL_MAGENTA = new THREE.Color('#b814d6');
const COL_PURPLE = new THREE.Color('#6d18d4');
const COL_DEEP_VIOLET = new THREE.Color('#3b0778');
const COL_LAVENDER = new THREE.Color('#f0abfc');

function pickFigureColor(
  rng: () => number,
  t: number,
  isHighlight: boolean,
  isEdge: boolean,
): THREE.Color {
  const c = new THREE.Color();
  const roll = rng();

  if (isHighlight) {
    if (roll < 0.72) c.copy(COL_WHITE);
    else if (roll < 0.9) c.copy(COL_LAVENDER);
    else c.copy(COL_SOFT_PINK);
    return c;
  }

  if (isEdge) {
    if (roll < 0.3) c.copy(COL_WHITE);
    else if (roll < 0.72) c.copy(COL_SOFT_PINK);
    else c.copy(COL_NEON_PINK);
    return c;
  }

  if (roll < 0.08) {
    c.copy(COL_LAVENDER);
  } else if (roll < 0.45) {
    c.copy(COL_NEON_PINK).lerp(COL_SOFT_PINK, t * 0.55 + rng() * 0.2);
  } else if (roll < 0.78) {
    c.copy(COL_MAGENTA).lerp(COL_PURPLE, rng() * 0.65);
  } else {
    c.copy(COL_PURPLE).lerp(COL_DEEP_VIOLET, (1 - t) * 0.5);
  }
  return c;
}

interface SamplePt {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  size: number;
  delay: number;
  contour: number;
  hairFactor: number;
  boneA: number;
  boneB: number;
  weightA: number;
}

function addCurvePts(
  out: SamplePt[],
  ctrl: THREE.Vector3[],
  count: number,
  jitter: number,
  sizeBase: number,
  delayBase: number,
  contourVal: number,
  isHighlight: boolean,
  boneA: number,
  boneB: number,
  weightA: number,
  rng: () => number,
  hairFactor = 0,
) {
  const curve = new THREE.CatmullRomCurve3(ctrl);
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    const p = curve.getPoint(u);
    const col = pickFigureColor(rng, 0.75, isHighlight, contourVal > 0.7);
    out.push({
      x: p.x + (rng() - 0.5) * jitter,
      y: p.y + (rng() - 0.5) * jitter,
      z: p.z + (rng() - 0.5) * jitter,
      r: col.r,
      g: col.g,
      b: col.b,
      size: sizeBase * (0.85 + rng() * 0.35),
      delay: delayBase + rng() * 0.12,
      contour: contourVal,
      hairFactor,
      boneA,
      boneB,
      weightA,
    });
  }
}

function addLimbTube(
  out: SamplePt[],
  ctrl: THREE.Vector3[],
  radii: number[],
  surfaceCount: number,
  meridianCount: number,
  delayBase: number,
  boneStart: number,
  boneEnd: number,
  rng: () => number,
  flattenZ = 1.0,
) {
  const curve = new THREE.CatmullRomCurve3(ctrl);
  const upRef = new THREE.Vector3(0, 0, 1);

  const getRadius = (u: number) => {
    const sc = u * (radii.length - 1);
    const idx = Math.min(Math.floor(sc), radii.length - 2);
    return THREE.MathUtils.lerp(radii[idx], radii[idx + 1], sc - idx);
  };

  const pushPt = (u: number, angle: number, radScale: number, isContour: boolean) => {
    const center = curve.getPoint(u);
    const tangent = curve.getTangent(u).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, upRef);
    if (binormal.lengthSq() < 0.001) binormal.set(1, 0, 0);
    binormal.normalize();
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    const r = getRadius(u) * radScale;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle) * flattenZ;

    // Smooth blend near midpoint of bone pair
    const blend = THREE.MathUtils.smoothstep(u, 0.25, 0.75);
    const bA = blend < 0.5 ? boneStart : boneEnd;
    const bB = blend < 0.5 ? boneEnd : boneStart;
    const wA = blend < 0.5 ? 1 - blend * 0.5 : 0.5 + (blend - 0.5);

    const isSil = Math.abs(cosA) > 0.86;
    const col = pickFigureColor(rng, 0.5 + u * 0.3, false, isContour || isSil);

    out.push({
      x: center.x + binormal.x * cosA * r + normal.x * sinA * r,
      y: center.y + binormal.y * cosA * r + normal.y * sinA * r,
      z: center.z + binormal.z * cosA * r + normal.z * sinA * r,
      r: col.r,
      g: col.g,
      b: col.b,
      size: isContour ? 0.9 + rng() * 0.28 : 0.78 + rng() * 0.35,
      delay: delayBase + u * 0.12 + rng() * 0.06,
      contour: isContour ? 0.92 : 0.22,
      hairFactor: 0,
      boneA: bA,
      boneB: bB,
      weightA: wA,
    });
  };

  for (let i = 0; i < surfaceCount; i++) {
    pushPt(rng(), rng() * Math.PI * 2, 0.94 + rng() * 0.1, false);
  }

  const meridians = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  const perM = Math.floor(meridianCount / meridians.length);
  for (const ang of meridians) {
    for (let i = 0; i < perM; i++) {
      const u = i / Math.max(1, perM - 1);
      pushPt(u, ang + (rng() - 0.5) * 0.05, 1.01, true);
    }
  }
}

interface CharacterSpec {
  role: 'boy' | 'girl';
  seed: number;
  height: number;
  shoulderWidth: number;
  waistWidth: number;
  hipWidth: number;
  chestDepth: number;
  bustProjection: number;
  hairLength: number;
}

function buildCharacterGeometryData(spec: CharacterSpec): {
  cloud: RiggedPointCloudData;
  bindPositions: THREE.Vector3[];
} {
  const rng = createRng(spec.seed);
  const pts: SamplePt[] = [];
  const H = spec.height;
  const s = H / 3.1;

  const pelvisY = 0.487 * H;
  const waistY = 0.605 * H;
  const chestY = 0.74 * H;
  const shoulderY = 0.81 * H;
  const neckBaseY = 0.835 * H;
  const headCenterY = 0.925 * H;

  const hipOffset = spec.hipWidth * 0.29;
  const shoulderX = spec.shoulderWidth * 0.49;

  // Bind-pose joint world positions (facing +Z, feet at y = 0)
  const bindPositions: THREE.Vector3[] = new Array(BONE_COUNT);
  bindPositions[BONE.PELVIS] = new THREE.Vector3(0, pelvisY, 0);
  bindPositions[BONE.CHEST] = new THREE.Vector3(0, waistY + 0.04 * H, 0);
  bindPositions[BONE.HEAD] = new THREE.Vector3(0, neckBaseY + 0.02 * H, 0);

  bindPositions[BONE.L_UPPER_ARM] = new THREE.Vector3(shoulderX, shoulderY - 0.02 * H, 0);
  bindPositions[BONE.L_FOREARM] = new THREE.Vector3(shoulderX + 0.03 * s, waistY + 0.05 * H, 0);
  bindPositions[BONE.L_HAND] = new THREE.Vector3(shoulderX + 0.02 * s, pelvisY - 0.02 * H, 0);

  bindPositions[BONE.R_UPPER_ARM] = new THREE.Vector3(-shoulderX, shoulderY - 0.02 * H, 0);
  bindPositions[BONE.R_FOREARM] = new THREE.Vector3(-shoulderX - 0.03 * s, waistY + 0.05 * H, 0);
  bindPositions[BONE.R_HAND] = new THREE.Vector3(-shoulderX - 0.02 * s, pelvisY - 0.02 * H, 0);

  bindPositions[BONE.L_THIGH] = new THREE.Vector3(hipOffset, pelvisY, 0);
  bindPositions[BONE.L_SHIN] = new THREE.Vector3(hipOffset, 0.25 * H, 0);

  bindPositions[BONE.R_THIGH] = new THREE.Vector3(-hipOffset, pelvisY, 0);
  bindPositions[BONE.R_SHIN] = new THREE.Vector3(-hipOffset, 0.25 * H, 0);

  const torsoWidthAt = (y: number) => {
    if (y < pelvisY) return spec.hipWidth * 0.88;
    if (y < waistY) {
      const t = (y - pelvisY) / (waistY - pelvisY);
      return THREE.MathUtils.lerp(spec.hipWidth, spec.waistWidth, t * t * (3 - 2 * t));
    }
    if (y < chestY) {
      const t = (y - waistY) / (chestY - waistY);
      return THREE.MathUtils.lerp(spec.waistWidth, spec.shoulderWidth * 0.88, t * t * (3 - 2 * t));
    }
    if (y < shoulderY) {
      const t = (y - chestY) / (shoulderY - chestY);
      return THREE.MathUtils.lerp(spec.shoulderWidth * 0.88, spec.shoulderWidth, Math.sin(t * Math.PI * 0.5));
    }
    const t = Math.min(1, (y - shoulderY) / (neckBaseY - shoulderY + 0.001));
    return THREE.MathUtils.lerp(spec.shoulderWidth * 0.9, 0.072 * s, t);
  };

  const torsoDepthAt = (y: number) => {
    if (y < waistY) {
      const t = (y - pelvisY) / (waistY - pelvisY);
      return THREE.MathUtils.lerp(spec.chestDepth * 0.94, spec.chestDepth * 0.78, t);
    }
    if (y < chestY) {
      const t = (y - waistY) / (chestY - waistY);
      return THREE.MathUtils.lerp(spec.chestDepth * 0.78, spec.chestDepth, t);
    }
    const t = Math.min(1, (y - chestY) / (neckBaseY - chestY + 0.001));
    return THREE.MathUtils.lerp(spec.chestDepth, 0.068 * s, t * 0.75);
  };

  // 1. TORSO SURFACE + ANATOMICAL CONTOUR RINGS
  for (let i = 0; i < 2400; i++) {
    const u = rng();
    const y = THREE.MathUtils.lerp(pelvisY - 0.02 * H, neckBaseY, u);
    const ang = rng() * Math.PI * 2;
    const rx = torsoWidthAt(y) * 0.5;
    let rz = torsoDepthAt(y) * 0.5;

    const sinA = Math.sin(ang);
    const cosA = Math.cos(ang);
    if (sinA > 0) {
      const chestF = Math.exp(-Math.pow((y - (chestY - 0.02 * H)) / (0.055 * H), 2));
      const bilat = Math.pow(Math.abs(cosA), 0.7) * (1 - Math.abs(cosA) * 0.35);
      rz += chestF * spec.bustProjection * bilat * sinA;
    }

    const blend = THREE.MathUtils.smoothstep(y, pelvisY, waistY + 0.08 * H);
    const isEdge = Math.abs(cosA) > 0.85;
    const col = pickFigureColor(rng, u, false, isEdge);

    pts.push({
      x: cosA * rx * (0.97 + rng() * 0.06),
      y,
      z: sinA * rz * (0.97 + rng() * 0.06),
      r: col.r,
      g: col.g,
      b: col.b,
      size: isEdge ? 0.96 + rng() * 0.25 : 0.76 + rng() * 0.35,
      delay: 0.04 + Math.abs(u - 0.5) * 0.14 + rng() * 0.06,
      contour: isEdge ? 0.82 : 0.22,
      hairFactor: 0,
      boneA: blend > 0.5 ? BONE.CHEST : BONE.PELVIS,
      boneB: blend > 0.5 ? BONE.PELVIS : BONE.CHEST,
      weightA: blend > 0.5 ? blend : 1 - blend,
    });
  }

  // Torso contour rings
  const ringHeights = [0.50, 0.56, 0.61, 0.68, 0.74, 0.79, 0.82];
  for (const hf of ringHeights) {
    const y = hf * H;
    const rx = torsoWidthAt(y) * 0.5;
    const rz = torsoDepthAt(y) * 0.5;
    const blend = THREE.MathUtils.smoothstep(y, pelvisY, waistY + 0.08 * H);
    for (let i = 0; i < 84; i++) {
      const a = (i / 84) * Math.PI * 2;
      const col = pickFigureColor(rng, hf, false, true);
      pts.push({
        x: Math.cos(a) * rx,
        y,
        z: Math.sin(a) * rz,
        r: col.r,
        g: col.g,
        b: col.b,
        size: 0.86 + rng() * 0.22,
        delay: 0.08 + rng() * 0.08,
        contour: 0.92,
        hairFactor: 0,
        boneA: blend > 0.5 ? BONE.CHEST : BONE.PELVIS,
        boneB: blend > 0.5 ? BONE.PELVIS : BONE.CHEST,
        weightA: blend > 0.5 ? blend : 1 - blend,
      });
    }
  }

  // If Girl: Elegant flowing particle dress/skirt silhouette from waist down to mid-calf!
  if (spec.role === 'girl') {
    for (let i = 0; i < 1850; i++) {
      const u = rng(); // 0 at waist, 1 at hem
      const y = THREE.MathUtils.lerp(waistY, 0.22 * H, u);
      const ang = rng() * Math.PI * 2;
      const flare = 1.0 + Math.pow(u, 1.35) * 1.65;
      const foldWave = 1.0 + 0.08 * Math.sin(ang * 7.0 + u * 2.5) * u;
      const rx = spec.waistWidth * 0.52 * flare * foldWave;
      const rz = spec.chestDepth * 0.48 * flare * foldWave;

      const isHemOrEdge = u > 0.94 || Math.abs(Math.cos(ang)) > 0.86;
      const col = pickFigureColor(rng, 1 - u * 0.5, u > 0.96 && rng() < 0.4, isHemOrEdge);

      pts.push({
        x: Math.cos(ang) * rx,
        y,
        z: Math.sin(ang) * rz,
        r: col.r,
        g: col.g,
        b: col.b,
        size: isHemOrEdge ? 0.94 + rng() * 0.24 : 0.74 + rng() * 0.32,
        delay: 0.1 + u * 0.12 + rng() * 0.06,
        contour: isHemOrEdge ? 0.9 : 0.3,
        hairFactor: u * 0.45, // subtle dress hem flow
        boneA: BONE.PELVIS,
        boneB: BONE.CHEST,
        weightA: 0.92,
      });
    }
  }

  // Collarbone & Spine contours
  const clavLeft = [
    new THREE.Vector3(0.02 * s, neckBaseY - 0.014 * H, 0.052 * s),
    new THREE.Vector3(0.11 * s, shoulderY + 0.008 * H, 0.045 * s),
    new THREE.Vector3(shoulderX * 0.92, shoulderY, 0.01 * s),
  ];
  const clavRight = clavLeft.map((v) => new THREE.Vector3(-v.x, v.y, v.z));
  addCurvePts(pts, clavLeft, 45, 0.004 * s, 0.92, 0.12, 1.0, true, BONE.CHEST, BONE.CHEST, 1, rng);
  addCurvePts(pts, clavRight, 45, 0.004 * s, 0.92, 0.12, 1.0, true, BONE.CHEST, BONE.CHEST, 1, rng);

  // 2. NECK
  addLimbTube(
    pts,
    [
      new THREE.Vector3(0, neckBaseY - 0.01 * H, 0),
      new THREE.Vector3(0, headCenterY - 0.055 * H, 0.012 * s),
    ],
    [0.068 * s, 0.058 * s],
    200,
    100,
    0.14,
    BONE.CHEST,
    BONE.HEAD,
    rng,
    0.92,
  );

  // 3. HEAD & HIGH-PRECISION FACIAL OUTLINES
  const headR = 0.108 * s;
  const headH = 0.146 * s;
  const headD = 0.125 * s;

  for (let i = 0; i < 1650; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    const lowerTaper = cosP < 0 ? 1.0 + cosP * 0.28 : 1.0;
    const frontF = Math.max(0, Math.sin(theta));
    const px = Math.cos(theta) * sinP * headR * lowerTaper;
    const py = headCenterY + cosP * headH;
    let pz = Math.sin(theta) * sinP * headD;
    if (frontF > 0.2 && cosP < 0.25 && cosP > -0.7) pz *= 0.94;

    const isProfile = Math.abs(Math.cos(theta)) > 0.87 || frontF > 0.86;
    const col = pickFigureColor(rng, 0.85, isProfile && rng() < 0.35, isProfile);

    pts.push({
      x: px,
      y: py,
      z: pz,
      r: col.r,
      g: col.g,
      b: col.b,
      size: isProfile ? 0.82 + rng() * 0.2 : 0.68 + rng() * 0.25,
      delay: 0.16 + rng() * 0.12,
      contour: isProfile ? 0.88 : 0.25,
      hairFactor: 0,
      boneA: BONE.HEAD,
      boneB: BONE.CHEST,
      weightA: 0.96,
    });
  }

  const fZ = headD * 0.95;

  // Jawline & Chin Outline
  addCurvePts(
    pts,
    [
      new THREE.Vector3(-headR * 0.86, headCenterY - headH * 0.12, 0.01 * s),
      new THREE.Vector3(-headR * 0.74, headCenterY - headH * 0.56, headD * 0.44),
      new THREE.Vector3(-headR * 0.34, headCenterY - headH * 0.88, headD * 0.76),
      new THREE.Vector3(0, headCenterY - headH * 0.99, headD * 0.86),
      new THREE.Vector3(headR * 0.34, headCenterY - headH * 0.88, headD * 0.76),
      new THREE.Vector3(headR * 0.74, headCenterY - headH * 0.56, headD * 0.44),
      new THREE.Vector3(headR * 0.86, headCenterY - headH * 0.12, 0.01 * s),
    ],
    200,
    0.002 * s,
    0.88,
    0.18,
    1.0,
    true,
    BONE.HEAD,
    BONE.HEAD,
    1,
    rng,
  );

  // Forehead -> Nose Bridge -> Tip -> Philtrum
  addCurvePts(
    pts,
    [
      new THREE.Vector3(0, headCenterY + headH * 0.52, fZ * 0.92),
      new THREE.Vector3(0, headCenterY + headH * 0.24, fZ * 1.0),
      new THREE.Vector3(0, headCenterY + headH * 0.08, fZ * 0.99),
      new THREE.Vector3(0, headCenterY - headH * 0.08, fZ * 1.13),
      new THREE.Vector3(0, headCenterY - headH * 0.21, fZ * 1.23),
      new THREE.Vector3(0, headCenterY - headH * 0.29, fZ * 1.06),
    ],
    100,
    0.0018 * s,
    0.84,
    0.19,
    1.0,
    true,
    BONE.HEAD,
    BONE.HEAD,
    1,
    rng,
  );

  // Eyes, Brows & Cheekbones
  for (const side of [-1, 1]) {
    const eyeX = side * 0.038 * s;
    const eyeY = headCenterY + headH * 0.11;
    const eyeZ = fZ * 0.94;

    addCurvePts(
      pts,
      [
        new THREE.Vector3(eyeX - side * 0.019 * s, eyeY - 0.002 * s, eyeZ + 0.004 * s),
        new THREE.Vector3(eyeX, eyeY + 0.01 * s, eyeZ + 0.01 * s),
        new THREE.Vector3(eyeX + side * 0.021 * s, eyeY - 0.001 * s, eyeZ - 0.004 * s),
      ],
      44,
      0.0012 * s,
      0.8,
      0.2,
      1.0,
      true,
      BONE.HEAD,
      BONE.HEAD,
      1,
      rng,
    );
    addCurvePts(
      pts,
      [
        new THREE.Vector3(eyeX - side * 0.019 * s, eyeY - 0.002 * s, eyeZ + 0.004 * s),
        new THREE.Vector3(eyeX, eyeY - 0.008 * s, eyeZ + 0.008 * s),
        new THREE.Vector3(eyeX + side * 0.021 * s, eyeY - 0.001 * s, eyeZ - 0.004 * s),
      ],
      34,
      0.0012 * s,
      0.74,
      0.2,
      1.0,
      false,
      BONE.HEAD,
      BONE.HEAD,
      1,
      rng,
    );
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      pts.push({
        x: eyeX + Math.cos(a) * 0.0065 * s,
        y: eyeY + Math.sin(a) * 0.0065 * s,
        z: eyeZ + 0.009 * s,
        r: 1.0,
        g: 0.95,
        b: 1.0,
        size: 0.78,
        delay: 0.21,
        contour: 1.0,
        hairFactor: 0,
        boneA: BONE.HEAD,
        boneB: BONE.HEAD,
        weightA: 1,
      });
    }
    addCurvePts(
      pts,
      [
        new THREE.Vector3(eyeX - side * 0.023 * s, eyeY + 0.019 * s, eyeZ + 0.008 * s),
        new THREE.Vector3(eyeX + side * 0.004 * s, eyeY + 0.026 * s, eyeZ + 0.01 * s),
        new THREE.Vector3(eyeX + side * 0.029 * s, eyeY + 0.018 * s, eyeZ - 0.005 * s),
      ],
      42,
      0.0018 * s,
      0.8,
      0.2,
      1.0,
      true,
      BONE.HEAD,
      BONE.HEAD,
      1,
      rng,
    );
  }

  // Lips
  const mouthY = headCenterY - headH * 0.45;
  const mouthZ = fZ * 0.97;
  addCurvePts(
    pts,
    [
      new THREE.Vector3(-0.026 * s, mouthY - 0.002 * s, mouthZ - 0.01 * s),
      new THREE.Vector3(-0.01 * s, mouthY + 0.007 * s, mouthZ + 0.006 * s),
      new THREE.Vector3(0, mouthY + 0.004 * s, mouthZ + 0.009 * s),
      new THREE.Vector3(0.01 * s, mouthY + 0.007 * s, mouthZ + 0.006 * s),
      new THREE.Vector3(0.026 * s, mouthY - 0.002 * s, mouthZ - 0.01 * s),
    ],
    44,
    0.0012 * s,
    0.78,
    0.2,
    1.0,
    true,
    BONE.HEAD,
    BONE.HEAD,
    1,
    rng,
  );
  addCurvePts(
    pts,
    [
      new THREE.Vector3(-0.024 * s, mouthY - 0.003 * s, mouthZ - 0.009 * s),
      new THREE.Vector3(0, mouthY - 0.012 * s, mouthZ + 0.009 * s),
      new THREE.Vector3(0.024 * s, mouthY - 0.003 * s, mouthZ - 0.009 * s),
    ],
    38,
    0.0012 * s,
    0.78,
    0.2,
    1.0,
    true,
    BONE.HEAD,
    BONE.HEAD,
    1,
    rng,
  );

  // Flowing Hair Strands
  const strands = spec.role === 'girl' ? 54 : 36;
  const perStrand = spec.role === 'girl' ? 30 : 18;
  for (let st = 0; st < strands; st++) {
    const az = Math.PI * 0.25 + (st / strands) * Math.PI * 1.5;
    const elev = 0.15 + rng() * 0.72;
    const crown = new THREE.Vector3(
      Math.cos(az) * headR * 0.96 * Math.cos(elev * 0.6),
      headCenterY + headH * (0.55 + elev * 0.45),
      Math.sin(az) * headD * 0.96 * Math.cos(elev * 0.6) - 0.01 * s,
    );
    const mid = new THREE.Vector3(
      Math.cos(az) * headR * (1.15 + rng() * 0.1),
      headCenterY - spec.hairLength * 0.36,
      Math.sin(az) * headD * (1.12 + rng() * 0.14) - 0.03 * s,
    );
    const tip = new THREE.Vector3(
      Math.cos(az) * headR * (1.25 + rng() * 0.24),
      headCenterY - spec.hairLength * (0.8 + rng() * 0.35),
      Math.sin(az) * headD * (1.2 + rng() * 0.2) - 0.06 * s,
    );
    addCurvePts(
      pts,
      [crown, mid, tip],
      perStrand,
      0.01 * s,
      0.86,
      0.18,
      0.72,
      rng() < 0.2,
      BONE.HEAD,
      BONE.CHEST,
      spec.role === 'girl' ? 0.65 : 0.95,
      rng,
      spec.role === 'girl' ? 1.0 : 0.35,
    );
  }

  // 4. ARMS & ARTICULATED HANDS (Straight downward bind pose so bone skinning bends cleanly!)
  for (const side of [-1, 1]) {
    const isLeft = side === 1;
    const uArmBone = isLeft ? BONE.L_UPPER_ARM : BONE.R_UPPER_ARM;
    const fArmBone = isLeft ? BONE.L_FOREARM : BONE.R_FOREARM;
    const handBone = isLeft ? BONE.L_HAND : BONE.R_HAND;

    const shoulderPt = bindPositions[uArmBone];
    const elbowPt = bindPositions[fArmBone];
    const wristPt = bindPositions[handBone];

    // Upper Arm
    addLimbTube(
      pts,
      [shoulderPt, elbowPt],
      [0.062 * s, 0.048 * s],
      420,
      160,
      0.12,
      uArmBone,
      fArmBone,
      rng,
    );
    // Forearm
    addLimbTube(
      pts,
      [elbowPt, wristPt],
      [0.047 * s, 0.031 * s],
      400,
      160,
      0.14,
      fArmBone,
      handBone,
      rng,
    );
    // Palm & 5 Fingers
    const palmEnd = new THREE.Vector3(wristPt.x, wristPt.y - 0.075 * s, wristPt.z + 0.01 * s);
    addCurvePts(pts, [wristPt, palmEnd], 60, 0.016 * s, 0.84, 0.18, 0.85, true, handBone, fArmBone, 0.95, rng);
    for (let f = 0; f < 5; f++) {
      const fZOff = (f - 2) * 0.013 * s;
      const fLen = (0.078 - Math.abs(f - 2) * 0.011) * s;
      const knuckle = new THREE.Vector3(wristPt.x, palmEnd.y - 0.008 * s, palmEnd.z + fZOff);
      const tip = new THREE.Vector3(wristPt.x, knuckle.y - fLen, knuckle.z + fZOff * 0.25);
      addCurvePts(pts, [palmEnd, knuckle, tip], 26, 0.0025 * s, 0.82, 0.2, 1.0, true, handBone, handBone, 1, rng);
    }
  }

  // 5. LEGS (Vertical bind pose so kneeling bends knees & hips accurately!)
  for (const side of [-1, 1]) {
    const isLeft = side === 1;
    const thighBone = isLeft ? BONE.L_THIGH : BONE.R_THIGH;
    const shinBone = isLeft ? BONE.L_SHIN : BONE.R_SHIN;

    const hipPt = bindPositions[thighBone];
    const kneePt = bindPositions[shinBone];
    const anklePt = new THREE.Vector3(kneePt.x, 0.04 * H, 0);
    const toePt = new THREE.Vector3(kneePt.x, 0.008 * H, 0.14 * s);

    addLimbTube(
      pts,
      [hipPt, kneePt],
      [0.096 * s, 0.062 * s],
      spec.role === 'girl' ? 650 : 980,
      spec.role === 'girl' ? 220 : 320,
      0.08,
      thighBone,
      shinBone,
      rng,
      1.04,
    );
    addLimbTube(
      pts,
      [kneePt, anklePt],
      [0.060 * s, 0.041 * s],
      spec.role === 'girl' ? 620 : 900,
      spec.role === 'girl' ? 220 : 320,
      0.1,
      shinBone,
      shinBone,
      rng,
      1.04,
    );
    addLimbTube(
      pts,
      [anklePt, toePt],
      [0.040 * s, 0.022 * s],
      160,
      70,
      0.12,
      shinBone,
      shinBone,
      rng,
      0.65,
    );
  }

  const count = pts.length;
  const positions = new Float32Array(count * 3);
  const scatterPositions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const delays = new Float32Array(count);
  const randoms = new Float32Array(count * 4);
  const isContour = new Float32Array(count);
  const boneIndices = new Float32Array(count * 2);
  const boneWeights = new Float32Array(count);

  const scatRng = createRng(spec.seed + 777);
  for (let i = 0; i < count; i++) {
    const p = pts[i];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    const th = scatRng() * Math.PI * 2;
    const ph = Math.acos(2 * scatRng() - 1);
    const rad = 2.2 + Math.pow(scatRng(), 0.72) * 3.6;
    scatterPositions[i * 3] = 0.28 + p.x * 0.45 + Math.cos(th) * Math.sin(ph) * rad;
    scatterPositions[i * 3 + 1] = (p.y - 1.52) * 0.65 + Math.cos(ph) * rad * 0.68 + 0.4;
    scatterPositions[i * 3 + 2] = 0.35 + p.z * 0.45 + Math.sin(th) * Math.sin(ph) * rad;

    colors[i * 3] = p.r;
    colors[i * 3 + 1] = p.g;
    colors[i * 3 + 2] = p.b;

    sizes[i] = p.size;
    delays[i] = p.delay;
    isContour[i] = p.contour;

    randoms[i * 4] = scatRng();
    randoms[i * 4 + 1] = scatRng();
    randoms[i * 4 + 2] = scatRng();
    randoms[i * 4 + 3] = p.hairFactor;

    boneIndices[i * 2] = p.boneA;
    boneIndices[i * 2 + 1] = p.boneB;
    boneWeights[i] = p.weightA;
  }

  return {
    cloud: {
      count,
      positions,
      scatterPositions,
      colors,
      sizes,
      delays,
      randoms,
      isContour,
      boneIndices,
      boneWeights,
    },
    bindPositions,
  };
}

export function createRigHierarchy(
  bindPositions: THREE.Vector3[],
  basePos: THREE.Vector3,
  baseRotY: number,
): RigDefinition {
  const root = new THREE.Group();
  root.position.copy(basePos);
  root.rotation.y = baseRotY;

  const joints: THREE.Object3D[] = new Array(BONE_COUNT);
  for (let i = 0; i < BONE_COUNT; i++) {
    joints[i] = new THREE.Object3D();
  }

  const parentMap: Record<number, number> = {
    [BONE.PELVIS]: -1,
    [BONE.CHEST]: BONE.PELVIS,
    [BONE.HEAD]: BONE.CHEST,
    [BONE.L_UPPER_ARM]: BONE.CHEST,
    [BONE.L_FOREARM]: BONE.L_UPPER_ARM,
    [BONE.L_HAND]: BONE.L_FOREARM,
    [BONE.R_UPPER_ARM]: BONE.CHEST,
    [BONE.R_FOREARM]: BONE.R_UPPER_ARM,
    [BONE.R_HAND]: BONE.R_FOREARM,
    [BONE.L_THIGH]: BONE.PELVIS,
    [BONE.L_SHIN]: BONE.L_THIGH,
    [BONE.R_THIGH]: BONE.PELVIS,
    [BONE.R_SHIN]: BONE.R_THIGH,
  };

  for (let i = 0; i < BONE_COUNT; i++) {
    const pIdx = parentMap[i];
    if (pIdx === -1) {
      root.add(joints[i]);
      joints[i].position.copy(bindPositions[i]);
    } else {
      joints[pIdx].add(joints[i]);
      joints[i].position.copy(bindPositions[i]).sub(bindPositions[pIdx]);
    }
  }

  const invBindMatrices = bindPositions.map((bp) =>
    new THREE.Matrix4().makeTranslation(-bp.x, -bp.y, -bp.z),
  );
  const boneMatrices = bindPositions.map(() => new THREE.Matrix4());

  return {
    bindPositions,
    invBindMatrices,
    root,
    joints,
    boneMatrices,
    basePos: basePos.clone(),
    baseRotY,
  };
}

// 3D Particle Rose (stem, leaves, 16 Fibonacci petals with crisp white/pink edges)
export function buildRosePointCloud(): PropPointCloudData {
  const rng = createRng(99311);
  const pts: { x: number; y: number; z: number; r: number; g: number; b: number; s: number; rand: number }[] = [];

  // Slender stem along local +Y (0 to 0.34)
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, 0),
    new THREE.Vector3(0.006, 0.06, 0.005),
    new THREE.Vector3(-0.004, 0.2, 0.002),
    new THREE.Vector3(0, 0.32, 0),
  ]);
  for (let i = 0; i < 320; i++) {
    const u = i / 319;
    const p = stemCurve.getPoint(u);
    const a = rng() * Math.PI * 2;
    const rad = 0.009;
    pts.push({
      x: p.x + Math.cos(a) * rad,
      y: p.y,
      z: p.z + Math.sin(a) * rad,
      r: 0.78,
      g: 0.58,
      b: 0.96,
      s: 0.78,
      rand: rng(),
    });
  }

  // Two delicate leaves on the stem
  for (const side of [-1, 1]) {
    const baseY = side === 1 ? 0.14 : 0.19;
    for (let i = 0; i < 160; i++) {
      const u = rng();
      const v = (rng() - 0.5) * 2;
      const width = Math.sin(u * Math.PI) * 0.036;
      const isEdge = Math.abs(v) > 0.85 || u > 0.9;
      pts.push({
        x: side * (0.01 + u * 0.085),
        y: baseY + u * 0.035 - u * u * 0.02,
        z: v * width,
        r: isEdge ? 1.0 : 0.75,
        g: isEdge ? 0.85 : 0.45,
        b: isEdge ? 1.0 : 0.95,
        s: isEdge ? 0.82 : 0.65,
        rand: rng(),
      });
    }
  }

  // Multi-layered blooming Rose petals (18 Fibonacci spiral petals)
  const petalCount = 18;
  const ptsPerPetal = 95;
  const bloomY = 0.34;
  for (let p = 0; p < petalCount; p++) {
    const tPetal = p / (petalCount - 1); // 0 inner tight bud -> 1 outer open petals
    const baseAz = p * 2.39996; // Golden angle!
    const openAngle = 0.18 + tPetal * 0.72;
    const petalRadius = 0.022 + tPetal * 0.068;
    const petalHeight = 0.078 + (1 - tPetal) * 0.022;

    for (let k = 0; k < ptsPerPetal; k++) {
      const u = rng(); // 0 base -> 1 rim
      const v = (rng() - 0.5) * 2; // -1..1 across petal width
      const w = Math.sin(u * Math.PI * 0.85) * (0.5 + tPetal * 0.65) * 0.048;

      const localR = petalRadius + u * Math.sin(openAngle) * 0.055;
      const localY = bloomY + u * petalHeight * Math.cos(openAngle * 0.75);
      // Cup curvature
      const cup = (1 - v * v) * 0.012;
      const az = baseAz + v * (0.55 + tPetal * 0.25);

      const x = Math.cos(az) * (localR + cup) - Math.sin(az) * v * w * 0.3;
      const z = Math.sin(az) * (localR + cup) + Math.cos(az) * v * w * 0.3;

      const isRim = u > 0.82;
      pts.push({
        x,
        y: localY,
        z,
        r: isRim ? 1.0 : 1.0,
        g: isRim ? 0.88 : 0.16 + (1 - tPetal) * 0.22,
        b: isRim ? 0.96 : 0.55 + tPetal * 0.2,
        s: isRim ? 0.92 : 0.78,
        rand: rng(),
      });
    }
  }

  const count = pts.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const randoms = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const pt = pts[i];
    positions[i * 3] = pt.x;
    positions[i * 3 + 1] = pt.y;
    positions[i * 3 + 2] = pt.z;
    colors[i * 3] = pt.r;
    colors[i * 3 + 1] = pt.g;
    colors[i * 3 + 2] = pt.b;
    sizes[i] = pt.s;
    randoms[i * 4] = pt.rand;
    randoms[i * 4 + 1] = rng();
    randoms[i * 4 + 2] = rng();
    randoms[i * 4 + 3] = rng();
  }
  return { count, positions, colors, sizes, randoms };
}

// 3D Particle Diamond Ring (Anguthi)
export function buildRingPointCloud(): PropPointCloudData {
  const rng = createRng(31415);
  const pts: { x: number; y: number; z: number; r: number; g: number; b: number; s: number; rand: number }[] = [];

  // Torus ring band in XZ plane
  const majorR = 0.045;
  const tubeR = 0.0075;
  for (let i = 0; i < 650; i++) {
    const u = (i / 650) * Math.PI * 2 + (rng() - 0.5) * 0.04;
    const v = rng() * Math.PI * 2;
    const x = (majorR + Math.cos(v) * tubeR) * Math.cos(u);
    const z = (majorR + Math.cos(v) * tubeR) * Math.sin(u);
    const y = Math.sin(v) * tubeR;

    const isBright = rng() < 0.45;
    pts.push({
      x,
      y,
      z,
      r: isBright ? 1.0 : 0.96,
      g: isBright ? 0.97 : 0.72,
      b: 1.0,
      s: isBright ? 0.92 : 0.75,
      rand: rng(),
    });
  }

  // Diamond Solitaire Crown & Prongs on +Y top of band (at x=0, z=majorR -> rotated to +Y!)
  // Let's place diamond at (0, majorR + 0.014, 0) with band in XY plane so ring slips onto finger easily!
  // Re-orient band into XY plane:
  for (let i = 0; i < pts.length; i++) {
    const oldY = pts[i].y;
    const oldZ = pts[i].z;
    pts[i].y = oldZ;
    pts[i].z = oldY;
  }

  const gemY = majorR + 0.018;
  const gemR = 0.024;
  // Brilliant-cut diamond pavilion + table + facets
  for (let i = 0; i < 650; i++) {
    const ringLevel = rng();
    const ang = rng() * Math.PI * 2;
    let rad: number;
    let yOff: number;
    if (ringLevel < 0.55) {
      // Lower pavilion cone
      const t = ringLevel / 0.55;
      rad = t * gemR;
      yOff = -0.016 * (1 - t);
    } else {
      // Upper crown & table
      const t = (ringLevel - 0.55) / 0.45;
      rad = THREE.MathUtils.lerp(gemR, gemR * 0.56, t);
      yOff = 0.012 * t;
    }
    // Snap slightly toward 8 facet ridges for crisp crystalline sparkle
    const facet = Math.round((ang / (Math.PI * 2)) * 8) * ((Math.PI * 2) / 8);
    const a = THREE.MathUtils.lerp(ang, facet, 0.42);
    const isFacetRim = rng() < 0.5;
    pts.push({
      x: Math.cos(a) * rad,
      y: gemY + yOff,
      z: Math.sin(a) * rad,
      r: 1.0,
      g: isFacetRim ? 1.0 : 0.82,
      b: 1.0,
      s: isFacetRim ? 1.15 : 0.85,
      rand: rng(),
    });
  }

  const count = pts.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const randoms = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const pt = pts[i];
    positions[i * 3] = pt.x;
    positions[i * 3 + 1] = pt.y;
    positions[i * 3 + 2] = pt.z;
    colors[i * 3] = pt.r;
    colors[i * 3 + 1] = pt.g;
    colors[i * 3 + 2] = pt.b;
    sizes[i] = pt.s;
    randoms[i * 4] = pt.rand;
    randoms[i * 4 + 1] = rng();
    randoms[i * 4 + 2] = rng();
    randoms[i * 4 + 3] = rng();
  }
  return { count, positions, colors, sizes, randoms };
}

export function buildCoupleAndEnvironment() {
  const boyData = buildCharacterGeometryData({
    role: 'boy',
    seed: 10203,
    height: 3.12,
    shoulderWidth: 0.50,
    waistWidth: 0.33,
    hipWidth: 0.36,
    chestDepth: 0.24,
    bustProjection: 0.016,
    hairLength: 0.13,
  });

  const girlData = buildCharacterGeometryData({
    role: 'girl',
    seed: 40506,
    height: 2.94,
    shoulderWidth: 0.41,
    waistWidth: 0.25,
    hipWidth: 0.37,
    chestDepth: 0.21,
    bustProjection: 0.036,
    hairLength: 0.40,
  });

  const boyRig = createRigHierarchy(
    boyData.bindPositions,
    new THREE.Vector3(-0.78, -1.52, 0.0),
    1.08, // ~62 deg facing right & slightly toward camera
  );
  const girlRig = createRigHierarchy(
    girlData.bindPositions,
    new THREE.Vector3(0.78, -1.52, 0.0),
    -1.08, // ~-62 deg facing left & slightly toward camera
  );

  const rose = buildRosePointCloud();
  const ring = buildRingPointCloud();

  // Ambient cosmic dust + ground ripples
  const dustRng = createRng(77119);
  const dustCount = 3400;
  const dustPos = new Float32Array(dustCount * 3);
  const dustCol = new Float32Array(dustCount * 3);
  const dustSize = new Float32Array(dustCount);
  const dustRand = new Float32Array(dustCount * 4);

  for (let i = 0; i < dustCount; i++) {
    if (i < 1100) {
      // Subtle floor concentric ripples around feet at y = -1.52
      const ringIdx = Math.floor(dustRng() * 8);
      const rad = 0.45 + ringIdx * 0.26 + (dustRng() - 0.5) * 0.03;
      const a = dustRng() * Math.PI * 2;
      dustPos[i * 3] = Math.cos(a) * rad * 1.25;
      dustPos[i * 3 + 1] = -1.52 + (dustRng() - 0.5) * 0.008;
      dustPos[i * 3 + 2] = Math.sin(a) * rad * 0.85;
      const c = pickFigureColor(dustRng, 1 - ringIdx / 8, false, ringIdx < 2);
      dustCol[i * 3] = c.r * 0.65;
      dustCol[i * 3 + 1] = c.g * 0.65;
      dustCol[i * 3 + 2] = c.b * 0.65;
      dustSize[i] = 0.68 + dustRng() * 0.3;
    } else {
      const th = dustRng() * Math.PI * 2;
      const rad = 0.9 + Math.pow(dustRng(), 0.7) * 4.5;
      dustPos[i * 3] = Math.cos(th) * rad;
      dustPos[i * 3 + 1] = (dustRng() - 0.42) * 4.2;
      dustPos[i * 3 + 2] = Math.sin(th) * rad - 0.3;
      const c = pickFigureColor(dustRng, 0.5, dustRng() < 0.25, false);
      dustCol[i * 3] = c.r;
      dustCol[i * 3 + 1] = c.g;
      dustCol[i * 3 + 2] = c.b;
      dustSize[i] = 0.55 + dustRng() * 0.85;
    }
    dustRand[i * 4] = dustRng();
    dustRand[i * 4 + 1] = dustRng();
    dustRand[i * 4 + 2] = dustRng();
    dustRand[i * 4 + 3] = i < 1100 ? 1 : 0; // 1 = floor ripple (no orbital spin)
  }

  return {
    boyCloud: boyData.cloud,
    girlCloud: girlData.cloud,
    boyRig,
    girlRig,
    rose,
    ring,
    dust: {
      count: dustCount,
      positions: dustPos,
      colors: dustCol,
      sizes: dustSize,
      randoms: dustRand,
    },
  };
}

function smooth(x: number, e0: number, e1: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Pre-allocated scratch transforms for zero-GC per-frame skinning
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _mScratch = new THREE.Matrix4();

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export interface PropPoseState {
  roseOpacity: number;
  rosePos: THREE.Vector3;
  roseQuat: THREE.Quaternion;
  roseScale: number;
  ringOpacity: number;
  ringPos: THREE.Vector3;
  ringQuat: THREE.Quaternion;
  ringScale: number;
  sparkIntensity: number;
  sparkOrigin: THREE.Vector3;
  rainOpacity: number;
  coupleCenter: THREE.Vector3;
  walkPhase: number;
  sitPhase: number;
}

const _propState: PropPoseState = {
  roseOpacity: 0,
  rosePos: new THREE.Vector3(),
  roseQuat: new THREE.Quaternion(),
  roseScale: 1,
  ringOpacity: 0,
  ringPos: new THREE.Vector3(),
  ringQuat: new THREE.Quaternion(),
  ringScale: 1,
  sparkIntensity: 0,
  sparkOrigin: new THREE.Vector3(),
  rainOpacity: 1,
  coupleCenter: new THREE.Vector3(),
  walkPhase: 0,
  sitPhase: 0,
};

const _benchRight = new THREE.Vector3(Math.cos(BENCH_ROT_Y), 0, -Math.sin(BENCH_ROT_Y));
const _benchFwd = new THREE.Vector3(Math.sin(BENCH_ROT_Y), 0, Math.cos(BENCH_ROT_Y));

export function updateCoupleChoreography(
  timeline: number, // 0..1
  elapsed: number,
  boyRig: RigDefinition,
  girlRig: RigDefinition,
): PropPoseState {
  // 7-Act Romantic Choreography:
  // 0.00 - 0.10 : Materialize on rainy cherry-blossom street
  // 0.10 - 0.28 : Boy kneels on one knee & offers Rose; Girl accepts Rose gracefully
  // 0.28 - 0.47 : Still on knee, Boy shows Diamond Ring & slips it onto Girl's left finger
  // 0.47 - 0.62 : Boy stands up & both share a close, warm embrace ("gale lage")
  // 0.62 - 0.80 : Holding hands, Boy leads Girl to the LEFT side toward the park bench; rain stops!
  // 0.80 - 0.88 : Both turn & sit side-by-side on the left-side park bench
  // 0.88 - 1.00 : Enjoying cherry blossoms & city lights; Girl rests head on Boy's shoulder!

  const approach = smooth(timeline, 0.08, 0.19);
  const kneelWeight = smooth(timeline, 0.10, 0.19) * (1 - smooth(timeline, 0.47, 0.53));
  const hugWeight = smooth(timeline, 0.50, 0.56) * (1 - smooth(timeline, 0.60, 0.64));
  const walkProgress = smooth(timeline, 0.63, 0.79);
  const walkAmp = smooth(timeline, 0.63, 0.66) * (1 - smooth(timeline, 0.77, 0.81));
  const seatAlign = smooth(timeline, 0.78, 0.83);
  const sitWeight = smooth(timeline, 0.82, 0.89);
  const headRest = smooth(timeline, 0.89, 0.95);

  // Rain falls during proposal & hug, then stops smoothly as they walk & sit on the bench
  _propState.rainOpacity = 1 - smooth(timeline, 0.65, 0.79);
  _propState.walkPhase = walkAmp;
  _propState.sitPhase = sitWeight;

  // --- WORLD POSITIONS & ROTATIONS FOR BOY & GIRL ---
  const proposalCenterX = 0.28;
  const proposalZ = 0.35;
  const startBoyX = proposalCenterX + THREE.MathUtils.lerp(-0.8, -0.52, approach);
  const startGirlX = proposalCenterX + THREE.MathUtils.lerp(0.8, 0.48, approach);

  // Close chest-to-chest embrace position
  const hugBoyX = proposalCenterX - 0.105;
  const hugGirlX = proposalCenterX + 0.105;

  // Walk path from proposal spot -> LEFT-SIDE park bench front
  const walkStartX = proposalCenterX;
  const walkStartZ = proposalZ;
  const walkEndX = BENCH_WORLD_POS.x + _benchFwd.x * 0.56;
  const walkEndZ = BENCH_WORLD_POS.z + _benchFwd.z * 0.56;
  const walkYaw = Math.atan2(walkEndX - walkStartX, walkEndZ - walkStartZ);
  const walkFwdX = Math.sin(walkYaw);
  const walkFwdZ = Math.cos(walkYaw);
  const walkLeftX = Math.cos(walkYaw);
  const walkLeftZ = -Math.sin(walkYaw);

  const pairCenterX = THREE.MathUtils.lerp(walkStartX, walkEndX, walkProgress);
  const pairCenterZ = THREE.MathUtils.lerp(walkStartZ, walkEndZ, walkProgress);

  // Seated bench slots (Boy on bench's left -X slot, Girl on bench's right +X slot)
  const benchBoyX = BENCH_WORLD_POS.x - _benchRight.x * 0.26 + _benchFwd.x * 0.08;
  const benchBoyZ = BENCH_WORLD_POS.z - _benchRight.z * 0.26 + _benchFwd.z * 0.08;
  const benchGirlX = BENCH_WORLD_POS.x + _benchRight.x * 0.26 + _benchFwd.x * 0.08;
  const benchGirlZ = BENCH_WORLD_POS.z + _benchRight.z * 0.26 + _benchFwd.z * 0.08;

  const preWalk = 1 - smooth(timeline, 0.61, 0.65);
  const boyPreX = THREE.MathUtils.lerp(startBoyX, hugBoyX, hugWeight);
  const girlPreX = THREE.MathUtils.lerp(startGirlX, hugGirlX, hugWeight);

  // Boy leads slightly ahead on the left, holding Girl's hand beside him
  const leadAmt = walkAmp * 0.08;
  const boyWalkX = pairCenterX + walkLeftX * 0.27 + walkFwdX * leadAmt;
  const boyWalkZ = pairCenterZ + walkLeftZ * 0.27 + walkFwdZ * leadAmt;
  const girlWalkX = pairCenterX - walkLeftX * 0.27 - walkFwdX * (leadAmt * 0.5);
  const girlWalkZ = pairCenterZ - walkLeftZ * 0.27 - walkFwdZ * (leadAmt * 0.5);

  const boyX = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(boyWalkX, boyPreX, preWalk),
    benchBoyX,
    seatAlign,
  );
  const boyZ = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(boyWalkZ, proposalZ, preWalk),
    benchBoyZ,
    seatAlign,
  );
  const girlX = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(girlWalkX, girlPreX, preWalk),
    benchGirlX,
    seatAlign,
  );
  const girlZ = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(girlWalkZ, proposalZ, preWalk),
    benchGirlZ,
    seatAlign,
  );

  // Shortest-angle Yaw transitions
  const boyPreYaw = lerpAngle(boyRig.baseRotY, 1.50, hugWeight);
  const girlPreYaw = lerpAngle(girlRig.baseRotY, -1.50, hugWeight);
  const turnToWalk = smooth(timeline, 0.61, 0.66);

  const boyYaw = lerpAngle(lerpAngle(boyPreYaw, walkYaw, turnToWalk), BENCH_ROT_Y, seatAlign);
  const girlYaw = lerpAngle(lerpAngle(girlPreYaw, walkYaw, turnToWalk), BENCH_ROT_Y, seatAlign);

  _propState.coupleCenter.set((boyX + girlX) * 0.5, -0.32 - sitWeight * 0.45, (boyZ + girlZ) * 0.5);

  // --- RESET BONE ROTATIONS ---
  for (let i = 0; i < BONE_COUNT; i++) {
    boyRig.joints[i].rotation.set(0, 0, 0);
    girlRig.joints[i].rotation.set(0, 0, 0);
  }

  // --- BOY POSE ---
  boyRig.root.position.set(boyX, -1.52, boyZ);
  boyRig.root.rotation.y = boyYaw;

  const boyPelvisBind = boyRig.bindPositions[BONE.PELVIS];
  boyRig.joints[BONE.PELVIS].position.copy(boyPelvisBind);
  // Keep front kneeling foot cleanly grounded on the road surface
  boyRig.joints[BONE.PELVIS].position.y -= kneelWeight * 0.53 + sitWeight * 0.68;
  boyRig.joints[BONE.PELVIS].rotation.x = kneelWeight * 0.05 - sitWeight * 0.06;

  const stridePhase = elapsed * 5.2;
  const boyStride = Math.sin(stridePhase) * 0.34 * walkAmp;

  // Boy Legs (Kneel -> Walk -> Sit on Bench)
  boyRig.joints[BONE.R_THIGH].rotation.x =
    -kneelWeight * 1.18 - boyStride - sitWeight * 1.48;
  boyRig.joints[BONE.R_SHIN].rotation.x =
    kneelWeight * 1.18 + Math.max(0, -boyStride) * 0.42 + sitWeight * 1.48;
  boyRig.joints[BONE.L_THIGH].rotation.x =
    kneelWeight * 0.14 + boyStride - sitWeight * 1.48;
  boyRig.joints[BONE.L_SHIN].rotation.x =
    kneelWeight * 1.38 + Math.max(0, boyStride) * 0.42 + sitWeight * 1.48;

  const breath = Math.sin(elapsed * 1.5) * 0.012;
  boyRig.joints[BONE.CHEST].rotation.x =
    kneelWeight * 0.06 + hugWeight * 0.06 + walkAmp * 0.05 + breath;
  boyRig.joints[BONE.CHEST].rotation.z = -headRest * 0.06;

  // Head gazes warmly up at Girl during kneel, tilts affectionately during hug
  boyRig.joints[BONE.HEAD].rotation.x =
    -kneelWeight * 0.24 + hugWeight * 0.14 - sitWeight * 0.04;
  boyRig.joints[BONE.HEAD].rotation.y = -hugWeight * 0.18;
  boyRig.joints[BONE.HEAD].rotation.z = hugWeight * 0.15 - headRest * 0.14;

  // Phase weights for Arm & Hand Choreography
  const offerRose = smooth(timeline, 0.11, 0.19) * (1 - smooth(timeline, 0.27, 0.31));
  const showRing = smooth(timeline, 0.29, 0.35) * (1 - smooth(timeline, 0.36, 0.41));
  const placeRing = smooth(timeline, 0.36, 0.44) * (1 - smooth(timeline, 0.47, 0.51));
  const supportHand = smooth(timeline, 0.31, 0.39) * (1 - smooth(timeline, 0.47, 0.51));
  const holdHandWalk = smooth(timeline, 0.62, 0.66) * (1 - smooth(timeline, 0.79, 0.84));
  const idleKneelLeft = kneelWeight * (1 - supportHand);

  // Boy's Right Arm:
  // Graceful elbow bend for Rose, Ring presentation, Ring placement, Waist-wrap Hug, Hand-holding Walk, Bench Sit
  boyRig.joints[BONE.R_UPPER_ARM].rotation.x =
    -0.06 -
    offerRose * 0.78 -
    showRing * 0.72 -
    placeRing * 0.84 -
    hugWeight * 0.92 +
    holdHandWalk * 0.16 -
    sitWeight * 0.72;
  boyRig.joints[BONE.R_UPPER_ARM].rotation.y = hugWeight * 0.36;
  boyRig.joints[BONE.R_UPPER_ARM].rotation.z =
    -0.05 -
    offerRose * 0.14 -
    showRing * 0.08 -
    placeRing * 0.12 -
    hugWeight * 0.42 -
    holdHandWalk * 0.26;
  boyRig.joints[BONE.R_FOREARM].rotation.x =
    -0.16 -
    offerRose * 0.54 -
    showRing * 0.68 -
    placeRing * 0.56 -
    hugWeight * 0.95 -
    holdHandWalk * 0.32 -
    sitWeight * 0.56;
  boyRig.joints[BONE.R_FOREARM].rotation.z = hugWeight * 0.55 + holdHandWalk * 0.12;
  boyRig.joints[BONE.R_HAND].rotation.x = -offerRose * 0.22 - placeRing * 0.18;

  // Boy's Left Arm:
  // Rests naturally on thigh when kneeling with Rose, cradles Girl's hand for Ring, wraps around waist in Hug, swings in Walk, wraps around Girl's shoulder on Bench
  boyRig.joints[BONE.L_UPPER_ARM].rotation.x =
    -0.06 -
    idleKneelLeft * 0.52 -
    supportHand * 0.76 -
    hugWeight * 0.92 +
    boyStride * 0.52 -
    sitWeight * 0.58;
  boyRig.joints[BONE.L_UPPER_ARM].rotation.y = -hugWeight * 0.36 - sitWeight * 0.32;
  boyRig.joints[BONE.L_UPPER_ARM].rotation.z =
    0.05 + supportHand * 0.14 + hugWeight * 0.42 + sitWeight * 0.46;
  boyRig.joints[BONE.L_FOREARM].rotation.x =
    -0.16 -
    idleKneelLeft * 0.48 -
    supportHand * 0.58 -
    hugWeight * 0.95 -
    sitWeight * 0.55;
  boyRig.joints[BONE.L_FOREARM].rotation.z = -hugWeight * 0.55;

  // --- GIRL POSE ---
  girlRig.root.position.set(girlX, -1.52, girlZ);
  girlRig.root.rotation.y = girlYaw;

  const girlPelvisBind = girlRig.bindPositions[BONE.PELVIS];
  girlRig.joints[BONE.PELVIS].position.copy(girlPelvisBind);
  girlRig.joints[BONE.PELVIS].position.y -= sitWeight * 0.68;
  girlRig.joints[BONE.PELVIS].rotation.x = -sitWeight * 0.06;

  // Girl Legs (Stand -> Walk -> Sit on Bench)
  girlRig.joints[BONE.R_THIGH].rotation.x = boyStride - sitWeight * 1.48;
  girlRig.joints[BONE.R_SHIN].rotation.x = Math.max(0, boyStride) * 0.42 + sitWeight * 1.48;
  girlRig.joints[BONE.L_THIGH].rotation.x = -boyStride - sitWeight * 1.48;
  girlRig.joints[BONE.L_SHIN].rotation.x = Math.max(0, -boyStride) * 0.42 + sitWeight * 1.48;

  girlRig.joints[BONE.CHEST].rotation.x =
    kneelWeight * 0.08 + hugWeight * 0.05 + walkAmp * 0.05 + breath * 0.8;
  // Girl leans warmly onto Boy's shoulder (+Z rotation tilts toward -X Boy)
  girlRig.joints[BONE.CHEST].rotation.z = headRest * 0.15;

  girlRig.joints[BONE.HEAD].rotation.x =
    kneelWeight * 0.2 - hugWeight * 0.06 - sitWeight * 0.05;
  girlRig.joints[BONE.HEAD].rotation.y = hugWeight * 0.22;
  girlRig.joints[BONE.HEAD].rotation.z = hugWeight * 0.22 + headRest * 0.38;

  // Girl's Right Arm:
  // 1) Tenderly over heart & cradling Rose (0.14..0.48)
  // 2) Wraps up around Boy's shoulders in Embrace (0.50..0.62)
  // 3) Swings softly while holding Rose on Walk (0.63..0.80)
  // 4) Holds Rose gently in lap on Bench (0.82..1.00)
  const surpriseOrRose = smooth(timeline, 0.14, 0.23) * (1 - smooth(timeline, 0.49, 0.53));
  girlRig.joints[BONE.R_UPPER_ARM].rotation.x =
    -0.08 -
    surpriseOrRose * 0.46 -
    hugWeight * 1.32 -
    boyStride * 0.48 -
    sitWeight * 0.72;
  girlRig.joints[BONE.R_UPPER_ARM].rotation.y = hugWeight * 0.32;
  girlRig.joints[BONE.R_UPPER_ARM].rotation.z =
    -0.06 + surpriseOrRose * 0.24 - hugWeight * 0.4;
  girlRig.joints[BONE.R_FOREARM].rotation.x =
    -0.2 - surpriseOrRose * 1.12 - hugWeight * 1.08 - sitWeight * 0.65;
  girlRig.joints[BONE.R_FOREARM].rotation.z = -surpriseOrRose * 0.22 + hugWeight * 0.52;

  // Girl's Left Arm:
  // 1) Gracefully curved reach to accept Rose (0.21..0.28)
  // 2) Softly extended bent-elbow hand for Ring (0.30..0.48)
  // 3) Wraps up around Boy's neck/shoulders in Embrace (0.50..0.62)
  // 4) Holds Boy's Right Hand while walking LEFT to bench (0.62..0.80)
  // 5) Rests warmly beside Boy on bench (0.82..1.00)
  const takeRose = smooth(timeline, 0.21, 0.26) * (1 - smooth(timeline, 0.27, 0.31));
  const extendRingHand = smooth(timeline, 0.29, 0.37) * (1 - smooth(timeline, 0.47, 0.51));
  girlRig.joints[BONE.L_UPPER_ARM].rotation.x =
    -0.08 -
    takeRose * 0.58 -
    extendRingHand * 0.56 -
    hugWeight * 1.32 -
    holdHandWalk * 0.38 -
    sitWeight * 0.72;
  girlRig.joints[BONE.L_UPPER_ARM].rotation.y = -hugWeight * 0.32;
  girlRig.joints[BONE.L_UPPER_ARM].rotation.z =
    0.06 +
    takeRose * 0.14 +
    extendRingHand * 0.12 +
    hugWeight * 0.4 +
    holdHandWalk * 0.26;
  girlRig.joints[BONE.L_FOREARM].rotation.x =
    -0.18 -
    takeRose * 0.56 -
    extendRingHand * 0.48 -
    hugWeight * 1.08 -
    holdHandWalk * 0.28 -
    sitWeight * 0.58;
  girlRig.joints[BONE.L_FOREARM].rotation.z = -hugWeight * 0.52 - holdHandWalk * 0.12;
  girlRig.joints[BONE.L_HAND].rotation.x = takeRose * 0.18 + extendRingHand * 0.26;
  girlRig.joints[BONE.L_HAND].rotation.z = -extendRingHand * 0.14;

  // Compute world matrices and upload bone skinning transforms
  boyRig.root.updateMatrixWorld(true);
  girlRig.root.updateMatrixWorld(true);

  for (let i = 0; i < BONE_COUNT; i++) {
    boyRig.boneMatrices[i].multiplyMatrices(
      boyRig.joints[i].matrixWorld,
      boyRig.invBindMatrices[i],
    );
    girlRig.boneMatrices[i].multiplyMatrices(
      girlRig.joints[i].matrixWorld,
      girlRig.invBindMatrices[i],
    );
  }

  // --- ROSE WORLD POSITION ---
  const boyRHandMat = boyRig.joints[BONE.R_HAND].matrixWorld;
  const girlLHandMat = girlRig.joints[BONE.L_HAND].matrixWorld;
  const girlRHandMat = girlRig.joints[BONE.R_HAND].matrixWorld;

  _vA.set(0, -0.09, 0.03).applyMatrix4(boyRHandMat);
  const holdSwitch = smooth(timeline, 0.27, 0.32);
  _vB.set(0, -0.09, 0.03).applyMatrix4(holdSwitch < 0.5 ? girlLHandMat : girlRHandMat);

  const transferT = smooth(timeline, 0.23, 0.29);
  _propState.rosePos.lerpVectors(_vA, _vB, transferT);
  _propState.roseOpacity = smooth(timeline, 0.11, 0.17) * (1 - hugWeight * 0.8);
  _propState.roseScale = 0.88;

  _qA.setFromRotationMatrix(boyRHandMat);
  _qB.setFromEuler(new THREE.Euler(0.35, 0, -0.25));
  _qA.multiply(_qB);
  _mScratch.makeRotationFromEuler(new THREE.Euler(0.28, 0.4, 0.15));
  _qB.setFromRotationMatrix(_mScratch);
  _propState.roseQuat.slerpQuaternions(_qA, _qB, transferT);

  // --- RING (ANGUTHI) WORLD POSITION ---
  _vA.set(0, -0.115, 0.045).applyMatrix4(boyRHandMat);
  _vB.set(0.0, -0.11, 0.015).applyMatrix4(girlLHandMat);

  const ringApproach = smooth(timeline, 0.38, 0.46);
  _propState.ringPos.lerpVectors(_vA, _vB, ringApproach);
  _propState.ringOpacity = smooth(timeline, 0.29, 0.34);
  _propState.ringScale = THREE.MathUtils.lerp(1.42, 0.82, ringApproach);

  _qA.setFromEuler(new THREE.Euler(0.18, elapsed * 1.1, 0.15));
  _qB.setFromRotationMatrix(girlLHandMat);
  _mScratch.makeRotationFromEuler(new THREE.Euler(Math.PI * 0.5, 0.2, 0));
  _qB.multiply(new THREE.Quaternion().setFromRotationMatrix(_mScratch));
  _propState.ringQuat.slerpQuaternions(_qA, _qB, ringApproach);

  _propState.sparkIntensity =
    smooth(timeline, 0.43, 0.47) * (1 - smooth(timeline, 0.49, 0.55));
  _propState.sparkOrigin.copy(_vB);

  return _propState;
}

