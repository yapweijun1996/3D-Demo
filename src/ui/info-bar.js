import { injectTheme, TOKENS } from './theme.js';

// Top-right info bar — landmark discovery counter + day/night badge.
// Sits next to (or replacing) the stats panel slot. Doesn't disappear like
// stats — this is gameplay, not debug.
//
// Usage:
//   const info = createInfoBar({ totalLandmarks });
//   info.tickDayNight(dayNight.phase, dayNight.label);
//   info.setVisited(n);

export function createInfoBar({ totalLandmarks = 6 } = {}) {
  injectTheme();
  const el = document.createElement('div');
  el.className = 'sg-card sg-fade-in';
  Object.assign(el.style, {
    position: 'fixed', top: '14px', right: '14px', zIndex: '55',
    padding: '10px 14px',
    font: `500 12px ${TOKENS.font}`,
    pointerEvents: 'none',
    display: 'flex', flexDirection: 'column', gap: '6px',
    minWidth: '160px',
  });
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
      <span style="font:600 10px ${TOKENS.font};letter-spacing:.16em;opacity:.55;text-transform:uppercase">Time</span>
      <span style="display:flex;align-items:center;gap:6px">
        <span id="ib-icon" style="font-size:14px;line-height:1">☀</span>
        <span id="ib-label" style="font:600 12px ${TOKENS.mono};letter-spacing:.05em;color:${TOKENS.gold}">DAY</span>
      </span>
    </div>
    <div style="height:1px;background:rgba(255,255,255,.08)"></div>
    <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
      <span style="font:600 10px ${TOKENS.font};letter-spacing:.16em;opacity:.55;text-transform:uppercase">Landmarks</span>
      <span style="display:flex;align-items:center;gap:4px">
        <span id="ib-count" style="font:700 14px ${TOKENS.mono};letter-spacing:.04em;color:${TOKENS.text}">0</span>
        <span style="font:500 11px ${TOKENS.mono};opacity:.55">/ ${totalLandmarks}</span>
      </span>
    </div>
    <div style="display:flex;gap:3px;margin-top:2px">
      ${Array.from({ length: totalLandmarks }, (_, i) =>
        `<div data-i="${i}" style="flex:1;height:4px;background:rgba(255,255,255,.08);border-radius:2px;transition:background .25s"></div>`
      ).join('')}
    </div>
  `;
  document.body.appendChild(el);

  const iconEl = el.querySelector('#ib-icon');
  const labelEl = el.querySelector('#ib-label');
  const countEl = el.querySelector('#ib-count');
  const dotEls  = el.querySelectorAll('[data-i]');

  return {
    tickDayNight(phase /* 0=day, 1=night */) {
      // 0..0.25 day, 0.25..0.4 dusk, 0.4..0.7 night, 0.7..1 dawn
      let icon = '☀', label = 'DAY', col = TOKENS.gold;
      if (phase > 0.7)      { icon = '🌅'; label = 'DAWN';  col = TOKENS.gold; }
      else if (phase > 0.4) { icon = '🌙'; label = 'NIGHT'; col = TOKENS.teal; }
      else if (phase > 0.2) { icon = '🌆'; label = 'DUSK';  col = '#ff8a5b'; }
      iconEl.textContent = icon;
      labelEl.textContent = label;
      labelEl.style.color = col;
    },
    setVisited(visitedSet) {
      countEl.textContent = String(visitedSet.size);
      let i = 0;
      for (const _ of visitedSet) {
        if (dotEls[i]) dotEls[i].style.background = TOKENS.gold;
        i++;
      }
      // dim the unvisited
      for (let j = i; j < dotEls.length; j++) {
        dotEls[j].style.background = 'rgba(255,255,255,.08)';
      }
    },
  };
}
