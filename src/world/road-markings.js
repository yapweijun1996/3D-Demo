import * as THREE from 'three';

// Zebra crossings at OSM intersections. Detects intersections by hashing way
// endpoints — if a coordinate is shared by 2+ primary-or-better ways, place
// a striped 6m × 4m plane there. The procedural fragment shader paints
// alternating black/white bars, so no texture asset is needed and the
// pattern is sharp at any zoom (no mipmap blur).

const ZEBRA_W = 6.0;
const ZEBRA_D = 4.0;
const STRIPE_COUNT = 6;     // 6 stripes → 3 white + 3 black bars

// Coord key: 5 decimal places ≈ 1m precision at SG latitude. Catches
// intersections whose endpoints don't quite match exactly.
function keyOf(lat, lng) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

const stripeShader = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */ `
    varying vec2 vUv;
    uniform float stripes;
    void main() {
      float stripe = step(0.5, fract(vUv.y * stripes));
      vec3 col = mix(vec3(0.05), vec3(0.95), stripe);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function buildZebraCrossings(scene, ways, project, allowedTiers) {
  const allowed = new Set(allowedTiers);
  const counts = new Map();      // key → { count, lat, lng, dirSamples }

  // Hash endpoints of all primary+ ways; track approach direction (way's
  // first segment) so we can roughly orient the zebra.
  for (const w of ways) {
    if (!allowed.has(w.t)) continue;
    if (w.g.length < 2) continue;
    const [first, last] = [w.g[0], w.g[w.g.length - 1]];
    for (const [lat, lng] of [first, last]) {
      const k = keyOf(lat, lng);
      const e = counts.get(k);
      if (e) e.count++;
      else counts.set(k, { count: 1, lat, lng, way: w });
    }
  }

  // Geometry shared across all crossings (one drawcall via InstancedMesh).
  const geo = new THREE.PlaneGeometry(ZEBRA_W, ZEBRA_D);
  geo.rotateX(-Math.PI / 2);    // lie flat on XZ
  const mat = new THREE.ShaderMaterial({
    uniforms: { stripes: { value: STRIPE_COUNT } },
    vertexShader: stripeShader.vertex,
    fragmentShader: stripeShader.fragment,
    polygonOffset: true,
    polygonOffsetFactor: -2,    // sit visually above the asphalt
  });

  const intersections = [...counts.values()].filter(e => e.count >= 2);
  // Cap to avoid drawcall explosion and visual clutter.
  const cap = Math.min(intersections.length, 120);
  const inst = new THREE.InstancedMesh(geo, mat, cap);
  inst.frustumCulled = false;   // single mesh covers wide area
  inst.renderOrder = 3;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();

  for (let i = 0; i < cap; i++) {
    const e = intersections[i];
    const [x, z] = project(e.lat, e.lng);
    p.set(x, 0.22, z);          // sit above road tier max y (0.20)
    // Orientation: sample first segment of one of the meeting ways.
    let yaw = 0;
    if (e.way.g.length >= 2) {
      const [la1, lo1] = e.way.g[0];
      const [la2, lo2] = e.way.g[1];
      const [x1, z1] = project(la1, lo1);
      const [x2, z2] = project(la2, lo2);
      yaw = Math.atan2(z2 - z1, x2 - x1);
    }
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    m.compose(p, q, v);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  return { count: cap };
}
