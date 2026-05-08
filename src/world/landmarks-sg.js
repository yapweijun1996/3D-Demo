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

// Footprint clearance radius (m) per landmark — used by buildings.js to skip
// procedural tower placements that overlap an iconic landmark. Measured from
// the landmark's anchor (Y=0) outward to the maximum geometry extent in XZ.
const FOOTPRINT_RADIUS = {
  mbs: 180,         // 3 towers + 340m skypark spans X
  helix: 150,       // double helix tube spans length
  esplanade: 50,    // twin domes + spike halo
  supertrees: 65,   // grove cluster spiral
  flyer: 90,        // 75m torus rim + leg base
  merlion: 14,      // small statue + plinth
};

// Populated by buildSGLandmarks. Consumers (buildings.js) read this AFTER
// landmarks have been placed to filter out clashing tower positions.
export const LANDMARK_FOOTPRINTS = [];

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
  LANDMARK_FOOTPRINTS.length = 0;
  for (const p of placements) {
    const [x, z] = proj(...p.latLng);
    const g = p.build();
    g.position.set(x, 0, z);
    g.rotation.y = p.yaw;
    g.userData.landmarkName = p.name;
    scene.add(g);
    groups.push(g);
    LANDMARK_FOOTPRINTS.push({
      name: p.name, x, z,
      r: FOOTPRINT_RADIUS[p.name] || 30,
    });
    if (p.name === 'flyer' && g.userData.capsuleMat) {
      scene.userData.flyerCapsuleMat = g.userData.capsuleMat;
    }
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

  // V-shaped pylons under the deck — real Helix has 4 angled support pairs
  // diving into the water. Without them the tube structure visibly floats.
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x707074, roughness: 0.55, metalness: 0.55,
  });
  const PYLON_X = [-105, -35, 35, 105];
  for (const px of PYLON_X) {
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 14, 8),
        pylonMat
      );
      pylon.position.set(px, -3.5, side * 1.5);
      // Tilt outward so two pylons form a V into the water.
      pylon.rotation.z = side * -0.18;
      pylon.castShadow = true;
      g.add(pylon);
    }
    // Cross-bar connecting the V near the top
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 7),
      pylonMat
    );
    cross.position.set(px, 1.5, 0);
    g.add(cross);
  }

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
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x9a7846, roughness: 0.55, metalness: 0.45,
  });
  // Sun-shade panels — flatter, denser triangular plates instead of long spikes.
  // Real Esplanade has hundreds of small triangular aluminium fins at varying
  // tilt angles; our 240-instance approximation reads as "textured durian"
  // not "spiked mace" from any reasonable distance.
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xc9a463, roughness: 0.40, metalness: 0.65,
  });

  const RADIUS = 30;
  const PANEL_COUNT = 240;
  const phi = Math.PI * (3 - Math.sqrt(5));
  const upY = new THREE.Vector3(0, 1, 0);

  for (let s = 0; s < 2; s++) {
    const sx = (s - 0.5) * 70;
    // Higher-tessellation hemisphere base reads less like a 90s game model.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      shellMat
    );
    dome.position.set(sx, 0, 0);
    dome.castShadow = true; dome.receiveShadow = true;
    g.add(dome);

    // ConeGeometry(0.85, 1.4, 3) — short 3-sided pyramid feels like a
    // facetted shade panel. Tilt 18° toward the dome surface so panels
    // lay against the shell rather than spike straight out.
    const panelGeo = new THREE.ConeGeometry(0.85, 1.4, 3);
    const panels = new THREE.InstancedMesh(panelGeo, panelMat, PANEL_COUNT);
    panels.castShadow = true;
    const m = new THREE.Matrix4();
    const tmp = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    const tiltAxis = new THREE.Vector3();
    const tiltQ = new THREE.Quaternion();
    for (let i = 0; i < PANEL_COUNT; i++) {
      const yT = 1 - (i / (PANEL_COUNT - 1));
      const r = Math.sqrt(1 - yT * yT);
      const theta = phi * i;
      const sxL = Math.cos(theta) * r * RADIUS;
      const yL = yT * RADIUS;
      const szL = Math.sin(theta) * r * RADIUS;

      tmp.set(sxL, yL, szL).normalize();
      // Position panel base flush with the dome surface.
      const px = sx + tmp.x * RADIUS;
      const py =       tmp.y * RADIUS;
      const pz =       tmp.z * RADIUS;
      tmpQ.setFromUnitVectors(upY, tmp);
      // Apply small tilt around a tangent axis so the panel lies against the
      // shell (mimics the real shade panels' inset angle).
      tiltAxis.set(-tmp.z, 0, tmp.x).normalize();   // any tangent
      const tilt = 0.32 + ((i * 13) % 7) * 0.018;   // ~18-25°, hash-jittered
      tiltQ.setFromAxisAngle(tiltAxis, tilt);
      tmpQ.premultiply(tiltQ);
      m.compose(new THREE.Vector3(px, py, pz), tmpQ, new THREE.Vector3(1, 1, 1));
      panels.setMatrixAt(i, m);
    }
    panels.instanceMatrix.needsUpdate = true;
    g.add(panels);
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
  // Capsule pods — windows emit warm light. Base emissiveIntensity 0.25 so
  // they read as glowing cabins even mid-day; main.js can drive it higher
  // at night via scene.userData.flyerCapsuleMat (mirrors HDB / CBD wiring).
  const capsuleMat = new THREE.MeshStandardMaterial({
    color: 0xd6e4f4, roughness: 0.25, metalness: 0.35,
    emissive: 0xfff0c0, emissiveIntensity: 0.25,
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
  g.userData.capsuleMat = capsuleMat;
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
