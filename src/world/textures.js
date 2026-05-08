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

// Procedural value-noise grayscale, 256x256, used as multiplier on road paint
// albedo so the white doesn't read as a flat LED stripe under bloom. Streaky
// repeat (40,1) along the stripe direction reads as tire-worn drag marks.
let _paintNoiseTex = null;
export function loadPaintNoiseTexture() {
  if (_paintNoiseTex) return _paintNoiseTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    // Two octaves: low-freq smudges + high-freq grit.
    const lo = 200 + Math.random() * 30;
    const hi = (Math.random() - Math.random()) * 24;
    const n = Math.max(120, Math.min(255, lo + hi));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Occasional darker tire scuff blots.
  ctx.fillStyle = 'rgba(80,80,80,0.35)';
  for (let k = 0; k < 12; k++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 14;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  _paintNoiseTex = tex;
  return tex;
}

// Polyhaven concrete_floor_02 1k — diffuse + nor_gl + roughness. Sidewalks.
export function loadSidewalkTextures() {
  return {
    map:          load('./assets/textures/sidewalk/concrete_diff_1k.jpg', { srgb: true }),
    normalMap:    load('./assets/textures/sidewalk/concrete_nor_1k.jpg'),
    roughnessMap: load('./assets/textures/sidewalk/concrete_rough_1k.jpg'),
  };
}

// Polyhaven coast_sand_rocks_02 1k — diffuse + nor_gl + roughness.
export function loadSandTextures() {
  return {
    map:          load('./assets/textures/sand/sand_diff_1k.jpg', { srgb: true }),
    normalMap:    load('./assets/textures/sand/sand_nor_1k.jpg'),
    roughnessMap: load('./assets/textures/sand/sand_rough_1k.jpg'),
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
