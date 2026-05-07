// Boot splash screen with progress bar. Created synchronously before any
// async work begins, so the user never sees a blank canvas.
export function createSplash() {
  const el = document.createElement('div');
  el.id = 'splash';
  Object.assign(el.style, {
    position: 'fixed', inset: '0',
    background: 'radial-gradient(circle at 50% 40%, #2a3a55 0%, #0f1623 70%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
    color: '#f0e8d0', font: '14px ui-monospace,monospace',
    zIndex: '100', transition: 'opacity 0.4s ease-out',
  });
  el.innerHTML = `
    <div style="font-size:24px;letter-spacing:0.12em;margin-bottom:6px;font-weight:700">🇸🇬 DRIVE SINGAPORE</div>
    <div style="font-size:12px;opacity:0.55;margin-bottom:18px">a mini-tour · three.js + rapier</div>
    <div style="width:260px;height:6px;background:rgba(255,255,255,0.10);border-radius:3px;overflow:hidden">
      <div id="splash-bar" style="height:100%;width:0;background:linear-gradient(90deg,#d33340,#fbcd4e);transition:width 0.18s ease-out"></div>
    </div>
    <div id="splash-text" style="margin-top:10px;opacity:0.6;font-size:12px;letter-spacing:0.04em">loading...</div>
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
      setTimeout(() => el.remove(), 450);
    },
  };
}
