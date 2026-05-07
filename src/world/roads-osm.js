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
const TIERS = [
  { t: 'motorway',  w: 6.0, color: 0x2c2c32, y: 0.40 },
  { t: 'trunk',     w: 4.8, color: 0x30303a, y: 0.36 },
  { t: 'primary',   w: 3.6, color: 0x3a3a42, y: 0.32 },
  { t: 'secondary', w: 2.6, color: 0x42424a, y: 0.28 },
  { t: 'tertiary',  w: 1.8, color: 0x484850, y: 0.24 },
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
    const mat = new THREE.MeshBasicMaterial({ color: tier.color, fog: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = tier.y;
    mesh.renderOrder = 1;
    scene.add(mesh);

    // Center stripe for motorway + trunk only — readable at distance.
    if (tier.t === 'motorway' || tier.t === 'trunk') {
      const stripeGeo = buildStripGeometry(ways, _proj, tier.w * 0.10);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2d96a, fog: true });
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

function buildStripGeometry(ways, project, width) {
  const positions = [];
  const indices = [];
  let vi = 0;
  const halfW = width / 2;

  for (const way of ways) {
    const pts = way.g.map(([lat, lng]) => project(lat, lng));
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nx = -dz / len * halfW;
      const nz =  dx / len * halfW;
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

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}
