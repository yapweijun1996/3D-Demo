import * as THREE from 'three';

// Render Singapore coastline as a thin sand-colored strip line.
// Source: assets/data/sg-coast.json (OSM natural=coastline export).
// Uses the same projection as roads-osm.js (passed in via proj fn).
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

  // Build line strip geometry — every coastline segment is a 1-pixel line at y=0.05
  const positions = [];
  for (const way of data.ways) {
    const pts = way.g.map(([lat, lng]) => proj(lat, lng));
    for (let i = 0; i < pts.length - 1; i++) {
      positions.push(pts[i][0], 0.05, pts[i][1], pts[i+1][0], 0.05, pts[i+1][1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xeed8a8 });
  const line = new THREE.LineSegments(geo, mat);
  scene.add(line);

  console.log(`[coast] ${data.ways.length} ways rendered`);
}
