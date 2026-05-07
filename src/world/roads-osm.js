import * as THREE from 'three';
import { loadRoadTextures, setRepeatMeters } from './textures.js';
import { emitParallelStrip } from './road-emitter.js';

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
// Realistic-ish widths (3-5x exaggerated from real meter scale, since our
// worldScale projects the bbox so 1 unit ≈ 22m). Y stack 0.04 between tiers
// avoids z-fight at intersections; renderOrder enforces motorway-on-top.
const TIERS = [
  { t: 'motorway',  w: 5.0, color: 0x222226, y: 0.20 },
  { t: 'trunk',     w: 4.0, color: 0x282830, y: 0.16 },
  { t: 'primary',   w: 3.0, color: 0x2e2e36, y: 0.12 },
  { t: 'secondary', w: 2.2, color: 0x34343a, y: 0.08 },
  { t: 'tertiary',  w: 1.5, color: 0x3a3a40, y: 0.04 },
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

  // PBR asphalt — shared by every tier (color tint preserves tier hierarchy).
  // Tile = 4m so the rough grain reads at car-cam height without looking like
  // wallpaper at distance.
  const ROAD_TILE_M = 4;
  const roadMaps = loadRoadTextures();
  setRepeatMeters(roadMaps, 1 / ROAD_TILE_M, 1 / ROAD_TILE_M);

  const minimapSegs = [];
  let totalWays = 0;
  const counts = {};

  for (const tier of TIERS) {
    const ways = data.ways.filter(w => w.t === tier.t);
    counts[tier.t] = ways.length;
    totalWays += ways.length;
    if (!ways.length) continue;

    const geo = emitParallelStrip(ways, _proj, { widthMeters: tier.w });
    // PBR asphalt with tier color tint. UV box-projected from world XZ (in
    // meters) so the shared texture tiles uniformly. receiveShadow on so the
    // car's shadow lands on the road. DoubleSide kept for the legacy winding
    // (front face points -Y); car-cam looks from above and would cull the
    // back face otherwise.
    const mat = new THREE.MeshStandardMaterial({
      color: tier.color, roughness: 1.0, metalness: 0.0,
      side: THREE.DoubleSide,
      ...roadMaps,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = tier.y;
    mesh.renderOrder = 1;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // White center lane line — Singapore standard. Solid for trunk (single
    // carriageway feel), dashed for motorway (lane separator).
    if (tier.t === 'motorway' || tier.t === 'trunk') {
      const dashed = (tier.t === 'motorway');
      const stripeGeo = emitParallelStrip(ways, _proj, { widthMeters: tier.w * 0.10, dashed });
      const stripeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, fog: true, side: THREE.DoubleSide,   // backface cull would hide stripe (same bug as roads)
      });
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

// (buildStripGeometry moved to ./road-emitter.js as emitParallelStrip — see T03 commit.)
