import * as THREE from 'three';
import { walkAtSpacing } from './road-emitter.js';

// Procedural street lamps along OSM ways. Single InstancedMesh handles all
// lamps citywide → 1-2 drawcalls total.
//
// Lamp geometry: 5m tall cylinder pole (charcoal) with a 0.5m box head
// (warm white emissive). Two materials, two InstancedMesh batches sharing
// the same per-instance matrix table.
//
// dayNight integration: caller passes a phaseRef that's read each frame to
// drive the head emissiveIntensity (0 day → 1 night). Returns a tick(now)
// hook for main.js to call once per frame.

const LAMP_HEIGHT = 5.0;
const POLE_RADIUS = 0.08;
const HEAD_W = 0.5;
const HEAD_H = 0.35;
const HEAD_D = 0.5;

export function buildStreetLamps(scene, ways, project, opts) {
  const {
    intervalMeters = 30,
    allowedTiers = ['motorway', 'trunk', 'primary', 'secondary'],
    sideOffset = 5.0,            // perpendicular distance from way centerline
  } = opts || {};

  const allowed = new Set(allowedTiers);
  const filtered = ways.filter(w => allowed.has(w.t));

  // First pass — count instances so we can size InstancedMesh exactly.
  const matrices = [];
  walkAtSpacing(filtered, project, intervalMeters, ({ x, z, perpX, perpZ, k }) => {
    const side = (k % 2) ? 1 : -1;       // alternate left / right
    const px = x + perpX * sideOffset * side;
    const pz = z + perpZ * sideOffset * side;
    const m = new THREE.Matrix4();
    m.setPosition(px, 0, pz);
    matrices.push(m);
  });

  if (matrices.length === 0) return { tick: () => {}, count: 0 };

  const poleGeo = new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS, LAMP_HEIGHT, 6);
  poleGeo.translate(0, LAMP_HEIGHT / 2, 0);    // base at y=0
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a30, roughness: 0.8, metalness: 0.4,
  });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, matrices.length);
  poles.castShadow = false;
  poles.frustumCulled = false;

  const headGeo = new THREE.BoxGeometry(HEAD_W, HEAD_H, HEAD_D);
  headGeo.translate(0, LAMP_HEIGHT - HEAD_H / 2, 0);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c0, roughness: 0.4, metalness: 0.0,
    emissive: 0xffd9a0, emissiveIntensity: 0.05,
  });
  const heads = new THREE.InstancedMesh(headGeo, headMat, matrices.length);
  heads.frustumCulled = false;

  for (let i = 0; i < matrices.length; i++) {
    poles.setMatrixAt(i, matrices[i]);
    heads.setMatrixAt(i, matrices[i]);
  }
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;

  scene.add(poles);
  scene.add(heads);

  // Phase-driven emissive ramp. Read whatever object/getter caller hands us.
  function tick(now, dayNight) {
    if (!dayNight) return;
    const phase = dayNight.phase ?? 0;        // 0 day, 1 night
    headMat.emissiveIntensity = 0.05 + 1.85 * phase;
  }

  return { tick, count: matrices.length, headMat };
}
