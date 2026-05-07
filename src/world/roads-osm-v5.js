import * as THREE from 'three';

// Render Singapore central road network from OSM data.
// Source: assets/data/sg-roads.json (Overpass: 5 highway tiers,
//   bbox 1.246–1.351 lat × 103.787–103.915 lng ≈ 11.7×14.3 km central SG).
// Output: 5 BufferGeometry meshes (one per tier), 5 drawcalls total.
//
// Equirectangular projection scaled so the wider axis fits ±WORLD_HALF.
// 1 world unit ≈ 22 m at this zoom — dense and recognisably SG.

const WORLD_HALF = 320;
const LAT_TO_M = 111000;

// Tier visual table — width in WORLD units, color, y-stack height (avoid z-fight).
// Wider widths than reality so roads stay readable from a car-height camera.
// Light-grey asphalt — high contrast against saturated green land.
// Real Singapore-style asphalt: nearly black (0x222226 → 0x3a3a40 by tier) +
// wider widths than reality.  Earlier 0x96969e light-grey blended into the
// saturated green land under HDRI ambient + ACES tonemap.  Dark wins.
// Real Singapore-style asphalt at ground level. Stack offset 0.05 between
// tiers prevents z-fighting where roads cross.
const TIERS = [
  { t: 'motorway',  w: 10.0, color: 0x222226, y: 0.20 },
  { t: 'trunk',     w: 8.0,  color: 0x282830, y: 0.16 },
  { t: 'primary',   w: 6.0,  color: 0x2e2e36, y: 0.12 },
  { t: 'secondary', w: 4.0,  color: 0x34343a, y: 0.08 },
  { t: 'tertiary',  w: 2.5,  color: 0x3a3a40, y: 0.04 },
];

let _proj = null;

export async function buildOSMRoads(scene) {
  let data;
  try {
    const res = await fetch('./assets/data/sg-roads.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.warn('[osm] failed to load sg-roads.json — falling back:', err);
    return null;
  }

  const [minLat, minLng, maxLat, maxLng] = data.bbox;
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  const lngToM = LAT_TO_M * Math.cos(cLat * Math.PI / 180);
  const widthM = (maxLng - minLng) * lngToM;
  const heightM = (maxLat - minLat) * LAT_TO_M;
  const worldScale = (WORLD_HALF * 2) / Math.max(widthM, heightM);

  // lat/lng → world [x, z] (north = -z, east = +x)
  _proj = (lat, lng) => {
    const dx = (lng - cLng) * lngToM;
    const dz = -(lat - cLat) * LAT_TO_M;
    return [dx * worldScale, dz * worldScale];
  };

  const minimapSegs = [];
  let totalWays = 0;
  const counts = {};

  for (const tier of TIERS) {
    const ways = data.ways.filter(w => w.t === tier.t);
    counts[tier.t] = ways.length;
    totalWays += ways.length;
    if (!ways.length) continue;

    const geo = buildStripGeometry(ways, _proj, tier.w);
    // DoubleSide is REQUIRED — buildStripGeometry winds vertices so the front
    // face points DOWN (-Y); from car-cam looking from above we see the back
    // face, and default FrontSide culls it = invisible.  3 hours of debugging
    // 'why is this gray-on-green road blending into grass' was actually:
    // it wasn't rendering at all because of backface culling.
    const mat = new THREE.MeshBasicMaterial({
      color: tier.color, fog: true, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = tier.y;
    mesh.renderOrder = 1;
    scene.add(mesh);

    // White center lane line — Singapore standard. Solid for trunk (single
    // carriageway feel), dashed for motorway (lane separator).
    if (tier.t === 'motorway' || tier.t === 'trunk') {
      const dashed = (tier.t === 'motorway');
      const stripeGeo = buildStripGeometry(ways, _proj, tier.w * 0.07, dashed);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = tier.y + 0.005;
      stripe.renderOrder = 2;
      scene.add(stripe);
    }

    // minimap segs — only major tiers (motorway/trunk/primary) to keep it readable
    if (tier.t === 'motorway' || tier.t === 'trunk' || tier.t === 'primary') {
      for (const w of ways) {
        const pts = w.g.map(([la, lo]) => _proj(la, lo));
        for (let i = 0; i < pts.length - 1; i++) {
          minimapSegs.push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        }
      }
    }
  }

  console.log(`[osm] ${totalWays} ways, tiers:`, counts);
  return { proj: _proj, bbox: data.bbox, minimapSegs };
}

export function projectLatLng(lat, lng) {
  if (!_proj) throw new Error('projectLatLng called before buildOSMRoads');
  return _proj(lat, lng);
}

function buildStripGeometry(ways, project, width, dashed = false) {
  const positions = [];
  const indices = [];
  let vi = 0;
  const halfW = width / 2;
  const DASH_LEN = 4.0;            // world units of dash + gap cycle
  const DASH_DUTY = 0.55;          // 55% painted, 45% gap

  for (const way of ways) {
    const pts = way.g.map(([lat, lng]) => project(lat, lng));
    let s = 0;                     // arc-length along this way (for dashed)
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nx = -dz / len * halfW;
      const nz =  dx / len * halfW;
      // dashed mode: walk arc-length along dashes/gaps and emit only dash quads.
      if (dashed) {
        const startS = s;
        let cursor = 0;                     // 0..len in this segment
        while (cursor < len) {
          const globalS = startS + cursor;
          const phase = ((globalS % DASH_LEN) + DASH_LEN) % DASH_LEN;     // 0..DASH_LEN
          const inDash = phase < DASH_LEN * DASH_DUTY;
          const remainInState = inDash
            ? (DASH_LEN * DASH_DUTY) - phase
            : DASH_LEN - phase;
          const advance = Math.max(0.05, Math.min(remainInState, len - cursor));
          if (inDash) {
            const t0 = cursor, t1 = cursor + advance;
            const xa = x1 + dx * (t0 / len), za = z1 + dz * (t0 / len);
            const xb = x1 + dx * (t1 / len), zb = z1 + dz * (t1 / len);
            positions.push(xa + nx, 0, za + nz, xa - nx, 0, za - nz, xb + nx, 0, zb + nz, xb - nx, 0, zb - nz);
            indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
            vi += 4;
          }
          cursor += advance;
        }
        s += len;
      } else {
        positions.push(
          x1 + nx, 0, z1 + nz,
          x1 - nx, 0, z1 - nz,
          x2 + nx, 0, z2 + nz,
          x2 - nx, 0, z2 - nz,
        );
        indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
        vi += 4;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}
