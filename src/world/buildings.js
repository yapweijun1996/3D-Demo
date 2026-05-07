import * as THREE from 'three';
import { CFG } from '../config.js';
import { instanceFromGLB, matricesFromPlacements } from '../loaders/instance-from-glb.js';

// Building ring — alternates between 2 Kenney City Kit (Suburban) GLB variants.
// Falls back to v0.2 procedural HDB if assets not loaded.
export function buildBuildings(scene, assets) {
  const a = assets?.['./assets/glb/buildings/building-type-c.glb'];
  const b = assets?.['./assets/glb/buildings/building-type-e.glb'];
  if (a && b) {
    buildGLBBuildings(scene, a, b);
  } else {
    buildProceduralBuildings(scene);
  }
}

function buildGLBBuildings(scene, gltfA, gltfB) {
  const { count, ringRadius, ringJitter } = CFG.hdb;
  const placementsA = [], placementsB = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.15;
    const r = ringRadius + (Math.random() - 0.5) * ringJitter;
    const place = {
      x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r,
      rotY: -a + Math.PI / 2 + (Math.random() - 0.5) * 0.4,
      scale: 6 + Math.random() * 3,            // Kenney buildings are 1-unit, scale up to feel like towers
    };
    (i % 2 === 0 ? placementsA : placementsB).push(place);
  }
  scene.add(instanceFromGLB(gltfA, matricesFromPlacements(placementsA), { castShadow: false }));
  scene.add(instanceFromGLB(gltfB, matricesFromPlacements(placementsB), { castShadow: false }));
}

// ---- v0.2 procedural fallback ----
function makeWindowTexture(cols = 5, rows = 18, lit = 0.4) {
  const cellW = 32, cellH = 28;
  const cnv = document.createElement('canvas');
  cnv.width = cols * cellW; cnv.height = rows * cellH;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#c8bfa6'; ctx.fillRect(0, 0, cnv.width, cnv.height);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cellW + 6, y = r * cellH + 6, w = cellW - 12, h = cellH - 12;
    const on = Math.random() < lit;
    ctx.fillStyle = on ? '#ffd97a' : '#34384a'; ctx.fillRect(x, y, w, h);
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
function buildProceduralBuildings(scene) {
  const { count, ringRadius, ringJitter } = CFG.hdb;
  const winTex = makeWindowTexture();
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const towerMat = new THREE.MeshStandardMaterial({
    map: winTex, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.85,
  });
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, count);
  const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
  const sV = new THREE.Vector3(), tV = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.15;
    const r = ringRadius + (Math.random() - 0.5) * ringJitter;
    const w = 14 + Math.random() * 6, h = 36 + Math.random() * 26, d = 10 + Math.random() * 4;
    const px = Math.cos(ang) * r, pz = Math.sin(ang) * r;
    e.set(0, -ang + Math.PI / 2, 0); q.setFromEuler(e);
    sV.set(w, h, d); tV.set(px, h / 2, pz);
    m.compose(tV, q, sV); towers.setMatrixAt(i, m);
  }
  towers.instanceMatrix.needsUpdate = true;
  scene.add(towers);
}
