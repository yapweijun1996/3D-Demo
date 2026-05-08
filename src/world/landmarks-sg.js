import * as THREE from 'three';

// Iconic Singapore landmarks — all procedural, no GLB. Each factory returns a
// THREE.Group positioned at origin; caller translates to OSM lat/lng. Geometry
// budgets per research: total scene ~25k tris, all 6 landmarks combined.
//
// Placement (real-world coordinates):
//   MBS:        1.2834, 103.8607
//   Helix:      1.2877, 103.8607
//   Esplanade:  1.2897, 103.8559
//   Supertrees: 1.2820, 103.8636
//   Flyer:      1.2893, 103.8634
//   Merlion:    1.2868, 103.8545

export async function buildSGLandmarks(scene, proj) {
  if (!proj) return [];

  const placements = [
    { name: 'mbs',        latLng: [1.2834, 103.8607], yaw: 0,            build: createMBS },
    { name: 'helix',      latLng: [1.2877, 103.8607], yaw: 0,            build: createHelix },
    { name: 'esplanade',  latLng: [1.2897, 103.8559], yaw: 0,            build: createEsplanade },
    { name: 'supertrees', latLng: [1.2820, 103.8636], yaw: 0,            build: createSupertrees },
    { name: 'flyer',      latLng: [1.2893, 103.8634], yaw: 0,            build: createFlyer },
    { name: 'merlion',    latLng: [1.2868, 103.8545], yaw: Math.PI * 0.5, build: createMerlion },
  ];

  const groups = [];
  for (const p of placements) {
    const [x, z] = proj(...p.latLng);
    const g = p.build();
    g.position.set(x, 0, z);
    g.rotation.y = p.yaw;
    g.userData.landmarkName = p.name;
    scene.add(g);
    groups.push(g);
  }
  console.log(`[landmarks-sg] placed ${groups.length} iconic landmarks`);
  return groups;
}

// ---- Marina Bay Sands ----
// 3 towers (194m, twin-leg base joining at 70m, vertical upper slab) connected
// by boat-shaped 340m skypark deck.
function createMBS() {
  const g = new THREE.Group();
  const towerMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a4a5c, roughness: 0.18, metalness: 0.8, envMapIntensity: 1.8,
    clearcoat: 0.6,
  });
  const skyMat = new THREE.MeshStandardMaterial({
    color: 0xc8c8c8, roughness: 0.5, metalness: 0.4,
  });
  const TOWER_COUNT = 3;
  const SPACING = 80;
  const TOWER_W = 23, TOWER_D = 23;

  for (let i = 0; i < TOWER_COUNT; i++) {
    const tx = (i - 1) * SPACING;     // -80, 0, 80
    // Twin angled legs from y=0 to y=70
    const legL = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, 70, TOWER_D), towerMat);
    legL.position.set(tx - 13, 35, 0);
    legL.rotation.z = 0.18;
    legL.castShadow = true;
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, 70, TOWER_D), towerMat);
    legR.position.set(tx + 13, 35, 0);
    legR.rotation.z = -0.18;
    legR.castShadow = true;
    g.add(legR);
    // Vertical upper slab
    const upper = new THREE.Mesh(new THREE.BoxGeometry(55, 124, TOWER_D), towerMat);
    upper.position.set(tx, 132, 0);
    upper.castShadow = true;
    g.add(upper);
  }
  // SkyPark — 340m boat-shaped deck on top
  const sky = new THREE.Mesh(new THREE.BoxGeometry(340, 8, 38), skyMat);
  sky.position.set(0, 200, 0);
  sky.castShadow = true;
  g.add(sky);
  // Skypark cantilever (sticks out one end)
  const cant = new THREE.Mesh(new THREE.BoxGeometry(67, 6, 30), skyMat);
  cant.position.set(170 + 33, 200, 6);
  g.add(cant);
  return g;
}

// ---- Helix Bridge ----
// 280m double-helix tube pair + flat deck.
function createHelix() {
  const g = new THREE.Group();

  class HelixCurve extends THREE.Curve {
    constructor(phase) { super(); this.phase = phase; }
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * Math.PI * 8 + this.phase;
      return target.set(t * 280 - 140, 3 + Math.sin(a) * 3, Math.cos(a) * 3);
    }
  }
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa, roughness: 0.4, metalness: 0.6, emissive: 0xff5544, emissiveIntensity: 0.05,
  });
  const tube1 = new THREE.Mesh(
    new THREE.TubeGeometry(new HelixCurve(0), 200, 0.18, 8, false),
    tubeMat
  );
  const tube2 = new THREE.Mesh(
    new THREE.TubeGeometry(new HelixCurve(Math.PI), 200, 0.18, 8, false),
    new THREE.MeshStandardMaterial({
      color: 0xaaaaaa, roughness: 0.4, metalness: 0.6, emissive: 0x44aaff, emissiveIntensity: 0.05,
    })
  );
  g.add(tube1); g.add(tube2);

  // Flat walkway deck
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(280, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.85 })
  );
  deck.position.set(0, 1, 0);
  deck.castShadow = true;
  g.add(deck);
  return g;
}

// ---- Esplanade ("Durian") ----
// 2 hemispheric domes covered in radial spike cones.
function createEsplanade() {
  const g = new THREE.Group();
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xb89060, roughness: 0.45, metalness: 0.7,
  });

  for (let s = 0; s < 2; s++) {
    const sx = (s - 0.5) * 70;        // -35, 35
    // Hemisphere base
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(30, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      domeMat
    );
    dome.position.set(sx, 0, 0);
    dome.castShadow = true;
    g.add(dome);
    // 80 spike cones distributed via fibonacci sphere on hemisphere
    const spikeGeo = new THREE.ConeGeometry(1.4, 3.5, 4);
    const spikes = new THREE.InstancedMesh(spikeGeo, domeMat, 80);
    const m = new THREE.Matrix4();
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 80; i++) {
      const yT = 1 - (i / 79);                 // 1 → 0, top to base of upper hemi
      const r = Math.sqrt(1 - yT * yT);
      const theta = phi * i;
      const sxL = Math.cos(theta) * r * 30;
      const yL = yT * 30;
      const szL = Math.sin(theta) * r * 30;
      // Align spike outward from sphere center
      const dir = new THREE.Vector3(sxL, yL, szL).normalize();
      const pos = new THREE.Vector3(sx + sxL + dir.x * 1.5, yL + dir.y * 1.5, szL + dir.z * 1.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.compose(pos, q, new THREE.Vector3(1, 1, 1));
      spikes.setMatrixAt(i, m);
    }
    spikes.instanceMatrix.needsUpdate = true;
    g.add(spikes);
  }
  return g;
}

// ---- Supertree Grove ----
// 18 metal trees (25-50m), tapered trunk + canopy disc + 8 radial ribs.
function createSupertrees() {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6a5a4a, roughness: 0.7, metalness: 0.3,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x803060, roughness: 0.5, metalness: 0.2,
    emissive: 0x401530, emissiveIntensity: 0.1,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x4a3a30, roughness: 0.7, metalness: 0.3,
  });

  for (let i = 0; i < 18; i++) {
    // Spiral around grove center
    const a = i * 0.39 + (i % 3) * 0.6;
    const r = 8 + (i % 3) * 16;
    const tx = Math.cos(a) * r;
    const tz = Math.sin(a) * r;
    const h = 25 + (i % 3) * 8 + Math.random() * 6;     // 25-50m

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 2.0, h, 12),
      trunkMat
    );
    trunk.position.set(tx, h / 2, tz);
    trunk.castShadow = true;
    g.add(trunk);

    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 8, 1.5, 16),
      canopyMat
    );
    canopy.position.set(tx, h - 1, tz);
    canopy.castShadow = true;
    g.add(canopy);

    // 8 radial ribs around trunk
    for (let k = 0; k < 8; k++) {
      const ang = k * Math.PI / 4;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, h * 0.95, 0.4),
        ribMat
      );
      rib.position.set(tx + Math.cos(ang) * 1.8, h * 0.475, tz + Math.sin(ang) * 1.8);
      g.add(rib);
    }
  }
  return g;
}

// ---- Singapore Flyer ----
// 165m total, 150m wheel, 28 capsules, 4 A-frame legs.
function createFlyer() {
  const g = new THREE.Group();
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0xe0e0e0, roughness: 0.45, metalness: 0.7,
  });
  const capsuleMat = new THREE.MeshStandardMaterial({
    color: 0xb0c8e0, roughness: 0.3, metalness: 0.4,
    emissive: 0x404060, emissiveIntensity: 0.1,
  });

  // Wheel rim (Torus, oriented in YZ plane so it stands vertically facing X)
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(75, 0.8, 8, 64),
    wheelMat
  );
  rim.rotation.y = Math.PI / 2;
  rim.position.set(0, 90, 0);
  g.add(rim);

  // 32 spokes (from center at (0,90,0) outward in YZ plane)
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 75, 6),
      wheelMat
    );
    // Place spoke pointing radially from center
    spoke.position.set(0, 90 + Math.sin(a) * 37.5, Math.cos(a) * 37.5);
    spoke.rotation.x = -a;
    g.add(spoke);
  }

  // 28 capsules along rim
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const cap = new THREE.Mesh(
      new THREE.CapsuleGeometry(2.2, 4, 4, 8),
      capsuleMat
    );
    cap.position.set(0, 90 + Math.sin(a) * 75, Math.cos(a) * 75);
    cap.rotation.x = -a;
    cap.castShadow = true;
    g.add(cap);
  }

  // 4 A-frame legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.6, metalness: 0.5 });
  for (let s = 0; s < 2; s++) {
    for (let f = 0; f < 2; f++) {
      const sx = (s - 0.5) * 16;
      const fz = (f - 0.5) * 18;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 2.2, 80, 8),
        legMat
      );
      leg.position.set(sx, 40, fz);
      leg.rotation.x = -fz * 0.005;
      leg.rotation.z = -sx * 0.008;
      leg.castShadow = true;
      g.add(leg);
    }
  }
  return g;
}

// ---- Merlion ----
// LatheGeometry fish body + sphere head + water cylinder jet. Scaled up 2x
// so it reads from a moving car.
function createMerlion() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xeeece5, roughness: 0.85, metalness: 0.0,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x88bbff, transparent: true, opacity: 0.7,
    emissive: 0x4488cc, emissiveIntensity: 0.3,
  });

  const SCALE = 2.5;
  // Lathe fish-body curve: base [0,0] → tail tip [0.8,7]
  const bodyPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(2.5, 1),
    new THREE.Vector2(3.0, 3),
    new THREE.Vector2(2.5, 5),
    new THREE.Vector2(1.5, 6),
    new THREE.Vector2(0.8, 7),
  ];
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(bodyPts, 16),
    stoneMat
  );
  body.scale.setScalar(SCALE);
  body.castShadow = true;
  g.add(body);

  // Lion head — stylized sphere on top
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 12),
    stoneMat
  );
  head.position.set(0, 8 * SCALE, 1.5 * SCALE);
  head.scale.setScalar(SCALE * 0.7);
  head.castShadow = true;
  g.add(head);

  // Mane wedges (4 box flares around head)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const mane = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.6, 1.4),
      stoneMat
    );
    mane.position.set(
      Math.cos(a) * 1.6 * SCALE,
      8 * SCALE,
      1.5 * SCALE + Math.sin(a) * 1.6 * SCALE
    );
    mane.scale.setScalar(SCALE);
    g.add(mane);
  }

  // Water arc — cylinder jutting out from head front
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.15, 14, 12),
    waterMat
  );
  water.position.set(0, 8 * SCALE - 1, 1.5 * SCALE + 7);
  water.rotation.x = Math.PI / 3;
  g.add(water);

  return g;
}
