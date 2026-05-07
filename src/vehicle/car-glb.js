import * as THREE from 'three';
import { loadGLB } from '../loaders/glb-cache.js';
import { CFG } from '../config.js';

// Load Kenney sedan.glb which has separate wheel meshes (named wheel-front-left
// etc) that we extract into their own groups so drive.js can spin them.
//
// Returns { group, wheels: [{ group, tire, isFront }] } — same shape as procedural buildCar.
export async function buildCarGLB(scene) {
  const C = CFG.car;
  const path = C.glbPath || './assets/glb/cars/sedan.glb';
  const scale = C.glbScale || 1.8;

  const root = new THREE.Group();
  root.position.set(...C.spawn);
  scene.add(root);

  let gltf;
  try {
    gltf = await loadGLB(path);
  } catch (err) {
    console.warn('[car-glb] failed to load', path, err);
    return null;
  }

  // Clone scene so multiple createDrive() calls (defensive) don't share geometry handles
  const sceneCopy = gltf.scene.clone(true);

  // Wrap to apply uniform scale + axis-fix
  const wrap = new THREE.Group();
  wrap.scale.setScalar(scale);
  // Kenney sedan uses +X = LEFT convention (front-right has x=-0.3). Flip X to make +X=right.
  wrap.scale.x *= -1;
  root.add(wrap);

  // Find body mesh + 4 wheel meshes by name
  const wheels = [];
  let bodyMesh = null;
  const namedNodes = {};
  sceneCopy.traverse(o => {
    if (o.name === 'body') bodyMesh = o;
    if (o.name?.startsWith('wheel-')) namedNodes[o.name] = o;
  });

  if (!bodyMesh) {
    console.warn('[car-glb] no body mesh found, returning null');
    return null;
  }

  // Detach body from sceneCopy and add to wrap
  if (bodyMesh.parent) bodyMesh.parent.remove(bodyMesh);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  // Upgrade body to metallic paint so HDRI gives clear coat reflections.
  // Kenney GLB bakes color via vertex colors / textures — keep them, just
  // tweak the standard material parameters.
  bodyMesh.traverse(o => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.isMeshStandardMaterial) {
          m.metalness = 0.55;
          m.roughness = 0.42;
          m.envMapIntensity = 1.1;
          m.needsUpdate = true;
        }
      }
    }
  });
  wrap.add(bodyMesh);

  // Extract each wheel into its own steering group + spinning tire
  // Order matters: must match Rapier wheel anchor order (FR=0, FL=1, RR=2, RL=3)
  const wheelOrder = ['wheel-front-right', 'wheel-front-left', 'wheel-back-right', 'wheel-back-left'];
  for (const name of wheelOrder) {
    const wheelMesh = namedNodes[name];
    if (!wheelMesh) continue;
    const localPos = wheelMesh.position.clone();
    if (wheelMesh.parent) wheelMesh.parent.remove(wheelMesh);
    wheelMesh.castShadow = true;
    // wrap each wheel in a steering group that lives at the wheel's anchor point
    const sg = new THREE.Group();
    sg.position.copy(localPos);
    wheelMesh.position.set(0, 0, 0);
    sg.add(wheelMesh);
    wrap.add(sg);
    wheels.push({ group: sg, tire: wheelMesh, isFront: name.startsWith('wheel-front'), name });
  }

  return { group: root, wheels };
}
