import * as THREE from 'three';
import { CFG } from '../config.js';

// Procedural ground texture — tropical grass with paved patches and hot dirt patches.
function makeGroundTexture(size = 1024) {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d');
  // Smoother base — softer 2-stop gradient, less contrast
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#4a6e3e'); g.addColorStop(1, '#3a5832');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // Fine grass speckle (more, smaller, lower opacity — looks like real grass)
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 1.8 + 0.3;
    ctx.fillStyle = `rgba(${60+Math.random()*60|0},${110+Math.random()*60|0},${55+Math.random()*40|0},.35)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  }
  // Very subtle dirt patches — only a few, low alpha (was 30 patches @ alpha 0.10-0.30 → cow spots)
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = `rgba(150,130,90,${.04 + Math.random()*.05})`;
    ctx.beginPath(); ctx.arc(x, y, 18 + Math.random()*30, 0, Math.PI*2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(CFG.world.ground.repeat, CFG.world.ground.repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildPlayground(scene) {
  const G = CFG.world.ground;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(G.size, G.size),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(1024), roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}
