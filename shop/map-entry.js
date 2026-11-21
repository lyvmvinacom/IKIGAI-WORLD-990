(() => {
  const map = document.querySelector('#mapScene');
  if (!map || map.querySelector('.ik-shop-dock')) return;
  const scriptURL = new URL(document.currentScript.src);
  const assetURL = name => new URL(name, scriptURL).href;
  const tools = document.createElement('div');
  tools.className = 'ik-shop-dock';
  tools.setAttribute('aria-label', 'Shop và Túi đồ');
  map.append(tools);
  const css = document.createElement('style');
  css.textContent = `
    #mapScene .ik-shop-dock{position:absolute;right:max(8px,env(safe-area-inset-right));top:50%;bottom:auto;left:auto;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:var(--ik-map-control-gap,8px);z-index:25;pointer-events:none}
    #mapScene .ik-shop-dock .ik-shop-entry{position:relative;flex:0 0 var(--ik-map-control-size,52px);box-sizing:border-box!important;width:var(--ik-map-control-size,52px)!important;height:var(--ik-map-control-size,52px)!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;pointer-events:auto;cursor:pointer;color:#ffe5a5;font-weight:800;transition:filter .15s;filter:drop-shadow(0 3px 3px #0008);overflow:visible}
    #mapScene .ik-shop-entry img{box-sizing:border-box!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;display:block;margin:0!important;transform:none!important;pointer-events:none}
    #mapScene .ik-shop-entry:hover{filter:drop-shadow(0 0 5px #ffd58a)}
    #mapScene .ik-shop-entry:active{filter:brightness(.85)}
    #mapScene .ik-shop-entry:focus-visible{outline:3px solid #ffe5a5;outline-offset:3px;border-radius:12px}
    #mapScene .map-tools{right:var(--ik-map-control-reserve,84px)!important;top:auto!important;bottom:24px!important}
    #mapScene .ik-task-entry .task-count{top:-3px!important;right:-3px!important;min-width:20px!important;height:20px!important;padding:0 4px!important;font:800 11px/1 system-ui!important}
    #ik-shop-overlay{position:absolute;inset:0;z-index:2147483000;background:#10283c;display:flex;flex-direction:column}
    #ik-shop-overlay iframe{border:0;width:100%;flex:1;min-height:0}
    #ik-shop-overlay header{display:flex;justify-content:space-between;align-items:center;background:#172e43;color:#ffe0a0;padding:4px max(10px,env(safe-area-inset-right));font:bold 12px system-ui}
    #ik-shop-overlay button{background:#25475e;color:white;border:1px solid #d9b86b;border-radius:6px;padding:5px 12px;cursor:pointer}
    @media(prefers-reduced-motion:reduce){.ik-shop-entry{transition:none}.ik-shop-entry:hover{transform:none}}
  `;
  document.head.append(css);
  // Measure the landscape canvas, not viewport vh: portrait-held phones rotate #game.
  function fitMapControls() {
    const height = map.clientHeight;
    if (!height) return;
    const size = Math.round(Math.max(44, Math.min(64, height * .14)));
    const gap = Math.round(Math.max(8, Math.min(12, height * .025)));
    map.style.setProperty('--ik-map-control-size', size + 'px');
    map.style.setProperty('--ik-map-control-gap', gap + 'px');
    map.style.setProperty('--ik-map-control-reserve', (size + gap + 20) + 'px');
  }
  fitMapControls();
  if (typeof ResizeObserver === 'function') new ResizeObserver(fitMapControls).observe(map);
  window.addEventListener('resize', fitMapControls);
  window.addEventListener('orientationchange', fitMapControls);

  function open(view, trigger) {
    if (document.getElementById('ik-shop-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ik-shop-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', view === 'shop' ? 'Shop IKIGAI' : 'Nhân vật và Túi đồ IKIGAI');
    overlay.innerHTML = '<header><span>IKIGAI EDUCATION · SHOP & TÚI ĐỒ</span><button type="button">✕ Về bản đồ</button></header><iframe title="Shop và Túi đồ IKIGAI"></iframe>';
    const frame = overlay.querySelector('iframe');
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', escape);
      window.removeEventListener('message', onMessage);
      trigger.focus();
    };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    const onMessage = event => {
      if (event.origin === location.origin && event.source === frame.contentWindow && event.data?.type === 'ikigai-shop-close') close();
    };
    overlay.querySelector('button').onclick = close;
    frame.src = assetURL('demo.html') + '?v=20261116-live-shop-1&view=' + view;
    (document.querySelector('#game') || document.body).append(overlay);
    document.addEventListener('keydown', escape);
    window.addEventListener('message', onMessage);
    overlay.querySelector('button').focus();
  }
  for (const [view, label, icon] of [['shop', 'Shop', 'shop'], ['character', 'Túi đồ và nhân vật', 'bag']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ik-shop-entry';
    button.setAttribute('aria-label', label);
    button.title = label;
    const image = document.createElement('img');
    image.src = assetURL(icon + '.png');
    image.alt = label;
    image.draggable = false;
    image.onerror = () => { image.remove(); button.textContent = label; };
    button.append(image);
    button.onclick = () => open(view, button);
    tools.append(button);
  }
})();
