import { injectTheme, TOKENS } from './theme.js';

// Sign-info modal with new design system. Card matches sg-card tokens,
// landmark color drives the side accent rail, content uses serif-ish font.
let openId = null;
let onCloseCb = null;
let dom = null;

function ensureDom() {
  if (dom) return dom;
  injectTheme();
  const wrap = document.createElement('div');
  wrap.id = 'sign-modal';
  wrap.innerHTML = `
    <div class="sm-backdrop"></div>
    <div class="sm-card sg-slide-up">
      <div class="sm-rail"></div>
      <div class="sm-body">
        <div class="sm-eyebrow">Singapore Landmark</div>
        <h2 class="sm-title"></h2>
        <ul class="sm-lines"></ul>
        <div class="sm-foot">Press <kbd>Esc</kbd> or click outside to dismiss</div>
      </div>
      <button class="sm-close" aria-label="Close">×</button>
    </div>`;
  Object.assign(wrap.style, {
    position: 'fixed', inset: '0', display: 'none',
    alignItems: 'center', justifyContent: 'center', zIndex: '90',
  });
  const css = document.createElement('style');
  css.textContent = `
    #sign-modal .sm-backdrop{position:absolute;inset:0;background:rgba(5,10,20,.62);backdrop-filter:blur(6px);cursor:pointer}
    #sign-modal .sm-card{
      position:relative;display:flex;min-width:380px;max-width:560px;
      background:${TOKENS.glassHi};backdrop-filter:${TOKENS.blur};
      color:${TOKENS.text};border:1px solid ${TOKENS.borderHi};border-radius:18px;
      box-shadow:0 28px 70px rgba(0,0,0,.55);overflow:hidden;
      font-family:${TOKENS.font};
    }
    #sign-modal .sm-rail{width:6px;background:${TOKENS.gold};flex-shrink:0}
    #sign-modal .sm-body{padding:22px 28px 24px;flex:1}
    #sign-modal .sm-eyebrow{font:600 10px ${TOKENS.font};letter-spacing:.22em;text-transform:uppercase;color:${TOKENS.gold};opacity:.85;margin-bottom:6px}
    #sign-modal .sm-title{margin:0 0 14px;font:700 24px ${TOKENS.font};letter-spacing:-.005em;line-height:1.15}
    #sign-modal .sm-lines{margin:0;padding:0;list-style:none}
    #sign-modal .sm-lines li{padding:6px 0;font:500 14px ${TOKENS.font};opacity:.86;line-height:1.55;border-top:1px solid rgba(255,255,255,.06)}
    #sign-modal .sm-lines li:first-child{border-top:0}
    #sign-modal .sm-foot{margin-top:18px;font:500 11px ${TOKENS.font};letter-spacing:.04em;opacity:.45;text-transform:uppercase}
    #sign-modal .sm-foot kbd{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:4px;padding:1px 5px;font-family:${TOKENS.mono};font-size:10px}
    #sign-modal .sm-close{
      position:absolute;top:10px;right:14px;background:none;border:0;color:${TOKENS.text};
      font-size:26px;line-height:1;cursor:pointer;opacity:.55;font-family:${TOKENS.font}
    }
    #sign-modal .sm-close:hover{opacity:1}
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
  const col = '#' + sign.color.toString(16).padStart(6, '0');
  w.querySelector('.sm-rail').style.background = col;
  w.querySelector('.sm-eyebrow').style.color = col;
  w.querySelector('.sm-title').textContent = sign.title;
  const ul = w.querySelector('.sm-lines');
  ul.innerHTML = '';
  for (const line of sign.lines) {
    const li = document.createElement('li');
    li.textContent = line;
    ul.appendChild(li);
  }
  w.style.display = 'flex';
  // Re-trigger slide-up animation
  const card = w.querySelector('.sm-card');
  card.classList.remove('sg-slide-up');
  void card.offsetWidth;
  card.classList.add('sg-slide-up');
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
