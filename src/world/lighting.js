import * as THREE from 'three';
import { CFG } from '../config.js';

export function buildLighting(scene) {
  const { hemi, sun, ambient } = CFG.lights;
  const hemiL = new THREE.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity);
  scene.add(hemiL);
  const ambL = ambient ? new THREE.AmbientLight(ambient.color, ambient.intensity) : null;
  if (ambL) scene.add(ambL);

  const dl = new THREE.DirectionalLight(sun.color, sun.intensity);
  dl.position.set(...sun.pos);
  dl.castShadow = true;
  const s = sun.shadow;
  // T12: 1024 → 2048 + radius 8 for VSM blur. Reads diffused, not knife-edge.
  dl.shadow.mapSize.set(2048, 2048);
  dl.shadow.radius = 8;
  dl.shadow.camera.left   = -s.frustum;
  dl.shadow.camera.right  =  s.frustum;
  dl.shadow.camera.top    =  s.frustum;
  dl.shadow.camera.bottom = -s.frustum;
  dl.shadow.camera.near = s.near;
  dl.shadow.camera.far  = s.far;
  dl.shadow.bias = -0.0005;
  scene.add(dl); scene.add(dl.target);

  return { hemi: hemiL, sun: dl, ambient: ambL };
}
