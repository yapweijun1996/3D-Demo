import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Postprocessing pipeline: Render → Bloom → Output (ACES + sRGB).
// Bloom strength is small (0.35) so it only blooms HDR-bright pixels —
// lit windows at night, sun reflections on car paint, white road stripes
// in low light. Threshold 0.85 keeps daytime mostly untouched.
export function buildPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.45,     // strength — gentle glow, not anime-bright
    0.55,     // radius
    0.82,     // threshold — only emissive>threshold blooms
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    setSize(w, h) { composer.setSize(w, h); },
    render() { composer.render(); },
  };
}
