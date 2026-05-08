import { injectTheme, TOKENS } from './theme.js';
import { districtAtWorld, DISTRICTS } from '../world/districts.js';

// Bottom-center banner that animates in when the car crosses into a new
// district. Quietly hides 2.4s later. Reads district SSOT for label/color.
const LABELS = {
  marina:    { name: 'Marina Bay',     tagline: 'Skyline · CBD · MBS' },
  civic:     { name: 'Civic District', tagline: 'Colonial · Esplanade' },
  chinatown: { name: 'Chinatown',      tagline: 'Shophouses · Heritage' },
  orchard:   { name: 'Orchard Road',   tagline: 'Retail · Avenues' },
  hdb:       { name: 'HDB Heartland',  tagline: 'Public Housing' },
  park:      { name: 'Park Belt',      tagline: 'Greenway · Reserve' },
};

export function createDistrictBanner(carRef) {
  injectTheme();
  const el = document.createElement('div');
  el.className = 'sg-card';
  Object.assign(el.style, {
    position: 'fixed', left: '50%', bottom: '90px', zIndex: '52',
    transform: 'translate(-50%, 30px)',
    padding: '14px 28px', minWidth: '300px',
    textAlign: 'center', pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity .4s ease, transform .42s cubic-bezier(.22,1,.36,1)',
  });
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:4px">
      <div style="width:22px;height:1px;background:${TOKENS.gold}"></div>
      <span id="db-eyebrow" style="font:700 10px ${TOKENS.font};letter-spacing:.32em;text-transform:uppercase;color:${TOKENS.gold}">entering</span>
      <div style="width:22px;height:1px;background:${TOKENS.gold}"></div>
    </div>
    <div id="db-name" style="font:800 26px ${TOKENS.font};letter-spacing:-.005em;line-height:1.1">—</div>
    <div id="db-tagline" style="font:500 11px ${TOKENS.font};letter-spacing:.10em;text-transform:uppercase;opacity:.55;margin-top:4px">—</div>
  `;
  document.body.appendChild(el);

  const nameEl = el.querySelector('#db-name');
  const tagEl  = el.querySelector('#db-tagline');

  let lastDist = null;
  let hideT = null;

  function show(did) {
    const meta = LABELS[did] || { name: did, tagline: '' };
    nameEl.textContent = meta.name;
    tagEl.textContent  = meta.tagline;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, 0)';
    if (hideT) clearTimeout(hideT);
    hideT = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, 30px)';
    }, 2400);
  }

  let acc = 0;
  function tick(dt) {
    // sample every 0.4s — district bbox check is cheap but no need each frame
    acc += dt;
    if (acc < 0.4) return;
    acc = 0;
    if (!carRef?.group) return;
    const p = carRef.group.position;
    const did = districtAtWorld(p.x, p.z);
    if (did && did !== lastDist) {
      lastDist = did;
      show(did);
    } else if (!did) {
      lastDist = null;
    }
  }
  return { tick };
}
