/* audio.js · SUBLIMA — Síntesis sonora procedural criogénica con Web Audio API
 *
 * 8 capas sonoras interactivas especializadas en la física del hielo seco:
 *   1. SISEO DE SUBLIMACIÓN BASAL (ruido blanco + bandpass dinámico) -> Contacto (touch.down) y posición (touch.x, y)
 *   2. CHIRRIDO FM ESTRIDENTE (síntesis FM inestable + armónicos disonantes) -> Presión / Diámetro (touch.f, touch.d)
 *   3. RETUMBO SUBGRAVE (gas atrapado a alta presión interna) -> Apresamiento / Pinch (touch.dist < 0.35)
 *   4. DESLIZAMIENTO LEIDENFROST (silbido aéreo metálico de fricción cero) -> Velocidad de arrastre (touch.vx, vy)
 *   5. IMPACTO CRISTALINO PERCUSIVO (microfractura por golpe) -> Ataque rápido / Tap inicial
 *   6. RÁFAGA EXPLOSIVA DE GAS (descompresión súbita al abrir) -> Liberación de pinch (delta touch.dist)
 *   7. CREPITAR DE ESCARCHA (burbujeo y fracturas microtérmicas) -> Multitáctil (touch.n >= 3)
 *   8. VÓRTICE CRIOGÉNICO (resonancia espacial y barrido de fase) -> Ángulo de rotación (touch.ang)
 */
(function(g) {
  'use strict';

  class SublimaAudio {
    constructor() {
      this.ctx     = null;
      this.ready   = false;
      this._nodes  = {};
      this._lastDist = null;
      this._lastDown = false;
      this._crackleTimer = null;
    }

    async init() {
      if (this.ready) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      await this.ctx.resume();
      this._build();
      this.ready = true;
    }

    _build() {
      const ctx = this.ctx;

      // ── Compresor y limitador master criogénico ──
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -16;
      master.knee.value      = 8;
      master.ratio.value     = 6;
      master.attack.value    = 0.002;
      master.release.value   = 0.2;
      master.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.0;
      masterGain.connect(master);

      /* ════ 1. SISEO DE SUBLIMACIÓN BASAL (Vapor CO₂) ════ */
      const bufLen = ctx.sampleRate * 2;
      const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer  = buf;
      noiseNode.loop    = true;

      const hissBpf = ctx.createBiquadFilter();
      hissBpf.type            = 'bandpass';
      hissBpf.frequency.value = 2600;
      hissBpf.Q.value         = 1.1;

      const hissHpf = ctx.createBiquadFilter();
      hissHpf.type            = 'highpass';
      hissHpf.frequency.value = 1100;
      hissHpf.Q.value         = 0.7;

      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.0;

      noiseNode.connect(hissBpf);
      hissBpf.connect(hissHpf);
      hissHpf.connect(hissGain);
      hissGain.connect(masterGain);
      noiseNode.start();

      /* ════ 2. CHIRRIDO FM ESTRIDENTE (Presión / Aprisionamiento) ════ */
      const carrier = ctx.createOscillator();
      carrier.type            = 'sawtooth';
      carrier.frequency.value = 1900;

      const modulator = ctx.createOscillator();
      modulator.type            = 'sine';
      modulator.frequency.value = 240;

      const modGain = ctx.createGain();
      modGain.gain.value = 0;

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      const fmGain = ctx.createGain();
      fmGain.gain.value = 0.0;

      const fmHpf = ctx.createBiquadFilter();
      fmHpf.type            = 'highpass';
      fmHpf.frequency.value = 950;

      // Resonador de pico para que suene a metal/cristal forzado
      const fmReso = ctx.createBiquadFilter();
      fmReso.type            = 'peaking';
      fmReso.frequency.value = 2900;
      fmReso.Q.value         = 4.0;
      fmReso.gain.value      = 7.0;

      carrier.connect(fmGain);
      fmGain.connect(fmHpf);
      fmHpf.connect(fmReso);
      fmReso.connect(masterGain);
      carrier.start();
      modulator.start();

      /* ════ 3. RETUMBO SUBGRAVE (Gas atrapado en pinch) ════ */
      const rumbleOsc = ctx.createOscillator();
      rumbleOsc.type            = 'sawtooth';
      rumbleOsc.frequency.value = 52;

      const wshaper = ctx.createWaveShaper();
      wshaper.curve      = makeDistortionCurve(70);
      wshaper.oversample = '2x';

      const rumbleLpf = ctx.createBiquadFilter();
      rumbleLpf.type            = 'lowpass';
      rumbleLpf.frequency.value = 240;
      rumbleLpf.Q.value         = 2.8;

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.0;

      rumbleOsc.connect(wshaper);
      wshaper.connect(rumbleLpf);
      rumbleLpf.connect(rumbleGain);
      rumbleGain.connect(masterGain);
      rumbleOsc.start();

      /* ════ 4. DESLIZAMIENTO LEIDENFROST (Fricción Cero / Silbido) ════ */
      const slideOsc = ctx.createOscillator();
      slideOsc.type            = 'sine';
      slideOsc.frequency.value = 3200;

      const slideTremolo = ctx.createOscillator();
      slideTremolo.type            = 'sine';
      slideTremolo.frequency.value = 18; // trémolo rápido de levitación

      const slideTremGain = ctx.createGain();
      slideTremGain.gain.value = 400;
      slideTremolo.connect(slideTremGain);
      slideTremGain.connect(slideOsc.frequency);

      const slideGain = ctx.createGain();
      slideGain.gain.value = 0.0;

      slideOsc.connect(slideGain);
      slideGain.connect(masterGain);
      slideOsc.start();
      slideTremolo.start();

      /* ════ 7. VÓRTICE CRIOGÉNICO (Filtro Allpass / Phaser) ════ */
      const phaserNode = ctx.createBiquadFilter();
      phaserNode.type            = 'allpass';
      phaserNode.frequency.value = 1500;
      phaserNode.Q.value         = 3.0;

      // Almacenar referencias
      this._nodes = {
        masterGain,
        hissGain, hissBpf, hissHpf,
        carrier, modulator, modGain, fmGain,
        rumbleOsc, rumbleGain, rumbleLpf,
        slideOsc, slideGain,
        phaserNode
      };
    }

    /** Activar o silenciar el master */
    setActive(on) {
      if (!this.ready) return;
      const g = this._nodes.masterGain;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(on ? 0.9 : 0.0, t, 0.2);
    }

    /** Disparar transitorio de impacto (microfractura / golpe de hielo) */
    triggerImpact(pressure = 0.5) {
      if (!this.ready) return;
      const ctx = this.ctx;
      const t   = ctx.currentTime;

      // Generador de click impulsivo + oscilador con caída ultra-rápida
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400 + pressure * 1800, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35 + pressure * 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(3200, t);
      bpf.Q.value = 4.0;

      osc.connect(bpf);
      bpf.connect(g);
      g.connect(this._nodes.masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    }

    /** Disparar ráfaga explosiva de despresurización de gas */
    triggerGasBurst(intensity = 0.7) {
      if (!this.ready) return;
      const ctx = this.ctx;
      const t   = ctx.currentTime;

      const dur = 0.28;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(1400, t);
      bpf.frequency.exponentialRampToValueAtTime(4500, t + dur);
      bpf.Q.value = 1.2;

      const g = ctx.createGain();
      g.gain.setValueAtTime(intensity * 0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      src.connect(bpf);
      bpf.connect(g);
      g.connect(this._nodes.masterGain);

      src.start(t);
    }

    /** Generar un micro-click de crepitar de escarcha */
    _triggerMicroCrackle() {
      if (!this.ready) return;
      const ctx = this.ctx;
      const t   = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = Math.random() < 0.5 ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(3500 + Math.random() * 4000, t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08 + Math.random() * 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

      osc.connect(g);
      g.connect(this._nodes.masterGain);

      osc.start(t);
      osc.stop(t + 0.03);
    }

    /**
     * Actualizar estado de audio continuo en cada frame
     * @param {object} s - { down, x, y, pressure, dist, nFingers, velocity, ang }
     */
    update(s) {
      if (!this.ready) return;
      const { down, x, y, pressure, dist, nFingers, velocity, ang } = s;
      const t = this.ctx.currentTime;
      const N = this._nodes;

      // ── Evento de Tap / Impacto al iniciar toque ──
      if (down && !this._lastDown) {
        this.triggerImpact(pressure || 0.4);
      }
      this._lastDown = down;

      // ── Evento de ráfaga de gas al abrir rápidamente un pinch ──
      if (this._lastDist !== null && nFingers >= 2) {
        const deltaDist = dist - this._lastDist;
        if (deltaDist > 0.08 && this._lastDist < 0.4) {
          this.triggerGasBurst(Math.min(1.0, deltaDist * 4));
        }
      }
      this._lastDist = nFingers >= 2 ? dist : null;

      // ── 1. Siseo basal de sublimación ──
      const hissTarget = down ? 0.16 + pressure * 0.14 : 0.0;
      N.hissGain.gain.setTargetAtTime(hissTarget, t, 0.06);
      if (down) {
        // La posición espacial X e Y afinan la resonancia del vapor
        const freqTarget = 1800 + x * 2200 + (1 - y) * 800;
        N.hissBpf.frequency.setTargetAtTime(freqTarget, t, 0.08);
      }

      // ── 2. Chirrido FM estridente por presión ──
      const fmActive = down && pressure > 0.06;
      const fmTarget = fmActive ? Math.min(0.38, (pressure - 0.05) * 0.45) : 0.0;
      N.fmGain.gain.setTargetAtTime(fmTarget, t, 0.03);
      if (fmActive) {
        const fCarrier = 950 + Math.pow(pressure, 1.2) * 2800;
        N.carrier.frequency.setTargetAtTime(fCarrier, t, 0.04);

        const modIndex = pressure * 850 + Math.random() * 60;
        N.modGain.gain.setTargetAtTime(modIndex, t, 0.02);

        const fMod = 190 + pressure * 180 + Math.sin(t * 12) * 35;
        N.modulator.frequency.setTargetAtTime(fMod, t, 0.05);
      }

      // ── 3. Retumbo subgrave por apresamiento (pinch) ──
      const pinchStrength = nFingers >= 2 ? Math.max(0, 1 - dist / 0.45) : 0;
      const rumbleTarget  = pinchStrength * 0.4;
      N.rumbleGain.gain.setTargetAtTime(rumbleTarget, t, 0.08);
      if (pinchStrength > 0) {
        const fRumble = 42 + pinchStrength * 75;
        N.rumbleOsc.frequency.setTargetAtTime(fRumble, t, 0.1);
        N.rumbleLpf.frequency.setTargetAtTime(180 + pinchStrength * 220, t, 0.1);
      }

      // ── 4. Deslizamiento Leidenfrost por velocidad ──
      const veloClamped = Math.min(1.0, Math.max(0, (velocity - 0.25) / 2.5));
      const slideTarget = (down && veloClamped > 0.05) ? veloClamped * 0.24 : 0.0;
      N.slideGain.gain.setTargetAtTime(slideTarget, t, 0.05);
      if (slideTarget > 0) {
        const fSlide = 2800 + veloClamped * 1600 + Math.sin(t * 20) * 120;
        N.slideOsc.frequency.setTargetAtTime(fSlide, t, 0.04);
      }

      // ── 7. Crepitar estocástico de escarcha (3+ dedos) ──
      if (down && nFingers >= 3) {
        if (Math.random() < 0.25 * nFingers) {
          this._triggerMicroCrackle();
        }
      }

      // ── 8. Barrido de fase angular (rotación) ──
      if (ang != null && down) {
        const angNorm = (ang + 180) / 360; // 0..1
        N.phaserNode.frequency.setTargetAtTime(800 + angNorm * 2600, t, 0.1);
      }
    }
  }

  function makeDistortionCurve(amount) {
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  g.SublimaAudio = SublimaAudio;
})(window);
