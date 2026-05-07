// Lightweight modal that displays sign content. Pure DOM, no framework.
// Exports: openModal(signCfg), closeModal(), isOpen()
// Pressing Escape (handled in main) or clicking the backdrop closes it.

let openId = null;
let onCloseCb = null;
let dom = null;

function ensureDom() {
  if (dom) return dom;
  const wrap = document.createElement('div');
  wrap.id = 'sign-modal';
  wrap.innerHTML = `
    <div class="sm-backdrop"></div>
    <div class="sm-card">
      <div class="sm-bar"></div>
      <h2 class="sm-title"></h2>
      <ul class="sm-lines"></ul>
      <button class="sm-close" aria-label="Close">×</button>
    </div>`;
  Object.assign(wrap.style, {
    position: 'fixed', inset: '0', display: 'none',
    alignItems: 'center', justifyContent: 'center', zIndex: '50',
  });
  const css = document.createElement('style');
  css.textContent = `
    #sign-modal .sm-backdrop{position:absolute;inset:0;background:rgba(8,12,20,.55);backdrop-filter:blur(4px);cursor:pointer}
    #sign-modal .sm-card{
      position:relative;min-width:340px;max-width:520px;padding:22px 26px 24px;
      background:rgba(20,28,42,.95);color:#f0e8d0;border:1px solid rgba(255,255,255,.16);
      border-radius:14px;box-shadow:0 22px 60px rgba(0,0,0,.5);
      animation:sm-in .25s ease-out;
    }
    #sign-modal .sm-bar{height:5px;border-radius:4px;margin:-4px -10px 14px;background:#888}
    #sign-modal .sm-title{margin:0 0 12px;font-size:24px;letter-spacing:.04em}
    #sign-modal .sm-lines{margin:0;padding:0;list-style:none}
    #sign-modal .sm-lines li{padding:5px 0;font-size:15px;opacity:.9;line-height:1.5;font-family:ui-monospace,monospace}
    #sign-modal .sm-close{
      position:absolute;top:8px;right:12px;background:none;border:0;color:#f0e8d0;
      font-size:28px;line-height:1;cursor:pointer;opacity:.7
    }
    #sign-modal .sm-close:hover{opacity:1}
    @keyframes sm-in{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
  `;
  document.head.appendChild(css);
  document.body.appendChild(wrap);
  wrap.querySelector('.sm-backdrop').addEventListener('click', closeModal);
  wrap.querySelector('.sm-close').addEventListener('click', closeModal);
  dom = wrap;
  return wrap;
}

export function openModal(sign, onClose) {
  const w = ensureDom();
  w.querySelector('.sm-bar').style.background = '#' + sign.color.toString(16).padStart(6, '0');
  w.querySelector('.sm-title').textContent = sign.title;
  const ul = w.querySelector('.sm-lines');
  ul.innerHTML = '';
  for (const line of sign.lines) {
    const li = document.createElement('li');
    li.textContent = line;
    ul.appendChild(li);
  }
  w.style.display = 'flex';
  openId = sign.id;
  onCloseCb = onClose;
}

export function closeModal() {
  if (!dom || !openId) return;
  dom.style.display = 'none';
  const id = openId; openId = null;
  if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(id); }
}

export function isOpen() { return openId !== null; }
