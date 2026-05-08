// SSOT design tokens for all in-game UI. Injected once into <head>.
// Drives splash, HUD, minimap, speedometer, modal, banners, tracker.
// Theme: tropical Singapore — SG red + gold + teal on dark glass.

let injected = false;

export const TOKENS = Object.freeze({
  red:    '#ED2939',
  redDim: '#a51a25',
  gold:   '#F5B344',
  teal:   '#3BC9DB',
  ink:    '#0a1426',
  text:   '#f4f6fb',
  muted:  'rgba(244,246,251,0.55)',
  glass:  'rgba(10,18,32,0.62)',
  glassHi:'rgba(20,30,48,0.78)',
  border: 'rgba(255,255,255,0.10)',
  borderHi:'rgba(255,255,255,0.22)',
  shadow: '0 14px 38px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.30)',
  font:   '-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter",system-ui,sans-serif',
  mono:   'ui-monospace,"SF Mono",Menlo,monospace',
  blur:   'blur(14px) saturate(1.35)',
});

export function injectTheme() {
  if (injected) return;
  injected = true;
  const css = `
    :root {
      --sg-red:${TOKENS.red}; --sg-red-dim:${TOKENS.redDim};
      --sg-gold:${TOKENS.gold}; --sg-teal:${TOKENS.teal};
      --sg-text:${TOKENS.text}; --sg-muted:${TOKENS.muted};
      --sg-glass:${TOKENS.glass}; --sg-glass-hi:${TOKENS.glassHi};
      --sg-border:${TOKENS.border}; --sg-border-hi:${TOKENS.borderHi};
      --sg-shadow:${TOKENS.shadow};
      --sg-font:${TOKENS.font}; --sg-mono:${TOKENS.mono};
      --sg-blur:${TOKENS.blur};
    }
    .sg-card {
      background: var(--sg-glass);
      backdrop-filter: var(--sg-blur);
      -webkit-backdrop-filter: var(--sg-blur);
      border: 1px solid var(--sg-border);
      border-radius: 16px;
      box-shadow: var(--sg-shadow);
      color: var(--sg-text);
      font-family: var(--sg-font);
    }
    .sg-pill {
      background: var(--sg-glass);
      backdrop-filter: var(--sg-blur);
      -webkit-backdrop-filter: var(--sg-blur);
      border: 1px solid var(--sg-border);
      border-radius: 999px;
      color: var(--sg-text);
      font-family: var(--sg-font);
      box-shadow: var(--sg-shadow);
    }
    .sg-stripe {
      height: 3px;
      background: linear-gradient(90deg, var(--sg-red) 0 50%, #fff 50% 100%);
      border-radius: 2px;
    }
    .sg-fade-in { animation: sg-fade-in .35s ease-out both; }
    .sg-slide-up { animation: sg-slide-up .42s cubic-bezier(.22,1,.36,1) both; }
    @keyframes sg-fade-in { from{opacity:0} to{opacity:1} }
    @keyframes sg-slide-up { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
  `;
  const tag = document.createElement('style');
  tag.id = 'sg-theme';
  tag.textContent = css;
  document.head.appendChild(tag);
}
