import * as THREE from 'three';
import { loadRoadTextures, loadSidewalkTextures, loadPaintNoiseTexture, setRepeatMeters } from './textures.js';
import { emitParallelStrip } from './road-emitter.js';
import { buildZebraCrossings } from './road-markings.js';
import { TIERS } from './road-tiers.js';

// Render Singapore central road network from OSM data.
// Source: assets/data/sg-roads.json (Overpass: 5 highway tiers,
//   bbox 1.246–1.351 lat × 103.787–103.915 lng ≈ 11.7×14.3 km central SG).
// Output: 5 BufferGeometry meshes (one per tier), 5 drawcalls total.
//
// Equirectangular projection scaled so the wider axis fits ±WORLD_HALF.
// 1 world unit ≈ 22 m at this zoom — dense and recognisably SG.

const WORLD_HALF = 320;
const LAT_TO_M = 111000;

// Tier visual table is the SSOT in road-tiers.js — every subsystem (roads,
// stripes, sidewalks, traffic, future awnings) reads from there.

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

  // PBR concrete sidewalks — separate texture set, tile = 4m. Sidewalks flank
  // primary/secondary/tertiary roads (skip motorway/trunk highways with no
  // sidewalk in real life). Sit raised 0.10m above road surface so the
  // elevation step itself reads as the curb edge from car cam — no separate
  // curb mesh needed.
  const SIDEWALK_TILE_M = 4;
  const SIDEWALK_W = 3.0;            // 3m wide sidewalk per side
  const sidewalkMaps = loadSidewalkTextures();
  setRepeatMeters(sidewalkMaps, 1 / SIDEWALK_TILE_M, 1 / SIDEWALK_TILE_M);
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xc8c0b0, roughness: 1.0, metalness: 0.0,
    side: THREE.DoubleSide,
    ...sidewalkMaps,
  });

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

    // Sidewalks — flank primary/secondary/tertiary roads on both sides.
    // Skip motorway/trunk (no real sidewalk on highways). Raised 0.10m above
    // the road surface so the elevation step itself reads as the curb edge.
    // Two meshes per tier (left + right) — could merge but ~6 extra drawcalls
    // total is well under budget.
    if (tier.t === 'primary' || tier.t === 'secondary' || tier.t === 'tertiary') {
      const swOffset = tier.w / 2 + SIDEWALK_W / 2;
      // Explicit curb stone — narrow 0.20m dark strip flush with road, raised
      // ~0.06m, sits between asphalt edge and sidewalk so the elevation step
      // reads as a real kerb when seen from cockpit cam.
      const curbMat = new THREE.MeshStandardMaterial({
        color: 0x6a6a6e, roughness: 0.85, metalness: 0.0,
      });
      const curbInset = tier.w / 2 + 0.10;
      for (const side of [-1, 1]) {
        const curbGeo = emitParallelStrip(ways, _proj, {
          widthMeters: 0.20,
          offsetMeters: side * curbInset,
        });
        const curbMesh = new THREE.Mesh(curbGeo, curbMat);
        curbMesh.position.y = tier.y + 0.06;
        curbMesh.renderOrder = 1;
        curbMesh.receiveShadow = true;
        scene.add(curbMesh);
      }
      for (const side of [-1, 1]) {
        const swGeo = emitParallelStrip(ways, _proj, {
          widthMeters: SIDEWALK_W,
          offsetMeters: side * swOffset,
        });
        const swMesh = new THREE.Mesh(swGeo, sidewalkMat);
        swMesh.position.y = tier.y + 0.18;
        swMesh.renderOrder = 1;
        swMesh.receiveShadow = true;
        scene.add(swMesh);
      }
    }

    // Painted lane markings — MeshStandardMaterial so they receive shadow
    // and don't blow out under bloom. Color values target real-world paint
    // albedo (worn thermoplastic ~0.7 not pure white). Wear noise texture
    // breaks up uniform fields so bloom never sees a flat band of >1.0.
    // polygonOffset replaces the +0.005 Y-stack so paint sits coplanar with
    // the road and properly receives the car's directional shadow.
    const paintNoise = loadPaintNoiseTexture();

    // White center lane line — Singapore standard. Solid for trunk (single
    // carriageway feel), dashed for motorway (lane separator).
    if (tier.t === 'motorway' || tier.t === 'trunk') {
      const dashed = (tier.t === 'motorway');
      const stripeGeo = emitParallelStrip(ways, _proj, { widthMeters: tier.w * 0.10, dashed });
      const stripeMat = new THREE.MeshStandardMaterial({
        color: tier.t === 'motorway' ? 0xc0c0c0 : 0xb8b8b8,
        roughness: 0.85, metalness: 0.0, envMapIntensity: 0.3,
        map: paintNoise,
        polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -2,
        side: THREE.DoubleSide,
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = tier.y;
      stripe.renderOrder = 2;
      stripe.receiveShadow = true;
      scene.add(stripe);
    }

    // Yellow edge lines — Singapore standard for motorway/trunk/primary.
    // Inset 0.15m from road edge. Desaturated ochre 0xc9a23a (real paint),
    // not the LED-saturated 0xffd24a we previously used.
    if (tier.t === 'motorway' || tier.t === 'trunk' || tier.t === 'primary') {
      const edgeOffset = tier.w / 2 - 0.15;
      const edgeMat = new THREE.MeshStandardMaterial({
        color: 0xc9a23a,
        roughness: 0.85, metalness: 0.0, envMapIntensity: 0.3,
        map: paintNoise,
        polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -2,
        side: THREE.DoubleSide,
      });
      for (const side of [-1, 1]) {
        const edgeGeo = emitParallelStrip(ways, _proj, {
          widthMeters: 0.20,
          offsetMeters: side * edgeOffset,
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.y = tier.y;
        edge.renderOrder = 2;
        edge.receiveShadow = true;
        scene.add(edge);
      }
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

  // Zebra crossings at intersections of motorway/trunk/primary ways.
  const zebra = buildZebraCrossings(scene, data.ways, _proj, ['motorway', 'trunk', 'primary']);
  console.log(`[osm] ${totalWays} ways, tiers:`, counts, `+ ${zebra.count} zebra crossings`);
  return { proj: _proj, bbox: data.bbox, minimapSegs, ways: data.ways };
}

export function projectLatLng(lat, lng) {
  if (!_proj) throw new Error('projectLatLng called before buildOSMRoads');
  return _proj(lat, lng);
}

// (buildStripGeometry moved to ./road-emitter.js as emitParallelStrip — see T03 commit.)
