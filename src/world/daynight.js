import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { PALETTE } from '../config.js';

// Day ↔ Night with 3s eased lerp.
// What lerps: fog color, sun/hemi/ambient colors + intensities.
// What jump-cuts: scene.background + scene.environment (HDRI textures
//   can't blend without a custom shader; we swap at t=0.5 of the lerp,
//   when the fog/lights are mid-transition so the swap is least visible).

const DAY_HDR   = './assets/hdr/sky_1k.hdr';
const NIGHT_HDR = './assets/hdr/sky_night_1k.hdr';
const LERP_DURATION = 3.0;          // seconds

// Apple HIG: tighter fog band (60–300) pushes far estates into atmospheric
// haze, letting the eye lock on the ~200m around the car. Hemi ground
// darkened so it doesn't repeat the land color (was 0x4a5440 ≈ land —
// killed depth perception).
// Tropical Singapore daylight — diffused, hazy, never deep blue. Real noon
// sun ≈ 100k lux, but humidity/cloud reduce direct component to ~60-75k while
// raising diffuse to ~25-35k. Three.js post-r155 uses physical units so
// directional intensity reads as scaled lux. Hemi lifts so diffuse:direct
// ratio matches; ambient is removed entirely (it stacks on hemi, killing
// contrast). Tonemap exposure pulled to 0.6 so the brighter physical lights
// don't blow out paint and sky.
//
// FogExp2 (set in main.js / config.js) replaces linear Fog so atmospheric
// extinction follows real Mie scattering — slightly warmer milky tropical
// horizon color.
const DAY = {
  fog: { color: 0xb8c8d4, near: 60, far: 300 },     // near/far ignored if FogExp2
  sun: { color: 0xfff4dc, intensity: 2.5 },
  hemi: { sky: PALETTE.sky, ground: 0x3a3830, intensity: 1.8 },
  amb: { color: 0x000000, intensity: 0.0 },         // disabled — hemi covers fill
};
const NIGHT = {
  fog: { color: PALETTE.fogNight, near: 30, far: 180 },
  sun: { color: 0x9bb4d6, intensity: 0.4 },
  hemi: { sky: 0x18243a, ground: 0x0c1018, intensity: 0.45 },
  amb: { color: 0x000000, intensity: 0.0 },
};

export function bindDayNight(scene, renderer, pmrem, lights, tickers) {
  const loader = new RGBELoader();
  let mode = 'day';
  let dayEnv = null, nightEnv = null;
  let dayBg = null,  nightBg = null;

  // Tween state
  let lerpFrom = null, lerpTo = null, lerpT = 1.0;       // t=1 means settled
  let textureSwapped = false;

  const ready = (path) => new Promise((resolve, reject) =>
    loader.load(path, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const envRT = pmrem.fromEquirectangular(tex);
      resolve({ bg: tex, env: envRT.texture });
    }, undefined, reject));

  // Sky backgrounds — plain colors so HDRI sun-glow doesn't dominate the
  // viewport.  HDRI textures are still used for environment (reflections),
  // which is where they belong.
  const DAY_SKY   = new THREE.Color(PALETTE.sky);
  const NIGHT_SKY = new THREE.Color(PALETTE.skyNight);

  Promise.all([ready(DAY_HDR), ready(NIGHT_HDR)]).then(([d, n]) => {
    dayEnv = d.env; dayBg = DAY_SKY;
    nightEnv = n.env; nightBg = NIGHT_SKY;
    scene.environment = dayEnv;
    scene.background = dayBg;
    apply(DAY);
    console.log('[daynight] HDRIs cached for env reflections; sky bg = solid color');
  }).catch(err => console.warn('[daynight] HDRI load failed:', err));

  // Apply a settled state (no lerp).
  function apply(p) {
    if (scene.fog) {
      scene.fog.color.setHex(p.fog.color);
      // Linear Fog has near/far; FogExp2 has only density. Only apply what exists.
      if ('near' in scene.fog) {
        scene.fog.near = p.fog.near;
        scene.fog.far = p.fog.far;
      }
    }
    if (lights?.sun) {
      lights.sun.color.setHex(p.sun.color);
      lights.sun.intensity = p.sun.intensity;
    }
    if (lights?.hemi) {
      lights.hemi.color.setHex(p.hemi.sky);
      lights.hemi.groundColor.setHex(p.hemi.ground);
      lights.hemi.intensity = p.hemi.intensity;
    }
    if (lights?.ambient) {
      lights.ambient.color.setHex(p.amb.color);
      lights.ambient.intensity = p.amb.intensity;
    }
  }

  // ease in-out cubic
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // Frame ticker — interpolate between lerpFrom and lerpTo over LERP_DURATION.
  const tick = (now, dt) => {
    if (lerpT >= 1.0) return;
    lerpT = Math.min(1, lerpT + dt / LERP_DURATION);
    const e = ease(lerpT);

    const a = lerpFrom, b = lerpTo;
    if (scene.fog) {
      scene.fog.color.setHex(a.fog.color).lerp(new THREE.Color(b.fog.color), e);
      if ('near' in scene.fog) {
        scene.fog.near = a.fog.near + (b.fog.near - a.fog.near) * e;
        scene.fog.far = a.fog.far + (b.fog.far - a.fog.far) * e;
      }
    }
    if (lights?.sun) {
      lights.sun.color.setHex(a.sun.color).lerp(new THREE.Color(b.sun.color), e);
      lights.sun.intensity = a.sun.intensity + (b.sun.intensity - a.sun.intensity) * e;
    }
    if (lights?.hemi) {
      lights.hemi.color.setHex(a.hemi.sky).lerp(new THREE.Color(b.hemi.sky), e);
      lights.hemi.groundColor.setHex(a.hemi.ground).lerp(new THREE.Color(b.hemi.ground), e);
      lights.hemi.intensity = a.hemi.intensity + (b.hemi.intensity - a.hemi.intensity) * e;
    }
    if (lights?.ambient) {
      lights.ambient.color.setHex(a.amb.color).lerp(new THREE.Color(b.amb.color), e);
      lights.ambient.intensity = a.amb.intensity + (b.amb.intensity - a.amb.intensity) * e;
    }

    // Swap HDRI textures at the midpoint — fog is dim there so swap is least visible.
    if (!textureSwapped && lerpT >= 0.5) {
      const goingNight = lerpTo === NIGHT;
      scene.environment = goingNight ? nightEnv : dayEnv;
      scene.background  = goingNight ? nightBg  : dayBg;
      textureSwapped = true;
    }
  };
  if (tickers) tickers.push(tick); else console.warn('[daynight] no tickers — lerp disabled');

  function startLerp(target) {
    if (!dayEnv || !nightEnv) return;          // not ready yet
    if (mode === target) return;
    lerpFrom = mode === 'day' ? DAY : NIGHT;
    lerpTo   = target === 'day' ? DAY : NIGHT;
    lerpT = 0;
    textureSwapped = false;
    mode = target;
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') startLerp(mode === 'day' ? 'night' : 'day');
  });

  const api = {
    get mode() { return mode; },
    get lerping() { return lerpT < 1; },
    // 0 = full day, 1 = full night, smoothly eased during transitions.
    // Buildings/lampposts read this each frame to drive emissive intensity
    // so window-grid glow fades in with the sky going dark.
    get phase() {
      if (lerpT >= 1.0) return mode === 'night' ? 1 : 0;
      const e = ease(lerpT);
      return lerpTo === NIGHT ? e : 1 - e;
    },
    // Programmatic toggle for dev tooling — bypasses isTrusted checks.
    setMode(target) { startLerp(target === 'night' ? 'night' : 'day'); },
  };
  return api;
}
