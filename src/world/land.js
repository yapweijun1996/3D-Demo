import * as THREE from 'three';

// Singapore land/water plate.
//   • Big green plane covers the playable bbox area (= land, default).
//   • Outer ocean ring (huge blue plane at y < land) shows where you've
//     driven off the island — visible past the green edge.
//   • OSM coastline (built separately) draws the actual island outline
//     in sand-colored lines on top, so the silhouette reads correctly
//     without needing closed-polygon triangulation.
//
// proj is the same projection used by roads-osm, so dimensions match.

const LAND_HALF_X = 340;     // slightly larger than WORLD_HALF so edges off-screen
const LAND_HALF_Z = 280;
const OCEAN_SIZE  = 4000;
const LAND_COLOR  = 0x6f8c5b;
const OCEAN_COLOR = 0x4a85a8;

export function buildLand(scene) {
  // Ocean — huge plane sits below land.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE),
    new THREE.MeshStandardMaterial({ color: OCEAN_COLOR, roughness: 0.55, metalness: 0.05 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.20;
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Land — bbox-sized rectangle, slightly above ocean.
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(LAND_HALF_X * 2, LAND_HALF_Z * 2),
    new THREE.MeshStandardMaterial({ color: LAND_COLOR, roughness: 0.95, metalness: 0.0 }),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.y = 0.00;
  land.receiveShadow = true;
  scene.add(land);

  console.log('[land] ocean + land plates built');
}
