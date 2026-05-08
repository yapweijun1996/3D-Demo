import * as THREE from 'three';
import { CFG } from './config.js';
import { bindInput } from './input.js';

import { buildClouds } from './world/clouds.js';
import { buildLighting } from './world/lighting.js';
import { buildPlayground } from './world/playground.js';
import { buildLand } from './world/land.js';
import { bindDayNight } from './world/daynight.js';
import { buildRoads } from './world/roads.js';
import { buildOSMRoads, projectLatLng } from './world/roads-osm.js';
import { buildCoastline } from './world/coastline.js';
import { buildWater } from './world/water.js';
import { buildLandmarks } from './world/landmarks.js';
import { buildSGLandmarks } from './world/landmarks-sg.js';
import { buildBuildings } from './world/buildings.js';
import { buildPalms } from './world/palms.js';
import { buildCones } from './world/cones.js';
import { buildSigns, animateSigns } from './world/signs.js';
import { buildStreetLamps } from './world/street-furniture.js';
import { buildTraffic } from './world/traffic.js';

import { buildCar } from './vehicle/car.js';
import { buildCarGLB } from './vehicle/car-glb.js';
import { createDrive } from './vehicle/drive.js';
import { createFollowCam } from './vehicle/camera.js';
import { createExhaust } from './vehicle/exhaust.js';

import { initPhysics, stepPhysics } from './physics/rapier-world.js';
import { buildStaticColliders } from './physics/static-colliders.js';
import { buildCarVehicle } from './physics/car-vehicle.js';

import { loadAll } from './loaders/glb-cache.js';

import { openModal, closeModal, isOpen } from './ui/modal.js';
import { createStats } from './ui/stats.js';
import { createMinimap } from './ui/minimap.js';
import { maybeBindTouchControls } from './ui/touch-controls.js';
import { createSplash } from './ui/splash.js';
import { createSpeedometer } from './ui/speedometer.js';
import { createControlsHint } from './ui/hud.js';
import { createInfoBar } from './ui/info-bar.js';
import { createDistrictBanner } from './ui/district-banner.js';

import { buildPostFX } from './render/postfx.js';

async function main() {
  const splash = createSplash();
  splash.setProgress(0.05, 'initializing renderer...');

  const canvas = document.getElementById('c');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.perf.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = CFG.perf.shadowsEnabled;
  // VSM gives soft variance shadows that match a diffused tropical sun;
  // PCF would render hard knife-edge shadows that read as "video-game" sun.
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Pulled down from 1.0 because directional/hemi lights are now in
  // physical-units range (DirectionalLight intensity 2.5). Without this
  // the scene blows out and paint glows.
  renderer.toneMappingExposure = 0.6;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.sky);
  // FogExp2 with density tuned so ~50% extinction at 150m, full milky at
  // ~400m — matches Mie scattering better than the previous linear fog.
  scene.fog = new THREE.FogExp2(0xb8c8d4, 0.0045);

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
  // sky comes from scene.background (plain blue Color) set by daynight-v2.
  // Clouds = a few drifting alpha-textured planes overhead — gives day texture.
  buildClouds(scene, tickers);
  const lights = buildLighting(scene);
  const dayNight = bindDayNight(scene, renderer, pmrem, lights, tickers);
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
  await buildSGLandmarks(scene, proj);
  const buildings = buildBuildings(scene, assets, proj, osm?.ways);
  buildPalms(scene, osm?.ways, proj);
  buildCones(scene, assets);
  const signs = buildSigns(scene, proj);
  const lamps = (osm?.ways && proj) ? buildStreetLamps(scene, osm.ways, proj) : null;
  const traffic = (osm?.ways && proj)
    ? buildTraffic(scene, osm.ways, proj, { count: 40, getPlayerPos: () => car.group.position })
    : null;

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
  const exhaust = createExhaust(car);

  bindInput();
  bindStartOverlay();
  maybeBindTouchControls();
  const stats = createStats(renderer);
  const minimap = createMinimap(car, signs, osm?.minimapSegs);
  const speedo = createSpeedometer();
  createControlsHint();
  const infoBar = createInfoBar({ totalLandmarks: signs.length });
  const districtBanner = createDistrictBanner(car);
  const visited = new Set();

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
        openModal(s, () => {
          s.visited = true;
          visited.add(s.id);
          infoBar.setVisited(visited);
        });
      }
      s.wasInZone = inZone;
    }
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isOpen()) closeModal();
  });

  const postfx = buildPostFX(renderer, scene, camera);

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    postfx.setSize(innerWidth, innerHeight);
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
    followCam(dt, drive.state);                // camera reads fresh car.group transform + boost shake
    exhaust.tick(drive.state);
    animateSigns(signs, now, camera);
    for (const tick of tickers) tick(now, dt);
    checkSignTriggers();

    // Drive HDB window glow with day/night phase — windows fade ON at dusk.
    if (buildings?.bodyMat) {
      buildings.bodyMat.emissiveIntensity = 0.05 + 1.75 * dayNight.phase;
    }
    // CBD glass tower windows ramp on the same curve.
    if (scene.userData.cbdWindowsMat) {
      scene.userData.cbdWindowsMat.emissiveIntensity = 0.05 + 2.4 * dayNight.phase;
    }
    if (lamps) lamps.tick(now, dayNight);
    if (traffic) traffic.tick(now, dt);
    if (scene.userData.palmWindUniforms) scene.userData.palmWindUniforms.uTime.value = now;

    postfx.render();
    minimap.tick();
    speedo.tick(drive.state);
    infoBar.tickDayNight(dayNight.phase);
    districtBanner.tick(dt);
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
