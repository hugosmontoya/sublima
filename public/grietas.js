/* grietas.js · SUBLIMA — grietas vectoriales heladas
 *
 * Grietas que se propagan en el lienzo cuando la presión supera un umbral.
 * Cada grieta es un árbol de segmentos con ángulo aleatorio basado en presión.
 * Se congelan (quedan pintadas, se desvanecen lentamente) al soltar.
 */
(function(g) {
  'use strict';

  class SistemaGrietas {
    constructor(canvas) {
      this.cv     = canvas;
      this.ctx    = canvas.getContext('2d');
      this.cracks = [];          // grietas activas
      this.frozen = [];          // grietas congeladas (fade out)
      this._lastPressure = 0;
      this._cooldown     = 0;    // ms hasta que se puede generar otra grieta
    }

    /**
     * Actualizar estado cada frame
     * @param {number} pressure   0–1
     * @param {number} touchX     posición X en píxeles en el canvas
     * @param {number} touchY     posición Y en píxeles en el canvas
     * @param {number} dt         delta time ms
     * @param {boolean} touching  si hay toque activo
     */
    update(pressure, touchX, touchY, dt, touching) {
      this._cooldown = Math.max(0, this._cooldown - dt);

      // Generar nueva grieta si hay presión suficiente y cooldown pasó
      if (touching && pressure > 0.12 && this._cooldown <= 0 && this.cracks.length < 12) {
        const intensity = pressure;
        this._spawnCrack(touchX, touchY, intensity);
        this._cooldown = 120 + (1 - pressure) * 300;  // más presión → grietas más seguidas
      }

      // Si se suelta, congelar grietas activas
      if (!touching && this.cracks.length > 0) {
        for (const c of this.cracks) {
          this.frozen.push({ ...c, fadeLife: 1.0 });
        }
        this.cracks = [];
      }

      // Propagar grietas activas
      for (const c of this.cracks) {
        this._growCrack(c, dt);
      }
      // Remover grietas completas → congelar
      const done = this.cracks.filter(c => c.done);
      for (const c of done) this.frozen.push({ ...c, fadeLife: 1.0 });
      this.cracks = this.cracks.filter(c => !c.done);

      // Desvanecer grietas congeladas
      for (const f of this.frozen) f.fadeLife -= 0.0015 * dt;
      this.frozen = this.frozen.filter(f => f.fadeLife > 0);

      this._lastPressure = pressure;
    }

    _spawnCrack(ox, oy, intensity) {
      const branches = Math.floor(2 + intensity * 4);  // 2–6 ramas
      const crack = {
        ox, oy,
        intensity,
        branches: [],
        done: false,
      };
      for (let b = 0; b < branches; b++) {
        const angle = (Math.random() * Math.PI * 2);
        crack.branches.push(this._newBranch(ox, oy, angle, intensity, 4));
      }
      this.cracks.push(crack);
    }

    _newBranch(x, y, angle, intensity, depth) {
      return {
        segments: [{ x, y }],  // lista de puntos
        angle,
        speed: 2 + intensity * 5,
        maxLen: 40 + intensity * 120 + Math.random() * 60,
        len: 0,
        depth,
        done: false,
        children: [],
        nextFork: 20 + Math.random() * 40,  // píxeles hasta bifurcación
      };
    }

    _growBranch(b, dt) {
      if (b.done) { for (const c of b.children) this._growBranch(c, dt); return; }
      const step  = b.speed * dt * 0.06;
      b.len      += step;
      // variación de ángulo (hace la grieta irregular)
      b.angle    += (Math.random() - 0.5) * 0.25;
      const last  = b.segments[b.segments.length - 1];
      const nx    = last.x + Math.cos(b.angle) * step;
      const ny    = last.y + Math.sin(b.angle) * step;
      b.segments.push({ x: nx, y: ny });

      // Bifurcación
      if (b.len >= b.nextFork && b.depth > 1) {
        const forkAngle = b.angle + (Math.random() < 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5);
        b.children.push(this._newBranch(nx, ny, forkAngle, b.intensity * 0.7, b.depth - 1));
        b.nextFork = b.len + 25 + Math.random() * 50;
      }

      if (b.len >= b.maxLen) b.done = true;
      for (const c of b.children) this._growBranch(c, dt);
    }

    _growCrack(crack, dt) {
      let allDone = true;
      for (const b of crack.branches) {
        this._growBranch(b, dt);
        if (!b.done) allDone = false;
      }
      if (allDone) crack.done = true;
    }

    /** Dibuja todas las grietas */
    draw(W, H, pressure) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, W, H);

      // Grietas activas
      for (const c of this.cracks) {
        const alpha = 0.5 + pressure * 0.5;
        this._drawCrack(ctx, c, alpha);
      }
      // Grietas congeladas (desvaneciendo)
      for (const f of this.frozen) {
        this._drawCrack(ctx, f, f.fadeLife * 0.6);
      }
    }

    _drawBranch(ctx, b, alpha) {
      if (b.segments.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(b.segments[0].x, b.segments[0].y);
      for (let i = 1; i < b.segments.length; i++) {
        ctx.lineTo(b.segments[i].x, b.segments[i].y);
      }
      ctx.stroke();
      for (const c of b.children) this._drawBranch(ctx, c, alpha * 0.75);
    }

    _drawCrack(ctx, crack, alpha) {
      // Resplandor exterior (halo violeta/cian)
      ctx.save();
      ctx.shadowBlur  = 8;
      ctx.shadowColor = `rgba(123,44,191,${alpha * 0.8})`;
      ctx.strokeStyle = `rgba(200,240,255,${alpha})`;
      ctx.lineWidth   = 1;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      for (const b of crack.branches) this._drawBranch(ctx, b, alpha);
      ctx.restore();

      // Núcleo más brillante y delgado
      ctx.save();
      ctx.shadowBlur  = 3;
      ctx.shadowColor = `rgba(100,255,218,${alpha})`;
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
      ctx.lineWidth   = 0.5;
      for (const b of crack.branches) this._drawBranch(ctx, b, alpha);
      ctx.restore();
    }

    clear() { this.cracks = []; this.frozen = []; }
  }

  g.SistemaGrietas = SistemaGrietas;
})(window);
