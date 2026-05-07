import * as THREE from 'three';
import { loadGLB } from '../loaders/glb-cache.js';
import { CFG } from '../config.js';

// GLB car loader supporting two naming conventions:
//
//   1. Kenney Car Kit (sedan.glb) — 4 separate wheel nodes named
//      'wheel-front-right', 'wheel-front-left', 'wheel-back-right',
//      'wheel-back-left'.  One Rapier wheel per visual node.  Body node = 'body'.
//
//   2. Quaternius Cars Bundle (sedan.glb) — 2 wheel-pair nodes named
//      'FrontWheels' and 'BackWheels' (each mesh contains both L+R wheels
//      baked together).  Body node = 'Car_Dook' or first non-wheel node.
//      Adapter maps each pair to TWO Rapier wheels (steering = avg, spin =
//      shared).  Visually wheels pair-rotate but suspension is averaged.
//
// drive.js sees the same { group, wheels: [...] } shape; for paired wheels
// the same `group` ref appears twice (FR + FL share the FrontWheels group),
// so the last writer wins per frame — fine because Rapier sym wheels
// produce identical suspension/steer values.
//
// Returns { group, wheels: [{ group, tire, isFront }] }.
export async function buildCarGLB(scene) {
  const C = CFG.car;
  const path = C.glbPath || './assets/glb/cars/sedan.glb';
  const scale = C.glbScale || 1.8;
  const flipX = C.glbFlipX !== false;          // default true (Kenney convention)

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

  const sceneCopy = gltf.scene.clone(true);
  const wrap = new THREE.Group();
  wrap.scale.setScalar(scale);
  if (flipX) wrap.scale.x *= -1;
  root.add(wrap);

  // Detect convention from node names.
  const named = {};
  sceneCopy.traverse(o => { if (o.name) named[o.name] = o; });

  let wheels;
  if (named['body'] && Object.keys(named).some(n => n.startsWith('wheel-'))) {
    wheels = extractKenney(wrap, named);
  } else if (named['FrontWheels'] && named['BackWheels']) {
    wheels = extractQuaternius(wrap, named);
  } else {
    console.warn('[car-glb] unrecognised wheel layout — nodes:', Object.keys(named));
    return null;
  }

  applyPbrPaint(wrap);
  return { group: root, wheels };
}

// Kenney: 4 separate wheel nodes, each gets its own steering group.
function extractKenney(wrap, named) {
  const body = named['body'];
  if (body.parent) body.parent.remove(body);
  body.castShadow = body.receiveShadow = true;
  wrap.add(body);

  const order = ['wheel-front-right', 'wheel-front-left', 'wheel-back-right', 'wheel-back-left'];
  const wheels = [];
  for (const name of order) {
    const w = named[name];
    if (!w) continue;
    const localPos = w.position.clone();
    if (w.parent) w.parent.remove(w);
    w.castShadow = true;
    const sg = new THREE.Group();
    sg.position.copy(localPos);
    w.position.set(0, 0, 0);
    sg.add(w);
    wrap.add(sg);
    wheels.push({ group: sg, tire: w, isFront: name.startsWith('wheel-front'), name });
  }
  return wheels;
}

// Quaternius: 2 wheel-pair nodes — map each pair to 2 Rapier wheels by
// duplicating the group reference.  drive.js writes the same group twice;
// since L/R Rapier wheels mirror, last-writer-wins is fine.
function extractQuaternius(wrap, named) {
  // Body = the non-wheel mesh node (Car_Dook, Cop_Cube, etc).
  const body = Object.values(named).find(n =>
    n.isMesh && !/Wheels?/i.test(n.name) && n.name !== 'RootNode'
  );
  if (body) {
    if (body.parent) body.parent.remove(body);
    body.castShadow = body.receiveShadow = true;
    wrap.add(body);
  }

  const front = named['FrontWheels'];
  const back = named['BackWheels'];

  function liftPair(node) {
    const localPos = node.position.clone();
    if (node.parent) node.parent.remove(node);
    node.castShadow = true;
    const sg = new THREE.Group();
    sg.position.copy(localPos);
    node.position.set(0, 0, 0);
    sg.add(node);
    wrap.add(sg);
    return { group: sg, tire: node };
  }

  const f = liftPair(front);
  const b = liftPair(back);

  // FR=0, FL=1, RR=2, RL=3 — front pair shared, back pair shared.
  return [
    { group: f.group, tire: f.tire, isFront: true,  name: 'FrontWheels-R' },
    { group: f.group, tire: f.tire, isFront: true,  name: 'FrontWheels-L' },
    { group: b.group, tire: b.tire, isFront: false, name: 'BackWheels-R' },
    { group: b.group, tire: b.tire, isFront: false, name: 'BackWheels-L' },
  ];
}

// Upgrade flat MeshStandardMaterial to MeshPhysicalMaterial with a clearcoat
// gloss layer. Same base color/map preserved; the clearcoat adds the wet
// showroom-shine that distinguishes a real car from a toy. envMapIntensity
// boosted so the HDRI sky reflects sharply across the body.
//
// Wheels (separate meshes) get the same clearcoat treatment but a different
// base — high metalness rim plus rough rubber mixes naturally because Kenney
// wheels are a single mesh. Tradeoff: rims glint a bit too much. Acceptable.
function applyPbrPaint(group) {
  group.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const swap = [];
    for (const m of mats) {
      if (!m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
        swap.push(m);
        continue;
      }
      const phys = new THREE.MeshPhysicalMaterial({
        color: m.color,
        map: m.map,
        normalMap: m.normalMap,
        roughnessMap: m.roughnessMap,
        metalnessMap: m.metalnessMap,
        emissive: m.emissive,
        emissiveMap: m.emissiveMap,
        metalness: 0.85,
        roughness: 0.35,
        envMapIntensity: 1.6,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      });
      swap.push(phys);
      m.dispose();
    }
    o.material = Array.isArray(o.material) ? swap : swap[0];
    o.castShadow = true;
  });
}
