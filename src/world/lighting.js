import * as THREE from 'three';
import { CFG } from '../config.js';

export function buildLighting(scene) {
  const { hemi, sun, ambient } = CFG.lights;
  scene.add(new THREE.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity));
  if (ambient) scene.add(new THREE.AmbientLight(ambient.color, ambient.intensity));

  const dl = new THREE.DirectionalLight(sun.color, sun.intensity);
  dl.position.set(...sun.pos);
  dl.castShadow = true;
  const s = sun.shadow;
  dl.shadow.mapSize.set(s.mapSize, s.mapSize);
  dl.shadow.camera.left   = -s.frustum;
  dl.shadow.camera.right  =  s.frustum;
  dl.shadow.camera.top    =  s.frustum;
  dl.shadow.camera.bottom = -s.frustum;
  dl.shadow.camera.near = s.near;
  dl.shadow.camera.far  = s.far;
  dl.shadow.bias = s.bias;
  scene.add(dl); scene.add(dl.target);
}
