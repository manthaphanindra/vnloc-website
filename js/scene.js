/**
 * VNLOC — scene.js  v8
 * Mine photo on a 130×87 plane (always fills viewport, no black side bars).
 * Camera pans + zooms straight overhead — no tilt.
 * Scroll sequence: hero → open pit → digger → crusher → loading area → wide.
 */
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

// ─── Plane: large enough to fill any viewport, no black edges ─
// At hero height 48, FOV 42°: visible area ~66×37 on 16:9, ~86×37 on 21:9.
// Plane 130×87 comfortably exceeds both → zero black bars.
const W = 200, H = 133;

// ─── Feature centres on the 130×87 plane ─────────────────────
// X = (screen_x_fraction − 0.5) × 130
// Z = (screen_y_fraction − 0.5) × 87   (positive Z = bottom of image)
//   open pit   ≈ screen(0.67, 0.38) → world( 22, -10)
//   digger      ≈ screen(0.72, 0.52) → world( 29,   2)
//   crusher     ≈ screen(0.38, 0.62) → world(-16,  10)
//   loading/haulrk ≈ screen(0.50, 0.55) → world(  0,   4)
// CamZ = lookZ + 2 everywhere → prevents straight-down gimbal lock.

// ─── STORY: [progress, camX, camY, camZ, lookX, lookY, lookZ] ─
const STORY = [
  [0.00,   0, 130,   2,   0,  0,   0],   // wide hero — full image
  [0.12,  22,  95,  -8,  22,  0, -10],   // 1) open pit
  [0.24,  29,  85,   4,  29,  0,   2],   // 2) digger loading trucks
  [0.37, -16,  88,  12, -16,  0,  10],   // 3) crusher plant
  [0.49,   0,  88,   6,   0,  0,   4],   // 4) trucks / loading area
  [0.60,   0, 125,   2,   0,  0,   0],   // pull back — wide overview
  [0.72,   0, 120,   2,   0,  0,   0],   // services
  [0.85,   0, 120,   2,   0,  0,   0],   // values / impact
  [1.00,   0, 128,   2,   0,  0,   0],   // contact
];

let scrollProgress = 0, scrollTarget = 0;
let renderer, scene, camera, composer, clock;
let dustGeo1, dustGeo2, dust1, dust2;

// ─── Boot ────────────────────────────────────────────────────
function init() {
  showLoader();
  clock = new THREE.Clock();

  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  setSize();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1C0A04);

  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 500);
  camera.position.set(0, 48, 2);
  camera.lookAt(0, 0, 0);

  buildScene();

  const mobile = window.matchMedia('(max-width:768px)').matches;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, 0.38, 0.82));
    composer.addPass(new OutputPass());
  }

  window.addEventListener('scroll', () => {
    const maxS = document.body.scrollHeight - window.innerHeight;
    scrollTarget = maxS > 0 ? window.scrollY / maxS : 0;
  }, { passive: true });
  window.addEventListener('resize', setSize);

  hideLoader();
  loop();
}

// ─── Scene ──────────────────────────────────────────────────
function buildScene() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  new THREE.TextureLoader().load(
    'mine.jpg',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy  = renderer.capabilities.getMaxAnisotropy();
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);
    },
    undefined,
    () => {
      // Fallback if mine.jpg missing
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        new THREE.MeshBasicMaterial({ color: 0xC05020 })
      );
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);
      console.warn('mine.jpg not found — save the mine image to the project root.');
    }
  );

  buildDust();
}

// ─── Dust ────────────────────────────────────────────────────
function buildDust() {
  function mkDust(count, color, spread, spreadZ) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * spread;
      pos[i*3+1] =  Math.random() * 6;
      pos[i*3+2] = (Math.random() - 0.5) * spreadZ;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return {
      geo,
      pts: new THREE.Points(geo, new THREE.PointsMaterial({
        color, size: 0.28, transparent: true, opacity: 0.40,
        sizeAttenuation: true, depthWrite: false,
      }))
    };
  }

  // Pit / excavation area
  const d1 = mkDust(300, 0xCC8844, 30, 22);
  dustGeo1 = d1.geo; dust1 = d1.pts;
  dust1.position.set(22, 0.5, -8);
  scene.add(dust1);

  // Plant / loading area
  const d2 = mkDust(180, 0xAA8866, 24, 18);
  dustGeo2 = d2.geo; dust2 = d2.pts;
  dust2.position.set(-12, 0.5, 6);
  scene.add(dust2);
}

function animateDust(geo, speed) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + speed * 0.016);
    if (pos.getY(i) > 6) pos.setY(i, 0);
  }
  pos.needsUpdate = true;
}

// ─── Scroll Camera ───────────────────────────────────────────
const _tv = new THREE.Vector3();
function updateCamera() {
  scrollProgress += (scrollTarget - scrollProgress) * 0.045;
  const p = scrollProgress;
  let i = 0;
  while (i < STORY.length - 2 && STORY[i+1][0] <= p) i++;
  const a = STORY[i], b = STORY[i+1];
  const seg = b[0] - a[0];
  const t = seg > 0 ? smoothstep(Math.max(0, Math.min(1, (p - a[0]) / seg))) : 0;
  camera.position.set(lerp(a[1],b[1],t), lerp(a[2],b[2],t), lerp(a[3],b[3],t));
  _tv.set(lerp(a[4],b[4],t), lerp(a[5],b[5],t), lerp(a[6],b[6],t));
  camera.lookAt(_tv);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }

// ─── Annotations ─────────────────────────────────────────────
function updateAnnotations() {
  const p = scrollProgress;
  const show = (id, when) => {
    const e = document.getElementById(id);
    if (e) e.classList.toggle('visible', when);
  };
  show('ann-exc',     p > 0.10 && p < 0.30);
  show('ann-grade',   p > 0.20 && p < 0.35);
  show('ann-truck',   p > 0.33 && p < 0.48);
  show('ann-crusher', p > 0.45 && p < 0.60);
}

// ─── Loader ──────────────────────────────────────────────────
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
  }, 1400);
}

// ─── Resize ──────────────────────────────────────────────────
function setSize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

// ─── Main loop ───────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  updateCamera();
  updateAnnotations();
  if (dustGeo1) animateDust(dustGeo1, 0.45);
  if (dustGeo2) animateDust(dustGeo2, 0.28);
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
