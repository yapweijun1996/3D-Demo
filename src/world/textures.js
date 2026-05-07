import * as THREE from 'three';

// Central PBR texture cache. One TextureLoader, shared anisotropy, sRGB on
// color maps only (normal/roughness stay linear). Builders call loadGround()
// etc. — the same Texture objects are returned on repeat calls so InstancedMesh
// + MeshStandardMaterial can share GPU memory.

const loader = new THREE.TextureLoader();
const cache = new Map();

function load(url, { srgb = false } = {}) {
  if (cache.has(url)) return cache.get(url);
  const tex = loader.load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(url, tex);
  return tex;
}

// Polyhaven aerial_grass_rock 1k — diffuse + nor_gl + roughness.
export function loadGroundTextures() {
  return {
    map:          load('./assets/textures/ground/grass_diff_1k.jpg', { srgb: true }),
    normalMap:    load('./assets/textures/ground/grass_nor_1k.jpg'),
    roughnessMap: load('./assets/textures/ground/grass_rough_1k.jpg'),
  };
}

// Polyhaven asphalt_02 1k — diffuse + nor_gl + roughness.
export function loadRoadTextures() {
  return {
    map:          load('./assets/textures/road/asphalt_diff_1k.jpg', { srgb: true }),
    normalMap:    load('./assets/textures/road/asphalt_nor_1k.jpg'),
    roughnessMap: load('./assets/textures/road/asphalt_rough_1k.jpg'),
  };
}

// Tile a texture set so 1 tile == `tileMeters` world units. ShapeGeometry +
// PlaneGeometry both have UVs = world coords (after we feed shape XZ in meters
// or set repeat manually); we adjust .repeat so 1 UV unit == tileMeters.
export function setRepeatMeters(maps, repeatX, repeatY) {
  for (const key of Object.keys(maps)) {
    const t = maps[key];
    if (!t) continue;
    // Each map shares the same wrapping; clone-on-write would defeat caching,
    // so we set repeat on the shared instance. All callers using this set get
    // the same tiling — fine for our use (one ground type globally).
    t.repeat.set(repeatX, repeatY);
  }
}
