import * as THREE from 'three';

// Big inward-facing sphere with a vertex-driven dusk gradient.
// Replaces the flat scene.background color with a horizon → zenith blend.
export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(750, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop:  { value: new THREE.Color(0x4a72a8) },     // dusk blue at zenith
      uMid:  { value: new THREE.Color(0xf2a878) },     // peach band
      uBot:  { value: new THREE.Color(0xfbe3c0) },     // light horizon haze
    },
    vertexShader: /* glsl */`
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uBot;
      varying float vH;
      void main() {
        float h = clamp(vH, -0.2, 1.0);
        vec3 col;
        if (h < 0.18) col = mix(uBot, uMid, smoothstep(-0.05, 0.18, h));
        else          col = mix(uMid, uTop, smoothstep(0.18, 0.85, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);
}
