# 🇸🇬 Drive Singapore

A driveable Singapore mini-tour, built with **Three.js + Rapier physics**, no build step.

> **Live demo:** https://yapweijun1996.github.io/3D-Demo/

Drive a red sedan past Marina Bay Sands, the Supertree grove, the Singapore Flyer, and the Merlion. Bump into glowing info signs to read about each landmark. Hold a circular minimap top-left and an FPS counter top-right while you cruise.

---

## ✨ Features

- **真物理** — Rapier WASM `DynamicRayCastVehicleController` with suspension, slip, brake, steer
- **5 个新加坡景点** — Marina Bay Sands · Supertrees · Singapore Flyer · Merlion · About Me
- **Procedural 场景** — dusk sky gradient, animated water, cross-shape road network, HDB tower ring, palm scatter
- **Drawcall 优化** — InstancedMesh 把 ~380 个 mesh 砍到 8 个 GPU 提交
- **PMREM 反射** — 车漆/铬合金/玻璃带真环境反射(无外部 HDRI)
- **Mini-map + FPS HUD** — 圆形顶视图 + 实时帧率
- **Cache-bust 三层防御** — 用户永远不用清缓存就能拿到最新版
- **Graceful degradation** — Rapier WASM 加载失败自动回退 v0.2 kinematic 模式

## 🎮 Controls

| Key | Action |
|---|---|
| `W` / `↑` | accelerate |
| `S` / `↓` | brake / reverse |
| `A` / `D` | steer left / right |
| `Esc` | close info popup |

Drive into a glowing sign to read about it.

## 🛠 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Renderer | three.js 0.170 (esm.sh + importmap) | no build step |
| Physics | `@dimforge/rapier3d-compat` 0.14 (WASM) | native vehicle controller |
| Reflections | PMREM (procedural env scene) | real metal/glass without HDRI |
| Cache strategy | `no-cache` + ETag + `?v=` runtime versioning | three-layer defense, see [ADR-006](docs/PLAN_v0.3.md) |
| Static server (dev) | `node .claude/serve.mjs` | macOS sandbox-safe, no python |
| Deploy | GitHub Pages via Actions | zero infra |

## 🚗 Quick start (local)

Requires Node 18+ (only for the dev server — no `npm install` needed).

```bash
git clone https://github.com/yapweijun1996/3D-Demo.git
cd 3D-Demo
PORT=8765 node .claude/serve.mjs
# open http://localhost:8765
```

That's it. No bundler, no toolchain. Edit any file and refresh.

## 📁 Project structure

```
3D-Demo/
├── index.html               # shell + importmap + cache-bust loader
├── docs/
│   └── PLAN_v0.3.md         # SSOT plan + ADR log
├── task.md                  # phase tracker (A → G)
├── .github/workflows/
│   └── deploy.yml           # GitHub Pages deploy
├── .claude/
│   ├── launch.json          # claude-preview server config
│   └── serve.mjs            # static dev server with no-cache headers
└── src/
    ├── main.js              # async boot, frame loop
    ├── config.js            # SSOT — every tunable lives here
    ├── input.js             # WASD + arrow keys
    ├── colliders.js         # legacy collider registry (used as fallback)
    ├── physics/             # Rapier integration
    │   ├── rapier-world.js
    │   ├── car-vehicle.js
    │   └── static-colliders.js
    ├── vehicle/
    │   ├── car.js           # curved-body sedan, 5-spoke alloys, plate
    │   ├── drive.js         # physics drive (primary) + kinematic (fallback)
    │   └── camera.js        # smoothed third-person follow
    ├── world/
    │   ├── sky.js           # gradient dome shader
    │   ├── lighting.js
    │   ├── playground.js    # ground texture
    │   ├── roads.js         # cross-shape asphalt + roundabout
    │   ├── water.js         # animated Marina Bay water
    │   ├── landmarks.js     # MBS / Supertrees / Flyer / Merlion
    │   ├── buildings.js     # HDB ring (InstancedMesh)
    │   ├── palms.js         # palm scatter (InstancedMesh)
    │   ├── cones.js         # traffic cones
    │   └── signs.js         # 5 info signs with canvas labels
    └── ui/
        ├── stats.js         # FPS HUD
        ├── minimap.js       # circular top-down map
        └── modal.js         # info popup
```

## 🗺 Roadmap

See [task.md](task.md) for the full checklist.

| Phase | Scope | Status |
|---|---|---|
| v0.2 | Procedural scene + InstancedMesh + minimap + FPS | ✅ shipped |
| **A** | **Rapier physics swap (RaycastVehicle)** | **🚧 in progress** |
| B | GLB asset pipeline (Quaternius / Kenney CC0) | planned |
| C | Reflector water + rain + clouds | planned |
| D | Day/night cycle | planned |
| E | LOD + bloom (night-only) + perf report | planned |
| F | Mobile (touch controls + tier system) | planned |
| G | PWA (installable, offline) | planned |

## 🤝 Credits

- **three.js** — MrDoob et al
- **Rapier** — Sébastien Crozet / Dimforge
- **(Phase B)** Quaternius + Kenney for CC0 GLB assets — see [`assets/CREDITS.md`](assets/CREDITS.md) when added

## 📜 License

Source code: **MIT** (do whatever you want, just keep the notice).
Future GLB assets in `assets/glb/` are **CC0** (no attribution required, but credited anyway).

---

Built by [@yapweijun1996](https://github.com/yapweijun1996) · 2026
