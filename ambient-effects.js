/* IKIGAI WORLD 9.3 — Independent ambient effects layer
   Canvas is decorative only: pointer-events are disabled and game logic is untouched. */
(() => {
  "use strict";

  const canvas = document.getElementById("ambientCanvas");
  const mapScene = document.getElementById("mapScene");
  if (!canvas || !mapScene || !canvas.getContext) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  let width = 0, height = 0, dpr = 1, raf = 0, lastFrame = 0;
  let active = false;
  const petals = [];
  const waterDrops = [];
  const ripples = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticles();
  }

  function seedParticles() {
    petals.length = 0;
    waterDrops.length = 0;
    ripples.length = 0;
    const mobile = width < 720;
    const petalCount = mobile ? 18 : 34;
    for (let i = 0; i < petalCount; i++) {
      petals.push({
        x: rand(-0.05, 1.05) * width,
        y: rand(-0.1, 1.1) * height,
        size: rand(3.2, mobile ? 6 : 8),
        speed: rand(13, 31),
        drift: rand(7, 23),
        phase: rand(0, Math.PI * 2),
        spin: rand(-1.2, 1.2),
        angle: rand(0, Math.PI * 2),
        alpha: rand(0.52, 0.88)
      });
    }
    // Small bright water particles at the three waterfall locations.
    const falls = [
      { x: 0.055, y: 0.405, w: 0.045, h: 0.13 },
      { x: 0.955, y: 0.245, w: 0.04, h: 0.11 },
      { x: 0.955, y: 0.475, w: 0.04, h: 0.11 }
    ];
    falls.forEach((f, fi) => {
      const count = mobile ? 7 : 13;
      for (let i = 0; i < count; i++) {
        waterDrops.push({
          zone: fi,
          x: (f.x + rand(-f.w / 2, f.w / 2)) * width,
          y: (f.y + rand(0, f.h)) * height,
          speed: rand(45, 105),
          len: rand(4, 13),
          alpha: rand(0.25, 0.68),
          sway: rand(1, 5)
        });
      }
    });
  }

  function drawPetal(p, t) {
    const sway = Math.sin(t * 0.0012 + p.phase) * p.drift;
    ctx.save();
    ctx.translate(p.x + sway, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.alpha;
    const s = p.size;
    const grad = ctx.createLinearGradient(-s, -s, s, s);
    grad.addColorStop(0, "#fff1f7");
    grad.addColorStop(0.48, "#ff9fca");
    grad.addColorStop(1, "#e94e98");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, s * 1.15);
    ctx.bezierCurveTo(-s * 1.5, s * 0.25, -s * 1.05, -s * 1.2, 0, -s * 0.9);
    ctx.bezierCurveTo(s * 1.05, -s * 1.2, s * 1.5, s * 0.25, 0, s * 1.15);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.8);
    ctx.quadraticCurveTo(s * 0.12, 0, 0, -s * 0.65);
    ctx.stroke();
    ctx.restore();
  }

  function drawWaterfallGlow(t) {
    // Narrow translucent highlights follow the existing waterfall artwork.
    const zones = [
      { x: 0.055, y: 0.405, w: 0.036, h: 0.13 },
      { x: 0.955, y: 0.245, w: 0.032, h: 0.11 },
      { x: 0.955, y: 0.475, w: 0.032, h: 0.11 }
    ];
    zones.forEach((z, i) => {
      const x = z.x * width, y = z.y * height;
      const w = z.w * width, h = z.h * height;
      const shimmer = 0.10 + (Math.sin(t * 0.002 + i) + 1) * 0.055;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "rgba(210,250,255,0)");
      g.addColorStop(0.45, `rgba(205,246,255,${shimmer})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, y, w, h);
    });
  }

  function drawWaterParticles(dt) {
    ctx.save();
    ctx.lineCap = "round";
    waterDrops.forEach(p => {
      p.y += p.speed * dt;
      p.x += Math.sin(p.y * 0.035 + p.zone) * p.sway * dt * 5;
      const zoneY = [0.405, 0.245, 0.475][p.zone] * height;
      const zoneH = [0.13, 0.11, 0.11][p.zone] * height;
      if (p.y > zoneY + zoneH) {
        p.y = zoneY + rand(-4, 5);
        p.x = ([0.055, 0.955, 0.955][p.zone] + rand(-0.014, 0.014)) * width;
      }
      ctx.globalAlpha = p.alpha;
      ctx.strokeStyle = "#d9fbff";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 1.2, p.y + p.len);
      ctx.stroke();
    });
    ctx.restore();
  }

  function addRipple(x, y, maxR, phase, alpha) {
    const r = 2 + ((phase % 1) * maxR);
    ctx.save();
    ctx.globalAlpha = alpha * (1 - phase);
    ctx.strokeStyle = "#c7f7ff";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.65, r * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFountain(t) {
    // Fine spray and circular ripples centered on the map's existing fountain.
    const cx = width * 0.5, cy = height * 0.445;
    ctx.save();
    for (let i = 0; i < 13; i++) {
      const phase = (t * 0.00042 + i / 13) % 1;
      const spread = 5 + phase * width * 0.014;
      const rise = Math.sin(phase * Math.PI) * height * 0.055;
      const x = cx + Math.sin(i * 2.4 + t * 0.0008) * spread;
      const y = cy - rise + phase * height * 0.014;
      ctx.globalAlpha = (1 - phase) * 0.58;
      ctx.fillStyle = "#e8fdff";
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + (1 - phase) * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    const ringPhase = (t * 0.00018) % 1;
    addRipple(cx, cy + height * 0.065, width * 0.085, ringPhase, 0.48);
    addRipple(cx, cy + height * 0.065, width * 0.085, (ringPhase + 0.5) % 1, 0.3);
    ctx.restore();
  }

  function drawLakeShimmers(t) {
    // Sparse glints on the surrounding water, not across paths or buildings.
    const spots = [
      [0.12, 0.87], [0.18, 0.94], [0.84, 0.88], [0.91, 0.94],
      [0.025, 0.73], [0.975, 0.72]
    ];
    spots.forEach((s, i) => {
      const pulse = 0.25 + (Math.sin(t * 0.0017 + i * 1.7) + 1) * 0.22;
      const x = s[0] * width, y = s[1] * height;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#c8f7ff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.quadraticCurveTo(x, y - 1.8, x + 6, y);
      ctx.stroke();
      ctx.restore();
    });
  }

  function frame(t) {
    raf = 0;
    if (!active) return;
    if (t - lastFrame < 30) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    ctx.clearRect(0, 0, width, height);

    drawWaterfallGlow(t);
    drawWaterParticles(dt);
    drawFountain(t);
    drawLakeShimmers(t);

    petals.forEach(p => {
      p.y += p.speed * dt;
      p.x += Math.sin(t * 0.001 + p.phase) * p.drift * dt;
      p.angle += p.spin * dt;
      if (p.y > height + 20) {
        p.y = -rand(8, 50);
        p.x = rand(-10, width + 10);
      }
      if (p.x < -30) p.x = width + 20;
      if (p.x > width + 30) p.x = -20;
      drawPetal(p, t);
    });
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (active || mapScene.hidden || document.hidden) return;
    active = true;
    lastFrame = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ctx.clearRect(0, 0, width, height);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (active) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
  });
  observer.observe(canvas);

  const sceneObserver = new MutationObserver(() => {
    if (mapScene.hidden) stop();
    else start();
  });
  sceneObserver.observe(mapScene, { attributes: true, attributeFilter: ["hidden"] });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener("pagehide", stop, { passive: true });

  resize();
  start();
})();
