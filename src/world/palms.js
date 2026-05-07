import * as THREE from 'three';
import { CFG } from '../config.js';

// InstancedMesh palm grove — N palms = 2 drawcalls (trunks + leaves), not N*8.
// Trunks: one tapered cylinder geometry, instanced.
// Leaves: 7 leaf planes per palm baked into a single fan geometry, instanced.
export function buildPalms(scene) {
  const N = CFG.palms.count;

  // pre-pick valid positions (skip road cross + water + outside ring)
  const positions = [];
  let tries = 0;
  while (positions.length < N && tries < N * 20) {
    tries++;
    const x = (Math.random() - 0.5) * 360;
    const z = (Math.random() - 0.5) * 360;
    if (Math.abs(x) < 8 || Math.abs(z) < 8) continue;
    const wx = x - CFG.water.center[0], wz = z - CFG.water.center[1];
    if (wx * wx + wz * wz < (CFG.water.radius + 6) ** 2) continue;
    if (Math.sqrt(x * x + z * z) > 200) continue;
    positions.push({ x, z, scale: 0.9 + Math.random() * 0.5, rot: Math.random() * Math.PI * 2 });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 4.5, 8);
  trunkGeo.translate(0, 2.25, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.85 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
  trunkInst.castShadow = true;

  // Build a fan of 7 leaf planes baked into one BufferGeometry, once.
  const leafGeo = buildLeafFan(7);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4ea24a, roughness: 0.7, side: THREE.DoubleSide,
  });
  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, positions.length);
  leafInst.castShadow = true;

  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const sV = new THREE.Vector3();
  const tV = new THREE.Vector3();
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    e.set(0, p.rot, 0);
    q.setFromEuler(e);
    sV.setScalar(p.scale);
    tV.set(p.x, 0, p.z);
    m.compose(tV, q, sV);
    trunkInst.setMatrixAt(i, m);
    leafInst.setMatrixAt(i, m);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  leafInst.instanceMatrix.needsUpdate = true;
  scene.add(trunkInst);
  scene.add(leafInst);
}

// 7 leaf rectangles arranged in a fan around the trunk top.
function buildLeafFan(count) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const g = new THREE.PlaneGeometry(2.4, 0.55);
    g.translate(1.2, 0, 0);          // pivot at base of leaf
    g.rotateY(a);
    g.rotateZ(-0.3);                 // droop
    g.translate(0, 4.6, 0);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

// minimal local merge — avoids importing BufferGeometryUtils addon (esm.sh path issues).
function mergeGeometries(geos) {
  let posCount = 0, idxCount = 0;
  for (const g of geos) {
    posCount += g.attributes.position.count;
    if (g.index) idxCount += g.index.count;
  }
  const pos = new Float32Array(posCount * 3);
  const norm = new Float32Array(posCount * 3);
  const uv = new Float32Array(posCount * 2);
  const idx = new Uint32Array(idxCount);
  let pOff = 0, iOff = 0, vOff = 0;
  for (const g of geos) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    const gu = g.attributes.uv.array;
    pos.set(gp, pOff * 3);
    norm.set(gn, pOff * 3);
    uv.set(gu, pOff * 2);
    if (g.index) {
      const gi = g.index.array;
      for (let k = 0; k < gi.length; k++) idx[iOff + k] = gi[k] + pOff;
      iOff += gi.length;
    }
    pOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
