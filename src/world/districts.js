// Singapore district SSOT — single source of truth for the 6 city zones the
// driving demo recreates. Read by builders (buildings, palms, street furniture)
// to dispatch typology + palette + density per location. NEVER hardcode
// coordinates elsewhere; query districtAtWorld(x, z) instead.
//
// Bbox numbers came from real SG geo-research (centered on the actual districts).
// They overlap the OSM road network's bbox (1.246–1.351 lat × 103.787–103.915 lng).

import { projectLatLng } from './roads-osm.js';

export const TYPOLOGY = Object.freeze({
  TOWER:     'tower',     // Marina Bay CBD — 80–290m glass+steel towers
  COLONIAL:  'colonial',  // Civic — white plaster, red roof, 2–4 story
  SHOPHOUSE: 'shophouse', // Chinatown — 3-story pastel rowhouses
  MALL:      'mall',      // Orchard — wide low podium + tower above
  HDB:       'hdb',       // HDB Heartland — 12–25 story slab/point blocks
  PARK:      'park',      // Park Belt — no buildings, dense vegetation
});

export const DISTRICTS = [
  {
    id: 'marina',
    name: 'Marina Bay CBD',
    bbox: [1.275, 103.848, 1.286, 103.860],   // [minLat, minLng, maxLat, maxLng]
    typology: TYPOLOGY.TOWER,
    palette: ['#3A4A5C', '#7A8B9E', '#C8D4DE', '#1E2A38', '#E8EEF2'],
    density: 1.5,                              // buildings per 100×100m block
    landmarks: [
      { name: 'Guoco Tower',  height: 290 },
      { name: 'OUB Centre',   height: 280 },
      { name: 'MBFC Tower 1', height: 245 },
    ],
    treeSpecies: 'palm-sparse',
    tell: 'three identical ~245m blue-glass slabs framing a curved water edge',
  },
  {
    id: 'civic',
    name: 'Civic District',
    bbox: [1.288, 103.850, 1.296, 103.858],
    typology: TYPOLOGY.COLONIAL,
    palette: ['#F5EFE0', '#D9CDB4', '#8B6F47', '#4A6B3A', '#B85C3C'],
    density: 0.4,
    landmarks: [
      { name: 'St Andrew Cathedral', height: 63 },
      { name: 'Victoria Theatre',    height: 54 },
      { name: 'Old Supreme Court',   height: 40 },
      { name: 'City Hall',           height: 28 },
    ],
    treeSpecies: 'rain-tree',
    tell: 'white neoclassical dome next to Gothic spire across a giant green field',
  },
  {
    id: 'chinatown',
    name: 'Chinatown',
    bbox: [1.280, 103.842, 1.286, 103.848],
    typology: TYPOLOGY.SHOPHOUSE,
    palette: ['#E8B4A0', '#F4D9A8', '#6B8E5A', '#C73E3E', '#F5E6C8'],
    density: 4.0,
    landmarks: [
      { name: 'Buddha Tooth Relic Temple', height: 28 },
      { name: 'Pinnacle@Duxton',           height: 156 },
      { name: 'Sri Mariamman gopuram',     height: 15 },
    ],
    treeSpecies: 'none',
    tell: 'continuous pastel shophouse rows with red lanterns and tiered red-gold temple roof',
  },
  {
    id: 'orchard',
    name: 'Orchard Road',
    bbox: [1.300, 103.830, 1.307, 103.842],
    typology: TYPOLOGY.MALL,
    palette: ['#2C2C2C', '#D4AF37', '#E8E8E8', '#1A4D8C', '#FFFFFF'],
    density: 1.2,
    landmarks: [
      { name: 'ION Orchard',     height: 218 },
      { name: 'Ngee Ann City',   height: 139 },
      { name: 'Wisma Atria',     height: 110 },
    ],
    treeSpecies: 'angsana',
    tell: 'curved silver glass blob (ION) under green angsana tunnel with 6-lane boulevard',
  },
  {
    id: 'hdb',
    name: 'HDB Heartland (Toa Payoh)',
    bbox: [1.330, 103.845, 1.345, 103.860],
    typology: TYPOLOGY.HDB,
    palette: ['#F2E8D5', '#A8C4D9', '#D9A88A', '#7BA05B', '#E8DCC4'],
    density: 1.8,
    landmarks: [
      { name: 'HDB Hub',                  height: 110 },
      { name: 'Toa Payoh Dragon Playground', height: 3 },
    ],
    treeSpecies: 'palm',
    tell: '20-story pastel slab blocks on stilts with red-mosaic dragon playground',
  },
  {
    id: 'park',
    name: 'Park Belt (Botanic)',
    bbox: [1.312, 103.813, 1.325, 103.823],
    typology: TYPOLOGY.PARK,
    palette: ['#2D5016', '#5A8C3E', '#8FB572', '#C8B580', '#6B4423'],
    density: 0.0,
    landmarks: [
      { name: 'Supertree Grove (Marina)', height: 50 },
      { name: 'Flower Dome',              height: 38 },
      { name: 'Fort Canning rain tree',   height: 30 },
    ],
    treeSpecies: 'mixed',
    tell: '40m steel "trees" wrapped in vines next to a domed glass conservatory',
  },
];

// Bbox prefilter — O(1) reject for the 5/6 districts the point isn't in.
function inBbox(lat, lng, b) {
  return lat >= b[0] && lat <= b[2] && lng >= b[1] && lng <= b[3];
}

// Lat/lng → district id (or null if outside all 6).
// Bboxes are axis-aligned rectangles in lat/lng (no polygon ray cast needed yet
// — keep simple. Switch to point-in-polygon if districts get non-rectangular).
export function districtAt(lat, lng) {
  for (const d of DISTRICTS) {
    if (inBbox(lat, lng, d.bbox)) return d.id;
  }
  return null;
}

// World (x,z) → district id. Uses the OSM projection from roads-osm.js. Calling
// before buildOSMRoads() finishes throws — districts are useless without a proj.
//
// Inverting an arbitrary proj is nontrivial; we instead pre-project each district
// bbox into world space lazily, then point-in-rect against world coords directly.
let _worldBoxCache = null;

function ensureWorldBoxes() {
  if (_worldBoxCache) return _worldBoxCache;
  _worldBoxCache = DISTRICTS.map(d => {
    const [sw_x, sw_z] = projectLatLng(d.bbox[0], d.bbox[1]);   // SW
    const [ne_x, ne_z] = projectLatLng(d.bbox[2], d.bbox[3]);   // NE
    return {
      id: d.id,
      xMin: Math.min(sw_x, ne_x), xMax: Math.max(sw_x, ne_x),
      zMin: Math.min(sw_z, ne_z), zMax: Math.max(sw_z, ne_z),
    };
  });
  return _worldBoxCache;
}

export function districtAtWorld(x, z) {
  const boxes = ensureWorldBoxes();
  for (const b of boxes) {
    if (x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax) return b.id;
  }
  return null;
}

export function getDistrict(id) {
  return DISTRICTS.find(d => d.id === id) || null;
}
