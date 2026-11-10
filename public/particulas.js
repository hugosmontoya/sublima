/* particulas.js · SUBLIMA — sistema de partículas CO₂
 *
 * Partículas de gas que emergen del punto de toque, suben y se disipan.
 * Con pinch (dos dedos juntos), el campo de partículas se comprime
 * hacia el centro entre los dos dedos, simulando gas atrapado.
 */
(function(g) {
  'use strict';

  const CYAN   = '#64FFDA';
  const WHITE  = '#c8f0ff';
  const VIO    = '#7B2CBF';
  const BG     = '#03070D';

  class SistemaParticulas {
    constructor(canvas) {
      this.cv  = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.maxP = 300;
    }

    /** Emitir nuevas partículas desde el punto de toque */
    emit(x, y, pressure, velocity, nFingers) {
      // Cantidad de partículas emitidas: más con más velocidad y presión
      const count = Math.floor(2 + velocity * 6 + pressure * 5);
      const basePressure = Math.max(0.1, pressure);

      for (let i = 0; i < count; i++) {
        if (this.particles.length >= this.maxP) break;

        // Ángulo de emisión: principalmente hacia arriba con dispersión
        const angle  = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
        const speed  = 0.3 + Math.random() * 1.2 + velocity * 0.8;
        const size   = 1.5 + Math.random() * 3 + basePressure * 4;

        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.008 + Math.random() * 0.012,
          size,
          sizeMult: 0.95 + Math.random() * 0.08,  // crece ligeramente al subir
          type: Math.random() < 0.7 ? 'gas' : 'mist',
          hue: Math.random() < 0.5 ? 'cyan' : 'white',
          opacity: 0.4 + Math.random() * 0.5,
          wobble: (Math.random() - 0.5) * 0.04,
        });
      }
    }

    /** Paso de simulación */
    step(dt, pinch) {
      // pinch: { active, cx, cy, strength } — comprime partículas hacia el centro
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= p.decay * dt * 0.06;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }

        // Movimiento normal: arriba + wobble
        p.x  += p.vx * dt * 0.05;
        p.y  += p.vy * dt * 0.05;
        p.vx += p.wobble;
        p.vy += (Math.random() - 0.5) * 0.01;  // turbulencia leve
        p.size *= p.sizeMult;

        // Con pinch: fuerza de atracción hacia el centro de los dos dedos
        if (pinch && pinch.active && pinch.strength > 0.05) {
          const dx = pinch.cx - p.x;
          const dy = pinch.cy - p.y;
          const dist = Math.hypot(dx, dy) + 0.001;
          const force = pinch.strength * 0.4 / dist;
          p.vx += dx * force * dt * 0.1;
          p.vy += dy * force * dt * 0.1;
          // Con mucho apresamiento las partículas se vuelven violetas
          p._pinch = (p._pinch || 0) * 0.9 + pinch.strength * 0.1;
        } else {
          p._pinch = (p._pinch || 0) * 0.9;
        }
      }
    }

    /** Render de partículas */
    draw(W, H) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, W, H);

      for (const p of this.particles) {
        const alpha = p.life * p.opacity;
        const sz    = Math.max(0.5, p.size);

        if (p.type === 'gas') {
          // Partícula criogénica: círculo con gradiente
          const pinchT = p._pinch || 0;
          let r, g_, b;
          if (pinchT > 0.1) {
            // Con apresamiento → violeta
            r = Math.round(123 * pinchT + 100 * (1 - pinchT));
            g_ = Math.round(44  * pinchT + 255 * (1 - pinchT));
            b = Math.round(191 * pinchT + 218 * (1 - pinchT));
          } else if (p.hue === 'cyan') {
            r = 100; g_ = 255; b = 218;
          } else {
            r = 200; g_ = 240; b = 255;
          }

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz);
          grad.addColorStop(0, `rgba(${r},${g_},${b},${alpha})`);
          grad.addColorStop(1, `rgba(${r},${g_},${b},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Niebla: rectángulo borroso
          ctx.fillStyle = `rgba(100,220,255,${alpha * 0.3})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, sz * 2, sz, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /** Explosión expansiva de vapor al despresurizar pinch */
    burst(x, y, intensity = 1.0) {
      const count = Math.floor(25 * intensity);
      for (let i = 0; i < count; i++) {
        if (this.particles.length >= this.maxP) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5 * intensity;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.9 + Math.random() * 0.4,
          decay: 0.015 + Math.random() * 0.015,
          size: 3 + Math.random() * 6,
          sizeMult: 1.03,
          type: 'gas',
          hue: Math.random() < 0.6 ? 'white' : 'cyan',
          opacity: 0.7,
          wobble: (Math.random() - 0.5) * 0.08,
          _pinch: 0.9
        });
      }
    }

    get count() { return this.particles.length; }
  }

  g.SistemaParticulas = SistemaParticulas;
})(window);
