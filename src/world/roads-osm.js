import * as THREE from 'three';

// Render Singapore's real motorway + trunk road network from OSM data.
// Source: assets/data/sg-roads.json (Overpass API export, May 2026)
// Output: 2 BufferGeometry meshes (motorway + trunk), 2 drawcalls total.
//
// Projection: equirectangular meter projection centered on bbox center,
// scaled so the wider axis fits ±worldHalf. Aspect ratio preserved.
//
// Returns the projection helpers so other systems (landmarks) can use the
// same lat/lng → x/z mapping.

const WORLD_HALF = 320;
const LAT_TO_M = 111000;

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

  // Singleton projection: lat/lng → world [x, z] (north = -z, east = +x)
  _proj = (lat, lng) => {
    const dx = (lng - cLng) * lngToM;
    const dz = -(lat - cLat) * LAT_TO_M;
    return [dx * worldScale, dz * worldScale];
  };

  const motorways = data.ways.filter(w => w.t === 'motorway');
  const trunks    = data.ways.filter(w => w.t === 'trunk');

  // Motorway: wider + brighter asphalt grey, lifted clearly above grass.
  // Use MeshBasicMaterial (unlit) so dusk shadow doesn't darken it into invisibility.
  const motorwayGeo = buildStripGeometry(motorways, _proj, 8.0);
  const motorwayMat = new THREE.MeshBasicMaterial({ color: 0x6a6a72 });
  const motorwayMesh = new THREE.Mesh(motorwayGeo, motorwayMat);
  motorwayMesh.position.y = 0.15;
  scene.add(motorwayMesh);

  // Trunk: slightly narrower + lighter (visible hierarchy)
  const trunkGeo = buildStripGeometry(trunks, _proj, 5.5);
  const trunkMat = new THREE.MeshBasicMaterial({ color: 0x7a7a82 });
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.position.y = 0.10;
  scene.add(trunkMesh);

  // Pre-project all road points for minimap consumption (cheap — done once at boot)
  const minimapSegs = [];
  for (const w of [...motorways, ...trunks]) {
    const pts = w.g.map(([la, lo]) => _proj(la, lo));
    for (let i = 0; i < pts.length - 1; i++) {
      minimapSegs.push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  }

  console.log(`[osm] ${motorways.length} motorways + ${trunks.length} trunks rendered, 2 drawcalls`);
  return { proj: _proj, bbox: data.bbox, minimapSegs };
}

// Get the singleton projector (after buildOSMRoads has run).
export function projectLatLng(lat, lng) {
  if (!_proj) throw new Error('projectLatLng called before buildOSMRoads');
  return _proj(lat, lng);
}

// Build a single BufferGeometry containing ribbon strips for all road segments.
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
      // perpendicular in XZ plane
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
  geo.computeVertexNormals();
  return geo;
}
