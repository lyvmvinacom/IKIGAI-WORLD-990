/* Native landscape: CSS rotation cannot rotate the phone's system keyboard. */
(() => {
  'use strict';
  const root = document.documentElement;
  const game = document.getElementById('game');
  const gate = document.getElementById('orientationGate');
  if (!game || !gate) return;
  const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let focused = null;
  let portrait = innerHeight > innerWidth;
  let frame = 0;
  let settleTimer;
  let previousInert = false;
  let blocked = false;
  let fontRestore = null;

  function editable(node) {
    return node instanceof HTMLElement && (node.isContentEditable ||
      node.matches('textarea, input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]):not([type=color])'));
  }
  function physicalPortrait() {
    // iOS reports device orientation independently of the keyboard viewport.
    if (touchDevice && typeof window.orientation === 'number') return Math.abs(window.orientation) % 180 === 0;
    if (touchDevice && screen.orientation?.type) return screen.orientation.type.startsWith('portrait');
    return innerHeight > innerWidth;
  }
  function sync(forceOrientation = false) {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const mobile = touchDevice || innerWidth <= 900;
      if (!focused || forceOrientation) portrait = physicalPortrait();
      const shouldBlock = mobile && portrait;
      if (shouldBlock && !blocked) {
        previousInert = game.inert;
        game.inert = true;
        focused?.blur();
      } else if (!shouldBlock && blocked) {
        game.inert = previousInert;
      }
      blocked = shouldBlock;
      root.classList.toggle('native-mobile', mobile);
      root.classList.toggle('needs-landscape', blocked);
      gate.hidden = !blocked;
      const viewport = window.visualViewport;
      const keyboard = mobile && !blocked && !!focused && (!viewport || Math.abs(viewport.scale - 1) < 0.05);
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
  document.addEventListener('focusin', event => {
    const input = event.composedPath().find(editable);
    if (!input) return;
    focused = input;
    // Applies to dynamically mounted forms and inputs inside the JFT shadow root.
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
    settleTimer = setTimeout(() => sync(), 350);
  });
  document.addEventListener('focusout', event => {
    if (!event.composedPath().includes(focused)) return;
    fontRestore?.();
    fontRestore = null;
    focused = null;
    clearTimeout(settleTimer);
    sync();
    settleTimer = setTimeout(() => sync(), 350);
  });
  const rotate = () => {
    sync(true);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => sync(true), 350);
  };
  window.addEventListener('orientationchange', rotate);
  screen.orientation?.addEventListener('change', rotate);
  window.addEventListener('resize', () => sync());
  window.visualViewport?.addEventListener('resize', () => sync());
  window.visualViewport?.addEventListener('scroll', () => sync());
  window.addEventListener('pageshow', () => sync(true));
  sync(true);
})();
