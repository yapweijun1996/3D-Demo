// CFG — SSOT. Every tunable lives here.
export const CFG = {
  sky:    0xf0c9a8,                           // tropical dusk peach
  fog:    { color: 0xf2c8a4, near: 120, far: 420 },

  camera: {
    fov: 58, near: 0.1, far: 900,
    followDistance: 8.5,
    followHeight: 3.8,
    smoothing: 0.10,
    lookAhead: 4.0,
  },

  car: {
    bodyColor:   0xd33340,                    // Singapore red
    accentColor: 0xfbf3e2,                    // off-white
    rimColor:    0xc9c9d1,
    spawn: [0, 0, 24],
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
  water: { center: [0, -90], radius: 60, color: 0x2a6a8a },

  // 5 info signs — Singapore-themed mini tour stops
  signs: [
    { id: 'mbs',       label: 'Marina Bay Sands', color: 0xfbcd4e, pos: [ 18, -24],
      title: 'Marina Bay Sands',
      lines: [
        '三栋 55 层酒店塔楼,顶部由 SkyPark 连接。',
        'Three 55-storey towers crowned by the SkyPark.',
        'Iconic since 2010 — Moshe Safdie design.',
      ] },
    { id: 'gardens',   label: 'Gardens by the Bay', color: 0x6ad19c, pos: [-26,  -8],
      title: 'Gardens by the Bay',
      lines: [
        'Supertrees 高 25–50m,垂直花园,夜间灯光秀。',
        'Vertical gardens. Lit up nightly at Garden Rhapsody.',
        'Cooled conservatories: Flower Dome + Cloud Forest.',
      ] },
    { id: 'flyer',     label: 'Singapore Flyer', color: 0xc78bff, pos: [ 26,  10],
      title: 'Singapore Flyer',
      lines: [
        '观景摩天轮,165m 高,曾是世界最高(2008–2014)。',
        'Giant observation wheel. 30-min full rotation.',
        'Views over Marina Bay, the city, even Indonesia.',
      ] },
    { id: 'merlion',   label: 'Merlion',          color: 0xff7e5f, pos: [-14,  18],
      title: 'Merlion (鱼尾狮)',
      lines: [
        '狮头鱼身,新加坡国家象征。',
        'Lion head + fish body. National symbol since 1964.',
        '8.6m tall, spouts water into Marina Bay.',
      ] },
    { id: 'about',     label: 'About Me',         color: 0xff5e9c, pos: [  0,  30],
      title: 'About yapweijun1996',
      lines: [
        'Singapore-based · building AI agent harnesses.',
        'Stack: Three.js · React · Node · MCP · KB-API.',
        'github.com/yapweijun1996',
      ] },
  ],
  signTriggerRadius: 3.0,
  signCooldown: 1.5,

  // Decorative cones around the player spawn — small driving warm-up area
  cones: [
    [ 6,  18], [ 4,  20], [ 8,  20],
    [-6,  18], [-4,  20], [-8,  20],
  ],

  // HDB-style residential towers ringing the playable area
  hdb: {
    count: 18,
    ringRadius: 230,
    ringJitter: 35,
  },

  // Palm trees scattered for flavor
  palms: {
    count: 28,
  },

  lights: {
    hemi:    { sky: 0xfbd9b0, ground: 0x4a5440, intensity: 0.55 },
    sun:     { color: 0xffd9a0, intensity: 1.6, pos: [60, 90, 50],
               shadow: { mapSize: 2048, frustum: 90, near: 1, far: 280, bias: -0.0005 } },
    ambient: { color: 0x7e90b6, intensity: 0.25 },
  },

  perf: { pixelRatio: 2 },
};
