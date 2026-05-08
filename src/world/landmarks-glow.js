// SSOT for "this material gets brighter at night" wiring across all
// landmarks. Each entry: scene.userData[key] is the material; emissive
// intensity = base + scale * dayNight.phase (phase 0=day, 1=night).
//
// To add a new emissive landmark feature:
//   1. expose the material via group.userData.<name> in createXxx()
//   2. wire in landmarks-sg.js buildSGLandmarks: scene.userData.<key> = ...
//   3. add an entry below.
//
// main.js calls applyLandmarkGlow(scene, dayNight.phase) once per frame.

export const GLOW_TABLE = Object.freeze([
  { key: 'cbdWindowsMat',     base: 0.05, scale: 2.4 },   // CBD glass towers
  { key: 'flyerCapsuleMat',   base: 0.25, scale: 1.6 },   // Flyer capsule pods
  { key: 'supertreeLedMat',   base: 0.15, scale: 2.2 },   // Supertree LED bands
  { key: 'mbsPoolMat',        base: 0.15, scale: 1.3 },   // MBS infinity pool
  { key: 'helixTubeMatA',     base: 0.05, scale: 1.8 },   // Helix red tube
  { key: 'helixTubeMatB',     base: 0.05, scale: 1.8 },   // Helix blue tube
]);

export function applyLandmarkGlow(scene, phase) {
  for (const e of GLOW_TABLE) {
    const mat = scene.userData[e.key];
    if (mat) mat.emissiveIntensity = e.base + e.scale * phase;
  }
}
