import { injectTheme, TOKENS } from './theme.js';

// Bottom-left controls hint pill. Auto-fades after 6s of activity.
// Replaces the always-on .hud div in index.html.
export function createControlsHint() {
  injectTheme();
  // Remove any pre-existing static hud node from index.html
  const stale = document.querySelector('.hud');
  if (stale) stale.remove();

  const el = document.createElement('div');
  el.className = 'sg-pill sg-fade-in';
  Object.assign(el.style, {
    position: 'fixed', left: '14px', bottom: '14px', zIndex: '50',
    padding: '8px 14px',
    font: `500 12px ${TOKENS.font}`, letterSpacing: '.02em',
    pointerEvents: 'none',
    transition: 'opacity .6s ease',
    display: 'flex', alignItems: 'center', gap: '10px',
  });
  const kbd = (k) => `<kbd style="display:inline-block;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:4px;padding:1px 7px;font:600 11px ${TOKENS.mono};margin:0 2px;letter-spacing:.04em">${k}</kbd>`;
  el.innerHTML = `
    <span>${kbd('W')}${kbd('A')}${kbd('S')}${kbd('D')} <span style="opacity:.55;margin-left:2px">drive</span></span>
    <span style="opacity:.25">·</span>
    <span>${kbd('Shift')} <span style="opacity:.55">boost</span></span>
    <span style="opacity:.25">·</span>
    <span>${kbd('T')} <span style="opacity:.55">day/night</span></span>
    <span style="opacity:.25">·</span>
    <span>${kbd('\`')} <span style="opacity:.55">stats</span></span>
  `;
  document.body.appendChild(el);

  // fade after first key press → 6s timer; reappear on hover near bottom-left
  let faded = false, t = null;
  function fade() {
    if (faded) return;
    faded = true;
    el.style.opacity = '0.18';
  }
  function unfade() {
    if (!faded) return;
    faded = false;
    el.style.opacity = '1';
    if (t) clearTimeout(t);
    t = setTimeout(fade, 6000);
  }
  addEventListener('keydown', unfade, { passive: true });
  addEventListener('pointermove', (e) => {
    if (e.clientY > innerHeight - 120 && e.clientX < 380) unfade();
  }, { passive: true });
  t = setTimeout(fade, 6000);
  return { el };
}
