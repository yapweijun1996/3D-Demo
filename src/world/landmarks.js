import * as THREE from 'three';
import { CFG } from '../config.js';
import { addBox, addCyl } from '../colliders.js';

// Singapore landmark suite: Marina Bay Sands, Supertrees, Singapore Flyer, Merlion.
// Each landmark is a stylized low-poly impression — not a faithful model — with
// emissive accents so it reads at dusk.

// Real Singapore coordinates (lat, lng). Resolved via projectLatLng if provided,
// else fall back to the original v0.2 hardcoded layout.
const REAL_POS = {
  mbs:        [1.2834, 103.8607],
  supertree:  [1.2816, 103.8636],
  flyer:      [1.2893, 103.8631],
  merlion:    [1.2868, 103.8545],
};
const FALLBACK_POS = {
  mbs:        [-110, 0, -130],
  supertree:  [ -70, 0,   60],
  flyer:      [ 110, 0,   70],
  merlion:    [ -50, 0,  -70],
};

export function buildLandmarks(scene, proj) {
  const tickers = [];
  const pos = (key) => {
    if (proj) {
      const [lat, lng] = REAL_POS[key];
      const [x, z] = proj(lat, lng);
      return [x, 0, z];
    }
    return FALLBACK_POS[key];
  };
  buildMarinaBaySands(scene, pos('mbs'));
  buildSupertreeGrove(scene, pos('supertree'), tickers);
  buildSingaporeFlyer(scene, pos('flyer'), tickers);
  buildMerlion(scene, pos('merlion'));
  return tickers;
}

// ---------- Marina Bay Sands ----------
// Three slanted towers connected by a long boat-shaped SkyPark roof.
function buildMarinaBaySands(scene, [cx, cy, cz]) {
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  scene.add(g);

  const towerMat = new THREE.MeshStandardMaterial({ color: 0xe6e2d6, roughness: 0.55, metalness: 0.2 });
  const winMat   = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, emissive: 0x6688a8, emissiveIntensity: 0.35,
                                                    roughness: 0.3, metalness: 0.6 });
  const skyMat   = new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 0.55, metalness: 0.3 });

  const towerH = 60, towerW = 14, towerD = 7;
  const offsets = [-22, 0, 22];

  for (let i = 0; i < offsets.length; i++) {
    const ox = offsets[i];
    // Each tower is two slanted blocks meeting at top — approximate by tilted box pair
    const left = new THREE.Mesh(new THREE.BoxGeometry(towerW * 0.45, towerH, towerD), towerMat);
    left.position.set(ox - towerW * 0.18, towerH / 2, 0);
    left.rotation.z = 0.06;
    left.castShadow = left.receiveShadow = true;
    g.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(towerW * 0.45, towerH, towerD), towerMat);
    right.position.set(ox + towerW * 0.18, towerH / 2, 0);
    right.rotation.z = -0.06;
    right.castShadow = right.receiveShadow = true;
    g.add(right);
    // Window strip overlay (emissive)
    for (const sx of [left, right]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(towerW * 0.42, towerH * 0.95, 0.2), winMat);
      w.position.copy(sx.position);
      w.position.z = towerD / 2 + 0.05;
      w.rotation.copy(sx.rotation);
      g.add(w);
      const w2 = w.clone();
      w2.position.z = -towerD / 2 - 0.05;
      g.add(w2);
    }
    addBox(cx + ox, cz, towerW * 0.6, towerD * 0.6);
  }

  // SkyPark — long curved roof linking the three towers (boat shape)
  const skyL = 70, skyW = 9, skyT = 2.2;
  const sky = new THREE.Mesh(new THREE.BoxGeometry(skyL, skyT, skyW), skyMat);
  sky.position.set(0, towerH + skyT / 2, 0);
  sky.castShadow = sky.receiveShadow = true;
  g.add(sky);
  // Boat upturn at one end
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(skyW / 2, skyW / 2, skyT, 24, 1, false, 0, Math.PI),
    skyMat
  );
  tip.rotation.z = Math.PI / 2;
  tip.position.set(skyL / 2 + 1.5, towerH + skyT / 2, 0);
  g.add(tip);
  // Pool deck strip
  const pool = new THREE.Mesh(
    new THREE.BoxGeometry(skyL * 0.85, 0.1, skyW * 0.6),
    new THREE.MeshStandardMaterial({ color: 0x4ec0e6, emissive: 0x4ec0e6, emissiveIntensity: 0.3, roughness: 0.25 })
  );
  pool.position.set(0, towerH + skyT + 0.1, 0);
  g.add(pool);
  // Palm row on roof
  for (let i = -3; i <= 3; i++) {
    const p = makePalm(0.6);
    p.position.set(i * 8, towerH + skyT + 0.2, skyW / 2 - 0.8);
    g.add(p);
  }
}

// ---------- Supertree grove (InstancedMesh) ----------
// Layout: 6 trees. Geometries (trunk, disk, strip, spoke) shared across all trees
// via InstancedMesh — 6×20=120 mesh → 4 drawcalls.
function buildSupertreeGrove(scene, [cx, cy, cz], tickers) {
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  scene.add(g);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x383036, roughness: 0.85 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x6a3a78, emissive: 0x9a3aa8, emissiveIntensity: 0.7,
    roughness: 0.6, metalness: 0.2,
  });
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0xff66c8, emissive: 0xff66c8, emissiveIntensity: 1.2, roughness: 0.4,
  });

  const layout = [
    [  0,   0, 22], [ 14, -10, 26], [-14, -10, 20],
    [ 18,  12, 18], [-18,  12, 24], [  0,  20, 16],   // shorter (16-26 was 22-32 — too tall)
  ];
  const N = layout.length;

  // Thicker trunk: 1.8m top → 2.4m base (was 1.0/1.4 → looked like power lines)
  const trunkGeo = new THREE.CylinderGeometry(1.8, 2.4, 1, 14);
  const diskGeo  = new THREE.CylinderGeometry(8.0, 6.5, 1.2, 18);  // bigger canopy (was 5.5/4.5)
  const stripGeo = new THREE.BoxGeometry(0.30, 1, 0.12);            // thicker accent strips
  const spokeGeo = new THREE.BoxGeometry(11, 0.22, 0.3);            // longer + thicker spokes

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const disks  = new THREE.InstancedMesh(diskGeo, canopyMat, N);
  const strips = new THREE.InstancedMesh(stripGeo, stripMat, N * 6);
  const spokes = new THREE.InstancedMesh(spokeGeo, canopyMat, N * 12);
  trunks.castShadow = true;
  disks.castShadow = true;

  const m = new THREE.Matrix4();
  const tV = new THREE.Vector3();
  const sV = new THREE.Vector3();
  const eR = new THREE.Euler();
  const qR = new THREE.Quaternion();
  const ID_Q = new THREE.Quaternion();

  for (let i = 0; i < N; i++) {
    const [x, z, h] = layout[i];
    // trunk: y-scale = h, position center y = h/2
    tV.set(x, h / 2, z); sV.set(1, h, 1);
    m.compose(tV, ID_Q, sV);
    trunks.setMatrixAt(i, m);

    // disk: top of trunk + 0.4
    tV.set(x, h + 0.4, z); sV.set(1, 1, 1);
    m.compose(tV, ID_Q, sV);
    disks.setMatrixAt(i, m);

    // strips: 6 around trunk, height = h*0.92 → scale Y, rotated to face out
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      tV.set(x + Math.cos(a) * 2.0, h / 2, z + Math.sin(a) * 2.0);  // strips on bigger trunk
      eR.set(0, -a, 0);
      qR.setFromEuler(eR);
      sV.set(1, h * 0.92, 1);
      m.compose(tV, qR, sV);
      strips.setMatrixAt(i * 6 + s, m);
    }

    // spokes: 12 fan above disk
    for (let s = 0; s < 12; s++) {
      const a = (s / 12) * Math.PI * 2;
      tV.set(x, h + 0.9, z);
      eR.set(0, a, 0);
      qR.setFromEuler(eR);
      sV.set(1, 1, 1);
      m.compose(tV, qR, sV);
      spokes.setMatrixAt(i * 12 + s, m);
    }

    addCyl(cx + x, cz + z, 1.6);
  }
  trunks.instanceMatrix.needsUpdate = true;
  disks.instanceMatrix.needsUpdate = true;
  strips.instanceMatrix.needsUpdate = true;
  spokes.instanceMatrix.needsUpdate = true;
  g.add(trunks); g.add(disks); g.add(strips); g.add(spokes);

  tickers.push((t) => {
    canopyMat.emissiveIntensity = 0.55 + Math.sin(t * 1.6) * 0.25;
  });
}

// ---------- Singapore Flyer ----------
function buildSingaporeFlyer(scene, [cx, cy, cz], tickers) {
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  scene.add(g);

  const supportMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.5, metalness: 0.7 });
  const rimMat     = new THREE.MeshStandardMaterial({ color: 0xa8b2bf, roughness: 0.4, metalness: 0.85 });
  const podMat     = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2a0, emissiveIntensity: 0.5,
                                                       roughness: 0.3, metalness: 0.4 });

  const wheelR = 26;
  const wheelHeight = 8 + wheelR;

  // A-frame supports
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, wheelHeight, 10), supportMat);
    leg.position.set(sx * 8, wheelHeight / 2, 0);
    leg.rotation.z = -sx * 0.18;
    leg.castShadow = true;
    g.add(leg);
  }
  addCyl(cx, cz, 9);

  // wheel rim torus — main outer ring is fat + visible from far away
  const wheel = new THREE.Group();
  wheel.position.set(0, wheelHeight, 0);
  wheel.rotation.y = Math.PI / 2;
  g.add(wheel);

  // double parallel main rims (no shadow — too expensive for distant background)
  const rimMain1 = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.55, 10, 48), rimMat);
  rimMain1.position.x = 0.8;
  rimMain1.castShadow = false;
  wheel.add(rimMain1);
  const rimMain2 = rimMain1.clone();
  rimMain2.position.x = -0.8;
  wheel.add(rimMain2);
  const rimInner = new THREE.Mesh(new THREE.TorusGeometry(wheelR - 1.5, 0.2, 6, 48), rimMat);
  rimInner.castShadow = false;
  wheel.add(rimInner);

  // spokes — 12 thicker bars
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, wheelR * 2 - 1, 6), rimMat);
    spoke.rotation.x = Math.PI / 2;
    spoke.rotation.z = a;
    spoke.castShadow = false;
    wheel.add(spoke);
  }

  // pods
  const pods = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const pod = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), podMat);
    pod.position.set(0, Math.sin(a) * wheelR, Math.cos(a) * wheelR);
    pod.castShadow = false;
    wheel.add(pod);
    pods.push({ pod, baseAngle: a });
  }

  // rotate wheel + keep pods upright (counter-rotate)
  tickers.push((t) => {
    wheel.rotation.x = -t * 0.12;
    for (const p of pods) {
      p.pod.rotation.x = t * 0.12;
    }
  });
}

// ---------- Merlion ----------
function buildMerlion(scene, [cx, cy, cz]) {
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  scene.add(g);

  // Pedestal
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.6, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a8a8e, roughness: 0.85 })
  );
  ped.position.y = 0.6;
  ped.castShadow = ped.receiveShadow = true;
  g.add(ped);
  addCyl(cx, cz, 2.8);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xece6d4, roughness: 0.7 });

  // Fish body — fat tapered cylinder lying on its side, curving upward at tail
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.7, 5.5, 12), stoneMat);
  body.position.set(0, 2.4, 0);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  g.add(body);

  // Tail flare
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 1.6, 12),
    stoneMat
  );
  tail.position.set(-3.2, 3.6, 0);
  tail.rotation.z = Math.PI / 4;
  tail.castShadow = true;
  g.add(tail);

  // Lion head — sphere + mane (torus) + small ears
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), stoneMat);
  head.position.set(2.6, 3.2, 0);
  head.castShadow = true;
  g.add(head);
  const mane = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.45, 10, 18), stoneMat);
  mane.position.copy(head.position);
  mane.rotation.y = Math.PI / 2;
  g.add(mane);

  // Open mouth (water spout)
  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.05, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x4ec0e6, emissive: 0x4ec0e6, emissiveIntensity: 0.6,
                                     transparent: true, opacity: 0.85 })
  );
  mouth.position.set(4.0, 3.0, 0);
  mouth.rotation.z = -Math.PI / 2.6;
  g.add(mouth);
}

// Reusable simple palm
export function makePalm(scale = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.32, 4.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.85 })
  );
  trunk.position.y = 2.25;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4ea24a, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55), leafMat);
    leaf.position.set(Math.cos(a) * 0.6, 4.6, Math.sin(a) * 0.6);
    leaf.rotation.set(-0.6 + Math.random() * 0.2, -a, 0);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}
