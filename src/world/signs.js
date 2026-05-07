import * as THREE from 'three';
import { CFG } from '../config.js';
import { addBox } from '../colliders.js';

// Each sign = stone pedestal + post + emissive panel with auto-sized text.
// Sign panels are larger + higher-resolution than v0.2.
// Trigger handling moved to main.js (uses transition-only entry detection).

function makeLabelTexture(label, color, w = 768, h = 384) {
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d');

  // background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a2030'); grad.addColorStop(1, '#0c1018');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

  // colored bars top + bottom
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, w, 22);
  ctx.fillRect(0, h - 22, w, 22);

  // label text — auto fit + word-wrap
  const padX = 36;
  const innerW = w - padX * 2;
  const lines = wrapLines(ctx, label, innerW, 110);  // try 110px first
  const fontSize = pickFontSize(ctx, lines, innerW, h - 80, 110, 36);

  ctx.fillStyle = '#f4ecd8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${fontSize}px system-ui,-apple-system,sans-serif`;

  const lineH = fontSize * 1.15;
  const totalH = lineH * lines.length;
  const startY = h / 2 - totalH / 2 + lineH / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, startY + i * lineH);
  }

  // hint footer
  ctx.font = '24px system-ui,sans-serif';
  ctx.fillStyle = 'rgba(244,236,216,0.55)';
  ctx.fillText('drive in to read', w / 2, h - 44);

  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wrapLines(ctx, text, maxW, fontSize) {
  ctx.font = `bold ${fontSize}px system-ui,sans-serif`;
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(trial).width > maxW && cur) {
      lines.push(cur); cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function pickFontSize(ctx, lines, maxW, maxH, startSize, minSize) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `bold ${size}px system-ui,sans-serif`;
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
    const total = lines.length * size * 1.15;
    if (widest <= maxW && total <= maxH) return size;
    size -= 6;
  }
  return minSize;
}

export function buildSigns(scene) {
  const out = [];
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6a74, roughness: 0.85 });

  for (const cfg of CFG.signs) {
    const [x, z] = cfg.pos;
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), stoneMat);
    ped.position.y = 0.4;
    ped.castShadow = ped.receiveShadow = true;
    g.add(ped);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.6, 8), stoneMat);
    post.position.y = 1.4;
    post.castShadow = true;
    g.add(post);

    // Larger panel: 2.6m × 1.3m, label is short form (cfg.label) for readability at distance.
    const labelMat = new THREE.MeshStandardMaterial({
      map: makeLabelTexture(cfg.label, cfg.color),
      emissiveMap: makeLabelTexture(cfg.label, cfg.color),
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), labelMat);
    panel.position.y = 2.9;
    panel.castShadow = false;
    g.add(panel);

    // Pulsing accent ring on top
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 1.4 })
    );
    ring.position.y = 3.8;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    scene.add(g);
    addBox(x, z, 0.7, 0.7);

    out.push({
      ...cfg,
      position: new THREE.Vector3(x, 0, z),
      panel, ring,
      wasInZone: false,                 // transition-only trigger state
      visited: false,                   // for minimap
    });
  }
  return out;
}

export function animateSigns(signs, t, camera) {
  for (let i = 0; i < signs.length; i++) {
    const s = signs[i];
    const phase = i * 0.7;
    s.panel.position.y = 2.9 + Math.sin(t * 1.6 + phase) * 0.07;
    s.ring.rotation.z = t * (0.6 + i * 0.07);
    s.panel.lookAt(camera.position.x, s.panel.getWorldPosition(new THREE.Vector3()).y, camera.position.z);
    // visited rings dim, unvisited stay bright
    s.ring.material.emissiveIntensity = s.visited ? 0.4 : 1.0 + Math.sin(t * 3 + i) * 0.3;
  }
}
