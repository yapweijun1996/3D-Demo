import * as THREE from 'three';
import { loadSandTextures, setRepeatMeters } from './textures.js';

// Render Singapore coastline as a wide PBR sand ribbon (not a 1px line).
// Source: assets/data/sg-coast.json (OSM natural=coastline export).
// Uses the same projection as roads-osm.js (passed in via proj fn).
//
// Each consecutive pair of points becomes a quad strip W meters wide,
// centered on the line — 0.5W into water, 0.5W onto land. UVs are box-
// projected in meters so the shared sand texture (repeat = 1/3m) tiles
// uniformly across all coast segments.
export async function buildCoastline(scene, proj) {
  let data;
  try {
    const res = await fetch('./assets/data/sg-coast.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.warn('[coast] failed to load:', err);
    return;
  }

  const SAND_TILE_M = 3;
  const sandMaps = loadSandTextures();
  setRepeatMeters(sandMaps, 1 / SAND_TILE_M, 1 / SAND_TILE_M);

  const WIDTH = 5.0;             // world units; ~half on each side of coast line
  const halfW = WIDTH / 2;
  const positions = [];
  const uvs = [];
  const indices = [];
  let vi = 0;

  for (const way of data.ways) {
    const pts = way.g.map(([lat, lng]) => proj(lat, lng));
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nx = -dz / len * halfW;
      const nz =  dx / len * halfW;
      const ax1 = x1 + nx, az1 = z1 + nz;
      const ax2 = x1 - nx, az2 = z1 - nz;
      const ax3 = x2 + nx, az3 = z2 + nz;
      const ax4 = x2 - nx, az4 = z2 - nz;
      positions.push(ax1, 0, az1, ax2, 0, az2, ax3, 0, az3, ax4, 0, az4);
      uvs.push(ax1, az1, ax2, az2, ax3, az3, ax4, az4);
      indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
      vi += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xefdcb2, roughness: 1.0, metalness: 0.0,
    side: THREE.DoubleSide,
    ...sandMaps,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.04;          // sit above land plate (-0.05) and below roads (0.04+)
  mesh.receiveShadow = true;
  scene.add(mesh);

  console.log(`[coast] ${data.ways.length} ways rendered as PBR sand strip`);
}
