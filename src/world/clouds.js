import * as THREE from 'three';

// Drifting alpha-textured cloud planes overhead.  Cheap visual upgrade
// for daytime sky — adds movement and depth without volumetric cost.
//
// Implementation:
//   • One generated radial-gradient canvas → CanvasTexture (1 drawcall once).
//   • InstancedMesh of N billboarded planes facing -Y (down toward camera).
//   • Each instance gets random XZ position, scale, drift speed.
//   • Tick translates each instance's matrix on +X; wraps when off-edge.
//
// Clouds sit at y=140 (well above buildings at ~64).  In night mode they
// fade to near-invisible by alpha tweak — handled by daynight if extended,
// for now they stay visible (subtle moonlit clouds).

const COUNT = 24;
const FIELD_HALF = 220;          // tighter than world bounds — clouds near camera
const ALTITUDE = 55;             // visible from car-height camera (was 140 = above frustum)
const DRIFT_SPEED_MIN = 0.6;     // world units per second
const DRIFT_SPEED_MAX = 1.8;

export function buildClouds(scene, tickers) {
  const tex = new THREE.CanvasTexture(makeCloudCanvas(256));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(60, 36);
  geo.rotateX(Math.PI / 2);                      // face down (lay flat)
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.85,
    depthWrite: false, fog: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.renderOrder = -1;                         // behind everything visible
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const speeds = new Float32Array(COUNT);
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const x = (Math.random() * 2 - 1) * FIELD_HALF;
    const z = (Math.random() * 2 - 1) * FIELD_HALF;
    const s = 0.7 + Math.random() * 1.6;        // scale variation
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = z;
    positions[i * 3 + 2] = s;
    speeds[i] = DRIFT_SPEED_MIN + Math.random() * (DRIFT_SPEED_MAX - DRIFT_SPEED_MIN);
    dummy.position.set(x, ALTITUDE, z);
    dummy.scale.set(s, 1, s);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  tickers.push((now, dt) => {
    for (let i = 0; i < COUNT; i++) {
      let x = positions[i * 3 + 0] + speeds[i] * dt;
      const z = positions[i * 3 + 1];
      const s = positions[i * 3 + 2];
      if (x > FIELD_HALF + 40) x = -FIELD_HALF - 40;
      positions[i * 3 + 0] = x;
      dummy.position.set(x, ALTITUDE, z);
      dummy.scale.set(s, 1, s);
      dummy.rotation.y = i * 0.7;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// Generate a soft radial-gradient cloud blob with multiple internal puffs.
function makeCloudCanvas(size) {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // 5 overlapping white blobs to make a fluffy cloud
  for (let i = 0; i < 5; i++) {
    const cx = size / 2 + (Math.random() - 0.5) * size * 0.4;
    const cy = size / 2 + (Math.random() - 0.5) * size * 0.18;
    const r = size * (0.18 + Math.random() * 0.18);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,    'rgba(255,255,255,0.95)');
    g.addColorStop(0.5,  'rgba(255,255,255,0.55)');
    g.addColorStop(1,    'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return cnv;
}
