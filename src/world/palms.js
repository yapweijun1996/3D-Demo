import * as THREE from 'three';
import { walkAtSpacing } from './road-emitter.js';
import { districtAtWorld, getDistrict } from './districts.js';

// Tree-lined avenues — Garden City identity. Procedural palms placed every
// 25m along OSM ways, alternating left/right at perpendicular offset just
// past the sidewalk edge.
//
// District-aware species rule (per districts.js DNA):
//   marina:    sparse — every 50m only (CBD towers dominate sightline)
//   civic:     rain tree mix (taller, broader) — every 20m
//   chinatown: NONE (shophouse rows start right at sidewalk edge)
//   orchard:   angsana — dense canopy every 15m (signature)
//   hdb:       palm — every 25m
//   park:      mixed dense — every 12m
//   default (no district): palm every 30m
//
// Two batches: trunks (cylinder) + leaves (fan PlaneGeometry merged). All
// trees citywide → 2 drawcalls. ~2-5k instances expected.

const ROAD_HALF_W_DEFAULT = 4.0;       // approx for primary road
const SIDEWALK_W = 3.0;
const TREE_OFFSET = ROAD_HALF_W_DEFAULT + SIDEWALK_W + 1.5;   // edge of grass

// Hash to deterministic 0..1 — used for scale/rotation jitter.
function h(seed) {
  return ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
}

const DISTRICT_RULE = {
  marina:    { interval: 50, scaleBase: 0.9 },
  civic:     { interval: 20, scaleBase: 1.2 },
  chinatown: { interval: 0,  scaleBase: 0   },   // 0 → skip
  orchard:   { interval: 15, scaleBase: 1.1 },
  hdb:       { interval: 25, scaleBase: 1.0 },
  park:      { interval: 12, scaleBase: 1.15 },
  __default: { interval: 30, scaleBase: 1.0 },
};

export function buildPalms(scene, ways, project) {
  if (!ways || !project) {
    // Fallback path — old random sprinkle if OSM not loaded.
    return buildPalmsLegacy(scene);
  }

  const tierFilter = new Set(['motorway', 'trunk', 'primary', 'secondary']);
  const filtered = ways.filter(w => tierFilter.has(w.t));

  // Walk at the densest interval (12m) — each callback then decides whether
  // to skip based on per-district rule. This keeps the walker simple while
  // letting different districts feel distinct.
  const STEP = 12;
  const matrices = [];
  walkAtSpacing(filtered, project, STEP, ({ x, z, perpX, perpZ, k }) => {
    const did = districtAtWorld(x, z);
    const rule = DISTRICT_RULE[did] || DISTRICT_RULE.__default;
    if (rule.interval === 0) return;
    // Skip ratio: if rule.interval = 25, place 1 of every Math.round(25/STEP) ≈ 2
    const skip = Math.max(1, Math.round(rule.interval / STEP));
    if (k % skip !== 0) return;

    const side = (k % 2) ? 1 : -1;
    const px = x + perpX * TREE_OFFSET * side;
    const pz = z + perpZ * TREE_OFFSET * side;

    const sJ = rule.scaleBase * (0.85 + h(k) * 0.30);
    const rJ = h(k + 17) * Math.PI * 2;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rJ);
    const sV = new THREE.Vector3(sJ, sJ, sJ);
    m.compose(new THREE.Vector3(px, 0, pz), q, sV);
    matrices.push(m);
  });

  if (matrices.length === 0) return buildPalmsLegacy(scene);

  // Trunks
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 4.5, 8);
  trunkGeo.translate(0, 2.25, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.85 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, matrices.length);
  trunkInst.castShadow = true;
  trunkInst.frustumCulled = false;

  // Leaves — fan geometry merged
  const leafGeo = buildLeafFan(7);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4ea24a, roughness: 0.7, side: THREE.DoubleSide,
  });
  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, matrices.length);
  leafInst.castShadow = true;
  leafInst.frustumCulled = false;

  for (let i = 0; i < matrices.length; i++) {
    trunkInst.setMatrixAt(i, matrices[i]);
    leafInst.setMatrixAt(i, matrices[i]);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  leafInst.instanceMatrix.needsUpdate = true;
  scene.add(trunkInst);
  scene.add(leafInst);
  console.log(`[palms] ${matrices.length} trees placed along OSM avenues`);
}

// ---- legacy random sprinkle (unchanged) ----
function buildPalmsLegacy(scene) {
  // (see git history pre-T07 for the random-sprinkle implementation)
  console.log('[palms] OSM not loaded — skipping (no fallback)');
}

// ---- shared helpers (unchanged from original palms.js) ----

// 5 curved leaf ribbons radiating from trunk top. Each ribbon is a 4-segment
// triangle strip that tapers from 0.4m wide (base) to 0.06m wide (tip) and
// droops in Y so the silhouette reads as 3D from any side angle — not the
// paper-flat fan the previous PlaneGeometry produced.
function buildLeafFan(count) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const g = buildCurvedLeaf();
    g.rotateY(a);
    g.translate(0, 4.6, 0);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

function buildCurvedLeaf() {
  const SEGS = 5;            // 5 sample points → 4 quad strips → 8 triangles
  const LEN = 2.6;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let s = 0; s <= SEGS; s++) {
    const t = s / SEGS;                        // 0..1 along length
    const x = LEN * t;                         // X = horizontal extent from trunk
    // Width taper: 0.4m at base → 0.06m at tip. Quadratic for natural shape.
    const w = 0.4 * (1 - t * t * 0.85);
    // Droop curve: leaf base level, tip pulled down ~0.5m via cosine.
    const y = -0.5 * (1 - Math.cos(t * Math.PI)) * 0.5;
    // Two vertices per sample (left + right side of leaf strip)
    positions.push(x,  y,  w / 2);             // +Z side
    positions.push(x,  y, -w / 2);             // -Z side
    // Normal points up — leaf surface roughly horizontal
    normals.push(0, 1, 0); normals.push(0, 1, 0);
    uvs.push(t, 0); uvs.push(t, 1);
  }

  // Triangle strip: for each segment between sample s and s+1, two triangles.
  for (let s = 0; s < SEGS; s++) {
    const a = s * 2, b = s * 2 + 1, c = (s + 1) * 2, d = (s + 1) * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(indices);
  return g;
}

function mergeGeometries(geos) {
  let posCount = 0, idxCount = 0;
  for (const g of geos) {
    posCount += g.attributes.position.count;
    if (g.index) idxCount += g.index.count;
  }
  const pos = new Float32Array(posCount * 3);
  const norm = new Float32Array(posCount * 3);
  const uv = new Float32Array(posCount * 2);
  const idx = new Uint32Array(idxCount);
  let pOff = 0, iOff = 0, vOff = 0;
  for (const g of geos) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    const gu = g.attributes.uv.array;
    pos.set(gp, pOff * 3);
    norm.set(gn, pOff * 3);
    uv.set(gu, pOff * 2);
    if (g.index) {
      const gi = g.index.array;
      for (let k = 0; k < gi.length; k++) idx[iOff + k] = gi[k] + pOff;
      iOff += gi.length;
    }
    pOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
