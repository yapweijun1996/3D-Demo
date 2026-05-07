import * as THREE from 'three';
import { loadGLB } from '../loaders/glb-cache.js';
import { CFG } from '../config.js';

// Load the Khronos ToyCar.glb (real PBR materials) and adapt as the player car.
// ToyCar is a single mesh (no separate wheels) — wheel spinning is sacrificed
// for a true PBR look (reflective paint, glass, fabric interior).
//
// Returns same shape as buildCar: { group, wheels: [] }.
// Empty wheels[] means drive.js sync gracefully no-ops on wheel transforms.
export async function buildCarGLB(scene) {
  const C = CFG.car;
  const group = new THREE.Group();
  group.position.set(...C.spawn);
  scene.add(group);

  let gltf;
  try {
    gltf = await loadGLB('./assets/glb/cars-pbr/ToyCar.glb');
  } catch (err) {
    console.warn('[car-glb] failed to load ToyCar:', err);
    return null;
  }

  // ToyCar is a tiny ~3-toy-cm model — bake it to a real 4m sedan.
  // Source bbox (from glb inspection): X 187u, Y 384u, Z 116u (Y is length).
  // Re-orient so length aligns with +Z (drive direction) and height with +Y.
  const wrap = gltf.scene.clone();
  wrap.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  // ToyCar's Y is forward in source frame → rotate -90° around X to make forward = +Z, up = +Y.
  wrap.rotation.x = -Math.PI / 2;
  // Scale to a clearly visible "real car" size — ~6m long for game-readable.
  // 384 source-units * 0.018 = ~6.9m long, ~3.4m wide, ~2m tall.
  wrap.scale.setScalar(0.018);
  // Lift so wheels sit roughly on ground (ToyCar origin is offset).
  wrap.position.y = 1.0;

  group.add(wrap);

  // Provide an empty wheels array so drive.js sync does no per-wheel work
  return { group, wheels: [] };
}
