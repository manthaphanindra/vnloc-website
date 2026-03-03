/**
 * VNLOC — Lego Mine Scene (Three.js)
 * Hero background: isometric-style Lego open-cut mine
 * with animated excavator & dump truck
 */
import * as THREE from 'three';

// ─── Palette ────────────────────────────────────────────────
const C = {
  greenLight:  0x4CAF50,
  greenDark:   0x2E7D32,
  brown:       0x8D6E63,
  brownDark:   0x5D4037,
  ore:         0x1A237E,
  oreGrey:     0x263238,
  rock:        0x607D8B,
  rockLight:   0x90A4AE,
  yellow:      0xFDD835,
  yellowDark:  0xF57F17,
  orange:      0xFF6D00,
  red:         0xD32F2F,
  redDark:     0xB71C1C,
  grey:        0x9E9E9E,
  darkGrey:    0x424242,
  black:       0x212121,
  white:       0xF5F5F5,
  sky:         0x0A0A18,
  windowBlue:  0x64B5F6,
};

// ─── State ──────────────────────────────────────────────────
let renderer, scene, camera;
let excavatorRoot, boomPivot, armPivot, bucketPivot;
let truckRoot;
let clock;
let oreMeshes = [];
let raf;

// ─── Entry ──────────────────────────────────────────────────
export function init() {
  const canvas = document.getElementById('legoCanvas');
  if (!canvas) return;

  clock = new THREE.Clock();

  // --- Renderer ---
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  resize();

  // --- Scene ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.FogExp2(C.sky, 0.018);

  // --- Camera ---
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 300);
  camera.position.set(24, 20, 24);
  camera.lookAt(0, -3, 0);

  // --- Lighting ---
  const ambient = new THREE.AmbientLight(0x203060, 1.8);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xFFE0A0, 2.8);
  sun.position.set(14, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -28;
  sc.right = sc.top = 28;
  sc.near = 0.5; sc.far = 80;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x4060FF, 0.4);
  fill.position.set(-10, 8, -10);
  scene.add(fill);

  // --- Build world ---
  buildGround();
  buildMinePit();
  buildExcavator();
  buildDumpTruck();
  addAtmosphere();

  // --- Animate ---
  loop();

  window.addEventListener('resize', resize);
}

// ─── Helpers ────────────────────────────────────────────────
function mat(color, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

/**
 * Create a Lego-style block group.
 * w, d are stud-counts; h is block height in world units.
 */
function legoBlock(w, h, d, color, studs = true) {
  const g = new THREE.Group();
  const bodyMat = mat(color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h, d * 0.96), bodyMat);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  if (studs) {
    const sr = 0.135, sh = 0.09;
    const sg = new THREE.CylinderGeometry(sr, sr, sh, 10);
    const sm = mat(color, 0.6);
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < d; r++) {
        const s = new THREE.Mesh(sg, sm);
        s.position.set(
          (c - (w - 1) * 0.5),
          h * 0.5 + sh * 0.5,
          (r - (d - 1) * 0.5)
        );
        g.add(s);
      }
    }
  }
  return g;
}

/** Place a block; position is block bottom-center. */
function place(w, h, d, color, x, y, z, studs = true) {
  const b = legoBlock(w, h, d, color, studs);
  b.position.set(x, y + h * 0.5, z);
  scene.add(b);
  return b;
}

// ─── Ground (green Lego surface) ────────────────────────────
function buildGround() {
  const bh = 0.55;
  // Use InstancedMesh for performance across the green ring
  const cols = [C.greenLight, C.greenDark];
  const geo = new THREE.BoxGeometry(0.92, bh, 0.92);

  // Count non-pit tiles
  const positions = [];
  for (let x = -10; x <= 10; x++) {
    for (let z = -10; z <= 10; z++) {
      if (x >= -5 && x <= 5 && z >= -5 && z <= 5) continue; // pit hole
      positions.push([x, z]);
    }
  }

  // Two instanced meshes (light/dark checker)
  const lightPos = positions.filter(([x,z]) => (x+z)%2 === 0);
  const darkPos  = positions.filter(([x,z]) => (x+z)%2 !== 0);

  [
    [lightPos, C.greenLight],
    [darkPos,  C.greenDark],
  ].forEach(([pts, color]) => {
    const mesh = new THREE.InstancedMesh(geo, mat(color), pts.length);
    mesh.receiveShadow = true;
    const mx = new THREE.Matrix4();
    pts.forEach(([x, z], i) => {
      mx.makeTranslation(x, bh * 0.5, z);
      mesh.setMatrixAt(i, mx);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });

  // Studs on surface (sparse, only every 2nd tile)
  const studGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.07, 8);
  const studMat = mat(C.greenLight, 0.6);
  const studMesh = new THREE.InstancedMesh(studGeo, studMat, Math.floor(positions.length / 4));
  let si = 0;
  const sm = new THREE.Matrix4();
  positions.forEach(([x,z], i) => {
    if (i % 4 !== 0) return;
    sm.makeTranslation(x, bh + 0.035, z);
    studMesh.setMatrixAt(si++, sm);
  });
  studMesh.instanceMatrix.needsUpdate = true;
  scene.add(studMesh);
}

// ─── Mine Pit (3-benched open-cut style) ────────────────────
function buildMinePit() {
  const bh = 0.55;

  // Bench 1 — rim (y = -2), ring around inner pit
  const bench1 = [];
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      if (x >= -3 && x <= 3 && z >= -3 && z <= 3) continue;
      bench1.push([x, z]);
    }
  }
  spawnBench(bench1, C.brown, -2);

  // Bench 2 (y = -4)
  const bench2 = [];
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 3; z++) {
      if (x >= -2 && x <= 2 && z >= -2 && z <= 2) continue;
      bench2.push([x, z]);
    }
  }
  spawnBench(bench2, C.brownDark, -4);

  // Pit floor — ore blocks (y = -6)
  const oreColors = [C.ore, C.oreGrey, C.rock];
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const c = oreColors[((x + z + 4) % 3 + 3) % 3];
      const b = legoBlock(1, bh, 1, c, false);
      b.position.set(x, -6 + bh * 0.5, z);
      scene.add(b);
    }
  }

  // Pit walls (vertical faces visible from camera angle)
  buildPitWalls();
}

function spawnBench(positions, color, baseY) {
  const bh = 0.55;
  const geo = new THREE.BoxGeometry(0.92, bh, 0.92);
  const mesh = new THREE.InstancedMesh(geo, mat(color), positions.length);
  mesh.receiveShadow = true; mesh.castShadow = true;
  const mx = new THREE.Matrix4();
  positions.forEach(([x, z], i) => {
    mx.makeTranslation(x, baseY + bh * 0.5, z);
    mesh.setMatrixAt(i, mx);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}

function buildPitWalls() {
  // Wall between surface (y=0) and bench1 (y=-2): height ~2 units
  // Placed along x=±5, z=±5 edges
  const wallH = 2.0;
  const wallMat = mat(C.rock, 0.8);

  const edges = [];
  for (let i = -5; i <= 5; i++) {
    edges.push([5, i], [-5, i], [i, 5], [i, -5]);
  }
  // dedupe
  const edgeSet = [...new Map(edges.map(e => [e.join(','), e])).values()];

  edgeSet.forEach(([x, z]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.92, wallH, 0.92), wallMat);
    b.position.set(x, -1, z);
    b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
  });

  // Wall between bench1 and bench2: y=-2 to -4
  const wall2Mat = mat(C.brownDark, 0.85);
  for (let i = -3; i <= 3; i++) {
    [[3,i],[-3,i],[i,3],[i,-3]].forEach(([x,z]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.92, wallH, 0.92), wall2Mat);
      b.position.set(x, -3, z);
      b.castShadow = true;
      scene.add(b);
    });
  }
}

// ─── Excavator ──────────────────────────────────────────────
function buildExcavator() {
  excavatorRoot = new THREE.Group();
  excavatorRoot.position.set(-0.5, -6, 0.5);
  excavatorRoot.rotation.y = Math.PI * 0.15; // slight angle toward truck
  scene.add(excavatorRoot);

  // Tracks
  addBox(excavatorRoot, 0.45, 0.38, 2.0, C.darkGrey, -0.75, 0.19, 0);
  addBox(excavatorRoot, 0.45, 0.38, 2.0, C.darkGrey,  0.75, 0.19, 0);
  // Track detail stripes
  for (let i = -0.8; i <= 0.8; i += 0.4) {
    addBox(excavatorRoot, 1.8, 0.08, 0.08, C.black, 0, 0.38, i);
  }

  // Chassis
  addBox(excavatorRoot, 1.5, 0.35, 1.7, C.grey, 0, 0.56, 0);

  // Cab body
  addBox(excavatorRoot, 1.1, 0.85, 1.05, C.yellow, 0, 1.2, 0);
  // Cab roof
  addBox(excavatorRoot, 1.0, 0.14, 0.95, C.yellowDark, 0, 1.69, 0);
  // Window front
  addBox(excavatorRoot, 0.72, 0.42, 0.06, C.windowBlue, 0, 1.15, 0.545);
  // Window side
  addBox(excavatorRoot, 0.06, 0.38, 0.55, C.windowBlue, -0.545, 1.15, 0);

  // Counter-weight (rear block)
  addBox(excavatorRoot, 1.0, 0.45, 0.35, C.grey, 0, 0.97, -0.75);

  // Boom pivot point
  boomPivot = new THREE.Group();
  boomPivot.position.set(0, 1.55, 0.45);
  excavatorRoot.add(boomPivot);

  // Boom (long arm)
  const boom = addBoxGroup(boomPivot, 0.24, 2.2, 0.22, C.yellow, 0, 1.1, 0);

  // Arm pivot at boom tip
  armPivot = new THREE.Group();
  armPivot.position.set(0, 2.2, 0);
  boomPivot.add(armPivot);

  // Arm (dipper)
  addBoxGroup(armPivot, 0.2, 1.4, 0.2, C.yellowDark, 0, 0.7, 0);

  // Bucket pivot at arm tip
  bucketPivot = new THREE.Group();
  bucketPivot.position.set(0, 1.4, 0);
  armPivot.add(bucketPivot);

  // Bucket body
  addBoxGroup(bucketPivot, 0.58, 0.32, 0.44, C.orange, 0, 0.0, 0);
  // Bucket teeth
  for (let t = -0.18; t <= 0.18; t += 0.18) {
    addBoxGroup(bucketPivot, 0.06, 0.12, 0.06, C.grey, t, -0.22, 0);
  }

  // Hydraulic cylinder (decorative)
  addBox(excavatorRoot, 0.07, 1.0, 0.07, C.grey, 0.1, 1.7, 0.48);
}

function addBox(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function addBoxGroup(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// ─── Dump Truck ─────────────────────────────────────────────
function buildDumpTruck() {
  truckRoot = new THREE.Group();
  truckRoot.position.set(3.5, -6, 0.5);
  truckRoot.rotation.y = -Math.PI * 0.5;
  scene.add(truckRoot);

  // Wheels
  const wGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14);
  const wMat = mat(C.black, 0.9);
  const wRimMat = mat(C.grey, 0.5);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.30, 14);

  [[-0.9,-0.38, 0.85],[0.9,-0.38, 0.85],
   [-0.9,-0.38,-0.85],[0.9,-0.38,-0.85]].forEach(([wx,wy,wz]) => {
    const w = new THREE.Mesh(wGeo, wMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    truckRoot.add(w);
    const rim = new THREE.Mesh(rimGeo, wRimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    truckRoot.add(rim);
  });

  // Frame / chassis
  addBox(truckRoot, 1.6, 0.28, 2.1, C.darkGrey, 0, 0.14, 0);

  // Dump bed
  addBox(truckRoot, 1.42, 0.64, 1.5, C.yellow, 0, 0.64, 0.25);
  // Bed sides
  addBox(truckRoot, 0.06, 0.5, 1.5, C.yellowDark, -0.74, 0.78, 0.25);
  addBox(truckRoot, 0.06, 0.5, 1.5, C.yellowDark,  0.74, 0.78, 0.25);
  // Bed rear gate
  addBox(truckRoot, 1.42, 0.5, 0.06, C.yellowDark, 0, 0.78, 1.02);

  // Cab
  addBox(truckRoot, 1.3, 0.78, 0.88, C.red, 0, 0.78, -0.75);
  addBox(truckRoot, 1.2, 0.14, 0.78, C.redDark, 0, 1.25, -0.75);
  // Windshield
  addBox(truckRoot, 0.96, 0.44, 0.06, C.windowBlue, 0, 0.88, -0.32);
  // Side windows
  addBox(truckRoot, 0.06, 0.36, 0.42, C.windowBlue, -0.64, 0.88, -0.66);
  addBox(truckRoot, 0.06, 0.36, 0.42, C.windowBlue,  0.64, 0.88, -0.66);

  // Bull bar
  addBox(truckRoot, 1.28, 0.22, 0.1, C.darkGrey, 0, 0.42, -1.22);

  // Exhaust pipe
  addBox(truckRoot, 0.07, 0.55, 0.07, C.grey, 0.55, 1.28, -0.88);
}

// ─── Atmosphere extras ──────────────────────────────────────
function addAtmosphere() {
  // Floating ore rocks (small decorative blocks near pit edge)
  const deco = [
    [-6, 0.8, -3], [7, 0.8, 2], [-7, 0.8, 5], [5, 0.8, -7],
  ];
  deco.forEach(([x, y, z]) => {
    const sizes = [[2,0.5,1],[1,0.5,2],[1.5,0.5,1.5]];
    const [w,h,d] = sizes[Math.abs(Math.round(x+z))%3];
    place(w, h, d, C.rock, x, y, z, false);
  });

  // Mini VNLOC sign made of yellow blocks near the mine entrance
  buildMiniSign();
}

function buildMiniSign() {
  const signGroup = new THREE.Group();
  signGroup.position.set(-7, 0, -7);
  signGroup.rotation.y = Math.PI * 0.25;
  scene.add(signGroup);

  // Post
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.6, 0.1),
    mat(C.grey)
  );
  post.position.set(0, 0.8, 0);
  signGroup.add(post);

  // Sign board
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.5, 0.08),
    mat(C.yellow)
  );
  board.position.set(0, 1.7, 0);
  signGroup.add(board);
}

// ─── Animation Loop ─────────────────────────────────────────
let orbitAngle = 0;
let truckOffset = 0;
let truckDir = 1;

function loop() {
  raf = requestAnimationFrame(loop);
  const t = clock.getElapsedTime();

  // --- Excavator: boom + arm + bucket animation ---
  if (boomPivot) {
    // Slow dig-cycle: boom raises/lowers
    boomPivot.rotation.x = Math.sin(t * 0.35) * 0.45 - 0.35;
  }
  if (armPivot) {
    armPivot.rotation.x = Math.sin(t * 0.35 + 1.2) * 0.35 + 0.15;
  }
  if (bucketPivot) {
    bucketPivot.rotation.x = Math.sin(t * 0.35 + 2.4) * 0.40;
  }

  // Excavator slight left-right swing
  if (excavatorRoot) {
    excavatorRoot.rotation.y = Math.PI * 0.15 + Math.sin(t * 0.18) * 0.25;
  }

  // --- Dump truck: moves back and forth ---
  if (truckRoot) {
    truckOffset += truckDir * 0.012;
    if (truckOffset > 3.5) truckDir = -1;
    if (truckOffset < 0)   truckDir =  1;
    truckRoot.position.x = 3.5 + truckOffset;
  }

  // --- Slow camera orbit ---
  orbitAngle += 0.0018;
  const R = 30;
  camera.position.x = Math.sin(orbitAngle) * R * 0.75;
  camera.position.z = Math.cos(orbitAngle) * R;
  camera.position.y = 20 + Math.sin(orbitAngle * 0.5) * 2;
  camera.lookAt(0, -3, 0);

  renderer.render(scene, camera);
}

// ─── Resize ─────────────────────────────────────────────────
function resize() {
  const canvas = document.getElementById('legoCanvas');
  if (!canvas || !renderer) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

// ─── Boot ───────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
