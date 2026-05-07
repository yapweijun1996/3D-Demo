import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Day ↔ Night toggle.  T key swaps HDRI sky + reflections, dims direct
// light, and warms ambient.  Jump-cut (no lerp) — keep code simple,
// add easing later if requested.
//
// Lights are passed in by reference from world/lighting.js (return value).
// If lighting.js doesn't return them, we no-op gracefully.

const DAY_HDR   = './assets/hdr/sky_1k.hdr';
const NIGHT_HDR = './assets/hdr/sky_night_1k.hdr';

const FOG_DAY   = { color: 0xb6cee0, near: 60,  far: 280 };
const FOG_NIGHT = { color: 0x10182a, near: 40,  far: 200 };

const SUN_DAY   = { color: 0xfff2d6, intensity: 1.2 };
const SUN_NIGHT = { color: 0x9bb4d6, intensity: 0.18 };  // moonlight

const HEMI_DAY   = { sky: 0xc8dcef, ground: 0x4a5440, intensity: 0.40 };
const HEMI_NIGHT = { sky: 0x18243a, ground: 0x0c1018, intensity: 0.25 };

const AMB_DAY   = { color: 0x9bb4cf, intensity: 0.15 };
const AMB_NIGHT = { color: 0x404a72, intensity: 0.30 };

export function bindDayNight(scene, renderer, pmrem, lights) {
  const loader = new RGBELoader();
  let mode = 'day';
  let dayEnv = null, nightEnv = null;
  let dayBg = null,  nightBg = null;

  // Day already loaded by main.js.  Capture once HDRI lands by reading
  // scene.environment / scene.background after the first frame.
  // Simpler: load both ourselves.
  const ready = (path) => new Promise((resolve, reject) =>
    loader.load(path, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const envRT = pmrem.fromEquirectangular(tex);
      resolve({ bg: tex, env: envRT.texture });
    }, undefined, reject));

  Promise.all([ready(DAY_HDR), ready(NIGHT_HDR)]).then(([d, n]) => {
    dayEnv = d.env; dayBg = d.bg;
    nightEnv = n.env; nightBg = n.bg;
    apply('day');                    // set initial state from cached textures
    console.log('[daynight] both HDRIs cached, T to toggle');
  }).catch(err => console.warn('[daynight] HDRI load failed:', err));

  function apply(next) {
    mode = next;
    const isDay = mode === 'day';
    if (isDay && dayEnv) { scene.environment = dayEnv; scene.background = dayBg; }
    if (!isDay && nightEnv) { scene.environment = nightEnv; scene.background = nightBg; }

    const fog = isDay ? FOG_DAY : FOG_NIGHT;
    if (scene.fog) {
      scene.fog.color.setHex(fog.color);
      scene.fog.near = fog.near;
      scene.fog.far  = fog.far;
    }

    if (lights?.sun) {
      const s = isDay ? SUN_DAY : SUN_NIGHT;
      lights.sun.color.setHex(s.color);
      lights.sun.intensity = s.intensity;
    }
    if (lights?.hemi) {
      const h = isDay ? HEMI_DAY : HEMI_NIGHT;
      lights.hemi.color.setHex(h.sky);
      lights.hemi.groundColor.setHex(h.ground);
      lights.hemi.intensity = h.intensity;
    }
    if (lights?.ambient) {
      const a = isDay ? AMB_DAY : AMB_NIGHT;
      lights.ambient.color.setHex(a.color);
      lights.ambient.intensity = a.intensity;
    }
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') apply(mode === 'day' ? 'night' : 'day');
  });

  return { apply, get mode() { return mode; } };
}
