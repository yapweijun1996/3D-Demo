import * as THREE from 'three';
import { CFG } from '../config.js';

// Cross-shaped asphalt road network through the playable area, with center
// roundabout. Pure visual — driving works on grass too.
function makeAsphaltTexture(repeat = 1, withLine = false) {
  const cnv = document.createElement('canvas');
  cnv.width = 256; cnv.height = 1024;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#2b2b30'; ctx.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256, y = Math.random() * 1024;
    ctx.fillStyle = `rgba(${60+Math.random()*40|0},${60+Math.random()*40|0},${65+Math.random()*40|0},.4)`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  // edge lines
  ctx.fillStyle = '#e8d77a';
  ctx.fillRect(8, 0, 4, 1024);
  ctx.fillRect(256 - 12, 0, 4, 1024);
  if (withLine) {
    // dashed center line
    ctx.fillStyle = '#f0f0f0';
    for (let y = 0; y < 1024; y += 80) ctx.fillRect(126, y, 4, 40);
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildRoads(scene) {
  const length = 280;
  const width = 12;
  const matNS = new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(length / 14, true), roughness: 0.95 });
  const matEW = new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(length / 14, true), roughness: 0.95 });

  const ns = new THREE.Mesh(new THREE.PlaneGeometry(width, length), matNS);
  ns.rotation.x = -Math.PI / 2;
  ns.position.y = 0.01;
  ns.receiveShadow = true;
  scene.add(ns);

  const ew = new THREE.Mesh(new THREE.PlaneGeometry(width, length), matEW);
  ew.rotation.x = -Math.PI / 2;
  ew.rotation.z = Math.PI / 2;
  ew.position.y = 0.01;
  ew.receiveShadow = true;
  scene.add(ew);

  // Roundabout center
  const round = new THREE.Mesh(
    new THREE.CircleGeometry(10, 48),
    new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.95 })
  );
  round.rotation.x = -Math.PI / 2;
  round.position.y = 0.012;
  round.receiveShadow = true;
  scene.add(round);

  const roundRing = new THREE.Mesh(
    new THREE.RingGeometry(9.6, 10, 48),
    new THREE.MeshStandardMaterial({ color: 0xe8d77a, roughness: 0.7, side: THREE.DoubleSide })
  );
  roundRing.rotation.x = -Math.PI / 2;
  roundRing.position.y = 0.013;
  scene.add(roundRing);

  // Center planter (small fountain mound)
  const planter = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 4, 0.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x6a6a74, roughness: 0.85 })
  );
  planter.position.y = 0.3;
  planter.castShadow = planter.receiveShadow = true;
  scene.add(planter);
  const grassTop = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x4a7a3e, roughness: 0.95 })
  );
  grassTop.rotation.x = -Math.PI / 2;
  grassTop.position.y = 0.601;
  scene.add(grassTop);
}
