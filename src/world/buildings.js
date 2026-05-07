import * as THREE from 'three';
import { CFG } from '../config.js';
import { instanceFromGLB, matricesFromPlacements } from '../loaders/instance-from-glb.js';

// 2-tier ring:
//   Inner ring (HDB high-rises) — procedural tall blocks with window-grid emissive texture
//   Outer ring (suburb) — Kenney City Suburban GLB houses for variety
export function buildBuildings(scene, assets) {
  buildHDBRing(scene);
  buildSuburbRing(scene, assets);
}

// ---------- HDB inner ring (procedural tall blocks) ----------
function buildHDBRing(scene) {
  const { count, ringRadius, ringJitter, minHeight, maxHeight, palette } = CFG.hdb;
  const winTex = makeWindowTexture(7, 22, 0.45);

  // Each block: body cuboid + flat roof + small water-tank cube on top.
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const capGeo = new THREE.BoxGeometry(1.04, 0.06, 1.04);
  const tankGeo = new THREE.BoxGeometry(0.35, 0.18, 0.25);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: winTex, emissiveMap: winTex, emissive: 0xffffff,
    emissiveIntensity: 0.30, roughness: 0.85,
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.85 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x9a8e74, roughness: 0.7 });

  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const caps = new THREE.InstancedMesh(capGeo, capMat, count);
  const tanks = new THREE.InstancedMesh(tankGeo, tankMat, count);
  // Tinting per-instance via instanceColor — variety without N drawcalls
  bodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const t = new THREE.Vector3();
  const sV = new THREE.Vector3();
  const colTmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const r = ringRadius + (Math.random() - 0.5) * ringJitter;
    const w = 18 + Math.random() * 10;
    const h = minHeight + Math.random() * (maxHeight - minHeight);
    const d = 11 + Math.random() * 5;
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e);

    // body
    sV.set(w, h, d); t.set(px, h / 2, pz);
    m.compose(t, q, sV); bodies.setMatrixAt(i, m);

    // cap
    sV.set(w, 1, d); t.set(px, h, pz);
    m.compose(t, q, sV); caps.setMatrixAt(i, m);

    // water tank (bumpy roof detail)
    sV.set(Math.min(w * 0.5, 8), h * 0.05, Math.min(d * 0.5, 5));
    t.set(px, h + 0.18 + sV.y / 2, pz);
    m.compose(t, q, sV); tanks.setMatrixAt(i, m);

    colTmp.set(palette[i % palette.length]).multiplyScalar(0.85 + Math.random() * 0.3);
    bodies.instanceColor.setXYZ(i, colTmp.r, colTmp.g, colTmp.b);
  }
  bodies.instanceMatrix.needsUpdate = true;
  bodies.instanceColor.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  tanks.instanceMatrix.needsUpdate = true;

  bodies.castShadow = true; bodies.receiveShadow = true;
  caps.castShadow = false; tanks.castShadow = false;
  scene.add(bodies); scene.add(caps); scene.add(tanks);
}

// ---------- Suburb outer ring (Kenney GLB) ----------
function buildSuburbRing(scene, assets) {
  const a = assets?.['./assets/glb/buildings/building-type-c.glb'];
  const b = assets?.['./assets/glb/buildings/building-type-e.glb'];
  if (!a || !b) return;

  const { count, ringRadius, ringJitter } = CFG.suburb;
  const placementsA = [], placementsB = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.2;
    const r = ringRadius + (Math.random() - 0.5) * ringJitter;
    const place = {
      x: Math.cos(ang) * r, y: 0, z: Math.sin(ang) * r,
      rotY: -ang + Math.PI / 2 + (Math.random() - 0.5) * 0.5,
      scale: 5 + Math.random() * 2,
    };
    (i % 2 === 0 ? placementsA : placementsB).push(place);
  }
  scene.add(instanceFromGLB(a, matricesFromPlacements(placementsA), { castShadow: false }));
  scene.add(instanceFromGLB(b, matricesFromPlacements(placementsB), { castShadow: false }));
}

// ---------- Window grid texture ----------
function makeWindowTexture(cols, rows, lit) {
  const cellW = 30, cellH = 26;
  const cnv = document.createElement('canvas');
  cnv.width = cols * cellW; cnv.height = rows * cellH;
  const ctx = cnv.getContext('2d');
  // base wall
  ctx.fillStyle = '#bfb6a0'; ctx.fillRect(0, 0, cnv.width, cnv.height);
  // horizontal floor lines
  ctx.fillStyle = '#5e554a';
  for (let r = 1; r < rows; r++) ctx.fillRect(0, r * cellH - 1, cnv.width, 1);
  // windows
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cellW + 5, y = r * cellH + 5;
    const w = cellW - 10, h = cellH - 10;
    const on = Math.random() < lit;
    ctx.fillStyle = on ? '#ffd97a' : '#1f2030';
    ctx.fillRect(x, y, w, h);
    // window frame
    ctx.fillStyle = '#5e554a';
    ctx.fillRect(x + w / 2 - 1, y, 2, h);  // vertical mullion
    if (on) {
      ctx.fillStyle = 'rgba(255,235,180,0.5)';
      ctx.fillRect(x + 2, y + 2, w - 4, 2);
    }
  }
  // balcony rail strip every 4 floors
  ctx.fillStyle = '#7a6e58';
  for (let r = 0; r < rows; r += 4) {
    ctx.fillRect(0, r * cellH + cellH - 5, cnv.width, 3);
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
