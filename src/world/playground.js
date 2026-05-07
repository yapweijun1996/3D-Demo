import * as THREE from 'three';
import { CFG } from '../config.js';

// Procedural ground texture — tropical grass with paved patches and hot dirt patches.
function makeGroundTexture(size = 1024) {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#3f6336'); g.addColorStop(1, '#2f4d28');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = `rgba(${50+Math.random()*70|0},${100+Math.random()*70|0},${50+Math.random()*40|0},.55)`;
    ctx.beginPath(); ctx.arc(x, y, Math.random() * 3 + 0.4, 0, Math.PI*2); ctx.fill();
  }
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = `rgba(170,140,90,${.10 + Math.random()*.20})`;
    ctx.beginPath(); ctx.arc(x, y, 24 + Math.random()*70, 0, Math.PI*2); ctx.fill();
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
