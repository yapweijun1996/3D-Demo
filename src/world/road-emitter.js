import * as THREE from 'three';

// SSOT for any geometry that follows OSM way polylines: roads, sidewalks,
// lane markings, lamp/tree placement. Two primitives:
//
//   emitParallelStrip(ways, project, opts) → BufferGeometry
//     a flat horizontal ribbon of given width, optionally offset perpendicular
//     to the way direction. UV box-projected from world XZ in meters so the
//     caller can apply a tiling PBR texture. Optional `dashed` mode skips
//     gap segments to draw lane stripes.
//
//   walkAtSpacing(ways, project, intervalMeters, callback)
//     iterates evenly-spaced points along every way at `intervalMeters`,
//     invoking callback({ x, z, perpX, perpZ, tanX, tanZ, wayIndex, k }).
//     k counts globally so callbacks can deterministically alternate sides
//     (k % 2) or pick a hash-based variant.
//
// Both routines walk OSM data the SAME way as the original buildStripGeometry,
// so legacy and new emitters give matching results at intersections.

const DASH_LEN  = 4.0;          // world units of dash + gap cycle
const DASH_DUTY = 0.55;         // 55% painted, 45% gap

// Snap projected XZ to a 0.02-unit grid. OSM nodes shared across ways still
// project to identical XZ (this is a no-op for them), but transient float
// drift between two builders consuming the same node — or between separate
// runs of project() — collapses to the same vertex. Closes T-junction gaps.
const SNAP = 50;                                  // 1 / 0.02
function snap(x) { return Math.round(x * SNAP) / SNAP; }

// --- emitParallelStrip ---------------------------------------------------
// opts: { widthMeters: number, offsetMeters?: number, dashed?: boolean }
// offsetMeters > 0 shifts the ribbon to the LEFT of way direction;
// offsetMeters < 0 shifts to the RIGHT. Width is centered on that offset.
export function emitParallelStrip(ways, project, opts) {
  const { widthMeters, offsetMeters = 0, dashed = false } = opts;
  const halfW = widthMeters / 2;

  const positions = [];
  const uvs = [];
  const indices = [];
  let vi = 0;

  function pushQuad(xa, za, xb, zb, perpX, perpZ) {
    // outer = +halfW from offset center; inner = -halfW
    const ax1 = xa + perpX * (offsetMeters + halfW);
    const az1 = za + perpZ * (offsetMeters + halfW);
    const ax2 = xa + perpX * (offsetMeters - halfW);
    const az2 = za + perpZ * (offsetMeters - halfW);
    const ax3 = xb + perpX * (offsetMeters + halfW);
    const az3 = zb + perpZ * (offsetMeters + halfW);
    const ax4 = xb + perpX * (offsetMeters - halfW);
    const az4 = zb + perpZ * (offsetMeters - halfW);
    positions.push(ax1, 0, az1, ax2, 0, az2, ax3, 0, az3, ax4, 0, az4);
    uvs.push(ax1, az1, ax2, az2, ax3, az3, ax4, az4);
    indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
    vi += 4;
  }

  for (const way of ways) {
    const pts = way.g.map(([lat, lng]) => {
      const [x, z] = project(lat, lng);
      return [snap(x), snap(z)];
    });
    let s = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      // perpendicular = rotate (dx, dz) by 90deg → (-dz, dx); normalize
      const perpX = -dz / len;
      const perpZ =  dx / len;
      if (dashed) {
        const startS = s;
        let cursor = 0;
        while (cursor < len) {
          const globalS = startS + cursor;
          const phase = ((globalS % DASH_LEN) + DASH_LEN) % DASH_LEN;
          const inDash = phase < DASH_LEN * DASH_DUTY;
          const remainInState = inDash
            ? (DASH_LEN * DASH_DUTY) - phase
            : DASH_LEN - phase;
          const advance = Math.max(0.05, Math.min(remainInState, len - cursor));
          if (inDash) {
            const t0 = cursor, t1 = cursor + advance;
            const xa = x1 + dx * (t0 / len), za = z1 + dz * (t0 / len);
            const xb = x1 + dx * (t1 / len), zb = z1 + dz * (t1 / len);
            pushQuad(xa, za, xb, zb, perpX, perpZ);
          }
          cursor += advance;
        }
        s += len;
      } else {
        pushQuad(x1, z1, x2, z2, perpX, perpZ);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  // Normals all +Y (flat horizontal). Setting directly is one BufferAttribute
  // cheaper than computeVertexNormals() and avoids NaN on degenerate verts.
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geo;
}

// --- walkAtSpacing -------------------------------------------------------
// Walks every way at evenly spaced arc-length intervals, calling cb with
// { x, z, perpX, perpZ, tanX, tanZ, wayIndex, k }. k is a global counter
// across all ways — deterministic, useful for InstancedMesh setMatrixAt(k)
// and for alternating sides via (k % 2).
export function walkAtSpacing(ways, project, intervalMeters, cb) {
  let k = 0;
  for (let wi = 0; wi < ways.length; wi++) {
    const pts = ways[wi].g.map(([lat, lng]) => {
      const [x, z] = project(lat, lng);
      return [snap(x), snap(z)];
    });
    let nextAt = intervalMeters;       // distance from way start to next sample
    let cumArc = 0;                    // distance covered by completed segments
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const tanX = dx / len, tanZ = dz / len;
      const perpX = -tanZ, perpZ = tanX;
      // Emit every sample whose absolute position falls inside this segment.
      while (nextAt <= cumArc + len) {
        const t = nextAt - cumArc;     // local distance into segment
        const x = x1 + tanX * t;
        const z = z1 + tanZ * t;
        cb({ x, z, perpX, perpZ, tanX, tanZ, wayIndex: wi, k });
        k++;
        nextAt += intervalMeters;
      }
      cumArc += len;
    }
  }
  return k;     // total count for callers to size InstancedMesh
}
