import * as THREE from 'three';
import { CFG } from '../config.js';

// HDB ring as 2 InstancedMesh (towers + caps). One canvas window texture shared.
function makeWindowTexture(cols = 5, rows = 18, lit = 0.4) {
  const cellW = 32, cellH = 28;
  const cnv = document.createElement('canvas');
  cnv.width = cols * cellW; cnv.height = rows * cellH;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#c8bfa6'; ctx.fillRect(0, 0, cnv.width, cnv.height);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + 6, y = r * cellH + 6;
      const w = cellW - 12, h = cellH - 12;
      const on = Math.random() < lit;
      ctx.fillStyle = on ? '#ffd97a' : '#34384a';
      ctx.fillRect(x, y, w, h);
      if (on) { ctx.fillStyle = 'rgba(255,235,180,0.6)'; ctx.fillRect(x + 2, y + 2, w - 4, 2); }
    }
  }
  ctx.fillStyle = '#9a8e74';
  for (let r = 0; r < rows; r++) ctx.fillRect(0, r * cellH + cellH - 4, cnv.width, 2);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildBuildings(scene) {
  const { count, ringRadius, ringJitter } = CFG.hdb;
  const winTex = makeWindowTexture();
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);  // unit box, scaled per-instance
  const towerMat = new THREE.MeshStandardMaterial({
    map: winTex, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 0.25,
    roughness: 0.85,
  });
  const capGeo = new THREE.BoxGeometry(1, 1, 1);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x5a5460, roughness: 0.8 });

  const towers = new THREE.InstancedMesh(towerGeo, towerMat, count);
  const caps = new THREE.InstancedMesh(capGeo, capMat, count);
  // distant — receive but don't cast shadow (perf)
  towers.castShadow = false; towers.receiveShadow = true;
  caps.castShadow = false;

  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const t = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.15;
    const r = ringRadius + (Math.random() - 0.5) * ringJitter;
    const w = 14 + Math.random() * 6;
    const h = 36 + Math.random() * 26;
    const d = 10 + Math.random() * 4;
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e);
    // tower
    s.set(w, h, d); t.set(px, h / 2, pz);
    m.compose(t, q, s);
    towers.setMatrixAt(i, m);
    // cap
    s.set(w + 0.6, 0.6, d + 0.6); t.set(px, h + 0.3, pz);
    m.compose(t, q, s);
    caps.setMatrixAt(i, m);
  }
  towers.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  scene.add(towers);
  scene.add(caps);
}
