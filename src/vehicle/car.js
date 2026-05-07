import * as THREE from 'three';
import { CFG } from '../config.js';

// Higher-fidelity stylized sedan: curved hood/trunk via ExtrudeGeometry,
// 5-spoke alloy wheels, headlight clusters, grille, side skirts, license plate.
export function buildCar(scene) {
  const C = CFG.car;
  const group = new THREE.Group();
  group.position.set(...C.spawn);
  scene.add(group);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: C.bodyColor, roughness: 0.32, metalness: 0.55,
    envMapIntensity: 1.0,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: C.accentColor, roughness: 0.4, metalness: 0.3,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.85 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.18, metalness: 0.95 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a2630, roughness: 0.05, metalness: 0.2,
    transmission: 0.55, transparent: true, opacity: 0.7, ior: 1.45,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff7d6, emissive: 0xfff7d6, emissiveIntensity: 0.9, roughness: 0.25,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 0.7, roughness: 0.4,
  });

  // ----- BODY (curved profile via ExtrudeGeometry) -----
  // Side profile drawn in XY plane then extruded along Z (car length).
  const profile = new THREE.Shape();
  profile.moveTo(-1.0, 0.10);
  profile.lineTo(-1.0, 0.55);
  profile.bezierCurveTo(-1.0, 0.95, -0.55, 1.05, -0.25, 1.05);
  profile.lineTo( 0.30, 1.05);
  profile.bezierCurveTo( 0.65, 1.05,  0.95, 0.85,  1.0, 0.55);
  profile.lineTo( 1.0, 0.10);
  profile.lineTo( 0.95, 0.05);
  profile.lineTo(-0.95, 0.05);
  profile.lineTo(-1.0, 0.10);
  const bodyGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 1.7, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3,
    curveSegments: 12,
  });
  bodyGeo.translate(0, 0, -0.85);
  bodyGeo.rotateY(Math.PI / 2);  // align length along Z
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  // ----- GREENHOUSE / CABIN GLASS (separate piece, slightly inset) -----
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-0.55, 0);
  cabinShape.bezierCurveTo(-0.55, 0.5, -0.35, 0.62, -0.05, 0.62);
  cabinShape.lineTo( 0.20, 0.62);
  cabinShape.bezierCurveTo( 0.45, 0.62,  0.55, 0.4,  0.55, 0.0);
  cabinShape.lineTo(-0.55, 0.0);
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
    depth: 1.55, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2,
    curveSegments: 12,
  });
  cabinGeo.translate(0, 0, -0.775);
  cabinGeo.rotateY(Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.y = 1.05;
  cabin.castShadow = false;
  group.add(cabin);

  // ----- ROOF (solid slab over the glass to read as painted top) -----
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 1.1), bodyMat);
  roof.position.set(0, 1.65, -0.05);
  roof.castShadow = true;
  group.add(roof);

  // ----- HOOD & TRUNK seam strips (just visual flair) -----
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.6 });
  const hoodSeam = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.02, 0.04), seamMat);
  hoodSeam.position.set(0, 1.07, 0.55);
  group.add(hoodSeam);

  // ----- GRILLE -----
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.06), darkMat);
  grille.position.set(0, 0.65, 1.62);
  group.add(grille);
  for (let i = 0; i < 5; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.01, 0.07), chromeMat);
    slat.position.set(0, 0.58 + i * 0.04, 1.625);
    group.add(slat);
  }

  // ----- BUMPER -----
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.18), darkMat);
  bumper.position.set(0, 0.32, 1.55);
  group.add(bumper);
  const rearBumper = bumper.clone();
  rearBumper.position.z = -1.55;
  group.add(rearBumper);

  // ----- HEADLIGHTS (cluster: glass lens + emissive core) -----
  for (const sx of [-1, 1]) {
    const lens = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.7 })
    );
    lens.position.set(sx * 0.62, 0.78, 1.605);
    group.add(lens);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), headMat);
    core.position.set(sx * 0.62, 0.78, 1.63);
    group.add(core);
    // accent LED strip
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.025, 0.04), headMat);
    drl.position.set(sx * 0.62, 0.88, 1.62);
    group.add(drl);
  }

  // ----- TAILLIGHTS -----
  for (const sx of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.05), tailMat);
    tail.position.set(sx * 0.62, 0.82, -1.605);
    group.add(tail);
  }

  // ----- LICENSE PLATES (front + rear) -----
  const plateMat = makePlateMaterial('SG · WJ-2026');
  for (const z of [1.605, -1.605]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), plateMat);
    plate.position.set(0, 0.4, z + (z > 0 ? 0.005 : -0.005));
    if (z < 0) plate.rotation.y = Math.PI;
    group.add(plate);
  }

  // ----- SIDE SKIRT -----
  for (const sx of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 1.9), darkMat);
    skirt.position.set(sx * 0.99, 0.18, 0);
    group.add(skirt);
  }

  // ----- SIDE MIRRORS -----
  for (const sx of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.18), bodyMat);
    mirror.position.set(sx * 1.05, 1.10, 0.45);
    group.add(mirror);
  }

  // ----- WHEELS (5-spoke alloy + tire) -----
  const wheels = [];
  const tireGeo = new THREE.TorusGeometry(0.36, 0.14, 14, 24);
  tireGeo.rotateY(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.95 });
  const positions = [
    [ 0.92, 0.4,  1.05, 'fr'],
    [-0.92, 0.4,  1.05, 'fl'],
    [ 0.92, 0.4, -1.05, 'rr'],
    [-0.92, 0.4, -1.05, 'rl'],
  ];
  for (const [x, y, z, name] of positions) {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    wg.add(tire);
    wg.add(buildAlloyHub(C.rimColor, x > 0 ? 1 : -1));
    group.add(wg);
    wheels.push({ group: wg, tire, name, isFront: name.startsWith('f') });
  }

  // ----- EXHAUST TIPS -----
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12),
      chromeMat
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.set(sx * 0.55, 0.22, -1.62);
    group.add(tip);
  }

  return { group, wheels };
}

// 5-spoke hub mesh — built from a Shape so it shows depth.
function buildAlloyHub(color, dir) {
  const shape = new THREE.Shape();
  const r = 0.32;
  shape.absarc(0, 0, r, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const hole = new THREE.Path();
    const cx = Math.cos(a) * r * 0.55, cy = Math.sin(a) * r * 0.55;
    hole.absarc(cx, cy, r * 0.18, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  geo.translate(dir * 0.07, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.85 });
  const hub = new THREE.Mesh(geo, mat);
  hub.castShadow = true;
  return hub;
}

function makePlateMaterial(text) {
  const cnv = document.createElement('canvas');
  cnv.width = 512; cnv.height = 128;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#f5e34a'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#111'; ctx.font = 'bold 76px ui-monospace,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
}
