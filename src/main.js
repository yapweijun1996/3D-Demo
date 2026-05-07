import * as THREE from 'three';
import { CFG } from './config.js';
import { bindInput } from './input.js';

import { buildSky } from './world/sky.js';
import { buildLighting } from './world/lighting.js';
import { buildPlayground } from './world/playground.js';
import { buildLand } from './world/land.js';
import { bindDayNight } from './world/daynight-v2.js';
import { buildRoads } from './world/roads.js';
import { buildOSMRoads, projectLatLng } from './world/roads-osm.js';
import { buildCoastline } from './world/coastline.js';
import { buildWater } from './world/water.js';
import { buildLandmarks } from './world/landmarks.js';
import { buildBuildings } from './world/buildings.js';
import { buildPalms } from './world/palms.js';
import { buildCones } from './world/cones.js';
import { buildSigns, animateSigns } from './world/signs.js';

import { buildCar } from './vehicle/car.js';
import { buildCarGLB } from './vehicle/car-glb.js';
import { createDrive } from './vehicle/drive.js';
import { createFollowCam } from './vehicle/camera.js';

import { initPhysics, stepPhysics } from './physics/rapier-world.js';
import { buildStaticColliders } from './physics/static-colliders.js';
import { buildCarVehicle } from './physics/car-vehicle.js';

import { loadAll } from './loaders/glb-cache.js';

import { openModal, closeModal, isOpen } from './ui/modal.js';
import { createStats } from './ui/stats.js';
import { createMinimap } from './ui/minimap.js';
import { maybeBindTouchControls } from './ui/touch-controls.js';
import { createSplash } from './ui/splash.js';

async function main() {
  const splash = createSplash();
  splash.setProgress(0.05, 'initializing renderer...');

  const canvas = document.getElementById('c');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.perf.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = CFG.perf.shadowsEnabled;
  // PCF (not soft) — much cheaper, still acceptable quality at 1024 map
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.sky);
  scene.fog = new THREE.Fog(CFG.fog.color, CFG.fog.near, CFG.fog.far);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  // Procedural fallback env — replaced by daynight.js HDRI when both load.
  scene.environment = pmrem.fromScene(makeEnvScene(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, CFG.camera.near, CFG.camera.far);

  // Pre-load CC0 GLB assets in parallel BEFORE builders run. Failures fall back to procedural.
  splash.setProgress(0.15, 'loading 3D models...');
  let assets = {};
  try {
    assets = await loadAll([
      './assets/glb/cars/sedan.glb',
      './assets/glb/cars/cone.glb',
      './assets/glb/buildings/building-type-c.glb',
      './assets/glb/buildings/building-type-e.glb',
    ], (n, total) => splash.setProgress(0.15 + 0.20 * n / total, `models ${n}/${total}`));
  } catch (err) {
    console.warn('[assets] some GLB failed to load, using procedural fallbacks:', err);
  }

  splash.setProgress(0.4, 'building scene...');
  // Build all visuals + register legacy colliders for landmarks/cones/signs.
  const tickers = [];
  // buildSky removed — was a dusk-gradient sphere that overrode scene.background.
  // sky now comes from scene.background (plain blue Color) set by daynight-v2.
  const lights = buildLighting(scene);
  bindDayNight(scene, renderer, pmrem, lights, tickers);
  // Try OSM first; fall back to handcrafted cross + flat grass if fetch fails
  const osm = await buildOSMRoads(scene);
  const proj = osm?.proj;
  if (proj) {
    await buildLand(scene, proj, osm.bbox);    // ocean plate + real OSM island polygons
    await buildCoastline(scene, proj);         // sand-colored coastline outline ON TOP of land
  } else {
    buildPlayground(scene);                    // fallback flat grass
    buildRoads(scene);                         // fallback handcrafted cross
  }
  buildWater(scene, tickers);
  tickers.push(...buildLandmarks(scene, proj));
  buildBuildings(scene, assets, proj);
  buildPalms(scene);
  buildCones(scene, assets);
  const signs = buildSigns(scene, proj);

  let car;
  if (CFG.car.useGLB) {
    car = await buildCarGLB(scene);
    if (!car) {
      console.warn('[car] GLB load failed, using procedural fallback');
      car = buildCar(scene);
    }
  } else {
    car = buildCar(scene);
  }

  // Physics — try to init Rapier; on failure, fall back to kinematic v0.2 drive.
  let physicsReady = false, carPhys = null, RAPIER = null, world = null;
  if (CFG.physics.enabled) {
    try {
      splash.setProgress(0.55, 'loading physics engine...');
      const ph = await initPhysics();
      RAPIER = ph.RAPIER; world = ph.world;
      buildStaticColliders(RAPIER, world);
      carPhys = buildCarVehicle(RAPIER, world, CFG.car.spawn);
      physicsReady = true;
      splash.setProgress(0.9, 'physics ready');
      console.log('[physics] Rapier ready');
    } catch (err) {
      console.warn('[physics] init failed, falling back to kinematic drive:', err);
      CFG.physics.enabled = false;
    }
  }
  splash.setProgress(1.0, 'go!');
  setTimeout(() => splash.hide(), 200);

  const drive = createDrive(car, physicsReady ? { RAPIER, world, carPhys } : null);
  const getSpeed = () => physicsReady && carPhys?.body
    ? carPhys.body.linvel().x ** 2 + carPhys.body.linvel().z ** 2 ** 0.5
    : 0;
  const followCam = createFollowCam(camera, car, () => {
    if (!physicsReady || !carPhys?.body) return 0;
    const v = carPhys.body.linvel();
    return Math.sqrt(v.x * v.x + v.z * v.z);
  });

  bindInput();
  bindStartOverlay();
  maybeBindTouchControls();
  const stats = createStats(renderer);
  const minimap = createMinimap(car, signs, osm?.minimapSegs);

  let now = 0;
  // Transition-only trigger: a sign fires only when the car CROSSES from outside
  // its zone into inside. Sitting in the zone never re-fires. Drive away then
  // back in to read again.
  function checkSignTriggers() {
    const cp = car.group.position;
    const r2 = CFG.signTriggerRadius * CFG.signTriggerRadius;
    for (const s of signs) {
      const dx = cp.x - s.position.x, dz = cp.z - s.position.z;
      const inZone = (dx * dx + dz * dz) < r2;
      if (inZone && !s.wasInZone && !isOpen()) {
        openModal(s, () => { s.visited = true; });
      }
      s.wasInZone = inZone;
    }
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isOpen()) closeModal();
  });

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  const clock = new THREE.Clock();
  (function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    now += dt;

    let physicsMs = 0;
    if (!isOpen()) {
      drive.tick(dt);                          // inputs + updateVehicle (no sync yet)
      if (physicsReady) {
        const t0 = performance.now();
        stepPhysics();                         // integrate physics world
        physicsMs = performance.now() - t0;
      }
      drive.sync();                            // visual sync from POST-step body state
    }
    followCam(dt);                             // camera reads fresh car.group transform
    animateSigns(signs, now, camera);
    for (const tick of tickers) tick(now, dt);
    checkSignTriggers();

    renderer.render(scene, camera);
    minimap.tick();
    stats.tick(dt, { physicsMs });
    requestAnimationFrame(frame);
  })();
}

function makeEnvScene() {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf2c8a4, side: THREE.BackSide })
  );
  s.add(sky);
  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(50, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4a5a3a, side: THREE.BackSide })
  );
  s.add(ground);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(8, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe6b8 })
  );
  sun.position.set(20, 25, 15);
  s.add(sun);
  return s;
}

function bindStartOverlay() {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  const dismiss = () => {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 250);
  };
  overlay.addEventListener('click', dismiss);
  addEventListener('keydown', (e) => {
    if (['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Space'].includes(e.code)) {
      dismiss();
    }
  });
}

main().catch(err => {
  console.error('[main] FATAL:', err);
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;top:50px;left:50px;background:#fff;color:#c00;padding:20px;z-index:999;max-width:80%;font:12px monospace;white-space:pre-wrap">${err.message}\n\n${err.stack}</pre>`);
});
