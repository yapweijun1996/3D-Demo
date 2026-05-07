import * as THREE from 'three';
import { CFG } from './config.js';
import { bindInput } from './input.js';

import { buildSky } from './world/sky.js';
import { buildLighting } from './world/lighting.js';
import { buildPlayground } from './world/playground.js';
import { buildRoads } from './world/roads.js';
import { buildWater } from './world/water.js';
import { buildLandmarks } from './world/landmarks.js';
import { buildBuildings } from './world/buildings.js';
import { buildPalms } from './world/palms.js';
import { buildCones } from './world/cones.js';
import { buildSigns, animateSigns } from './world/signs.js';

import { buildCar } from './vehicle/car.js';
import { createDrive } from './vehicle/drive.js';
import { createFollowCam } from './vehicle/camera.js';

import { initPhysics, stepPhysics } from './physics/rapier-world.js';
import { buildStaticColliders } from './physics/static-colliders.js';
import { buildCarVehicle } from './physics/car-vehicle.js';

import { openModal, closeModal, isOpen } from './ui/modal.js';
import { createStats } from './ui/stats.js';
import { createMinimap } from './ui/minimap.js';
import { maybeBindTouchControls } from './ui/touch-controls.js';
import { createSplash } from './ui/splash.js';

async function main() {
  const splash = createSplash();
  splash.setProgress(0.05, 'initializing renderer...');

  const canvas = document.getElementById('c');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.perf.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.sky);
  scene.fog = new THREE.Fog(CFG.fog.color, CFG.fog.near, CFG.fog.far);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = pmrem.fromScene(makeEnvScene(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, CFG.camera.near, CFG.camera.far);

  // Build all visuals + register legacy colliders for landmarks/cones/signs.
  const tickers = [];
  buildSky(scene);
  buildLighting(scene);
  buildPlayground(scene);
  buildRoads(scene);
  buildWater(scene, tickers);
  tickers.push(...buildLandmarks(scene));
  buildBuildings(scene);
  buildPalms(scene);
  buildCones(scene);
  const signs = buildSigns(scene);

  const car = buildCar(scene);

  splash.setProgress(0.4, 'building scene...');
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
  const followCam = createFollowCam(camera, car);

  bindInput();
  bindStartOverlay();
  maybeBindTouchControls();
  const stats = createStats();
  const minimap = createMinimap(car, signs);

  let now = 0;
  function checkSignTriggers() {
    if (isOpen()) return;
    const cp = car.group.position;
    for (const s of signs) {
      const dx = cp.x - s.position.x, dz = cp.z - s.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < CFG.signTriggerRadius * CFG.signTriggerRadius && now - s.lastTriggered > CFG.signCooldown) {
        s.lastTriggered = Infinity;
        openModal(s, () => { s.lastTriggered = now; });
        break;
      }
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

    if (!isOpen()) {
      drive.tick(dt);                          // applies inputs + updateVehicle (physics path)
      if (physicsReady) stepPhysics();         // integrate physics world
    }
    followCam(dt);
    animateSigns(signs, now, camera);
    for (const tick of tickers) tick(now, dt);
    checkSignTriggers();

    renderer.render(scene, camera);
    minimap.tick();
    stats.tick(dt);
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

main();
