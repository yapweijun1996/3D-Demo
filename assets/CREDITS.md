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
| _(pending)_ palm.glb | poly.pizza Quaternius | CC0 | (deferred — modal download not script-friendly) |
| _(pending)_ lamppost.glb | https://kenney.nl/assets/city-kit-roads | CC0 | (deferred to Phase D for night cycle) |

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
