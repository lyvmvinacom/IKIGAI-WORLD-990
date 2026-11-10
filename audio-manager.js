/* IKIGAI WORLD 9.6.1 — original Japanese-inspired ambient music + UI sounds */
(() => {
  const tracks = {
    login: 'assets/audio/login-japan-ambient.wav',
    map: 'assets/audio/map-sakura-garden.wav',
    class: 'assets/audio/classroom-focus.wav',
    arena: 'assets/audio/arena-challenge.wav',
    n5: 'assets/audio/n5-study.wav',
    n4: 'assets/audio/n4-study.wav',
    jft: 'assets/audio/jft-study.wav',
    gym: 'assets/audio/gym-energy.wav',
    tea: 'assets/audio/tea-ceremony.wav'
  };
  const labels = {
    login:'Chào đón', map:'Vườn Sakura', class:'Lớp học',
    arena:'Đấu trường', n5:'Luyện thi N5', n4:'Luyện thi N4',
    jft:'Luyện thi JFT', gym:'Phòng Gym', tea:'Phòng Trà'
  };
  const audio = {};
  Object.entries(tracks).forEach(([key,src]) => {
    const a = new Audio(src);
    a.loop = true; a.preload = 'none'; a.volume = 0;
    audio[key] = a;
  });
  let enabled = localStorage.getItem('ikigaiMusicEnabled') !== 'false';
  let current = 'login', unlocked = false, suspended = false, fadeTimer = null, ctx = null;
  const btn = document.getElementById('musicToggle');
  const label = btn?.querySelector('.music-toggle-label');
  function paint() {
    if (!btn) return;
    btn.classList.toggle('is-muted',!enabled);
    btn.setAttribute('aria-pressed',String(enabled));
    btn.setAttribute('aria-label',enabled?'Tắt nhạc nền':'Bật nhạc nền');
    if(label) label.textContent = enabled ? 'NHẠC: BẬT' : 'NHẠC: TẮT';
  }
  function fadeTo(key) {
    if (!audio[key]) key='map';
    current=key;
    if(!enabled || !unlocked || suspended) return;
    clearInterval(fadeTimer);
    Object.entries(audio).forEach(([name,a])=>{
      if(name===key) { a.play().catch(()=>{}); }
    });
    const start=Date.now(), duration=900;
    fadeTimer=setInterval(()=>{
      const p=Math.min(1,(Date.now()-start)/duration);
      Object.entries(audio).forEach(([name,a])=>{
        const target=(name===key)?0.22:0;
        a.volume=Math.max(0,Math.min(1,target*p+(name===key?0: a.volume*(1-p))));
        if(name!==key && p===1) a.pause();
      });
      if(p>=1) clearInterval(fadeTimer);
    },50);
  }
  function unlock() {
    if(unlocked) return;
    unlocked=true;
    if(enabled && !suspended) {
      const a=audio[current]; a.volume=0;
      a.play().then(()=>fadeTo(current)).catch(()=>{});
    }
  }
  function toggle() {
    enabled=!enabled;
    localStorage.setItem('ikigaiMusicEnabled',String(enabled));
    paint();
    if(enabled) { unlock(); fadeTo(current); }
    else {
      clearInterval(fadeTimer);
      Object.values(audio).forEach(a=>{a.pause();a.currentTime=0;a.volume=0;});
    }
  }
  btn?.addEventListener('click',e=>{e.stopPropagation();toggle();});
  document.addEventListener('pointerdown',unlock,{once:true,capture:true});
  document.addEventListener('keydown',unlock,{once:true,capture:true});
  function sfx(kind='tap') {
    if(!unlocked) return;
    try {
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      ctx=ctx||new AC();
      if(ctx.state==='suspended')ctx.resume();
      const now=ctx.currentTime;
      const notes=kind==='success'?[659.25,783.99,987.77]:kind==='enter'?[523.25,659.25,783.99]:[880];
      notes.forEach((freq,i)=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(freq,now+i*.075);
        gain.gain.setValueAtTime(.0001,now+i*.075);
        gain.gain.exponentialRampToValueAtTime(kind==='tap'?.025:.045,now+i*.075+.015);
        gain.gain.exponentialRampToValueAtTime(.0001,now+i*.075+.38);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(now+i*.075);osc.stop(now+i*.075+.4);
      });
    } catch(e) {}
  }
  // Gentle UI feedback; ignore the dedicated music control.
  document.addEventListener('click',e=>{
    const target=e.target.closest('button,.hotspot,.station,[role="button"]');
    if(!target || target.id==='musicToggle')return;
    sfx(target.matches('.gold')||/enterPlace|ĐĂNG NHẬP|TẠO TÀI KHOẢN/i.test(target.textContent||'')?'enter':'tap');
  },true);
  window.IKIGAI_AUDIO={
    play:place=>{const key=tracks[place]?place:(place==='map'?'map':'map');fadeTo(key);},
    success:()=>sfx('success'),
    suspend:()=>{suspended=true;clearInterval(fadeTimer);Object.values(audio).forEach(a=>a.pause());},
    resume:()=>{if(suspended){suspended=false;fadeTo(current);}},
    setEnabled:value=>{enabled=!!value;localStorage.setItem('ikigaiMusicEnabled',String(enabled));paint();if(enabled){unlock();fadeTo(current)}else Object.values(audio).forEach(a=>a.pause());}
  };
  paint();
  // Start in the login ambience after the first real user interaction.
  current='login';
})();
