import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Promise-cached GLB loader. Subsequent loadGLB(path) calls return the same
// gltf object — call .scene.clone() at the consumer if multiple instances needed.
const loader = new GLTFLoader();
const cache = new Map();

export function loadGLB(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(path));
  return cache.get(path);
}

// Convenience: load many in parallel, report progress via callback.
//   onProgress(loaded, total, currentPath)
export async function loadAll(paths, onProgress) {
  let loaded = 0;
  const total = paths.length;
  return Promise.all(paths.map(async (p) => {
    const gltf = await loadGLB(p);
    loaded++;
    onProgress?.(loaded, total, p);
    return [p, gltf];
  })).then(entries => Object.fromEntries(entries));
}
