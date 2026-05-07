import * as THREE from 'three';
import { CFG } from '../config.js';
import { addBox } from '../colliders.js';

// Each sign = a stone pedestal + a colored panel with the label baked into a CanvasTexture.
// Collision is *not* via the global collider list — the car should be able to drive THROUGH
// the sign zone to trigger the modal. We do a soft "trigger zone" check in main.js instead.
//
// Build returns an array of { id, label, position, content, mesh, lastTriggered } for use
// by the trigger system. Each entry also pulses (bob + glow) to draw attention.

function makeLabelTexture(label, color, size = 512) {
  const cnv = document.createElement('canvas');
  cnv.width = size; cnv.height = size / 2;
  const ctx = cnv.getContext('2d');
  // background
  const grad = ctx.createLinearGradient(0, 0, 0, cnv.height);
  grad.addColorStop(0, '#1a2030'); grad.addColorStop(1, '#0c1018');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, cnv.width, cnv.height);
  // colored bar at top
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, cnv.width, 14);
  ctx.fillRect(0, cnv.height - 14, cnv.width, 14);
  // label text
  ctx.font = 'bold 92px system-ui,sans-serif';
  ctx.fillStyle = '#f4ecd8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cnv.width / 2, cnv.height / 2);
  // subtle hint
  ctx.font = '20px system-ui,sans-serif';
  ctx.fillStyle = 'rgba(244,236,216,0.55)';
  ctx.fillText('drive into me', cnv.width / 2, cnv.height - 36);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildSigns(scene) {
  const out = [];
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6a74, roughness: 0.85 });

  for (const cfg of CFG.signs) {
    const [x, z] = cfg.pos;
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    // stone pedestal (collider — car bumps into it)
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), stoneMat);
    ped.position.y = 0.4;
    ped.castShadow = ped.receiveShadow = true;
    g.add(ped);

    // post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), stoneMat);
    post.position.y = 1.4;
    post.castShadow = true;
    g.add(post);

    // label panel — emissive so it pops at any time of day
    const labelMat = new THREE.MeshStandardMaterial({
      map: makeLabelTexture(cfg.label, cfg.color),
      emissiveMap: makeLabelTexture(cfg.label, cfg.color),
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), labelMat);
    panel.position.y = 2.5;
    g.add(panel);
    // back panel facing the other way too — billboard double-sided already covered by side:DoubleSide
    panel.castShadow = true;

    // glowing accent ring around top
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 8, 24),
      new THREE.MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 1.2 })
    );
    ring.position.y = 3.1;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    scene.add(g);

    // Pedestal acts as a soft static obstacle (car will bump against it).
    addBox(x, z, 0.7, 0.7);

    out.push({
      ...cfg, position: new THREE.Vector3(x, 0, z), panel, ring, lastTriggered: -Infinity,
    });
  }
  return out;
}

// Tick — gently animates panels (face camera) + ring spin + bob.
export function animateSigns(signs, t, camera) {
  for (let i = 0; i < signs.length; i++) {
    const s = signs[i];
    const phase = i * 0.7;
    s.panel.position.y = 2.5 + Math.sin(t * 1.6 + phase) * 0.06;
    s.ring.rotation.z = t * (0.6 + i * 0.07);
    // billboard: rotate panel to face camera (Y axis only)
    s.panel.lookAt(camera.position.x, s.panel.getWorldPosition(new THREE.Vector3()).y, camera.position.z);
  }
}
