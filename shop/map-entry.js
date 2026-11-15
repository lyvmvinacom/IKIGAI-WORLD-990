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
    .ik-shop-dock{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:8px;z-index:25;pointer-events:none}
    .ik-shop-dock .ik-shop-entry{pointer-events:auto;width:clamp(62px,12vh,105px);height:clamp(62px,12vh,105px);padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;cursor:pointer;color:#ffe5a5;font-weight:800;transition:transform .15s;filter:drop-shadow(0 3px 3px #0008)}
    .ik-shop-entry img{width:100%;height:100%;object-fit:contain;display:block}
    .ik-shop-entry:hover{transform:translateY(-3px) scale(1.06)}.ik-shop-entry:active{transform:scale(.94)}
    .ik-shop-entry:focus-visible{outline:3px solid #ffe5a5;outline-offset:3px;border-radius:12px}
    #ik-shop-overlay{position:fixed;inset:0;z-index:2147483000;background:#10283c;display:flex;flex-direction:column}
    #ik-shop-overlay iframe{border:0;width:100%;flex:1;min-height:0}
    #ik-shop-overlay header{display:flex;justify-content:space-between;align-items:center;background:#172e43;color:#ffe0a0;padding:4px max(10px,env(safe-area-inset-right));font:bold 12px system-ui}
    #ik-shop-overlay button{background:#25475e;color:white;border:1px solid #d9b86b;border-radius:6px;padding:5px 12px;cursor:pointer}
    @media(prefers-reduced-motion:reduce){.ik-shop-entry{transition:none}.ik-shop-entry:hover{transform:none}}
  `;
  document.head.append(css);
  function open(view, trigger) {
    if (document.getElementById('ik-shop-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ik-shop-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', view === 'shop' ? 'Shop IKIGAI' : 'Nhân vật và Túi đồ IKIGAI');
    overlay.innerHTML = '<header><span>IKIGAI EDUCATION · KHU TRẢI NGHIỆM</span><button type="button">✕ Về bản đồ</button></header><iframe title="Shop và Túi đồ IKIGAI"></iframe>';
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
    frame.src = assetURL('demo.html') + '?view=' + view;
    document.body.append(overlay);
    document.addEventListener('keydown', escape);
    window.addEventListener('message', onMessage);
    overlay.querySelector('button').focus();
  }
  for (const [view, label, icon] of [['character', 'Túi đồ và nhân vật', 'bag'], ['shop', 'Shop', 'shop']]) {
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
