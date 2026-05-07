// CFG — SSOT. Every tunable lives here.
//
// PALETTE CONSTITUTION (Apple HIG: clarity / deference / depth)
// Every visible color in the world MUST come from this palette.
// 8 hues max. Each HDB cluster locks one tone (warm or cool) for
// neighborhood identity — Memoji-style coherence, not asset-pack chaos.
export const PALETTE = {
  sky:        0xc8dcee,        // soft tropical day blue
  skyNight:   0x0a1428,        // deep night with hint of cloud
  fog:        0xc4d4e0,        // sky-tinted haze for atmospheric perspective
  fogNight:   0x10182a,
  sea:        0x4d8aab,        // saturated teal — recognizable Marina Bay
  land:       0x7aaa6e,        // softer tropical green than old saturated 0x4f7242
  road:       0x2e2e36,
  accent:     0xffb85c,        // MBS / Supertrees / Flyer warm emissive (single accent)
  hdbWarm:   [0xe8d7b4, 0xd9a88c],   // cream + terracotta
  hdbCool:   [0xc5d5c0, 0xb8c8d8],   // mint + slate-blue
  voidDeck:   0x3a3530,        // recessed darker band at HDB ground floor
  rooftop:    0x6a6258,        // water-tank / lift-motor box on top
};

export const CFG = {
  palette: PALETTE,
  sky:    PALETTE.sky,                          // legacy alias
  // Tighter fog — pushes far estates into haze, focuses player on ~200m around car
  fog:    { color: PALETTE.fog, near: 60, far: 300 },

  camera: {
    fov: 58, near: 0.1, far: 900,
    followDistance: 9.0,
    followHeight: 5.5,                       // higher (was 3.8 — too low / horizon at center)
    smoothing: 0.10,                         // legacy lerp factor (camera now uses spring)
    lookAhead: 5.5,
  },

  car: {
    useGLB: true,                             // load GLB sedan with separately-spinnable wheels
    // Default = Kenney sedan (4 separate wheels — best Rapier match).
    // Alternate = Quaternius './assets/glb/cars-quat/sedan.glb' (paired-wheel, glbScale ~0.5).
    glbPath: './assets/glb/cars/sedan.glb',
    glbScale: 1.8,                            // 1u source → 1.8m world (gives ~2.7m wide × 4.6m long sedan)
    glbFlipX: true,                           // Kenney +X=LEFT, Quaternius +X=RIGHT (set false for Quat)
    bodyColor:   0xd33340,                    // Singapore red (procedural fallback only)
    accentColor: 0xfbf3e2,
    rimColor:    0xc9c9d1,
    spawn: [99, 1.5, 17],                     // exact ECP world coord from OSM (East Coast Parkway)
    accel: 26,
    brake: 32,
    reverseAccel: 11,
    maxSpeed: 26,
    maxReverse: -9,
    drag: 0.985,
    rollingFriction: 4.0,
    turnRate: 2.5,
    turnFalloff: 0.55,
  },

  world: {
    ground: { size: 800, repeat: 80 },
    bounds: 320,
  },

  // Marina Bay water (visual only, soft no-go ring)
  water: { center: [0, -90], radius: 60, color: PALETTE.sea },

  // 5 info signs — REAL Singapore lat/lng (resolved to world via projectLatLng at build time)
  signs: [
    { id: 'mbs',       label: 'Marina Bay Sands', color: 0xfbcd4e, latLng: [1.2834, 103.8607],
      title: 'Marina Bay Sands',
      lines: [
        '三栋 55 层酒店塔楼,顶部由 SkyPark 连接。',
        'Three 55-storey towers crowned by the SkyPark.',
        'Iconic since 2010 — Moshe Safdie design.',
      ] },
    { id: 'gardens',   label: 'Gardens by the Bay', color: 0x6ad19c, latLng: [1.2816, 103.8636],
      title: 'Gardens by the Bay',
      lines: [
        'Supertrees 高 25–50m,垂直花园,夜间灯光秀。',
        'Vertical gardens. Lit up nightly at Garden Rhapsody.',
        'Cooled conservatories: Flower Dome + Cloud Forest.',
      ] },
    { id: 'flyer',     label: 'Singapore Flyer', color: 0xc78bff, latLng: [1.2893, 103.8631],
      title: 'Singapore Flyer',
      lines: [
        '观景摩天轮,165m 高,曾是世界最高(2008–2014)。',
        'Giant observation wheel. 30-min full rotation.',
        'Views over Marina Bay, the city, even Indonesia.',
      ] },
    { id: 'merlion',   label: 'Merlion',          color: 0xff7e5f, latLng: [1.2868, 103.8545],
      title: 'Merlion (鱼尾狮)',
      lines: [
        '狮头鱼身,新加坡国家象征。',
        'Lion head + fish body. National symbol since 1964.',
        '8.6m tall, spouts water into Marina Bay.',
      ] },
    { id: 'about',     label: 'About Me',         color: 0xff5e9c, latLng: [1.2950, 103.8520],
      title: 'About yapweijun1996',
      lines: [
        'Singapore-based · building AI agent harnesses.',
        'Stack: Three.js · React · Node · MCP · KB-API.',
        'github.com/yapweijun1996',
      ] },
  ],
  signTriggerRadius: 3.0,           // transition-only trigger; cooldown removed (see main.checkSignTriggers)

  // Decorative cones around the player spawn — small driving warm-up area
  cones: [
    [ 6,  18], [ 4,  20], [ 8,  20],
    [-6,  18], [-4,  20], [-8,  20],
  ],

  // HDB clusters — placed at REAL Singapore neighborhoods (resolved via projectLatLng).
  // Each cluster is a mini town: ~70% slab blocks (long 50–80m × 32–48m tall),
  // ~30% point blocks (square 22×22 × 70–90m tall). Every block gets a darker
  // void deck base + small rooftop water tank — the silhouette features that
  // make HDB recognizable. Per-cluster `tone` (warm|cool) gives identity.
  hdb: {
    palette: { warm: PALETTE.hdbWarm, cool: PALETTE.hdbCool },
    clusters: [
      { name: 'Toa Payoh',   latLng: [1.3343, 103.8479], count: 7, spread: 36, tone: 'warm' },
      { name: 'Bishan',      latLng: [1.3504, 103.8480], count: 6, spread: 32, tone: 'cool' },
      { name: 'Ang Mo Kio',  latLng: [1.3690, 103.8460], count: 8, spread: 42, tone: 'warm' },
      { name: 'Tampines',    latLng: [1.3496, 103.9568], count: 7, spread: 38, tone: 'cool' },
      { name: 'Jurong East', latLng: [1.3329, 103.7436], count: 6, spread: 36, tone: 'warm' },
      { name: 'Woodlands',   latLng: [1.4382, 103.7891], count: 5, spread: 30, tone: 'cool' },
    ],
  },
  // Suburb belt — Kenney houses placed further out for visual variety
  suburb: { count: 14, ringRadius: 220, ringJitter: 30 },

  // Palm trees scattered for flavor
  palms: {
    count: 28,
  },

  lights: {
    // Tuned for HDRI-lit daytime — HDRI provides ambient/fill, direct lights only add sun crispness.
    hemi:    { sky: 0xc8dcef, ground: 0x4a5440, intensity: 0.40 },
    sun:     { color: 0xfff2d6, intensity: 1.2, pos: [60, 90, 50],
               shadow: { mapSize: 1024, frustum: 55, near: 1, far: 220, bias: -0.0005 } },
    ambient: { color: 0x9bb4cf, intensity: 0.15 },
  },

  perf: {
    pixelRatio: 1.5,                  // capped under 2 — Retina *2 quadruples pixels = 4x fragment cost
    shadowsEnabled: true,             // toggle for further perf if needed
  },

  physics: {
    enabled: true,                            // false → fall back to kinematic drive (v0.2)
    gravity: -9.82,
    chassis: {
      halfExtents: [1.30, 0.55, 2.20],        // matches Kenney sedan @ scale 1.8 (~2.6w × 1.1h × 4.4l)
      mass: 900,
      linearDamping: 0.25,
      angularDamping: 0.7,
      visualOffsetY: 1.0,                     // body center → visual group origin (Kenney body is 0–2.07m, mid ~1.0)
    },
    wheel: {
      suspensionRest: 0.22,
      suspensionMaxTravel: 0.18,
      suspensionStiffness: 50,
      frictionSlip: 2.4,
      sideFrictionStiffness: 1.5,
      radius: 0.40,
      // Anchors aligned to Kenney sedan wheel positions @ scale 1.8: ±0.54 X, ±1.19 Z
      anchors: [
        [ 0.54, -0.45,  1.19, true ],         // FR
        [-0.54, -0.45,  1.19, true ],         // FL
        [ 0.54, -0.45, -1.19, false],         // RR
        [-0.54, -0.45, -1.19, false],         // RL
      ],
    },
    drive: {
      engineForce: 2200,
      brakeForce: 90,
      reverseFactor: 0.5,
      maxSteer: 0.5,
      steerSpeed: 6,                          // rad/s lerp toward target
      rollingBrake: 8,                        // tiny brake when no throttle (anti-coast-forever)
    },
  },

  // Hold Shift = nitrous. Engine force scales while gauge has fuel.
  // Gauge: 1.0 full, drains 1/burnSeconds per second held, recharges
  // refillRate per second when released.
  boost: {
    multiplier:    2.0,         // engineForce × this while held
    maxSpeedMul:   1.6,         // soft cap raise (kinematic only)
    burnSeconds:   3.0,         // seconds of full burn from full gauge
    refillRate:    0.35,        // gauge units / sec when released
    rechargeDelay: 0.4,         // wait before refill starts (so tap-tap doesn't auto-refuel)
  },
};
