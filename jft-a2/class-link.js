(() => {
  'use strict';

  const prefix = '#jft=';
  const legacyKey = 'ikigai-world-jft-link-v1';
  const shortcutKey = 'ikigai-world-jft-shortcut-v2';
  const fromLink = location.hash.startsWith(prefix);
  let legacyToken = '';
  let shortcut = false;
  try {
    legacyToken = sessionStorage.getItem(legacyKey) ?? '';
    shortcut = sessionStorage.getItem(shortcutKey) === '1';
  } catch {}
  let pendingToken = fromLink ? location.hash.slice(prefix.length) : legacyToken || null;
  const active = fromLink || shortcut || !!legacyToken;
  let key;
  const examProofs = new Map();

  if (fromLink) history.replaceState(history.state, '', location.pathname + location.search);
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith(prefix)) location.reload();
  });

  function savedKey(mode, run) {
    return new Promise((resolve, reject) => {
      const opening = indexedDB.open('ikigai-world-jft-access', 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore('keys');
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('keys', mode);
        const request = run(tx.objectStore('keys'));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }

  function clear() {
    key = undefined;
    pendingToken = null;
    examProofs.clear();
    try {
      sessionStorage.removeItem(legacyKey);
      sessionStorage.removeItem(shortcutKey);
    } catch {}
  }

  async function decrypt(name, candidate, signal) {
    const response = await fetch(new URL('jft-a2/locked-v1/' + name + '.bin', document.baseURI), {signal});
    if (!response.ok) throw new Error('Chưa tải được dữ liệu luyện thi.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 28) throw new Error('Tệp luyện thi không đầy đủ.');
    const additionalData = new TextEncoder().encode('ikigai-world-jft:v1:' + name);
    const data = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.subarray(0,12), additionalData}, candidate, bytes.subarray(12));
    return new TextDecoder('utf-8', {fatal:true}).decode(data);
  }

  async function confirmKey(candidate, signal) {
    try {
      if (await decrypt('catalog', candidate, signal) !== 'IKIGAI WORLD JFT A2 / 01-10') return 'invalid';
      key = candidate;
      return 'ready';
    } catch (error) {
      return error.name === 'OperationError' ? 'invalid' : 'unavailable';
    }
  }

  async function unlock(value, signal) {
    let token = value.trim();
    if (token.includes(prefix)) token = token.slice(token.lastIndexOf(prefix) + prefix.length);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return 'invalid';
    if (!crypto.subtle) return 'unavailable';
    try {
      const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0));
      const candidate = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
      const status = await confirmKey(candidate, signal);
      if (status !== 'ready') return status;
      try { await savedKey('readwrite', (store) => store.put(candidate, 'class')); } catch {}
      try {
        sessionStorage.removeItem(legacyKey);
        if (active) sessionStorage.setItem(shortcutKey, '1');
      } catch {}
      return 'ready';
    } catch { return 'unavailable'; }
  }

  window.IKIGAI_JFT_CLASS_LINK = Object.freeze({
    active,
    clear,
    async verify(signal) {
      if (window.IKIGAI_JFT_ACCOUNT?.canLoad) return 'ready';
      if (pendingToken !== null) {
        const status = await unlock(pendingToken, signal);
        if (status !== 'unavailable') pendingToken = null;
        return status;
      }
      if (key) return 'ready';
      const saved = await savedKey('readonly', (store) => store.get('class')).catch(() => null);
      return saved ? confirmKey(saved, signal) : 'missing';
    },
    async load(id, signal) {
      if (!/^sore-vol1-(?:0[1-9]|10)$/.test(id)) throw new Error('Mã đề không hợp lệ.');
      const account = window.IKIGAI_JFT_ACCOUNT;
      if (!account?.canLoad && !key) throw new Error('Đăng nhập IKIGAI WORLD để làm bài.');
      const payload = account?.canLoad ? await account.loadExam(id, signal) : await decrypt(id, key, signal);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ikigai-world-jft:score-proof:v2:' + payload));
      examProofs.set(id, Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''));
      return JSON.parse(payload);
    },
    scoreProof(id) {
      const proof = examProofs.get(id);
      if (!proof) throw new Error('Hãy mở lại đề để xác thực kết quả.');
      return proof;
    }
  });
})();
