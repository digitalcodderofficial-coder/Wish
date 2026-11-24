import * as THREE from 'three';

function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Park bench placed clearly on the LEFT side (-X) facing diagonally toward the river & skyline
export const BENCH_WORLD_POS = new THREE.Vector3(-1.72, -1.52, -1.42);
export const BENCH_ROT_Y = 0.50;

export interface RealEnvironmentController {
  group: THREE.Group;
  update: (elapsed: number, rainOpacity: number, coupleCenter: THREE.Vector3) => void;
  dispose: () => void;
}

function makeAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#11131c';
  ctx.fillRect(0, 0, 256, 256);

  const rng = createRng(9012);
  for (let i = 0; i < 6500; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const v = 13 + Math.floor(rng() * 18);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 7})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWetRoughnessTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#929292';
  ctx.fillRect(0, 0, 256, 256);

  const rng = createRng(3344);
  for (let i = 0; i < 24; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 16 + rng() * 34;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, '#141414');
    grad.addColorStop(0.65, '#343434');
    grad.addColorStop(1, 'rgba(146,146,146,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 10);
  return tex;
}

function makePavementTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1f202c';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#12131c';
  ctx.lineWidth = 2;
  const step = 32;
  for (let y = 0; y <= 256; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * (step * 0.5);
    for (let x = offset; x <= 256; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, row * step);
      ctx.lineTo(x, (row + 1) * step);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBuildingWindowTextures(seed: number): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = w;
  colCanvas.height = h;
  const colCtx = colCanvas.getContext('2d')!;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = w;
  emCanvas.height = h;
  const emCtx = emCanvas.getContext('2d')!;

  const rng = createRng(seed);
  colCtx.fillStyle = rng() < 0.5 ? '#151724' : '#1b1828';
  colCtx.fillRect(0, 0, w, h);

  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, w, h);

  const cols = 6;
  const rows = 14;
  const padX = 12;
  const padY = 12;
  const cellW = (w - padX * 2) / cols;
  const cellH = (h - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    const isGround = r === rows - 1;
    for (let c = 0; c < cols; c++) {
      const wx = padX + c * cellW + 5;
      const wy = padY + r * cellH + 5;
      const ww = cellW - 10;
      const wh = cellH - 10;

      colCtx.fillStyle = '#0b0d15';
      colCtx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);

      const litRoll = rng();
      if (litRoll < (isGround ? 0.65 : 0.42)) {
        const huePick = rng();
        const winCol =
          huePick < 0.58
            ? '#ffd08e'
            : huePick < 0.84
              ? '#c9d4ff'
              : '#f7a8d6';
        colCtx.fillStyle = winCol;
        colCtx.fillRect(wx, wy, ww, wh);
        emCtx.fillStyle = winCol;
        emCtx.fillRect(wx, wy, ww, wh);
      } else {
        colCtx.fillStyle = '#111524';
        colCtx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

function makeSkyDomeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#03040b');
  grad.addColorStop(0.45, '#070a18');
  grad.addColorStop(0.75, '#111026');
  grad.addColorStop(1.0, '#1c1330');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRiverWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMoonDir: { value: new THREE.Vector3(4.0, 5.5, -24.0).normalize() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * 2.2 + uTime * 1.4) * 0.014 + cos(pos.y * 1.6 - uTime * 1.8) * 0.012;
        pos.z += wave;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        // Animated multi-layered night river ripples
        float r1 = sin(vWorldPos.x * 4.5 + vWorldPos.z * 1.8 - uTime * 1.9);
        float r2 = cos(vWorldPos.x * 6.8 - vWorldPos.z * 2.4 + uTime * 2.3);
        float r3 = sin((vWorldPos.x + vWorldPos.z) * 9.0 + uTime * 1.4);
        float ripple = (r1 + r2 * 0.7 + r3 * 0.4) * 0.33;

        // Deep midnight river blue-teal base
        vec3 deepWater = vec3(0.025, 0.055, 0.11);
        vec3 midWater = vec3(0.055, 0.11, 0.21);
        vec3 col = mix(deepWater, midWater, 0.5 + 0.5 * ripple);

        // Shimmering moonlight reflection path on river surface
        float moonLane = exp(-pow((vWorldPos.x - 5.2) / 1.95, 2.0));
        float moonSpark = smoothstep(0.32, 0.85, ripple) * moonLane;
        col += vec3(0.55, 0.65, 0.95) * moonSpark * 0.72;

        // Soft rose-pink cherry blossom & lamp reflection near riverside bank
        float bankReflect = exp(-pow((vWorldPos.x - 2.95) / 1.15, 2.0));
        col += vec3(0.45, 0.16, 0.32) * (0.35 + 0.65 * smoothstep(0.0, 0.6, ripple)) * bankReflect * 0.42;

        // Distant horizon depth fade
        float fogFade = smoothstep(-28.0, -4.0, vWorldPos.z);
        col = mix(vec3(0.04, 0.04, 0.09), col, fogFade);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function buildRomanticEnvironment(): RealEnvironmentController {
  const group = new THREE.Group();
  const rng = createRng(202611);
  const floorY = -1.52;

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- 1. MOODY ROMANTIC NIGHT LIGHTING (Keeps particles crisp & vibrant!) ---
  const hemiLight = new THREE.HemisphereLight('#5c5c9e', '#100d1a', 0.55);
  group.add(hemiLight);

  const moonLight = new THREE.DirectionalLight('#b4c6ff', 0.68);
  moonLight.position.set(4.0, 8.5, -18.0);
  group.add(moonLight);

  const warmFill = new THREE.DirectionalLight('#cf8eb0', 0.2);
  warmFill.position.set(-3.5, 4.0, 5.0);
  group.add(warmFill);

  // Soft pink-magenta point light tracking the particle couple onto wet road & bench
  const coupleGlowLight = new THREE.PointLight('#ff2e93', 1.75, 5.4, 1.7);
  coupleGlowLight.position.set(0, -0.4, 0.3);
  group.add(coupleGlowLight);

  // Night Sky Dome + Full Moon over the River + Stars
  const skyTex = track(makeSkyDomeTexture());
  const skyGeo = track(new THREE.SphereGeometry(46, 24, 16));
  const skyMat = track(
    new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
    }),
  );
  group.add(new THREE.Mesh(skyGeo, skyMat));

  const moonGeo = track(new THREE.SphereGeometry(0.92, 20, 20));
  const moonMat = track(
    new THREE.MeshBasicMaterial({
      color: '#f2efff',
      fog: false,
    }),
  );
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(5.2, 5.6, -26.5);
  group.add(moon);

  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const th = rng() * Math.PI * 2;
    const ph = rng() * Math.PI * 0.42;
    const r = 36;
    starPos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
    starPos[i * 3 + 1] = Math.cos(ph) * r + 1.0;
    starPos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = track(
    new THREE.PointsMaterial({
      color: '#dce4ff',
      size: 0.11,
      transparent: true,
      opacity: 0.72,
      fog: false,
    }),
  );
  group.add(new THREE.Points(starGeo, starMat));

  // --- 2. WET ASPHALT ROAD ("SADAK"), SIDEWALK & RIVERSIDE EMBANKMENT ---
  const asphaltTex = track(makeAsphaltTexture());
  const wetRoughTex = track(makeWetRoughnessTexture());
  const pavementTex = track(makePavementTexture());

  const roadW = 3.8;
  const roadLen = 34;
  const roadGeo = track(new THREE.PlaneGeometry(roadW, roadLen));
  const roadMat = track(
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughnessMap: wetRoughTex,
      roughness: 0.36,
      metalness: 0.25,
    }),
  );
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(-0.2, floorY, -10.5);
  group.add(road);

  const dashGeo = track(new THREE.PlaneGeometry(0.1, 1.0));
  const dashMat = track(
    new THREE.MeshStandardMaterial({
      color: '#8e96ab',
      roughness: 0.7,
    }),
  );
  for (let z = 3.2; z > -24; z -= 2.3) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-0.2, floorY + 0.004, z);
    group.add(dash);
  }

  // Left Sidewalk (under bench & buildings) + Right Riverside Promenade Walkway
  const leftSidewalkGeo = track(new THREE.BoxGeometry(3.6, 0.05, roadLen));
  const rightSidewalkGeo = track(new THREE.BoxGeometry(0.95, 0.05, roadLen));
  const sidewalkMat = track(
    new THREE.MeshStandardMaterial({
      map: pavementTex,
      roughness: 0.64,
      metalness: 0.08,
    }),
  );
  const curbGeo = track(new THREE.BoxGeometry(0.13, 0.065, roadLen));
  const curbMat = track(
    new THREE.MeshStandardMaterial({
      color: '#3c3f52',
      roughness: 0.62,
    }),
  );

  const leftSw = new THREE.Mesh(leftSidewalkGeo, sidewalkMat);
  leftSw.position.set(-3.9, floorY - 0.015, -10.5);
  group.add(leftSw);

  const leftCurb = new THREE.Mesh(curbGeo, curbMat);
  leftCurb.position.set(-2.15, floorY - 0.005, -10.5);
  group.add(leftCurb);

  const rightSw = new THREE.Mesh(rightSidewalkGeo, sidewalkMat);
  rightSw.position.set(2.15, floorY - 0.015, -10.5);
  group.add(rightSw);

  const rightCurb = new THREE.Mesh(curbGeo, curbMat);
  rightCurb.position.set(1.7, floorY - 0.005, -10.5);
  group.add(rightCurb);

  // Low Stone Riverside Parapet & Embankment Wall bordering the River (+X = 2.65)
  const bankWallGeo = track(new THREE.BoxGeometry(0.24, 0.62, roadLen));
  const bankWallMat = track(
    new THREE.MeshStandardMaterial({
      color: '#2e3142',
      roughness: 0.78,
    }),
  );
  const bankWall = new THREE.Mesh(bankWallGeo, bankWallMat);
  bankWall.position.set(2.65, floorY - 0.14, -10.5);
  group.add(bankWall);

  // --- 3. MOONLIT FLOWING RIVER ("NADI") & DISTANT STONE BRIDGE ---
  const riverGeo = track(new THREE.PlaneGeometry(12.5, 36, 36, 48));
  const riverMat = track(createRiverWaterMaterial());
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.rotation.x = -Math.PI / 2;
  riverMesh.position.set(8.8, floorY - 0.34, -11.0);
  group.add(riverMesh);

  // Far riverbank embankment + distant stone arched bridge spanning the river
  const farBankGeo = track(new THREE.BoxGeometry(5.0, 0.6, 36));
  const farBank = new THREE.Mesh(farBankGeo, bankWallMat);
  farBank.position.set(14.5, floorY - 0.15, -11.0);
  group.add(farBank);

  // Stone Bridge across the river at z = -13.5
  const bridgeDeckGeo = track(new THREE.BoxGeometry(11.6, 0.28, 1.35));
  const bridgeMat = track(
    new THREE.MeshStandardMaterial({
      color: '#2b2d3d',
      roughness: 0.8,
    }),
  );
  const bridgeDeck = new THREE.Mesh(bridgeDeckGeo, bridgeMat);
  bridgeDeck.position.set(8.1, floorY + 0.62, -13.5);
  group.add(bridgeDeck);

  const bridgePillarGeo = track(new THREE.BoxGeometry(0.46, 1.2, 1.45));
  for (const px of [4.2, 7.6, 11.0]) {
    const pillar = new THREE.Mesh(bridgePillarGeo, bridgeMat);
    pillar.position.set(px, floorY + 0.05, -13.5);
    group.add(pillar);
  }
  const bridgeLampMat = track(new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
  const bridgeLampGeo = track(new THREE.SphereGeometry(0.09, 8, 8));
  for (const px of [4.2, 7.6, 11.0]) {
    const bl = new THREE.Mesh(bridgeLampGeo, bridgeLampMat);
    bl.position.set(px, floorY + 0.92, -12.9);
    group.add(bl);
  }

  // --- 4. REAL 3D CITY BUILDINGS & SKYLINE ("BUILDING") ---
  const winTexA = makeBuildingWindowTextures(101);
  const winTexB = makeBuildingWindowTextures(202);
  const winTexC = makeBuildingWindowTextures(303);
  track(winTexA.map);
  track(winTexA.emissiveMap);
  track(winTexB.map);
  track(winTexB.emissiveMap);
  track(winTexC.map);
  track(winTexC.emissiveMap);

  const buildingMats = [winTexA, winTexB, winTexC].map((wt) =>
    track(
      new THREE.MeshStandardMaterial({
        map: wt.map,
        emissiveMap: wt.emissiveMap,
        emissive: new THREE.Color('#ffeedd'),
        emissiveIntensity: 0.65,
        roughness: 0.78,
        metalness: 0.12,
      }),
    ),
  );
  const roofTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: '#1b1d2b',
      roughness: 0.75,
    }),
  );

  const buildingSpecs = [
    // Left avenue buildings
    { x: -5.5, z: -2.4, w: 2.5, h: 6.2, d: 3.1, m: 0 },
    { x: -5.6, z: -6.2, w: 2.8, h: 8.1, d: 3.4, m: 1 },
    { x: -5.3, z: -10.4, w: 2.6, h: 6.8, d: 3.5, m: 2 },
    { x: -5.5, z: -14.8, w: 2.8, h: 9.2, d: 3.6, m: 0 },
    // Far-side riverfront skyline buildings & towers (right side + horizon!)
    { x: 13.8, z: -3.2, w: 2.8, h: 7.4, d: 3.2, m: 1 },
    { x: 13.6, z: -7.8, w: 3.0, h: 9.0, d: 3.4, m: 2 },
    { x: 13.9, z: -12.8, w: 3.1, h: 8.2, d: 3.5, m: 0 },
    { x: -2.6, z: -19.5, w: 2.6, h: 9.6, d: 2.4, m: 2 },
    { x: 0.4, z: -21.0, w: 3.1, h: 11.4, d: 2.6, m: 0 },
    { x: 3.8, z: -20.0, w: 2.7, h: 8.8, d: 2.5, m: 1 },
    { x: 8.8, z: -21.2, w: 3.2, h: 10.2, d: 2.6, m: 2 },
  ];

  for (const b of buildingSpecs) {
    const bGeo = track(new THREE.BoxGeometry(b.w, b.h, b.d));
    const mesh = new THREE.Mesh(bGeo, buildingMats[b.m]);
    mesh.position.set(b.x, floorY + b.h * 0.5, b.z);
    group.add(mesh);

    const ledgeGeo = track(new THREE.BoxGeometry(b.w + 0.14, 0.16, b.d + 0.14));
    const ledge = new THREE.Mesh(ledgeGeo, roofTrimMat);
    ledge.position.set(b.x, floorY + b.h + 0.08, b.z);
    group.add(ledge);
  }

  // --- 5. STREETLAMPS & RIVERSIDE LANTERNS ---
  const ironMat = track(
    new THREE.MeshStandardMaterial({
      color: '#191b24',
      roughness: 0.45,
      metalness: 0.7,
    }),
  );
  const bulbMat = track(
    new THREE.MeshBasicMaterial({
      color: '#ffdca8',
    }),
  );
  const poleGeo = track(new THREE.CylinderGeometry(0.034, 0.052, 2.7, 10));
  const poleBaseGeo = track(new THREE.CylinderGeometry(0.085, 0.12, 0.26, 10));
  const armGeo = track(new THREE.CylinderGeometry(0.022, 0.026, 0.48, 8));
  const lampHeadGeo = track(new THREE.SphereGeometry(0.095, 12, 10));

  const lampSpots = [
    { x: -2.35, z: -0.3, dir: 1, hasLight: true },
    { x: 1.95, z: -0.5, dir: -1, hasLight: true },
    { x: -2.35, z: -5.2, dir: 1, hasLight: true },
    { x: 1.95, z: -5.2, dir: -1, hasLight: false },
  ];
  for (const ls of lampSpots) {
    const pole = new THREE.Mesh(poleGeo, ironMat);
    pole.position.set(ls.x, floorY + 1.35, ls.z);
    group.add(pole);

    const pBase = new THREE.Mesh(poleBaseGeo, ironMat);
    pBase.position.set(ls.x, floorY + 0.13, ls.z);
    group.add(pBase);

    const arm = new THREE.Mesh(armGeo, ironMat);
    arm.rotation.z = ls.dir * (Math.PI * 0.44);
    arm.position.set(ls.x + ls.dir * 0.21, floorY + 2.68, ls.z);
    group.add(arm);

    const head = new THREE.Mesh(lampHeadGeo, bulbMat);
    head.position.set(ls.x + ls.dir * 0.42, floorY + 2.64, ls.z);
    group.add(head);

    if (ls.hasLight) {
      const pLight = new THREE.PointLight('#ffbe78', 1.25, 8.2, 1.6);
      pLight.position.set(ls.x + ls.dir * 0.42, floorY + 2.52, ls.z);
      group.add(pLight);
    }
  }

  // Warm stone bollards along the riverside embankment wall
  const bollardGeo = track(new THREE.SphereGeometry(0.065, 8, 8));
  for (let bz = 1.2; bz > -13.0; bz -= 3.4) {
    const bol = new THREE.Mesh(bollardGeo, bulbMat);
    bol.position.set(2.65, floorY + 0.22, bz);
    group.add(bol);
  }

  // --- 6. REAL 3D WOOD & WROUGHT-IRON PARK BENCH ("BANCH") ON LEFT SIDE ---
  const benchGroup = new THREE.Group();
  benchGroup.position.copy(BENCH_WORLD_POS);
  benchGroup.rotation.y = BENCH_ROT_Y;

  const benchWoodMat = track(
    new THREE.MeshStandardMaterial({
      color: '#5c3124',
      roughness: 0.65,
      metalness: 0.05,
    }),
  );

  const legFrontGeo = track(new THREE.BoxGeometry(0.055, 0.86, 0.055));
  const legBackGeo = track(new THREE.BoxGeometry(0.055, 1.26, 0.055));
  const armRestGeo = track(new THREE.BoxGeometry(0.065, 0.045, 0.56));
  const seatSupportGeo = track(new THREE.BoxGeometry(0.05, 0.05, 0.52));

  for (const side of [-1, 1]) {
    const lx = side * 0.72;
    const fLeg = new THREE.Mesh(legFrontGeo, ironMat);
    fLeg.position.set(lx, 0.43, 0.24);
    benchGroup.add(fLeg);

    const bLeg = new THREE.Mesh(legBackGeo, ironMat);
    bLeg.position.set(lx, 0.63, -0.23);
    bLeg.rotation.x = -0.08;
    benchGroup.add(bLeg);

    const arm = new THREE.Mesh(armRestGeo, ironMat);
    arm.position.set(lx, 0.86, 0.0);
    benchGroup.add(arm);

    const sup = new THREE.Mesh(seatSupportGeo, ironMat);
    sup.position.set(lx, 0.61, 0.01);
    benchGroup.add(sup);
  }

  const slatGeo = track(new THREE.BoxGeometry(1.54, 0.036, 0.092));
  for (let s = 0; s < 4; s++) {
    const slat = new THREE.Mesh(slatGeo, benchWoodMat);
    slat.position.set(0, 0.635, THREE.MathUtils.lerp(0.21, -0.15, s / 3));
    benchGroup.add(slat);
  }
  for (let b = 0; b < 3; b++) {
    const slat = new THREE.Mesh(slatGeo, benchWoodMat);
    const u = b / 2;
    slat.position.set(0, THREE.MathUtils.lerp(0.84, 1.18, u), THREE.MathUtils.lerp(-0.21, -0.25, u));
    slat.rotation.x = -0.14;
    benchGroup.add(slat);
  }
  group.add(benchGroup);

  // --- 7. SWAYING CHERRY BLOSSOM TREES ("PED") WITH DELICATE ORGANIC CANOPIES ---
  const barkMat = track(
    new THREE.MeshStandardMaterial({
      color: '#342126',
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  const blossomPuffGeo = track(new THREE.IcosahedronGeometry(0.068, 1));
  const blossomPuffMat = track(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.82,
      metalness: 0.02,
      emissive: '#300b21',
      emissiveIntensity: 0.25,
    }),
  );

  const treeSpecs = [
    { x: -3.05, z: -2.05, scale: 1.08, leanX: 0.85, phase: 0.0 }, // Overarching left park bench
    { x: 2.05, z: -1.65, scale: 1.0, leanX: -0.78, phase: 1.2 }, // Riverside foreground tree
    { x: -2.85, z: -6.0, scale: 1.02, leanX: 0.78, phase: 2.3 },
    { x: 2.08, z: -5.8, scale: 0.98, leanX: -0.75, phase: 3.1 },
    { x: -2.9, z: -10.2, scale: 0.95, leanX: 0.72, phase: 4.0 },
    { x: 2.1, z: -10.0, scale: 0.95, leanX: -0.72, phase: 5.1 },
  ];

  const swayingTrees: { pivot: THREE.Group; phase: number }[] = [];
  const cPink = new THREE.Color('#d64186');
  const cSoft = new THREE.Color('#f08bb8');
  const cWhite = new THREE.Color('#f9dce9');
  const dummy = new THREE.Object3D();

  for (const ts of treeSpecs) {
    const treePivot = new THREE.Group();
    treePivot.position.set(ts.x, floorY, ts.z);
    group.add(treePivot);
    swayingTrees.push({ pivot: treePivot, phase: ts.phase });

    const s = ts.scale;
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(ts.leanX * 0.25, 1.15 * s, 0.08 * s),
      new THREE.Vector3(ts.leanX * 0.62, 2.18 * s, 0.16 * s),
      new THREE.Vector3(ts.leanX * 0.98, 2.9 * s, 0.2 * s),
    ]);
    const trunkGeo = track(new THREE.TubeGeometry(trunkCurve, 14, 0.11 * s, 8, false));
    treePivot.add(new THREE.Mesh(trunkGeo, barkMat));

    const branches = [
      { startU: 0.48, dx: ts.leanX * 0.9, dy: 0.85, dz: 0.42 },
      { startU: 0.58, dx: -ts.leanX * 0.62, dy: 0.92, dz: -0.34 },
      { startU: 0.72, dx: ts.leanX * 1.18, dy: 0.8, dz: -0.24 },
      { startU: 0.84, dx: ts.leanX * 0.42, dy: 0.96, dz: 0.5 },
      { startU: 0.95, dx: ts.leanX * 0.86, dy: 0.68, dz: 0.1 },
    ];

    const localCanopyPts: { pos: THREE.Vector3; radius: number }[] = [];
    for (const br of branches) {
      const origin = trunkCurve.getPoint(br.startU);
      const mid = new THREE.Vector3(
        origin.x + br.dx * 0.55 * s,
        origin.y + br.dy * 0.55 * s,
        origin.z + br.dz * 0.55 * s,
      );
      const tip = new THREE.Vector3(
        origin.x + br.dx * s,
        origin.y + br.dy * s,
        origin.z + br.dz * s,
      );
      const brGeo = track(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([origin, mid, tip]), 8, 0.038 * s, 6, false),
      );
      treePivot.add(new THREE.Mesh(brGeo, barkMat));
      localCanopyPts.push({ pos: mid, radius: 0.64 * s });
      localCanopyPts.push({ pos: tip, radius: 0.68 * s });
    }

    const perTreeCount = localCanopyPts.length * 44;
    const inst = new THREE.InstancedMesh(blossomPuffGeo, blossomPuffMat, perTreeCount);
    let idx = 0;
    for (const cc of localCanopyPts) {
      for (let k = 0; k < 44; k++) {
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        const r = Math.pow(rng(), 0.55) * cc.radius;
        dummy.position.set(
          cc.pos.x + Math.cos(th) * Math.sin(ph) * r * 1.25,
          cc.pos.y + Math.cos(ph) * r * 0.64,
          cc.pos.z + Math.sin(th) * Math.sin(ph) * r * 1.1,
        );
        dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        const sc = 0.65 + rng() * 0.72;
        dummy.scale.set(sc * 1.18, sc * 0.82, sc * 1.1);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);

        const roll = rng();
        inst.setColorAt(idx, roll < 0.24 ? cWhite : roll < 0.7 ? cPink : cSoft);
        idx++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    treePivot.add(inst);
  }

  // Roadside Shrubs & Flowering Plants ("Podhe")
  const shrubLeafMat = track(
    new THREE.MeshStandardMaterial({
      color: '#1b382b',
      roughness: 0.9,
    }),
  );
  const shrubLightMat = track(
    new THREE.MeshStandardMaterial({
      color: '#264d3b',
      roughness: 0.86,
    }),
  );
  const flowerBudMat = track(
    new THREE.MeshStandardMaterial({
      color: '#e85d9d',
      emissive: '#380d22',
      emissiveIntensity: 0.3,
      roughness: 0.7,
    }),
  );
  const shrubPuffGeo = track(new THREE.IcosahedronGeometry(0.17, 1));
  const budGeo = track(new THREE.IcosahedronGeometry(0.036, 0));

  const shrubSpots = [
    [-2.45, 0.5, 1.0],
    [2.15, 0.5, 0.9],
    [-2.65, -0.55, 1.1],
    [2.18, -0.9, 0.9],
    [-2.78, -2.35, 1.15],
    [-1.08, -2.35, 0.88],
    [2.16, -2.8, 0.95],
    [-2.48, -4.3, 1.1],
    [2.18, -4.5, 0.95],
    [-2.5, -7.2, 1.05],
    [2.18, -7.2, 0.95],
  ];

  for (const [sx, sz, sc] of shrubSpots) {
    const shrubGrp = new THREE.Group();
    shrubGrp.position.set(sx, floorY + 0.02, sz);
    for (let m = 0; m < 6; m++) {
      const ang = (m / 6) * Math.PI * 2 + rng() * 0.4;
      const dist = m === 0 ? 0 : (0.14 + rng() * 0.12) * sc;
      const puff = new THREE.Mesh(shrubPuffGeo, m % 2 === 0 ? shrubLeafMat : shrubLightMat);
      puff.position.set(Math.cos(ang) * dist, (m === 0 ? 0.18 : 0.11 + rng() * 0.08) * sc, Math.sin(ang) * dist);
      const pSc = (m === 0 ? 1.12 : 0.72 + rng() * 0.32) * sc;
      puff.scale.set(pSc * 1.18, pSc * 0.84, pSc * 1.1);
      shrubGrp.add(puff);

      for (let b = 0; b < 3; b++) {
        const bud = new THREE.Mesh(budGeo, flowerBudMat);
        bud.position.set(
          puff.position.x + (rng() - 0.5) * 0.18 * sc,
          puff.position.y + 0.12 * pSc,
          puff.position.z + (rng() - 0.5) * 0.18 * sc,
        );
        shrubGrp.add(bud);
      }
    }
    group.add(shrubGrp);
  }

  // --- 8. FLYING BIRDS OVER THE MOONLIT RIVER ("BIRDS UD RAHI HO") ---
  const birdMat = track(
    new THREE.MeshBasicMaterial({
      color: '#1b1d30',
      side: THREE.DoubleSide,
    }),
  );
  const birdBodyGeo = track(new THREE.ConeGeometry(0.032, 0.16, 5));
  birdBodyGeo.rotateX(Math.PI * 0.5);
  const wingGeo = track(new THREE.BufferGeometry());
  // Sleek swept gull wing extending along +X from pivot
  wingGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0, 0.04,
        0.24, 0.02, -0.04,
        0, 0, -0.05,
      ]),
      3,
    ),
  );
  wingGeo.computeVertexNormals();

  interface FlyingBird {
    root: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    centerX: number;
    centerZ: number;
    baseY: number;
    radiusX: number;
    radiusZ: number;
    speed: number;
    phase: number;
    flapSpeed: number;
  }
  const birds: FlyingBird[] = [];
  for (let b = 0; b < 9; b++) {
    const bRoot = new THREE.Group();
    bRoot.add(new THREE.Mesh(birdBodyGeo, birdMat));

    const lWing = new THREE.Mesh(wingGeo, birdMat);
    const rWing = new THREE.Mesh(wingGeo, birdMat);
    rWing.scale.x = -1;
    bRoot.add(lWing, rWing);

    const scale = 0.85 + rng() * 0.5;
    bRoot.scale.setScalar(scale);
    group.add(bRoot);

    birds.push({
      root: bRoot,
      leftWing: lWing,
      rightWing: rWing,
      centerX: 4.5 + rng() * 3.8,
      centerZ: -4.5 - rng() * 8.0,
      baseY: 0.75 + rng() * 2.1,
      radiusX: 1.4 + rng() * 1.8,
      radiusZ: 1.8 + rng() * 2.6,
      speed: 0.24 + rng() * 0.16,
      phase: rng() * Math.PI * 2,
      flapSpeed: 5.5 + rng() * 2.8,
    });
  }

  // --- 9. FALLING 3D CHERRY BLOSSOM PETALS IN THE WIND ---
  const petalCount = 380;
  const petalGeo = track(new THREE.PlaneGeometry(0.052, 0.034));
  const petalMat = track(
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  const petalInst = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
  const petalData: {
    x: number;
    y: number;
    z: number;
    speed: number;
    sway: number;
    phase: number;
    spin: number;
  }[] = [];

  for (let i = 0; i < petalCount; i++) {
    petalData.push({
      x: (rng() - 0.5) * 9.5,
      y: floorY + rng() * 5.2,
      z: 3.0 - rng() * 13.0,
      speed: 0.36 + rng() * 0.44,
      sway: 0.25 + rng() * 0.45,
      phase: rng() * Math.PI * 2,
      spin: 1.5 + rng() * 2.5,
    });
    const roll = rng();
    petalInst.setColorAt(i, roll < 0.3 ? cWhite : roll < 0.72 ? cPink : cSoft);
  }
  if (petalInst.instanceColor) petalInst.instanceColor.needsUpdate = true;
  group.add(petalInst);

  // --- 10. WIND-SLANTED FALLING RAIN STREAKS (Stops cleanly when they walk to bench!) ---
  const rainCount = 1100;
  const rainBasePos = new Float32Array(rainCount * 2 * 3);
  const rainMeta: { x: number; y: number; z: number; speed: number; len: number }[] = [];
  for (let i = 0; i < rainCount; i++) {
    rainMeta.push({
      x: (rng() - 0.5) * 11.5,
      y: floorY + rng() * 5.6,
      z: 3.2 - rng() * 13.5,
      speed: 5.5 + rng() * 2.5,
      len: 0.22 + rng() * 0.14,
    });
  }
  const rainGeo = track(new THREE.BufferGeometry());
  const rainAttr = new THREE.BufferAttribute(rainBasePos, 3);
  rainAttr.setUsage(THREE.DynamicDrawUsage);
  rainGeo.setAttribute('position', rainAttr);
  const rainMat = track(
    new THREE.LineBasicMaterial({
      color: '#c4d0ff',
      transparent: true,
      opacity: 0.3,
    }),
  );
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  group.add(rainLines);

  // --- UPDATE LOOP FOR SWAYING TREES, RIVER WAVES, FLYING BIRDS, PETALS & RAIN ---
  const update = (elapsed: number, rainOpacity: number, coupleCenter: THREE.Vector3) => {
    // 1. Visibly swaying cherry blossom trees in the wind
    for (const st of swayingTrees) {
      st.pivot.rotation.z =
        Math.sin(elapsed * 1.15 + st.phase) * 0.028 + Math.sin(elapsed * 2.4 + st.phase) * 0.011;
      st.pivot.rotation.x = Math.cos(elapsed * 0.95 + st.phase * 0.7) * 0.016;
    }

    // 2. River water ripples
    riverMat.uniforms.uTime.value = elapsed;

    // 3. Flying birds gliding & flapping gracefully over the moonlit river
    for (const bd of birds) {
      const ang = elapsed * bd.speed + bd.phase;
      const nx = bd.centerX + Math.cos(ang) * bd.radiusX;
      const nz = bd.centerZ + Math.sin(ang) * bd.radiusZ;
      const ny = bd.baseY + Math.sin(elapsed * 0.9 + bd.phase) * 0.22;

      const vx = -Math.sin(ang) * bd.radiusX * bd.speed;
      const vz = Math.cos(ang) * bd.radiusZ * bd.speed;
      bd.root.position.set(nx, ny, nz);
      bd.root.rotation.y = Math.atan2(vx, vz);

      const flap = Math.sin(elapsed * bd.flapSpeed + bd.phase * 3.0) * 0.48;
      bd.leftWing.rotation.z = flap;
      bd.rightWing.rotation.z = -flap;
    }

    // 4. Couple holographic pink glow onto wet road & bench
    coupleGlowLight.position.set(coupleCenter.x, coupleCenter.y + 0.25, coupleCenter.z + 0.15);

    // 5. Falling fluttering sakura petals blown across by breeze
    for (let i = 0; i < petalCount; i++) {
      const p = petalData[i];
      const spanY = 5.2;
      const tFall = ((p.y - floorY - elapsed * p.speed) % spanY + spanY) % spanY;
      const py = floorY + tFall;
      const px =
        (((p.x + elapsed * 0.55) % 9.5) + 9.5) % 9.5 -
        4.75 +
        Math.sin(elapsed * 2.0 + p.phase) * p.sway;
      const pz = p.z + Math.cos(elapsed * 1.6 + p.phase) * p.sway * 0.5;

      dummy.position.set(px, py, pz);
      dummy.rotation.set(
        elapsed * p.spin + p.phase,
        elapsed * p.spin * 0.7,
        elapsed * p.spin * 0.4,
      );
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      petalInst.setMatrixAt(i, dummy.matrix);
    }
    petalInst.instanceMatrix.needsUpdate = true;

    // 6. Rain visibility & wind-slanted motion
    rainLines.visible = rainOpacity > 0.01;
    rainMat.opacity = 0.3 * rainOpacity;
    if (rainLines.visible) {
      const arr = rainAttr.array as Float32Array;
      const spanY = 5.6;
      for (let i = 0; i < rainCount; i++) {
        const rm = rainMeta[i];
        const yOff = ((rm.y - floorY - elapsed * rm.speed) % spanY + spanY) % spanY;
        const topY = floorY + yOff;
        const xShift = (((rm.x + elapsed * 1.15) % 11.5) + 11.5) % 11.5 - 5.75;
        const idx = i * 6;
        arr[idx] = xShift;
        arr[idx + 1] = topY;
        arr[idx + 2] = rm.z;
        arr[idx + 3] = xShift - rm.len * 0.2;
        arr[idx + 4] = topY - rm.len;
        arr[idx + 5] = rm.z;
      }
      rainAttr.needsUpdate = true;
    }
  };

  const dispose = () => {
    for (const d of disposables) {
      d.dispose();
    }
  };

  return { group, update, dispose };
}
