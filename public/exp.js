/* exp.js · SUBLIMA — lógica principal de la experiencia criogénica
 *
 * Orquesta:
 *   · Tacto.js (MQTT, canales del teléfono)
 *   · Bloque de hielo seco interactivo (cv-ice + hielo_seco.png)
 *   · SistemaParticulas  (vapor CO₂ + burst)
 *   · SistemaGrietas     (fracturas heladas sobre la masa del hielo)
 *   · SublimaAudio       (8 capas sonoras procedurales de hielo seco)
 *
 * Loop: MQTT → estado → audio → render imagen de hielo y efectos → requestAnimationFrame
 */
(function() {
  'use strict';

  /* ═══════════════════════════════════════════
     Canvases y contextos
  ═══════════════════════════════════════════ */
  const stage     = document.getElementById('stage');
  const cvBg      = document.getElementById('cv-bg');
  const cvIce     = document.getElementById('cv-ice');
  const cvParts   = document.getElementById('cv-parts');
  const cvCrack   = document.getElementById('cv-crack');
  const cvTouch   = document.getElementById('cv-touch');

  const ctxBg     = cvBg.getContext('2d');
  const ctxIce    = cvIce.getContext('2d');
  const ctxTouch  = cvTouch.getContext('2d');

  const particles = new SistemaParticulas(cvParts);
  const grietas   = new SistemaGrietas(cvCrack);
  const audio     = new SublimaAudio();

  let W = 0, H = 0;

  function resize() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    for (const cv of [cvBg, cvIce, cvParts, cvCrack, cvTouch]) {
      cv.width = W; cv.height = H;
    }
  }
  window.addEventListener('resize', resize);
  resize();

  /* ═══════════════════════════════════════════
     Imagen y física del Bloque de Hielo Seco
  ═══════════════════════════════════════════ */
  const iceImg = new Image();
  let iceLoaded = false;
  iceImg.onload = () => { iceLoaded = true; };
  iceImg.src = 'hielo_seco.png';

  let iceShake = 0;
  let tapPulse = 0;
  let burstPulse = 0;
  let lastDist = null;
  let lastDown = false;
  const sublimationCraters = []; // marcas de sublimación térmica

  /* ═══════════════════════════════════════════
     Estado del toque (desde MQTT)
  ═══════════════════════════════════════════ */
  const state = {
    down:      false,
    x:         0.5,     // 0–1
    y:         0.5,     // 0–1
    pressure:  0,       // 0–1
    diameter:  0,       // px
    nFingers:  0,
    dist:      0,       // 0–1.5 distancia entre dos dedos
    // velocidad calculada
    _px: 0.5, _py: 0.5,
    vx: 0, vy: 0,
    // posición en píxeles
    px: 0, py: 0,
    // pinch
    pinch: { active: false, cx: 0, cy: 0, strength: 0 },
    fingers: [],
  };

  let lastMoveTime = performance.now();

  function updateStateFromTacto(dev) {
    if (!dev) return;
    const ch = dev.ch;
    const down = (ch['touch.down'] || 0) > 0;
    state.nFingers = ch['touch.n']   || 0;
    state.down     = down;
    state.pressure = ch['touch.f']   || 0;
    state.diameter = ch['touch.d']   || 0;
    state.dist     = ch['touch.dist'] ?? 0;

    const now = performance.now();
    const dt  = Math.max(1, now - lastMoveTime);

    if (down) {
      const nx = ch['touch.x'] ?? 0.5;
      const ny = ch['touch.y'] ?? 0.5;
      state.vx = Math.abs(nx - state._px) / (dt * 0.001);
      state.vy = Math.abs(ny - state._py) / (dt * 0.001);
      state._px = nx; state._py = ny;
      state.x = nx; state.y = ny;
    } else {
      state.vx *= 0.85;
      state.vy *= 0.85;
    }
    lastMoveTime = now;

    state.px = state.x * W;
    state.py = state.y * H;

    // Detectar Tap / Impacto inicial
    if (down && !lastDown) {
      iceShake = 10 + state.pressure * 8;
      tapPulse = 1.0;
      sublimationCraters.push({
        x: state.px, y: state.py,
        radius: 20 + state.pressure * 35,
        life: 1.0,
      });
      if (sublimationCraters.length > 25) sublimationCraters.shift();
    }
    lastDown = down;

    // Detectar apertura rápida de pinch (explosión de gas)
    if (lastDist !== null && state.nFingers >= 2) {
      const deltaDist = state.dist - lastDist;
      if (deltaDist > 0.06 && lastDist < 0.45) {
        burstPulse = 1.0;
        particles.burst(state.px, state.py, Math.min(1.4, deltaDist * 5));
      }
    }
    lastDist = state.nFingers >= 2 ? state.dist : null;

    // Pinch: centro entre los dos primeros dedos
    const t1x = ch['t1.x'], t1y = ch['t1.y'];
    const t2x = ch['t2.x'], t2y = ch['t2.y'];
    if (state.nFingers >= 2 && t1x != null && t2x != null) {
      state.pinch.active   = true;
      state.pinch.cx       = ((t1x + t2x) / 2) * W;
      state.pinch.cy       = ((t1y + t2y) / 2) * H;
      state.pinch.strength = Math.max(0, 1 - state.dist / 0.5);
    } else {
      state.pinch.active   = false;
      state.pinch.strength = 0;
    }
  }

  /* ═══════════════════════════════════════════
     MQTT — Tacto.js
  ═══════════════════════════════════════════ */
  const tacto = new Tacto();
  const $  = s => document.querySelector(s);

  const salaCode = $('#sala-code');
  salaCode.textContent = tacto.sala;

  async function loadQR() {
    const phoneUrl = buildPhoneUrl();
    $('#qr-sala-lbl').textContent = `sala ${tacto.sala}`;
    $('#qr-url').textContent = phoneUrl;

    try {
      const infoRes = await fetch(new URL('info', document.baseURI), { cache: 'no-store' });
      const info    = await infoRes.json();
      const base    = info.baseUrl || location.origin;
      const url     = `${base}/?sala=${tacto.sala}`;
      const qrUrl   = `/qr.svg?u=${encodeURIComponent(url)}`;
      $('#qr-img').src          = qrUrl;
      $('#qr-url').textContent = url;
    } catch {
      $('#qr-img').style.display = 'none';
      $('#qr-box').style.padding = '14px 16px';
    }
  }

  function buildPhoneUrl() {
    const cfg  = window.TACTO_CONFIG || {};
    const base = cfg.phoneUrl || location.href.replace(/\/exp\.html.*$/, '/').replace(/\/exp$/, '/');
    return `${base}?sala=${tacto.sala}`;
  }
  loadQR();

  tacto.on('estado', s => {
    const el = $('#conn-state');
    el.textContent = s.toUpperCase();
    el.className   = s === 'conectado' ? 'on' : s === 'reconectando' ? 'warn' : '';
  });

  tacto.on('dispositivo', dev => {
    if (!dev) return;
    $('#device-label').textContent = dev.online ? `● ${dev.name.toUpperCase()}` : 'SIN TELÉFONO CONECTADO';
  });

  tacto.on('rtt', dev => {
    if (!dev.rtt.length) return;
    const sorted = [...dev.rtt].sort((a, b) => a - b);
    const med    = sorted[Math.floor(sorted.length / 2)];
    $('#rtt-val').textContent = Math.round(med);
  });

  tacto.connect();

  /* ═══════════════════════════════════════════
     Audio — botón Activar
  ═══════════════════════════════════════════ */
  let audioOn = false;
  $('#btn-audio').onclick = async () => {
    await audio.init();
    audioOn = !audioOn;
    audio.setActive(audioOn);
    const btn = $('#btn-audio');
    btn.textContent = audioOn ? '■ AUDIO ON' : '▶ ACTIVAR AUDIO';
    btn.classList.toggle('active', audioOn);
  };

  /* ═══════════════════════════════════════════
     Panel izquierdo — monitor de canales
  ═══════════════════════════════════════════ */
  const CH_MONITOR = [
    { id: 'touch.down',  label: 'tocando',   max: 1    },
    { id: 'touch.n',     label: 'dedos',     max: 5    },
    { id: 'touch.x',     label: 'pos X',     max: 1    },
    { id: 'touch.y',     label: 'pos Y',     max: 1    },
    { id: 'touch.f',     label: 'presión',   max: 1    },
    { id: 'touch.d',     label: 'diámetro',  max: 120  },
    { id: 'touch.dist',  label: 'dist 2d',   max: 1.5  },
    { id: 'touch.ang',   label: 'ángulo',    max: 360  },
  ];

  const chList = $('#ch-list');
  for (const ch of CH_MONITOR) {
    chList.insertAdjacentHTML('beforeend', `
      <div class="ch-row">
        <span class="ch-name">${ch.label}</span>
        <span class="ch-val" id="chv-${ch.id.replace('.', '-')}">—</span>
      </div>
      <div class="ch-bar"><div class="ch-fill" id="chb-${ch.id.replace('.', '-')}"></div></div>
    `);
  }

  function updateChannelPanel(dev) {
    if (!dev) return;
    for (const ch of CH_MONITOR) {
      const val = dev.ch[ch.id];
      const rid = ch.id.replace('.', '-');
      const vEl = document.getElementById(`chv-${rid}`);
      const bEl = document.getElementById(`chb-${rid}`);
      if (!vEl) continue;
      if (val == null) { vEl.textContent = '—'; bEl.style.width = '0%'; continue; }
      vEl.textContent = val.toFixed ? val.toFixed(2) : val;
      bEl.style.width  = Math.min(100, Math.max(0, (val / ch.max) * 100)) + '%';
    }
  }

  /* ═══════════════════════════════════════════
     Panel derecho — 8 conexiones en tiempo real
  ═══════════════════════════════════════════ */
  function updateConnPanel() {
    const s = state;
    const velocity = Math.hypot(s.vx, s.vy);

    // 1. touch.x/y → siseo vapor
    document.getElementById('cm-hiss').style.width   = (s.down ? 35 + s.pressure * 65 : 0) + '%';
    // 2. touch.f → chirrido FM
    document.getElementById('cm-fm').style.width     = (Math.max(0, s.pressure - 0.05) / 0.95 * 100) + '%';
    // 3. touch.dist → retumbo subgrave
    const pinchPct = s.nFingers >= 2 ? Math.max(0, 1 - s.dist / 0.45) * 100 : 0;
    document.getElementById('cm-rumble').style.width = pinchPct + '%';
    // 4. touch.velo → leidenfrost
    const slidePct = Math.min(100, Math.max(0, (velocity - 0.25) / 2.0 * 100));
    document.getElementById('cm-slide').style.width  = (s.down ? slidePct : 0) + '%';
    // 5. tap inicial → microfractura
    document.getElementById('cm-tap').style.width    = (tapPulse * 100) + '%';
    // 6. apertura pinch → ráfaga gas
    document.getElementById('cm-burst').style.width  = (burstPulse * 100) + '%';
    // 7. touch.n >= 3 → crepitar escarcha
    document.getElementById('cm-crackle').style.width = (s.down && s.nFingers >= 3 ? Math.min(100, (s.nFingers / 5) * 100) : 0) + '%';
    // 8. touch.f → quemadura & grietas
    document.getElementById('cm-halo').style.width   = (s.pressure * 100) + '%';
  }

  /* ═══════════════════════════════════════════
     FONDO AMBIENTAL CRIOGÉNICO
  ═══════════════════════════════════════════ */
  function drawBackground() {
    ctxBg.clearRect(0, 0, W, H);

    const bg = ctxBg.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    bg.addColorStop(0,   '#05111c');
    bg.addColorStop(0.6, '#030a13');
    bg.addColorStop(1,   '#020408');
    ctxBg.fillStyle = bg;
    ctxBg.fillRect(0, 0, W, H);

    // Scanlines sutiles industriales
    ctxBg.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < H; y += 4) {
      ctxBg.fillRect(0, y, W, 1);
    }
  }

  /* ═══════════════════════════════════════════
     DIBUJO Y EFECTOS DEL BLOQUE DE HIELO SECO
  ═══════════════════════════════════════════ */
  function drawIceBlock(dt) {
    ctxIce.clearRect(0, 0, W, H);

    // Dimensiones y centrado del bloque
    const targetW = Math.min(W * 0.78, 860);
    const targetH = targetW * 0.62;
    const bx = (W - targetW) / 2 + (Math.random() - 0.5) * iceShake;
    const by = (H - targetH) / 2 + (Math.random() - 0.5) * iceShake;

    ctxIce.save();

    // 1. Dibujar el bloque de hielo (imagen o render procedural de respaldo)
    if (iceLoaded && iceImg.naturalWidth > 0) {
      // Sombra criogénica y resplandor exterior frío
      ctxIce.shadowColor = 'rgba(100,255,218,0.2)';
      ctxIce.shadowBlur  = 30;
      ctxIce.drawImage(iceImg, bx, by, targetW, targetH);
      ctxIce.shadowBlur  = 0;
    } else {
      // Bloque procedural de alta fidelidad si la imagen aún carga
      const gIce = ctxIce.createLinearGradient(bx, by, bx + targetW, by + targetH);
      gIce.addColorStop(0,   '#c8f0ff');
      gIce.addColorStop(0.4, '#80d8ff');
      gIce.addColorStop(0.7, '#2a6a8a');
      gIce.addColorStop(1,   '#0a2236');
      ctxIce.fillStyle = gIce;
      ctxIce.fillRect(bx, by, targetW, targetH);
      ctxIce.strokeStyle = '#64FFDA';
      ctxIce.lineWidth = 2;
      ctxIce.strokeRect(bx, by, targetW, targetH);
    }

    // 2. Efecto de sublimación / cráteres térmicos donde los dedos tocan
    if (state.down) {
      const p = state.pressure;
      const craterRadius = 24 + p * 45 + (state.diameter * 0.4);

      // Resplandor de sublimación que "come" y escarcha la superficie
      const gSub = ctxIce.createRadialGradient(state.px, state.py, 0, state.px, state.py, craterRadius);
      gSub.addColorStop(0,   `rgba(255,255,255,${0.35 + p * 0.4})`);
      gSub.addColorStop(0.5, `rgba(100,255,218,${0.25 + p * 0.3})`);
      gSub.addColorStop(0.85,`rgba(123,44,191,${0.18 + p * 0.2})`);
      gSub.addColorStop(1,   'rgba(0,0,0,0)');

      ctxIce.fillStyle = gSub;
      ctxIce.beginPath();
      ctxIce.arc(state.px, state.py, craterRadius, 0, Math.PI * 2);
      ctxIce.fill();
    }

    // 3. Cráteres térmicos residuales que se desvanecen lentamente
    for (let i = sublimationCraters.length - 1; i >= 0; i--) {
      const c = sublimationCraters[i];
      c.life -= dt * 0.0008;
      if (c.life <= 0) {
        sublimationCraters.splice(i, 1);
        continue;
      }
      ctxIce.save();
      ctxIce.strokeStyle = `rgba(100,255,218,${c.life * 0.35})`;
      ctxIce.lineWidth   = 1;
      ctxIce.beginPath();
      ctxIce.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctxIce.stroke();
      ctxIce.restore();
    }

    // 4. Estela brillante de deslizamiento Leidenfrost (fricción cero)
    const velocity = Math.hypot(state.vx, state.vy);
    if (state.down && velocity > 0.4) {
      const speedNorm = Math.min(1.0, velocity / 2.0);
      ctxIce.save();
      ctxIce.shadowColor = '#64FFDA';
      ctxIce.shadowBlur  = 16 * speedNorm;
      ctxIce.strokeStyle = `rgba(200,255,250,${0.5 * speedNorm})`;
      ctxIce.lineWidth   = 8 * speedNorm;
      ctxIce.lineCap     = 'round';
      ctxIce.beginPath();
      ctxIce.moveTo(state._px * W, state._py * H);
      ctxIce.lineTo(state.px, state.py);
      ctxIce.stroke();
      ctxIce.restore();
    }

    // 5. Tensión y condensación en el centro de un pinch (gas encapsulado)
    if (state.pinch.active && state.pinch.strength > 0.05) {
      const str = state.pinch.strength;
      const gPinch = ctxIce.createRadialGradient(state.pinch.cx, state.pinch.cy, 0, state.pinch.cx, state.pinch.cy, 90 * str);
      gPinch.addColorStop(0,   `rgba(123,44,191,${0.45 * str})`);
      gPinch.addColorStop(0.6, `rgba(40,15,70,${0.25 * str})`);
      gPinch.addColorStop(1,   'rgba(0,0,0,0)');
      ctxIce.fillStyle = gPinch;
      ctxIce.beginPath();
      ctxIce.arc(state.pinch.cx, state.pinch.cy, 90 * str, 0, Math.PI * 2);
      ctxIce.fill();
    }

    // Amortiguación del temblor de impacto
    iceShake *= 0.88;
    if (iceShake < 0.2) iceShake = 0;

    // Decaimiento de pulsos
    tapPulse   = Math.max(0, tapPulse - dt * 0.004);
    burstPulse = Math.max(0, burstPulse - dt * 0.0035);

    ctxIce.restore();
  }

  /* ═══════════════════════════════════════════
     HALO DE QUEMADURA HELADA
  ═══════════════════════════════════════════ */
  let haloRadius  = 0;
  let haloTargetR = 0;

  function drawHalo() {
    ctxTouch.clearRect(0, 0, W, H);
    if (!state.down) {
      haloRadius *= 0.82;
      if (haloRadius < 1) haloRadius = 0;
      return;
    }

    haloTargetR = 32 + state.pressure * 95 + (state.diameter * 0.5);
    haloRadius += (haloTargetR - haloRadius) * 0.15;

    const cx = state.px, cy = state.py;
    const r  = haloRadius;
    const p  = state.pressure;

    // Capa 1: Halo exterior difuso (violeta criogénico)
    const g3 = ctxTouch.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.6);
    g3.addColorStop(0,   `rgba(123,44,191,${0.18 + p * 0.22})`);
    g3.addColorStop(0.5, `rgba(60,20,100,${0.09 + p * 0.12})`);
    g3.addColorStop(1,   'rgba(0,0,0,0)');
    ctxTouch.fillStyle = g3;
    ctxTouch.beginPath();
    ctxTouch.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
    ctxTouch.fill();

    // Capa 2: Corona intermedia (cian vapor)
    const g2 = ctxTouch.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.35);
    g2.addColorStop(0,   `rgba(100,255,218,${0.15 + p * 0.28})`);
    g2.addColorStop(0.6, `rgba(50,180,140,${0.09 + p * 0.14})`);
    g2.addColorStop(1,   'rgba(0,0,0,0)');
    ctxTouch.fillStyle = g2;
    ctxTouch.beginPath();
    ctxTouch.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctxTouch.fill();

    // Capa 3: Núcleo incandescente (blanco frío puro)
    const g1 = ctxTouch.createRadialGradient(cx, cy, 0, cx, cy, r * 0.65);
    g1.addColorStop(0,   `rgba(235,255,255,${0.7 + p * 0.3})`);
    g1.addColorStop(0.4, `rgba(180,245,255,${0.35 + p * 0.35})`);
    g1.addColorStop(1,   'rgba(100,200,255,0)');
    ctxTouch.fillStyle = g1;
    ctxTouch.beginPath();
    ctxTouch.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
    ctxTouch.fill();

    // Borde incandescente cian
    ctxTouch.save();
    ctxTouch.shadowBlur  = 14;
    ctxTouch.shadowColor = `rgba(100,255,218,${0.6 + p * 0.4})`;
    ctxTouch.strokeStyle = `rgba(100,255,218,${0.45 + p * 0.55})`;
    ctxTouch.lineWidth   = 1.5;
    ctxTouch.beginPath();
    ctxTouch.arc(cx, cy, r, 0, Math.PI * 2);
    ctxTouch.stroke();
    ctxTouch.restore();

    // Si hay pinch: línea conectora de tensión entre dedos
    if (state.pinch.active && state.pinch.strength > 0.05) {
      const pcx = state.pinch.cx, pcy = state.pinch.cy;
      const str = state.pinch.strength;
      const gP  = ctxTouch.createRadialGradient(pcx, pcy, 0, pcx, pcy, 65 * str);
      gP.addColorStop(0, `rgba(123,44,191,${str * 0.55})`);
      gP.addColorStop(1, 'rgba(123,44,191,0)');
      ctxTouch.fillStyle = gP;
      ctxTouch.beginPath();
      ctxTouch.arc(pcx, pcy, 65 * str, 0, Math.PI * 2);
      ctxTouch.fill();
    }
  }

  /* ═══════════════════════════════════════════
     LOOP PRINCIPAL
  ═══════════════════════════════════════════ */
  let lastTime    = performance.now();
  let lastEmitPos = { x: -1, y: -1 };

  function loop(now) {
    const dt = Math.min(80, now - lastTime);
    lastTime = now;

    // 1. Leer teléfono y actualizar estado
    const dev = tacto.pick();
    updateStateFromTacto(dev);
    updateChannelPanel(dev);
    updateConnPanel();

    const velocity = Math.hypot(state.vx, state.vy);

    // 2. Audio procedural criogénico (8 capas)
    if (audioOn) {
      audio.update({
        down:      state.down,
        x:         state.x,
        y:         state.y,
        pressure:  state.pressure,
        dist:      state.dist,
        nFingers:  state.nFingers,
        velocity:  velocity,
        ang:       tacto.get('touch.ang')
      });
    }

    // 3. Render fondo ambiental
    drawBackground();

    // 4. Render del bloque de hielo seco con imagen y respuesta
    drawIceBlock(dt);

    // 5. Emisión y paso de partículas de vapor CO₂
    if (state.down) {
      const minEmitDist = 3;
      const movedEnough = Math.hypot(state.px - lastEmitPos.x, state.py - lastEmitPos.y) > minEmitDist;
      if (movedEnough || velocity < 0.1) {
        particles.emit(state.px, state.py, state.pressure, velocity, state.nFingers);
        lastEmitPos = { x: state.px, y: state.py };
      }
    }
    particles.step(dt, state.pinch);
    particles.draw(W, H);

    // 6. Grietas vectoriales sobre el cuerpo del hielo
    grietas.update(state.pressure, state.px, state.py, dt, state.down);
    grietas.draw(W, H, state.pressure);

    // 7. Halo criogénico de quemadura
    drawHalo();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(t => {
    lastTime = t;
    requestAnimationFrame(loop);
  });

  /* ═══════════════════════════════════════════
     Botones de preset criogénico
  ═══════════════════════════════════════════ */
  document.querySelectorAll('.mat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mat = btn.dataset.mat;
      if (mat === 'vapor') {
        particles.maxP = 350;
        grietas.clear();
      } else if (mat === 'hielo') {
        particles.maxP = 100;
      } else if (mat === 'fractura') {
        particles.maxP = 180;
        grietas.update(0.8, W * 0.5, H * 0.5, 30, true);
      }
    });
  });

  // Ratón como teléfono virtual
  let mouseDown = false;
  stage.addEventListener('mousedown', e => {
    mouseDown = true;
    const r = stage.getBoundingClientRect();
    state.x = (e.clientX - r.left) / r.width;
    state.y = (e.clientY - r.top) / r.height;
    state.px = state.x * W; state.py = state.y * H;
    state.down = true;
    state.pressure = 0.45;
    state.nFingers = 1;
    iceShake = 8;
    tapPulse = 1.0;
  });

  stage.addEventListener('mousemove', e => {
    if (!mouseDown) return;
    const r = stage.getBoundingClientRect();
    state._px = state.x; state._py = state.y;
    state.x   = (e.clientX - r.left) / r.width;
    state.y   = (e.clientY - r.top) / r.height;
    state.px  = state.x * W; state.py = state.y * H;
    state.down = true;
    state.pressure = 0.5;
    state.nFingers = 1;
    state.vx = Math.abs(state.x - state._px) * 60;
    state.vy = Math.abs(state.y - state._py) * 60;
  });

  stage.addEventListener('mouseup', () => {
    mouseDown = false; state.down = false; state.pressure = 0; state.nFingers = 0;
  });
  stage.addEventListener('mouseleave', () => {
    if (mouseDown) { mouseDown = false; state.down = false; state.pressure = 0; state.nFingers = 0; }
  });

})();
