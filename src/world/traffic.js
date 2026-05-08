import * as THREE from 'three';

// NPC traffic — 40 cars driving along OSM primary/trunk/motorway ways.
// Pure visuals (no Rapier). Each car has a CatmullRomCurve3 path + progress
// 0..1 advanced per frame; getPointAt + getTangentAt drive matrix update.
//
// One InstancedMesh per vehicle type (sedan / bus / taxi). Per-instance body
// color via instanceColor jitter (sedan only). When a car finishes its way,
// it picks a new random one from the candidate pool. Far cars (>400m) get
// zero-scale matrix to "hide" without per-instance visibility flag.

const SPEED = { sedan: 12, taxi: 10, bus: 7 };           // m/s along path
const DESPAWN_DIST2 = 400 * 400;
const SPAWN_RADIUS  = 300;

export function buildTraffic(scene, ways, project, opts = {}) {
  const COUNT = opts.count || 40;
  // Filter: only long ways (>120m) on big roads — ensures cars actually move.
  const candidates = [];
  for (const w of ways) {
    if (!['motorway', 'trunk', 'primary'].includes(w.t)) continue;
    if (w.g.length < 4) continue;
    const pts = w.g.map(([la, lo]) => {
      const [x, z] = project(la, lo);
      return new THREE.Vector3(x, 0, z);
    });
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]);
    if (len < 120) continue;
    candidates.push({ pts, length: len });
  }
  if (candidates.length === 0) {
    console.warn('[traffic] no candidate ways — skipping');
    return { tick: () => {} };
  }

  // 3 vehicle InstancedMeshes — sedan/taxi/bus split by index parity.
  const counts = {
    sedan: Math.round(COUNT * 0.6),
    taxi:  Math.round(COUNT * 0.25),
    bus:   COUNT - Math.round(COUNT * 0.6) - Math.round(COUNT * 0.25),
  };

  const sedanMesh = makeVehicleMesh('sedan', counts.sedan);
  const taxiMesh  = makeVehicleMesh('taxi',  counts.taxi);
  const busMesh   = makeVehicleMesh('bus',   counts.bus);
  scene.add(sedanMesh.group);
  scene.add(taxiMesh.group);
  scene.add(busMesh.group);

  // Per-car state
  const cars = [];
  function spawnCar(type, instIndex) {
    const path = pickPath(candidates);
    const speed = SPEED[type] * (0.85 + Math.random() * 0.30);
    return {
      type, instIndex,
      path, totalLen: path.length,
      progress: Math.random(),
      speed,
      direction: Math.random() < 0.5 ? 1 : -1,
    };
  }
  for (let i = 0; i < counts.sedan; i++) cars.push(spawnCar('sedan', i));
  for (let i = 0; i < counts.taxi;  i++) cars.push(spawnCar('taxi',  i));
  for (let i = 0; i < counts.bus;   i++) cars.push(spawnCar('bus',   i));

  // Per-instance HSL color jitter on sedans (taxi/bus stay fixed).
  const baseSedan = new THREE.Color(0xc8c0b0);
  const tmpHSL = {};
  const tmpCol = new THREE.Color();
  for (let i = 0; i < counts.sedan; i++) {
    baseSedan.getHSL(tmpHSL);
    tmpCol.setHSL(
      (Math.random()) % 1,                       // any hue (cars come in all colors)
      0.5 + Math.random() * 0.4,
      0.35 + Math.random() * 0.25
    );
    sedanMesh.inst.setColorAt(i, tmpCol);
  }
  if (sedanMesh.inst.instanceColor) sedanMesh.inst.instanceColor.needsUpdate = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sV = new THREE.Vector3(1, 1, 1);
  const sZero = new THREE.Vector3(0, 0, 0);
  const tV = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  // Player position — passed via opts.getPlayerPos(). Used for distance cull.
  const getPlayerPos = opts.getPlayerPos || (() => new THREE.Vector3());

  function tick(now, dt) {
    if (!dt) return;
    const playerPos = getPlayerPos();

    for (const c of cars) {
      c.progress += (c.speed * c.direction * dt) / c.totalLen;
      if (c.progress >= 1) {
        // Reached end — reassign new path, keep direction
        c.path = pickPath(candidates);
        c.totalLen = c.path.length;
        c.progress = 0;
      } else if (c.progress < 0) {
        // Wrapped around going reverse — reassign and flip back to forward
        c.path = pickPath(candidates);
        c.totalLen = c.path.length;
        c.progress = 1;
      }

      const t = c.direction === 1 ? c.progress : (1 - c.progress);
      const tClamped = Math.max(0.001, Math.min(0.999, t));
      const pos = c.path.curve.getPointAt(tClamped);
      const tan = c.path.curve.getTangentAt(tClamped);

      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const d2 = dx * dx + dz * dz;

      const yaw = Math.atan2(tan.x * c.direction, tan.z * c.direction);
      q.setFromAxisAngle(yAxis, yaw);
      tV.set(pos.x, 0.4, pos.z);

      if (d2 > DESPAWN_DIST2) {
        // Hide via zero-scale matrix (InstancedMesh has no per-inst visibility)
        m.compose(tV, q, sZero);
      } else {
        m.compose(tV, q, sV);
      }

      const meshRef = c.type === 'sedan' ? sedanMesh : c.type === 'taxi' ? taxiMesh : busMesh;
      meshRef.inst.setMatrixAt(c.instIndex, m);
    }

    sedanMesh.inst.instanceMatrix.needsUpdate = true;
    taxiMesh.inst.instanceMatrix.needsUpdate = true;
    busMesh.inst.instanceMatrix.needsUpdate = true;
  }

  console.log(`[traffic] ${cars.length} NPC cars (${counts.sedan} sedan / ${counts.taxi} taxi / ${counts.bus} bus)`);
  return { tick, cars };
}

// ---- helpers ----

function pickPath(candidates) {
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  // Cache curve on the candidate the first time it's picked. Reuse across cars.
  if (!pick.curve) {
    pick.curve = new THREE.CatmullRomCurve3(pick.pts, false, 'catmullrom', 0.0);
    pick.curve.arcLengthDivisions = Math.max(50, pick.pts.length * 4);
  }
  return pick;
}

function makeVehicleMesh(type, count) {
  // Build a simple box-car merged geometry — body + cabin + 4 wheels.
  const group = new THREE.Group();
  let bodyGeo, bodyMat;

  if (type === 'sedan') {
    bodyGeo = makeSedanGeometry();
    bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.5 });
  } else if (type === 'taxi') {
    bodyGeo = makeSedanGeometry();
    bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c4a8c, roughness: 0.45, metalness: 0.4 });
  } else { // bus
    bodyGeo = makeBusGeometry();
    bodyMat = new THREE.MeshStandardMaterial({ color: 0xc25540, roughness: 0.5, metalness: 0.3 });
  }

  const inst = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (type === 'sedan') {
    inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  }
  inst.castShadow = true;
  inst.frustumCulled = false;
  group.add(inst);
  return { group, inst };
}

// Simple sedan: low body box + small cabin box. ~60 verts.
function makeSedanGeometry() {
  const geos = [];
  const body = new THREE.BoxGeometry(2.0, 0.6, 4.4);
  body.translate(0, 0.4, 0);
  geos.push(body);
  const cabin = new THREE.BoxGeometry(1.8, 0.55, 2.2);
  cabin.translate(0, 1.0, -0.2);
  geos.push(cabin);
  return mergeBoxGeos(geos);
}

// Bus: long flat box with slight cabin lift.
function makeBusGeometry() {
  const geos = [];
  const body = new THREE.BoxGeometry(2.4, 1.6, 9.0);
  body.translate(0, 1.2, 0);
  geos.push(body);
  return mergeBoxGeos(geos);
}

// Tiny merge utility (no addon dep). Concat positions/normals/uvs/indices.
function mergeBoxGeos(geos) {
  let posCount = 0, idxCount = 0;
  for (const g of geos) {
    posCount += g.attributes.position.count;
    if (g.index) idxCount += g.index.count;
  }
  const pos = new Float32Array(posCount * 3);
  const norm = new Float32Array(posCount * 3);
  const uv = new Float32Array(posCount * 2);
  const idx = new Uint32Array(idxCount);
  let pOff = 0, iOff = 0;
  for (const g of geos) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    const gu = g.attributes.uv.array;
    pos.set(gp, pOff * 3);
    norm.set(gn, pOff * 3);
    uv.set(gu, pOff * 2);
    if (g.index) {
      const gi = g.index.array;
      for (let k = 0; k < gi.length; k++) idx[iOff + k] = gi[k] + pOff;
      iOff += gi.length;
    }
    pOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
