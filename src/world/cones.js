import * as THREE from 'three';
import { CFG } from '../config.js';
import { addCyl } from '../colliders.js';

// Traffic cones — orange decorative obstacles, also collidable so the car can knock around them visually.
const orange = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 });
const stripe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const baseM  = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.85 });

export function buildCones(scene) {
  for (const [x, z] of CFG.cones) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), baseM);
    base.position.y = 0.04;
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.85, 12), orange);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 12), stripe);
    ring.position.y = 0.55;
    g.add(ring);

    g.position.set(x, 0, z);
    scene.add(g);
    addCyl(x, z, 0.45);
  }
}
