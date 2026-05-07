import * as THREE from 'three';
import { CFG, PALETTE } from '../config.js';
import { instanceFromGLB, matricesFromPlacements } from '../loaders/instance-from-glb.js';
import { DISTRICTS, TYPOLOGY } from './districts.js';
import { walkAtSpacing } from './road-emitter.js';

// HDB blocks placed at REAL Singapore neighborhoods (Toa Payoh, Bishan, Ang Mo Kio,
// Tampines, Jurong East, Woodlands), via projectLatLng from roads-osm.
// Falls back to one big procedural ring if proj not available.
export function buildBuildings(scene, assets, proj, ways) {
  const lit = proj ? buildHDBClusters(scene, proj) : buildHDBFallbackRing(scene);
  buildSuburbRing(scene, assets, proj);
  if (proj) buildDistrictBuildings(scene, proj, ways);    // T08-T10
  // Caller reads `lit.bodyMat.emissiveIntensity` each frame to drive
  // window-glow with day/night phase. Daytime ≈ 0.05, night ≈ 1.8.
  return lit;
}

// Per-district typology dispatcher. For each district whose typology requires
// it, place buildings inside its bbox via the matching builder. Skips HDB
// (already covered by buildHDBClusters above) and PARK (no buildings).
function buildDistrictBuildings(scene, proj, ways) {
  let totalAdded = 0;
  for (const d of DISTRICTS) {
    const [sw_x, sw_z] = proj(d.bbox[0], d.bbox[1]);
    const [ne_x, ne_z] = proj(d.bbox[2], d.bbox[3]);
    const xMin = Math.min(sw_x, ne_x), xMax = Math.max(sw_x, ne_x);
    const zMin = Math.min(sw_z, ne_z), zMax = Math.max(sw_z, ne_z);
    const region = { xMin, xMax, zMin, zMax, width: xMax - xMin, depth: zMax - zMin };

    let added = 0;
    switch (d.typology) {
      case TYPOLOGY.TOWER:     added = buildTowers(scene, region, d);                  break;
      case TYPOLOGY.COLONIAL:  added = buildColonial(scene, region, d);                break;
      case TYPOLOGY.MALL:      added = buildMallBlocks(scene, region, d);              break;
      case TYPOLOGY.SHOPHOUSE: added = buildShophouses(scene, region, d, proj, ways);  break;
      // hdb / park handled elsewhere
    }
    totalAdded += added;
  }
  console.log(`[buildings] +${totalAdded} district buildings (towers/colonial/mall/shophouse)`);
}

// ---- T08 stubs (T09/T10 expand) ----

// T09: continuous shophouse rows along Chinatown's secondary/tertiary roads.
// 3-story, 5-6m frontage, 12m depth, pitched terracotta roof, pastel facade
// from district palette. Placed via walkAtSpacing(6m) on roads inside the
// Chinatown bbox so they hug the streetline like real shophouses.
function buildShophouses(scene, region, district, proj, ways) {
  if (!ways || !proj) return 0;

  // Filter: roads inside this district's bbox.
  const inRegion = (lat, lng) => {
    const [x, z] = proj(lat, lng);
    return x >= region.xMin && x <= region.xMax && z >= region.zMin && z <= region.zMax;
  };
  const districtWays = ways.filter(w => {
    if (!['primary', 'secondary', 'tertiary', 'residential'].includes(w.t)) return false;
    if (w.g.length < 2) return false;
    // Any vertex inside the bbox = include this way (catches edge-crossing
    // ways that midpoint test would miss).
    return w.g.some(([la, lo]) => inRegion(la, lo));
  });

  if (districtWays.length === 0) return 0;

  // OSM ways in this dataset are short fragments (2-3m each) so the walker
  // interval must be smaller than typical segment length to actually emit
  // anything. 1.5m interval + (k % 4 keep) gives ~6m effective spacing
  // between shophouses.
  const placements = [];
  walkAtSpacing(districtWays, proj, 1.5, ({ x, z, perpX, perpZ, k }) => {
    if (k % 4 !== 0) return;        // keep every 4th sample

    if (!(x >= region.xMin && x <= region.xMax && z >= region.zMin && z <= region.zMax)) return;
    const side = (k % 2) ? 1 : -1;     // both sides of street
    // Push past sidewalk so house front sits on the kerb.
    const pushOut = 6.5;
    const px = x + perpX * pushOut * side;
    const pz = z + perpZ * pushOut * side;
    const yaw = Math.atan2(perpZ * side, perpX * side);
    placements.push({ x: px, z: pz, yaw, paletteIdx: k });
  });

  if (placements.length === 0) return 0;

  // Body: per-instance color via instanceColor; 3 stories tall (~10m).
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, placements.length);
  bodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(placements.length * 3), 3);

  // Roof: terracotta cone (4-sided pyramid via ConeGeometry rotated).
  const roofGeo = new THREE.ConeGeometry(1, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb85c3c, roughness: 0.7 });
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, placements.length);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sV = new THREE.Vector3();
  const tV = new THREE.Vector3();
  const colTmp = new THREE.Color();
  const palette = district.palette;

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const W = 5.5, D = 12, H = 10;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);

    sV.set(W, H, D); tV.set(p.x, H / 2, p.z);
    m.compose(tV, q, sV); bodies.setMatrixAt(i, m);
    colTmp.set(palette[p.paletteIdx % palette.length]);
    bodies.instanceColor.setXYZ(i, colTmp.r, colTmp.g, colTmp.b);

    sV.set(W * 1.1, 2.5, D * 1.1); tV.set(p.x, H + 1.25, p.z);
    m.compose(tV, q, sV); roofs.setMatrixAt(i, m);
  }
  bodies.instanceMatrix.needsUpdate = true;
  bodies.instanceColor.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  bodies.castShadow = roofs.castShadow = true;
  scene.add(bodies); scene.add(roofs);
  return placements.length;
}

function buildTowers(scene, region, district) {
  // T10 implements the real glass-skyscraper generator. T08 placeholder:
  // sprinkle 6 plain dark boxes 80–200m tall to mark the CBD silhouette.
  const N = 6;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a72, roughness: 0.4, metalness: 0.6 });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  const m = new THREE.Matrix4(), s = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const w = 24 + Math.random() * 16, d = 24 + Math.random() * 16;
    const h = 80 + Math.random() * 120;
    const x = region.xMin + 20 + Math.random() * (region.width - 40);
    const z = region.zMin + 20 + Math.random() * (region.depth - 40);
    s.set(w, h, d); t.set(x, h / 2, z);
    m.compose(t, new THREE.Quaternion(), s); inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  scene.add(inst);
  return N;
}

function buildColonial(scene, region, district) {
  // White plaster box + red pyramid roof. 2-3 stories. 4 buildings clustered
  // around Padang (district center).
  const N = 4;
  const cx = (region.xMin + region.xMax) / 2;
  const cz = (region.zMin + region.zMax) / 2;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb85c3c, roughness: 0.7 });
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 35;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const w = 20 + Math.random() * 8, d = 14 + Math.random() * 6;
    const wallH = 10 + Math.random() * 4;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    wall.position.set(x, wallH / 2, z);
    wall.castShadow = true; wall.receiveShadow = true;
    scene.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.7, 4, 4), roofMat);
    roof.position.set(x, wallH + 2, z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
  }
  return N;
}

function buildMallBlocks(scene, region, district) {
  // Wide low podium (~40m × 80m × 30m). 4 along the main axis.
  const N = 4;
  const cx = (region.xMin + region.xMax) / 2;
  const cz = (region.zMin + region.zMax) / 2;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c, roughness: 0.5, metalness: 0.4,
  });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(geo, mat, N);
  const m = new THREE.Matrix4(), s = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const w = 60 + Math.random() * 30;
    const d = 28 + Math.random() * 12;
    const h = 25 + Math.random() * 25;
    const x = cx + (i - N / 2) * 60;
    const z = cz + (Math.random() - 0.5) * 30;
    s.set(w, h, d); t.set(x, h / 2, z);
    m.compose(t, new THREE.Quaternion(), s); inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  scene.add(inst);
  return N;
}

// HDB clusters — Apple-HIG / SG-typology rebuild.
// 70/30 mix of slab + point blocks per cluster, each with void deck (recessed
// dark base) + rooftop water tank (small box). Per-cluster tone (warm/cool)
// gives instant neighborhood identity. Three InstancedMesh batches share the
// scene budget regardless of cluster count.
function buildHDBClusters(scene, proj) {
  const { clusters, palette } = CFG.hdb;
  const winTex = makeWindowTexture(7, 22, 0.45);

  // Compute totals: each cluster splits 70% slab / 30% point.
  let total = 0;
  for (const c of clusters) {
    c._ptCount = Math.max(1, Math.round(c.count * 0.30));
    c._slCount = c.count - c._ptCount;
    total += c.count;
  }

  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const tankGeo = new THREE.BoxGeometry(1, 1, 1);
  const voidGeo = new THREE.BoxGeometry(1, 1, 1);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: winTex, emissiveMap: winTex, emissive: 0xffffff,
    emissiveIntensity: 0.05, roughness: 0.85,
  });
  const tankMat = new THREE.MeshStandardMaterial({ color: PALETTE.rooftop, roughness: 0.9 });
  const voidMat = new THREE.MeshStandardMaterial({ color: PALETTE.voidDeck, roughness: 0.95 });

  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, total);
  const tanks  = new THREE.InstancedMesh(tankGeo, tankMat, total);
  const voids  = new THREE.InstancedMesh(voidGeo, voidMat, total);
  bodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const t = new THREE.Vector3(), sV = new THREE.Vector3();
  const colTmp = new THREE.Color();
  const VOID_H = 3.0;        // ground-floor open columns — dark recessed band
  let i = 0;

  for (const cluster of clusters) {
    const [cx, cz] = proj(cluster.latLng[0], cluster.latLng[1]);
    const tonePalette = palette[cluster.tone] || palette.warm;

    const placeBlock = (isPoint, idxInCluster) => {
      // Distribute around cluster center using golden-angle for even spread
      const a = idxInCluster * 2.39996323 + Math.random() * 0.4;     // golden angle radians
      const r = cluster.spread * (0.3 + Math.random() * 0.7);
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      // Axis-align for clarity (Apple HIG: silhouettes over noise) — pick one of 2 cardinal rots
      const rot = Math.random() < 0.5 ? 0 : Math.PI / 2;

      let w, h, d;
      if (isPoint) {
        // Point block — square footprint, tall
        w = 22; d = 22;
        h = 70 + Math.random() * 22;
      } else {
        // Slab block — long footprint, mid-height
        w = 50 + Math.random() * 28;
        d = 12;
        h = 32 + Math.random() * 14;
      }

      e.set(0, rot, 0); q.setFromEuler(e);

      // BODY — sits above void deck, occupies (h - VOID_H) vertically
      const bodyH = h - VOID_H;
      sV.set(w, bodyH, d); t.set(px, VOID_H + bodyH / 2, pz);
      m.compose(t, q, sV); bodies.setMatrixAt(i, m);

      // VOID DECK — bottom 3m, slightly inset XZ (recess look)
      sV.set(w * 0.96, VOID_H, d * 0.96); t.set(px, VOID_H / 2, pz);
      m.compose(t, q, sV); voids.setMatrixAt(i, m);

      // ROOFTOP WATER TANK — small box centered on roof, off-center for asymmetry
      const tankW = isPoint ? w * 0.55 : w * 0.30;
      const tankD = isPoint ? d * 0.55 : d * 0.65;
      const tankH = 2.5;
      const tankOffX = isPoint ? 0 : (Math.random() - 0.5) * w * 0.3;
      // Apply rotation to tank offset
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const tx = px + cos * tankOffX;
      const tz = pz + sin * tankOffX;
      sV.set(tankW, tankH, tankD); t.set(tx, h + tankH / 2, tz);
      m.compose(t, q, sV); tanks.setMatrixAt(i, m);

      colTmp.set(tonePalette[i % tonePalette.length]).multiplyScalar(0.92 + Math.random() * 0.14);
      bodies.instanceColor.setXYZ(i, colTmp.r, colTmp.g, colTmp.b);
      i++;
    };

    let idx = 0;
    for (let k = 0; k < cluster._slCount; k++) placeBlock(false, idx++);
    for (let k = 0; k < cluster._ptCount; k++) placeBlock(true,  idx++);
  }

  bodies.instanceMatrix.needsUpdate = true;
  bodies.instanceColor.needsUpdate = true;
  tanks.instanceMatrix.needsUpdate = true;
  voids.instanceMatrix.needsUpdate = true;
  bodies.receiveShadow = true;
  scene.add(bodies); scene.add(tanks); scene.add(voids);
  return { bodyMat };
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
  return { bodyMat: mat };
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
