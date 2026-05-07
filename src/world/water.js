import * as THREE from 'three';
import { CFG } from '../config.js';

// Stylized animated water disk for Marina Bay. Uses a ShaderMaterial with
// scrolling sine waves on UV. Pure visual — collisions handled by drive.js bounds.

export function buildWater(scene, tickers) {
  const { center, radius, color } = CFG.water;
  const geo = new THREE.CircleGeometry(radius, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uColor2:{ value: new THREE.Color(0x9ed6e8) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uColor2;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float w1 = sin(vWorld.x * 0.18 + uTime * 0.6) * 0.5 + 0.5;
        float w2 = sin(vWorld.z * 0.22 - uTime * 0.4) * 0.5 + 0.5;
        float ripple = mix(w1, w2, 0.5);
        vec3 col = mix(uColor, uColor2, ripple * 0.55);
        // sun glint
        float glint = pow(max(0.0, ripple - 0.7), 4.0) * 6.0;
        col += vec3(1.0, 0.9, 0.7) * glint;
        gl_FragColor = vec4(col, 0.92);
      }
    `,
    transparent: true,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(center[0], 0.05, center[1]);
  scene.add(water);

  // dark seabed disk just under the water for depth read
  const bed = new THREE.Mesh(
    new THREE.CircleGeometry(radius - 0.5, 48),
    new THREE.MeshBasicMaterial({ color: 0x152436 })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(center[0], 0.03, center[1]);
  scene.add(bed);

  // beach ring (light sand)
  const sand = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 4, 64),
    new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 0.95, side: THREE.DoubleSide })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(center[0], 0.04, center[1]);
  sand.receiveShadow = true;
  scene.add(sand);

  tickers.push((t) => { mat.uniforms.uTime.value = t; });
}
