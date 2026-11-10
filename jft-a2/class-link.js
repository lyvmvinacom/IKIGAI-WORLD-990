(() => {
  'use strict';

  const prefix = '#jft=';
  const sessionKey = 'ikigai-world-jft-link-v1';
  const fromLink = location.hash.startsWith(prefix);
  let token = fromLink ? location.hash.slice(prefix.length) : '';
  if (fromLink) {
    history.replaceState(history.state, '', location.pathname + location.search);
  } else {
    try { token = sessionStorage.getItem(sessionKey) ?? ''; } catch {}
  }

  const active = fromLink || token.length > 0;
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
  let key;

  function clear() {
    token = '';
    key = undefined;
    try { sessionStorage.removeItem(sessionKey); } catch {}
  }

  async function decrypt(name, signal) {
    if (!crypto.subtle) throw new Error('Cần mở IKIGAI WORLD bằng HTTPS.');
    if (!validToken || !token) throw new DOMException('Link lớp không hợp lệ.', 'OperationError');
    if (name !== 'catalog' && !/^sore-vol1-(?:0[1-9]|10)$/.test(name)) throw new Error('Mã đề không hợp lệ.');
    if (!key) {
      const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0));
      key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
    }
    const response = await fetch(new URL('jft-a2/locked-v1/' + name + '.bin', document.baseURI), {signal});
    if (!response.ok) throw new Error('Chưa tải được dữ liệu luyện thi.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 28) throw new Error('Tệp luyện thi không đầy đủ.');
    const additionalData = new TextEncoder().encode('ikigai-world-jft:v1:' + name);
    const data = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.subarray(0,12), additionalData}, key, bytes.subarray(12));
    return new TextDecoder('utf-8', {fatal:true}).decode(data);
  }

  window.IKIGAI_JFT_CLASS_LINK = Object.freeze({
    active,
    clear,
    async verify(signal) {
      if (!active) return 'missing';
      try {
        if (await decrypt('catalog', signal) !== 'IKIGAI WORLD JFT A2 / 01-10') return 'invalid';
        try { sessionStorage.setItem(sessionKey, token); } catch {}
        return 'ready';
      } catch (error) {
        if (error.name === 'OperationError') {
          clear();
          return 'invalid';
        }
        return 'unavailable';
      }
    },
    async load(id, signal) {
      return JSON.parse(await decrypt(id, signal));
    }
  });
})();
