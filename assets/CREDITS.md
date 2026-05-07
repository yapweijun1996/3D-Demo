# Asset Credits

All GLB models in this directory are **CC0** (Creative Commons Zero — public domain, commercial use OK, no attribution required). We credit them anyway as engineering courtesy.

## Models

| File | Source | License | Author / Pack |
|---|---|---|---|
| `cars/sedan.glb` | https://kenney.nl/assets/car-kit | CC0 | Kenney — Car Kit (default, 4-wheel-separate) |
| `cars-quat/sedan.glb` | https://poly.pizza/m/HQ0hvRM2XR | CC0 | Quaternius — Cars Bundle (alternate, paired-wheel) |
| `cars-pbr/ToyCar.glb` | https://github.com/KhronosGroup/glTF-Sample-Assets | CC-BY 4.0 | Khronos Group (PBR, baked wheels — kept for visual ref) |
| `hdr/sky_1k.hdr` | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 | Poly Haven — Kloofendal puresky 1k (day) |
| `hdr/sky_night_1k.hdr` | https://polyhaven.com/a/dikhololo_night | CC0 | Poly Haven — Dikhololo night 1k |
| `cars/cone.glb` | https://kenney.nl/assets/car-kit | CC0 | Kenney — Car Kit |
| `cars/Textures/colormap.png` | https://kenney.nl/assets/car-kit | CC0 | Kenney — Car Kit |
| `buildings/building-type-c.glb` | https://kenney.nl/assets/city-kit-suburban | CC0 | Kenney — City Kit (Suburban) |
| `buildings/building-type-e.glb` | https://kenney.nl/assets/city-kit-suburban | CC0 | Kenney — City Kit (Suburban) |
| `buildings/Textures/colormap.png` | https://kenney.nl/assets/city-kit-suburban | CC0 | Kenney — City Kit (Suburban) |

## Procedural assets (no GLB)

The following are generated in code from BoxGeometry / CylinderGeometry / etc. — chosen over CC0 GLB sources because (a) zip mirrors aren't script-friendly, (b) procedural variants give more visual control per district, and (c) the silhouette is what reads from a moving car, not per-tree mesh fidelity.

| Element | Where | Notes |
|---|---|---|
| Palm trees | src/world/palms.js | Cylinder trunk + radial leaf planes. T07 upgrades to InstancedMesh + scale jitter. |
| Street lamps | src/world/street-furniture.js (T06) | Pole + lamp head, emissive at night. |
| Bus stops | src/world/street-furniture.js (T06) | Box shelter + roof. |
| Shophouses | src/world/buildings.js (T09) | Box base + pitched roof + pastel paint variants. |
| CBD towers | src/world/buildings.js (T10) | Box body + glass PBR + emissive window grid. |

## Textures (PBR)

| Path | Source | License |
|---|---|---|
| `textures/ground/grass_*` | https://polyhaven.com/a/aerial_grass_rock | CC0 |
| `textures/road/asphalt_*` | https://polyhaven.com/a/asphalt_02 | CC0 |
| `textures/sand/sand_*` | https://polyhaven.com/a/coast_sand_rocks_02 | CC0 |
| `textures/sidewalk/concrete_*` (T04) | https://polyhaven.com/a/concrete_floor_02 | CC0 |

## How to populate this directory

Run `scripts/fetch-assets.sh` from the repo root (Phase B.3, planned).
Manual fallback: download the listed packs, unzip, and copy the relevant `.glb` files into this directory using the filenames above.

## Why CC0-only?

- Commercial-safe (no royalty, no attribution requirement)
- No license drift risk — `LICENSE` file in the pack stays static
- Compatible with the project's MIT source license

## Engine assets

| Library | License | Source |
|---|---|---|
| three.js | MIT | https://github.com/mrdoob/three.js |
| Rapier | Apache-2.0 | https://github.com/dimforge/rapier |
