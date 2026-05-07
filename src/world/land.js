import * as THREE from 'three';
import { PALETTE } from '../config.js';

// Build land/water from real OSM coastline polygons.
//
// OSM coastline rule: water lies on the right when you walk a way forward,
// so land is on the left.  An open chain whose endpoints sit on (or near)
// the bbox border can be closed into a land polygon by walking the bbox
// edge *counter-clockwise* from end → corners → start (counter-clockwise
// keeps land on the left, matching the way orientation).
//
// Closed chains are island polygons as-is.  All polygons feed into
// THREE.Shape → ShapeGeometry (earcut) for green land mesh.  Outside the
// polygons is the ocean plate.

const OCEAN_SIZE  = 4000;
const LAND_COLOR  = PALETTE.land;
const OCEAN_COLOR = PALETTE.sea;
const STITCH_EPS  = 1.2;
const EDGE_EPS    = 40.0;

export async function buildLand(scene, proj, bbox) {
  // Layer 1 — huge ocean (visible past the playable area).
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE),
    new THREE.MeshStandardMaterial({ color: OCEAN_COLOR, roughness: 0.55, metalness: 0.05 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.20;
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Layer 2 — land plate sized to the OSM bbox (covers central SG core where
  // the road network lives). OSM-polygon "islands" overlay on top below.
  const [bxmin, bzmax] = proj(bbox[0], bbox[1]);   // SW
  const [bxmax, bzmin] = proj(bbox[2], bbox[3]);   // NE
  const landPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(bxmax - bxmin, bzmax - bzmin),
    new THREE.MeshStandardMaterial({ color: LAND_COLOR, roughness: 0.95 }),
  );
  landPlate.rotation.x = -Math.PI / 2;
  landPlate.position.set((bxmin + bxmax) / 2, -0.05, (bzmin + bzmax) / 2);
  landPlate.receiveShadow = true;
  scene.add(landPlate);

  // Project bbox to world to know where to walk for chain closure.
  const [minLat, minLng, maxLat, maxLng] = bbox;
  const [bx0, bz1] = proj(minLat, minLng);    // SW corner (south = +z)
  const [bx1, bz0] = proj(maxLat, maxLng);    // NE corner (north = -z)
  const wbox = { xMin: bx0, xMax: bx1, zMin: bz0, zMax: bz1 };

  let data;
  try {
    const res = await fetch('./assets/data/sg-coast.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.warn('[land] coastline fetch failed:', err);
    return;
  }

  const ways = data.ways.map(w => w.g.map(([la, lo]) => proj(la, lo)));
  const chains = stitchChains(ways);

  const landMat = new THREE.MeshStandardMaterial({
    color: LAND_COLOR, roughness: 0.95, metalness: 0.0,
  });

  let closedCount = 0, extendedCount = 0;
  const landGroup = new THREE.Group();

  for (const chain of chains) {
    if (chain.length < 4) continue;
    const start = chain[0];
    const end = chain[chain.length - 1];
    const closed = Math.hypot(start[0] - end[0], start[1] - end[1]) < STITCH_EPS * 2;

    let poly;
    if (closed) {
      poly = chain;
      closedCount++;
    } else {
      // Try to close by walking bbox edge counter-clockwise.
      const closure = walkBboxEdge(end, start, wbox);
      if (!closure) continue;                  // both endpoints not on edge — skip
      poly = chain.concat(closure);
      extendedCount++;
    }

    if (poly.length < 4) continue;
    if (Math.abs(signedArea(poly)) < 100) continue;   // tiny artifact

    const shape = new THREE.Shape();
    shape.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], poly[i][1]);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, landMat);
    mesh.position.y = 0.0;
    mesh.receiveShadow = true;
    landGroup.add(mesh);
  }
  scene.add(landGroup);

  console.log(`[land] ${chains.length} chains → ${closedCount} closed + ${extendedCount} bbox-extended polygons`);
}

// ---------- helpers ----------

function stitchChains(ways) {
  const remaining = ways.map(w => w.slice());
  const chains = [];
  while (remaining.length) {
    let chain = remaining.shift();
    let extended = true;
    while (extended) {
      extended = false;
      const head = chain[0];
      const tail = chain[chain.length - 1];
      for (let i = 0; i < remaining.length; i++) {
        const w = remaining[i];
        const ws = w[0], we = w[w.length - 1];
        if (close(tail, ws, STITCH_EPS)) { chain = chain.concat(w.slice(1)); remaining.splice(i, 1); extended = true; break; }
        if (close(tail, we, STITCH_EPS)) { chain = chain.concat(w.slice(0, -1).reverse()); remaining.splice(i, 1); extended = true; break; }
        if (close(head, we, STITCH_EPS)) { chain = w.concat(chain.slice(1)); remaining.splice(i, 1); extended = true; break; }
        if (close(head, ws, STITCH_EPS)) { chain = w.slice().reverse().concat(chain.slice(1)); remaining.splice(i, 1); extended = true; break; }
      }
    }
    chains.push(chain);
  }
  return chains;
}

// Walk counter-clockwise around bbox from B back to A, emitting corner waypoints.
// Edges (CCW): bottom-right corner → top-right → top-left → bottom-left → bottom-right.
// We compute "edge index" for each point and walk forward through edges.
//   edge 0 = right  (xMax, z varies)
//   edge 1 = top    (x varies, zMin)
//   edge 2 = left   (xMin, z varies)
//   edge 3 = bottom (x varies, zMax)
function walkBboxEdge(B, A, w) {
  const eB = edgeOf(B, w);
  const eA = edgeOf(A, w);
  if (eB == null || eA == null) return null;

  const corners = [
    [w.xMax, w.zMax],   // SE — between bottom (3) and right (0)
    [w.xMax, w.zMin],   // NE — between right (0) and top (1)
    [w.xMin, w.zMin],   // NW — between top (1) and left (2)
    [w.xMin, w.zMax],   // SW — between left (2) and bottom (3)
  ];
  // CCW order of corners after each edge: edge 0 → NE, edge 1 → NW, edge 2 → SW, edge 3 → SE
  const cornerAfter = [1, 2, 3, 0];

  const out = [];
  let edge = eB;
  let safety = 16;
  while (safety-- > 0) {
    if (edge === eA) {
      // On same edge — check if we'd need to wrap full loop or stop here.
      // Compare progress along the edge in CCW direction.
      if (ccwProgress(B, A, edge, w) > 0) break;
    }
    const corner = corners[cornerAfter[edge]];
    out.push(corner);
    edge = (edge + 1) % 4;
  }
  return out;
}

function edgeOf(p, w) {
  if (Math.abs(p[0] - w.xMax) < EDGE_EPS) return 0;   // right
  if (Math.abs(p[1] - w.zMin) < EDGE_EPS) return 1;   // top (north, smaller z)
  if (Math.abs(p[0] - w.xMin) < EDGE_EPS) return 2;   // left
  if (Math.abs(p[1] - w.zMax) < EDGE_EPS) return 3;   // bottom (south, larger z)
  return null;
}

// Is A "ahead of" B in CCW direction along the edge?
function ccwProgress(B, A, edge, w) {
  switch (edge) {
    case 0: return B[1] - A[1];   // right edge: CCW = z decreasing → A.z < B.z is ahead
    case 1: return B[0] - A[0];   // top edge: CCW = x decreasing
    case 2: return A[1] - B[1];   // left edge: CCW = z increasing
    case 3: return A[0] - B[0];   // bottom edge: CCW = x increasing
  }
  return 0;
}

function signedArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    s += (x2 - x1) * (z2 + z1);
  }
  return s;
}

function close(a, b, eps) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < eps;
}
