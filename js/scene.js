/**
 * VNLOC — scene.js
 * Full 3D open-pit mine with scroll-driven cinematic camera.
 * Equipment: excavator loading truck → trucks on haul road → crusher dump.
 */
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

// ─── Palette ────────────────────────────────────────────────
const C = {
  ground:    0x5C4A1E, gndDark: 0x3D2E0A,
  bench1:    0x7A5C2A, bench2: 0x546070, bench3: 0x384250,
  oreFloor:  0x1A2535, oreAcc: 0x162030,
  cliff:     0x5A6070, cliffDk: 0x3A4050,
  road:      0x8A7040,
  sky0:      0x0A0616, sky1: 0x1A0820, sky2: 0x2A0808,
  sun:       0xFFE060,
  // Equipment
  yellow:    0xFFCC00, yellowDk: 0xCC9900, yellowLt: 0xFFDD44,
  red:       0xCC1010, redDk: 0x991010,
  grey:      0x888898, greyDk: 0x404050, greyLt: 0xAAB0BB,
  black:     0x181820,
  glass:     0x6699CC,
  orange:    0xFF6600,
  white:     0xEEEEF4,
};

// ─── Scene state ────────────────────────────────────────────
let renderer, scene, camera, composer;
let clock;

// Equipment
let excPlatform, excBoom, excArm, excBucket;      // excavator pivots
let truck1, truck1Bed;                             // loading truck
let truck2, truck2Bed;                             // hauling truck
let truck3, truck3Bed;                             // dumping truck
let truck2Progress = 0, truck2Dir = 1;
let truck3BedAngle = 0, truck3DumpPhase = 0;
let dust1Geo, dust1, dust2Geo, dust2;             // particle systems
let haulCurve;                                     // path for truck2

// Camera scroll story
const STORY = [
  // [scrollT, camX,  camY, camZ, tarX, tarY,  tarZ]
  [0.00,  -5,  62,  45,    0, -12,   0],   // aerial hero
  [0.12, -18,  38,  32,   -5, -12,   2],   // mid aerial (about)
  [0.24,  -8,   7,  20,   -4, -19,   2],   // pit floor (orebody)
  [0.37,  14,  18,   8,   12,  -8,  -6],   // haul road (ops)
  [0.49,  36,  14,  -8,   26,   0, -16],   // crusher (AI)
  [0.60,   2,  52,  32,    2,  -5,   0],   // aerial overview (services)
  [0.72, -22,  24,  30,   -5, -10,   5],   // golden hour (values)
  [0.85, -10,  28,  40,    0,  -8,   5],   // impact
  [1.00,   0,  34,  48,    0,  -5,   0],   // contact
];

let scrollProgress = 0, scrollTarget = 0;

// ─── Boot ───────────────────────────────────────────────────
function init() {
  showLoader();
  clock = new THREE.Clock();

  // ── Renderer ──
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  setSize();

  // ── Scene ──
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0A0616, 0.012);

  // ── Camera ──
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 400);
  camera.position.set(-5, 62, 45);
  camera.lookAt(0, -12, 0);

  // ── Lighting ──
  buildLighting();

  // ── World ──
  buildSky();
  buildTerrain();
  buildHaulRoad();
  buildExcavator();
  truck1 = buildTruck(new THREE.Vector3(-4, -20, 6), Math.PI * 0.15, 'loading');
  truck2 = buildTruck(new THREE.Vector3(10, -16, 4), 0, 'hauling');
  truck3 = buildTruck(new THREE.Vector3(28, 0.4, -20), Math.PI, 'dumping');
  buildCrusher();
  buildSurface();
  buildDust();

  // ── Post-processing (desktop only) ──
  const mobile = window.matchMedia('(max-width:768px)').matches;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, 0.5, 0.78
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ── Events ──
  window.addEventListener('scroll', () => {
    const maxS = document.body.scrollHeight - window.innerHeight;
    scrollTarget = maxS > 0 ? window.scrollY / maxS : 0;
  }, { passive: true });
  window.addEventListener('resize', setSize);

  hideLoader();
  loop();
}

// ─── Loader ─────────────────────────────────────────────────
function showLoader() {
  const l = document.createElement('div');
  l.id = 'loader';
  l.innerHTML = `
    <img class="loader-logo" src="VNLOC_LOGO.png" alt="VNLOC"/>
    <div class="loader-bar"><div class="loader-fill"></div></div>
    <span class="loader-text">Preparing the mine…</span>`;
  document.body.appendChild(l);
}
function hideLoader() {
  setTimeout(() => {
    const l = document.getElementById('loader');
    if (l) { l.classList.add('hidden'); setTimeout(() => l.remove(), 700); }
  }, 1200);
}

// ─── Helpers ────────────────────────────────────────────────
function sm(color, rough = 0.8, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function bm(color) { return new THREE.MeshBasicMaterial({ color }); }

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function cyl(rT, rB, h, seg = 12) { return new THREE.CylinderGeometry(rT, rB, h, seg); }

function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}

/** Add a box mesh directly to a group */
function addBox(parent, w, h, d, color, x, y, z, rough = 0.75, metal = 0) {
  const m = mesh(box(w, h, d), sm(color, rough, metal));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Add a cylinder mesh to a group */
function addCyl(parent, rT, rB, h, color, x, y, z, seg = 12, rough = 0.8) {
  const m = mesh(cyl(rT, rB, h, seg), sm(color, rough));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Place a Lego-style block (with stud) in scene */
function legoPlace(w, h, d, color, x, y, z, parent = scene) {
  const g = new THREE.Group();
  const b = addBox(g, w * 0.96, h, d * 0.96, color, 0, 0, 0);

  const sr = 0.13, sh = 0.09;
  const sg = cyl(sr, sr, sh, 10);
  const sm2 = sm(color, 0.55);
  for (let c = 0; c < Math.round(w); c++) {
    for (let r = 0; r < Math.round(d); r++) {
      const s = new THREE.Mesh(sg, sm2);
      s.position.set(c - (Math.round(w)-1)/2, h/2+sh/2, r - (Math.round(d)-1)/2);
      g.add(s);
    }
  }
  g.position.set(x, y + h/2, z);
  parent.add(g);
  return g;
}

// ─── Lighting ───────────────────────────────────────────────
function buildLighting() {
  scene.add(new THREE.AmbientLight(0x203060, 1.4));

  // Golden-hour sun from southeast
  const sun = new THREE.DirectionalLight(0xFFD080, 3.0);
  sun.position.set(60, 50, -40);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -55; sc.right = sc.top = 55;
  sc.near = 1; sc.far = 180;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.001;
  scene.add(sun);

  // Cool fill (sky)
  const fill = new THREE.DirectionalLight(0x4060FF, 0.35);
  fill.position.set(-30, 20, 20);
  scene.add(fill);

  // Rim light (west)
  const rim = new THREE.DirectionalLight(0xFF8020, 0.5);
  rim.position.set(-50, 10, -30);
  scene.add(rim);
}

// ─── Sky ────────────────────────────────────────────────────
function buildSky() {
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const cols = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y + 60) / 120));
    // Deep purple-blue top → orange-red horizon → dark rust below
    const r = t < 0.5 ? lerp(0.18, 0.60, t*2) : lerp(0.60, 0.04, (t-0.5)*2);
    const g = t < 0.5 ? lerp(0.04, 0.20, t*2) : lerp(0.20, 0.02, (t-0.5)*2);
    const b = t < 0.5 ? lerp(0.02, 0.10, t*2) : lerp(0.10, 0.08, (t-0.5)*2);
    cols.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const skyMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  scene.add(skyMesh);

  // Sun disc (emissive, triggers bloom)
  const sunSphere = mesh(new THREE.SphereGeometry(2.5, 16, 8), new THREE.MeshBasicMaterial({ color: 0xFFEE88 }), false);
  sunSphere.position.set(80, 42, -55);
  scene.add(sunSphere);

  // Halo ring around sun
  const haloGeo = new THREE.TorusGeometry(5, 1.2, 8, 32);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.22 });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.copy(sunSphere.position);
  halo.lookAt(0, 0, 0);
  scene.add(halo);
}

// ─── Terrain ────────────────────────────────────────────────
function buildTerrain() {
  // ---- Ground surface ring ----
  const ringSeg = 64;
  buildBenchFloor(22, 55, 0,   C.ground, C.gndDark, ringSeg);
  buildBenchWall(22, 0, -5, C.cliff, ringSeg);

  buildBenchFloor(14, 22, -5,  C.bench1, C.bench1, ringSeg);
  buildBenchWall(14, -5, -10, C.cliffDk, ringSeg);

  buildBenchFloor(9,  14, -10, C.bench2, C.bench2, ringSeg);
  buildBenchWall(9, -10, -15, C.cliff, ringSeg);

  buildBenchFloor(5,  9,  -15, C.bench3, C.bench3, ringSeg);
  buildBenchWall(5, -15, -20, C.cliffDk, ringSeg);

  // ---- Pit floor (ore) ----
  const floorGeo = new THREE.CircleGeometry(5.2, 32);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = sm(C.oreFloor, 0.95);
  const floor = mesh(floorGeo, floorMat);
  floor.position.y = -20;
  scene.add(floor);

  // Ore accent rocks on pit floor
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 2.5 + Math.random() * 1.5;
    const bw = 0.4 + Math.random() * 0.6;
    const bh = 0.3 + Math.random() * 0.4;
    const ore = mesh(box(bw, bh, bw * 0.7), sm(C.oreAcc, 0.9));
    ore.position.set(Math.cos(a)*r, -20 + bh/2, Math.sin(a)*r);
    scene.add(ore);
  }

  // Rock scatter on benches
  const rockColors = [C.cliff, C.cliffDk, C.bench2];
  const benchRings = [[18, 21, 0], [12, 18, -5], [8, 13, -10], [5, 9, -15]];
  benchRings.forEach(([ir, or, y]) => {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = ir + Math.random() * (or - ir);
      const s = 0.3 + Math.random() * 0.6;
      const rock = mesh(box(s, s*0.5, s*0.8), sm(rockColors[Math.floor(Math.random()*3)], 0.95));
      rock.position.set(Math.cos(a)*r, y + s*0.25, Math.sin(a)*r);
      rock.rotation.y = Math.random() * Math.PI * 2;
      scene.add(rock);
    }
  });
}

function buildBenchFloor(innerR, outerR, y, colorA, colorB, seg) {
  // Split in two to allow haul road gap on east side
  [
    [0.3, Math.PI * 2 - 0.3, colorA],
    // haul road gap on east (removed ~0.6 rad)
  ].forEach(([tS, tL, col]) => {
    const geo = new THREE.RingGeometry(innerR, outerR, seg, 1, tS, tL);
    geo.rotateX(-Math.PI / 2);
    const m = mesh(geo, sm(col, 0.92));
    m.position.y = y;
    scene.add(m);
  });
}

function buildBenchWall(r, yTop, yBot, color, seg) {
  const h = Math.abs(yTop - yBot);
  const wallGeo = new THREE.CylinderGeometry(r, r, h, seg, 2, true);
  const wallMesh = mesh(wallGeo, sm(color, 0.95));
  wallMesh.position.y = yBot + h / 2;
  scene.add(wallMesh);
}

// ─── Haul Road ──────────────────────────────────────────────
function buildHaulRoad() {
  haulCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(4, -20, 0),
    new THREE.Vector3(7, -18, 3),
    new THREE.Vector3(12, -15, 7),
    new THREE.Vector3(17, -12, 5),
    new THREE.Vector3(20, -10, 0),
    new THREE.Vector3(22, -7, -5),
    new THREE.Vector3(23, -4, -12),
    new THREE.Vector3(26, 0, -17),
    new THREE.Vector3(28, 0, -22),
  ]);

  const pts = haulCurve.getPoints(40);
  const roadMat = sm(C.road, 0.88);
  const edgeMat = sm(0x6A5030, 0.92);

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const seg = new THREE.Vector3().subVectors(p2, p1);
    const len = seg.length();
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), seg.clone().normalize());

    const road = mesh(box(5, 0.25, len), roadMat);
    road.position.copy(mid);
    road.setRotationFromQuaternion(quat);
    scene.add(road);

    // Shoulders
    [-3, 3].forEach(sx => {
      const e = mesh(box(0.6, 0.18, len), edgeMat);
      const offset = new THREE.Vector3(sx, 0, 0).applyQuaternion(quat);
      e.position.copy(mid).add(offset);
      e.setRotationFromQuaternion(quat);
      scene.add(e);
    });
  }

  // ---- Road markings (centre line) ----
  for (let i = 0; i < pts.length - 1; i += 2) {
    const p1 = pts[i], p2 = pts[Math.min(i+1, pts.length-1)];
    const seg = new THREE.Vector3().subVectors(p2, p1);
    const len = seg.length();
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), seg.clone().normalize());
    const line = mesh(box(0.2, 0.28, len * 0.5), sm(0xEEDD88, 0.6));
    line.position.copy(mid).add(new THREE.Vector3(0, 0.01, 0));
    line.setRotationFromQuaternion(quat);
    scene.add(line);
  }
}

// ─── Excavator ──────────────────────────────────────────────
function buildExcavator() {
  const root = new THREE.Group();
  root.position.set(-7, -20, 1.5);
  scene.add(root);

  // Undercarriage & tracks
  addBox(root, 2.8, 0.4, 2.4, C.greyDk, 0, 0.2, 0);
  addBox(root, 0.55, 0.48, 2.6, C.black, -1.2, 0.24, 0);   // left track
  addBox(root, 0.55, 0.48, 2.6, C.black,  1.2, 0.24, 0);   // right track
  // Track detail
  for (let z = -1.1; z <= 1.1; z += 0.45) {
    addBox(root, 2.65, 0.1, 0.1, C.greyDk, 0, 0.48, z);
  }

  // Swing bearing
  addCyl(root, 0.85, 0.85, 0.12, C.grey, 0, 0.48, 0);

  // Upper platform (rotates)
  excPlatform = new THREE.Group();
  excPlatform.position.set(0, 0.55, 0);
  root.add(excPlatform);

  addBox(excPlatform, 2.2, 0.42, 1.9, C.yellow, 0, 0.21, 0);

  // Counterweight
  addBox(excPlatform, 1.8, 0.55, 0.45, C.greyDk, 0, 0.48, -0.85);

  // Cab
  addBox(excPlatform, 1.1, 1.0, 1.1, C.yellow, -0.35, 0.92, 0.1);
  addBox(excPlatform, 1.0, 0.12, 1.0, C.yellowDk, -0.35, 1.46, 0.1); // roof
  // Windows
  addBox(excPlatform, 0.0, 0.42, 0.70, C.glass, -0.88, 0.9, 0.1);   // side glass
  addBox(excPlatform, 0.78, 0.42, 0.0, C.glass, -0.35, 0.9, 0.6);   // front glass

  // Engine housing (rear)
  addBox(excPlatform, 0.9, 0.65, 1.3, C.greyLt, 0.68, 0.74, 0.0);
  addCyl(excPlatform, 0.08, 0.08, 0.7, C.greyDk, 0.75, 1.25, -0.4, 8); // exhaust

  // Boom pivot
  excBoom = new THREE.Group();
  excBoom.position.set(-0.35, 1.38, 0.6);
  excPlatform.add(excBoom);

  // Boom (long arm)
  const boomMesh = addBox(excBoom, 0.3, 2.8, 0.28, C.yellow, 0, 1.4, 0);
  // Boom hydraulic
  addBox(excBoom, 0.1, 1.3, 0.1, C.grey, 0.18, 0.9, 0);

  // Arm pivot
  excArm = new THREE.Group();
  excArm.position.set(0, 2.8, 0);
  excBoom.add(excArm);

  // Arm (dipper)
  addBox(excArm, 0.22, 1.7, 0.22, C.yellowDk, 0, 0.85, 0);
  addBox(excArm, 0.09, 0.8, 0.09, C.grey, 0.14, 0.7, 0);  // hydraulic

  // Bucket pivot
  excBucket = new THREE.Group();
  excBucket.position.set(0, 1.7, 0);
  excArm.add(excBucket);

  // Bucket body
  addBox(excBucket, 0.72, 0.36, 0.58, C.orange, 0, 0.0, 0, 0.65);
  addBox(excBucket, 0.72, 0.1, 0.44, C.greyDk, 0, -0.23, 0.06, 0.9);  // bottom
  addBox(excBucket, 0.72, 0.3, 0.1, C.greyDk, 0, 0.0, 0.34, 0.85);   // back
  // Teeth
  for (let tx = -0.26; tx <= 0.26; tx += 0.13) {
    addBox(excBucket, 0.06, 0.14, 0.06, C.greyLt, tx, -0.28, 0.0, 0.5, 0.6);
  }

  // Initial boom angles (boom up, ready to swing)
  excBoom.rotation.x   = -0.45;
  excArm.rotation.x    =  0.3;
  excBucket.rotation.x = -0.15;
}

// ─── Mining Truck ────────────────────────────────────────────
function buildTruck(position, rotY, type) {
  const g = new THREE.Group();
  g.position.copy(position);
  g.rotation.y = rotY;
  scene.add(g);

  // ---- Wheels (6-wheel mining truck) ----
  const wMat = sm(C.black, 0.9);
  const wRim = sm(C.grey, 0.4, 0.3);
  const wGeo = cyl(0.82, 0.82, 0.55, 16);
  const rGeo = cyl(0.5, 0.5, 0.57, 12);

  const wheelPos = [
    [-1.2, 0, 1.4], [1.2, 0, 1.4],  // front axle
    [-1.3, 0, -0.5], [1.3, 0, -0.5],// rear inner
    [-1.3, 0, -1.8], [1.3, 0, -1.8],// rear outer
  ];
  wheelPos.forEach(([wx, wy, wz]) => {
    const w = mesh(wGeo, wMat); w.rotation.z = Math.PI/2; w.position.set(wx, wy, wz); g.add(w);
    const r = mesh(rGeo, wRim); r.rotation.z = Math.PI/2; r.position.set(wx, wy, wz); g.add(r);
  });

  // ---- Frame ----
  addBox(g, 2.3, 0.38, 3.6, C.greyDk, 0, 0.65, -0.3);

  // ---- Dump bed ----
  const bedGrp = new THREE.Group();
  bedGrp.position.set(0, 0.85, -0.25);
  g.add(bedGrp);

  addBox(bedGrp, 2.0, 0.7, 2.6, C.yellow,   0, 0.35, 0.05, 0.7);    // floor
  addBox(bedGrp, 0.1, 0.9, 2.6, C.yellowDk, -1.05, 0.8, 0.05, 0.75); // L side
  addBox(bedGrp, 0.1, 0.9, 2.6, C.yellowDk,  1.05, 0.8, 0.05, 0.75); // R side
  addBox(bedGrp, 2.0, 0.9, 0.1, C.yellowDk,  0, 0.8, 1.35, 0.75);   // rear gate

  // Pivot at bottom-rear of bed
  bedGrp.userData.pivotZ = -1.3;

  if (type === 'loading') truck1Bed = bedGrp;
  if (type === 'hauling') truck2Bed = bedGrp;
  if (type === 'dumping') truck3Bed = bedGrp;

  // ---- Cab ----
  const cabY = type === 'dumping' ? 1.5 : 1.5;
  addBox(g, 2.1, 1.2, 1.45, C.red, 0, cabY, 1.4, 0.65);
  addBox(g, 1.9, 0.14, 1.3, C.redDk, 0, cabY + 0.67, 1.4, 0.7);  // roof
  // Windshield
  addBox(g, 1.55, 0.58, 0.0, C.glass, 0, cabY + 0.2, 0.72);
  addBox(g, 0.0, 0.42, 0.75, C.glass, -1.03, cabY + 0.15, 1.4);   // side win
  addBox(g, 0.0, 0.42, 0.75, C.glass,  1.03, cabY + 0.15, 1.4);
  // Bull bar
  addBox(g, 1.9, 0.5, 0.14, C.greyDk, 0, 1.05, 2.18);
  addBox(g, 1.65, 0.08, 0.55, C.greyDk, 0, 0.72, 2.06); // lower guard
  // Headlights
  addBox(g, 0.18, 0.14, 0.0, 0xFFFFCC, -0.65, 1.22, 2.22, 0.1);
  addBox(g, 0.18, 0.14, 0.0, 0xFFFFCC,  0.65, 1.22, 2.22, 0.1);

  // Truck 3 starts with bed already tilted
  if (type === 'dumping') {
    bedGrp.rotation.x = -Math.PI * 0.35;
  }

  return g;
}

// ─── Crusher / Processing Plant ──────────────────────────────
function buildCrusher() {
  const root = new THREE.Group();
  root.position.set(24, 0, -18);
  scene.add(root);

  // Main crusher body
  addBox(root, 4.5, 5.5, 4.0, C.greyDk, 0, 2.75, 0, 0.85);
  addBox(root, 4.2, 0.3, 3.8, C.grey, 0, 5.65, 0);   // top cap

  // Feed hopper (trapezoid approximation)
  addBox(root, 3.5, 1.0, 3.0, 0x505060, 0, 6.15, 0, 0.8); // hopper lower
  addBox(root, 5.0, 0.6, 4.2, 0x606070, 0, 6.95, 0, 0.8); // hopper upper flare

  // Structural frame columns
  [-2.5, 2.5].forEach(sx => {
    [-2.2, 2.2].forEach(sz => {
      addCyl(root, 0.18, 0.18, 5.5, C.greyDk, sx, 2.75, sz, 8, 0.6);
    });
  });

  // Side access platform
  addBox(root, 0.2, 0.06, 2.8, C.grey, -2.8, 2.5, 0);
  addBox(root, 0.2, 0.06, 2.8, C.grey, 2.8, 2.5, 0);

  // Discharge conveyor (going away from crusher to stockpile)
  const convLen = 12;
  const convAngle = -0.18; // slight downward angle
  const conv = new THREE.Group();
  conv.position.set(-5, 1.5, -2);
  conv.rotation.z = convAngle;
  root.add(conv);
  addBox(conv, convLen, 0.5, 0.9, C.greyDk, 0, 0, 0, 0.8); // belt
  addBox(conv, 0.18, 0.5, 0.9, C.grey, -convLen/2, 0, 0, 0.6); // end cap
  // Conveyor legs
  for (let ci = -convLen/2+1; ci < convLen/2; ci += 2.5) {
    addBox(conv, 0.15, 2.0, 0.15, C.greyDk, ci, -1.25, 0.42);
    addBox(conv, 0.15, 2.0, 0.15, C.greyDk, ci, -1.25, -0.42);
  }

  // Stockpile cone at end of conveyor
  const stockGeo = new THREE.ConeGeometry(4, 3, 16);
  const stock = mesh(stockGeo, sm(C.ore, 0.95));
  stock.position.set(-7, 1.5, -5);
  scene.add(stock);

  // Dust hood
  addBox(root, 2.5, 0.5, 2.2, 0x404050, 0, 5.6, 0, 0.9);

  // Processing building (office/control room)
  const bldg = new THREE.Group();
  bldg.position.set(-8, 0, 0);
  root.add(bldg);
  addBox(bldg, 3.5, 3.8, 3.0, 0x3A4050, 0, 1.9, 0, 0.85);
  addBox(bldg, 3.3, 0.2, 2.8, 0x2A3040, 0, 3.9, 0);  // roof
  // Windows
  addBox(bldg, 0.7, 0.6, 0.0, C.glass, -0.5, 2.2, 1.52);
  addBox(bldg, 0.7, 0.6, 0.0, C.glass,  0.5, 2.2, 1.52);
  // Door
  addBox(bldg, 0.4, 0.9, 0.0, C.greyDk, 0, 1.35, 1.52);
}

// ─── Surface Details ─────────────────────────────────────────
function buildSurface() {
  // Large ground plane
  const gndGeo = new THREE.CircleGeometry(55, 64);
  gndGeo.rotateX(-Math.PI / 2);
  const gnd = mesh(gndGeo, sm(C.ground, 0.95));
  gnd.position.y = 0;
  scene.add(gnd);

  // Outer terrain ring (rough)
  const outGeo = new THREE.RingGeometry(55, 130, 32);
  outGeo.rotateX(-Math.PI / 2);
  const outMesh = mesh(outGeo, sm(C.gndDark, 0.97));
  scene.add(outMesh);

  // Lighting towers around rim
  const towerPos = [
    [-20, 0, -20], [20, 0, -20], [22, 0, 14], [-22, 0, 14],
    [0, 0, -28], [0, 0, 26],
  ];
  towerPos.forEach(([x, y, z]) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    scene.add(grp);
    addCyl(grp, 0.1, 0.14, 9, C.grey, 0, 4.5, 0, 8);
    addBox(grp, 0.8, 0.15, 0.4, C.greyLt, 0, 9.1, 0);
    // Light glow (emissive)
    const lGeo = new THREE.SphereGeometry(0.15, 6, 4);
    const lMat = new THREE.MeshBasicMaterial({ color: 0xFFFF88 });
    const lm = new THREE.Mesh(lGeo, lMat);
    lm.position.set(0, 9.1, 0);
    grp.add(lm);
  });

  // Waste dump (west side)
  const wdGeo = new THREE.ConeGeometry(8, 5, 16);
  const wd = mesh(wdGeo, sm(C.gndDark, 0.97));
  wd.position.set(-40, 2.5, -10);
  scene.add(wd);
  const wd2 = mesh(new THREE.ConeGeometry(5, 3, 12), sm(C.cliffDk, 0.97));
  wd2.position.set(-36, 1.5, 5);
  scene.add(wd2);

  // Main road from crusher to gate
  addBox(scene, 5, 0.2, 30, C.road, 28, 0.2, 5);

  // Site perimeter fence posts (token few)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 48;
    addCyl(scene, 0.08, 0.08, 1.5, C.grey, Math.cos(a)*r, 0.75, Math.sin(a)*r, 6);
  }
}

// ─── Dust particles ──────────────────────────────────────────
function buildDust() {
  function makeDust(count, color, range) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random()-0.5) * range;
      pos[i*3+1] =  Math.random() * range * 0.5;
      pos[i*3+2] = (Math.random()-0.5) * range;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size: 0.25, transparent: true, opacity: 0.35,
      sizeAttenuation: true, depthWrite: false,
    });
    return { geo, pts: new THREE.Points(geo, mat) };
  }

  // Excavator dust
  const d1 = makeDust(200, 0xC09060, 3);
  dust1Geo = d1.geo;
  dust1 = d1.pts;
  dust1.position.set(-7, -18, 2);
  scene.add(dust1);

  // Crusher dust
  const d2 = makeDust(300, 0x808090, 4);
  dust2Geo = d2.geo;
  dust2 = d2.pts;
  dust2.position.set(24, 4, -18);
  scene.add(dust2);
}

// ─── Animate Dust ───────────────────────────────────────────
function animateDust(geo, t, speed = 0.4) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + speed * 0.016);
    if (pos.getY(i) > 4) pos.setY(i, 0);
  }
  pos.needsUpdate = true;
}

// ─── Scroll Camera ──────────────────────────────────────────
const _tv = new THREE.Vector3();
function updateCamera() {
  // Smooth scroll lag
  scrollProgress += (scrollTarget - scrollProgress) * 0.045;
  const p = scrollProgress;

  let i = 0;
  while (i < STORY.length - 2 && STORY[i + 1][0] <= p) i++;
  const a = STORY[i], b = STORY[i + 1];
  const seg = b[0] - a[0];
  const t = seg > 0 ? smoothstep(Math.max(0, Math.min(1, (p - a[0]) / seg))) : 0;

  camera.position.set(
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
    lerp(a[3], b[3], t),
  );
  _tv.set(lerp(a[4], b[4], t), lerp(a[5], b[5], t), lerp(a[6], b[6], t));
  camera.lookAt(_tv);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }

// ─── Equipment Animation ─────────────────────────────────────
function animateEquipment(t) {
  // Excavator: dig cycle — platform swings, boom lowers to dig, rises to dump
  const phase = (t * 0.28) % (Math.PI * 2); // full cycle period ~22s
  if (excPlatform) {
    excPlatform.rotation.y = Math.sin(phase * 0.5) * 0.8;  // swing left/right
  }
  if (excBoom) {
    // Boom rises while swinging toward truck, lowers to dig when swinging back
    excBoom.rotation.x = -0.45 + Math.sin(phase * 0.5 + 0.5) * 0.35;
  }
  if (excArm) {
    excArm.rotation.x = 0.3 + Math.sin(phase * 0.5 + 1.0) * 0.3;
  }
  if (excBucket) {
    excBucket.rotation.x = -0.15 + Math.sin(phase * 0.5 + 1.6) * 0.45;
  }

  // Truck 1 (loading): slight chassis rock when excavator is loading
  if (truck1) {
    truck1.rotation.z = Math.sin(t * 1.2) * 0.012;
  }

  // Truck 2 (haul road): moves continuously along haulCurve
  if (truck2 && haulCurve) {
    truck2Progress += 0.00035 * truck2Dir;
    if (truck2Progress >= 1) { truck2Progress = 1; truck2Dir = -1; }
    if (truck2Progress <= 0) { truck2Progress = 0; truck2Dir =  1; }

    const pos = haulCurve.getPoint(truck2Progress);
    const tan = haulCurve.getTangent(truck2Progress);
    truck2.position.set(pos.x, pos.y + 0.82, pos.z);

    // Orient along tangent (horizontal yaw only)
    const yaw = Math.atan2(tan.x, tan.z);
    truck2.rotation.y = yaw + (truck2Dir < 0 ? Math.PI : 0);

    // Slight pitch/roll based on tangent
    truck2.rotation.z = Math.sin(t * 2.5) * 0.02;
  }

  // Truck 3 (crusher): dump cycle
  if (truck3Bed) {
    truck3DumpPhase = (truck3DumpPhase + 0.003) % (Math.PI * 2);
    // Raise bed → hold → lower → hold
    const dp = truck3DumpPhase;
    let angle = 0;
    if (dp < Math.PI * 0.4) angle = smoothstep(dp / (Math.PI * 0.4)) * (-Math.PI * 0.42);
    else if (dp < Math.PI * 0.9) angle = -Math.PI * 0.42;
    else angle = -(1 - smoothstep((dp - Math.PI * 0.9) / (Math.PI * 1.1))) * Math.PI * 0.42;
    truck3Bed.rotation.x = angle;
  }

  // Dust particles
  if (dust1Geo) animateDust(dust1Geo, t, 0.5);
  if (dust2Geo) animateDust(dust2Geo, t, 0.4);
}

// ─── Annotation visibility ────────────────────────────────────
function updateAnnotations() {
  const p = scrollProgress;
  const show = (id, when) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('visible', when);
  };
  show('ann-exc',     p > 0.20 && p < 0.35);
  show('ann-grade',   p > 0.20 && p < 0.35);
  show('ann-truck',   p > 0.33 && p < 0.48);
  show('ann-crusher', p > 0.45 && p < 0.60);
}

// ─── Resize ─────────────────────────────────────────────────
function setSize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

// ─── Main loop ──────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();

  updateCamera();
  animateEquipment(t);
  updateAnnotations();

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

// ─── Start ──────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
