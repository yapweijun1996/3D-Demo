import * as THREE from 'three';
import { CFG } from '../config.js';
import { instanceFromGLB, matricesFromPlacements } from '../loaders/instance-from-glb.js';

// HDB blocks placed at REAL Singapore neighborhoods (Toa Payoh, Bishan, Ang Mo Kio,
// Tampines, Jurong East, Woodlands), via projectLatLng from roads-osm.
// Falls back to one big procedural ring if proj not available.
export function buildBuildings(scene, assets, proj) {
  if (proj) buildHDBClusters(scene, proj);
  else      buildHDBFallbackRing(scene);
  buildSuburbRing(scene, assets, proj);
}

function buildHDBClusters(scene, proj) {
  const { clusters, minHeight, maxHeight, palette } = CFG.hdb;
  const totalCount = clusters.reduce((s, c) => s + c.count, 0);
  const winTex = makeWindowTexture(7, 22, 0.45);

  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const capGeo = new THREE.BoxGeometry(1.04, 0.06, 1.04);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: winTex, emissiveMap: winTex, emissive: 0xffffff,
    emissiveIntensity: 0.30, roughness: 0.85,
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.85 });

  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, totalCount);
  const caps = new THREE.InstancedMesh(capGeo, capMat, totalCount);
  bodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalCount * 3), 3);

  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const t = new THREE.Vector3();
  const sV = new THREE.Vector3();
  const colTmp = new THREE.Color();
  let i = 0;

  for (const cluster of clusters) {
    const [cx, cz] = proj(cluster.latLng[0], cluster.latLng[1]);
    for (let k = 0; k < cluster.count; k++) {
      // place around cluster center with small jitter
      const a = (k / cluster.count) * Math.PI * 2 + Math.random() * 0.6;
      const r = cluster.spread * (0.4 + Math.random() * 0.6);
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      const w = 18 + Math.random() * 8;
      const h = minHeight + Math.random() * (maxHeight - minHeight);
      const d = 11 + Math.random() * 4;
      const rot = Math.random() * Math.PI * 2;

      e.set(0, rot, 0); q.setFromEuler(e);
      sV.set(w, h, d); t.set(px, h / 2, pz);
      m.compose(t, q, sV); bodies.setMatrixAt(i, m);

      sV.set(w, 1, d); t.set(px, h, pz);
      m.compose(t, q, sV); caps.setMatrixAt(i, m);

      colTmp.set(palette[i % palette.length]).multiplyScalar(0.85 + Math.random() * 0.3);
      bodies.instanceColor.setXYZ(i, colTmp.r, colTmp.g, colTmp.b);
      i++;
    }
  }
  bodies.instanceMatrix.needsUpdate = true;
  bodies.instanceColor.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  bodies.castShadow = false; bodies.receiveShadow = true;
  caps.castShadow = false;
  scene.add(bodies); scene.add(caps);
}

function buildHDBFallbackRing(scene) {
  // Simple ring fallback (used only if OSM proj missing — unusual)
  const N = 18;
  const winTex = makeWindowTexture(5, 18, 0.4);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
  const t = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 140;
    const w = 18, h = 50, d = 12;
    e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e);
    s.set(w, h, d); t.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.compose(t, q, s); inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
}

function buildSuburbRing(scene, assets, proj) {
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

function makeWindowTexture(cols, rows, lit) {
  const cellW = 30, cellH = 26;
  const cnv = document.createElement('canvas');
  cnv.width = cols * cellW; cnv.height = rows * cellH;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#bfb6a0'; ctx.fillRect(0, 0, cnv.width, cnv.height);
  ctx.fillStyle = '#5e554a';
  for (let r = 1; r < rows; r++) ctx.fillRect(0, r * cellH - 1, cnv.width, 1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cellW + 5, y = r * cellH + 5, w = cellW - 10, h = cellH - 10;
    const on = Math.random() < lit;
    ctx.fillStyle = on ? '#ffd97a' : '#1f2030';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#5e554a';
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    if (on) { ctx.fillStyle = 'rgba(255,235,180,0.5)'; ctx.fillRect(x + 2, y + 2, w - 4, 2); }
  }
  ctx.fillStyle = '#7a6e58';
  for (let r = 0; r < rows; r += 4) ctx.fillRect(0, r * cellH + cellH - 5, cnv.width, 3);
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
