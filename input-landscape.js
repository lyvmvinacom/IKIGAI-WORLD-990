/* Keep the game available. Native keyboards need unrotated text-entry UI. */
(() => {
  'use strict';
  const root = document.documentElement;
  const game = document.getElementById('game');
  const login = document.getElementById('login');
  if (!game) return;
  const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let focused = null;
  let closingKeyboard = false;
  let frame = 0;
  let settleTimer;
  let fontRestore = null;

  function editable(node) {
    return node instanceof HTMLElement && (node.isContentEditable ||
      node.matches('textarea, input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]):not([type=color])'));
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const mobile = touchDevice || innerWidth <= 900;
      // Never block access or set inert based on the reported device direction.
      // The existing landscape canvas returns after text entry, without
      // recreating form nodes or losing the player's current game state.
      const entry = mobile && (!!focused || closingKeyboard || (login && !login.hidden));
      const viewport = window.visualViewport;
      const keyboard = mobile && !!focused && (!viewport || Math.abs(viewport.scale - 1) < 0.05);
      root.classList.toggle('native-entry', !!entry);
      root.classList.toggle('keyboard-open', keyboard);
      root.style.setProperty('--input-viewport-height', `${keyboard && viewport ? viewport.height : innerHeight}px`);
      root.style.setProperty('--input-viewport-top', `${keyboard && viewport ? viewport.offsetTop : 0}px`);
      root.style.setProperty('--input-viewport-width', `${innerWidth}px`);
      if (keyboard && focused?.isConnected) {
        const rect = focused.getBoundingClientRect();
        const top = viewport?.offsetTop || 0;
        const bottom = top + (viewport?.height || innerHeight);
        if (rect.top < top + 12 || rect.bottom > bottom - 12) {
          focused.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        }
      }
    });
  }
  if (login) new MutationObserver(sync).observe(login, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('focusin', event => {
    const input = event.composedPath().find(editable);
    if (!input) return;
    focused = input;
    closingKeyboard = false;
    if (touchDevice && parseFloat(getComputedStyle(input).fontSize) < 16) {
      const value = input.style.getPropertyValue('font-size');
      const priority = input.style.getPropertyPriority('font-size');
      input.style.setProperty('font-size', '16px', 'important');
      fontRestore = () => {
        if (input.style.getPropertyValue('font-size') === '16px') {
          if (value) input.style.setProperty('font-size', value, priority);
          else input.style.removeProperty('font-size');
        }
      };
    }
    sync();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(sync, 350);
  });
  document.addEventListener('focusout', event => {
    if (!event.composedPath().includes(focused)) return;
    fontRestore?.();
    fontRestore = null;
    focused = null;
    closingKeyboard = true;
    clearTimeout(settleTimer);
    sync();
    settleTimer = setTimeout(() => { closingKeyboard = false; sync(); }, 350);
  });
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  screen.orientation?.addEventListener('change', sync);
  window.visualViewport?.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('scroll', sync);
  window.addEventListener('pageshow', sync);
  sync();
})();
