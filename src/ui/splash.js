import { injectTheme } from './theme.js';

// Cinematic boot screen. Tropical SG title card with red/white flag stripe,
// progress bar, and tagline. Replaces the generic dark panel.
export function createSplash() {
  injectTheme();
  const el = document.createElement('div');
  el.id = 'splash';
  Object.assign(el.style, {
    position: 'fixed', inset: '0', zIndex: '100',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
    background:
      'radial-gradient(circle at 30% 20%, rgba(245,179,68,0.18) 0, transparent 45%),' +
      'radial-gradient(circle at 75% 80%, rgba(59,201,219,0.16) 0, transparent 50%),' +
      'linear-gradient(160deg, #0e1a30 0%, #050a14 100%)',
    color: 'var(--sg-text)', fontFamily: 'var(--sg-font)',
    transition: 'opacity .45s ease-out',
  });
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
      <div style="width:42px;height:28px;border-radius:5px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 12px rgba(0,0,0,.5)">
        <div style="flex:1;background:#ED2939"></div>
        <div style="flex:1;background:#fff;display:flex;align-items:center;justify-content:flex-end;padding-right:3px;font-size:8px">★</div>
      </div>
      <div style="font:700 13px var(--sg-font);letter-spacing:.32em;color:var(--sg-gold);text-transform:uppercase">drive</div>
    </div>
    <div style="font:800 56px var(--sg-font);letter-spacing:.02em;line-height:1;margin:6px 0 4px;background:linear-gradient(180deg,#fff 0%,#cfd6e4 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
      SINGAPORE
    </div>
    <div class="sg-stripe" style="width:120px;margin:8px 0 18px"></div>
    <div style="font:500 13px var(--sg-font);letter-spacing:.10em;opacity:.7;text-transform:uppercase;margin-bottom:32px">
      a procedural mini-tour
    </div>
    <div style="position:relative;width:280px;height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">
      <div id="splash-bar" style="position:absolute;inset:0;width:0;background:linear-gradient(90deg,#ED2939,#F5B344,#3BC9DB);border-radius:inherit;transition:width .25s cubic-bezier(.22,1,.36,1);box-shadow:0 0 16px rgba(245,179,68,.55)"></div>
    </div>
    <div id="splash-text" style="margin-top:14px;font:500 11px var(--sg-mono);letter-spacing:.10em;opacity:.55;text-transform:uppercase">
      booting...
    </div>
    <div style="position:absolute;bottom:18px;font:500 10px var(--sg-mono);letter-spacing:.18em;opacity:.35;text-transform:uppercase">
      three.js · rapier · openstreetmap
    </div>
  `;
  document.body.appendChild(el);
  const bar = el.querySelector('#splash-bar');
  const txt = el.querySelector('#splash-text');
  return {
    setProgress(pct, label) {
      bar.style.width = Math.min(100, Math.max(0, pct * 100)) + '%';
      if (label) txt.textContent = label;
    },
    hide() {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 480);
    },
  };
}
