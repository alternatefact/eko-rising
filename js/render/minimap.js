// The small overview map: explored land, your buildings, other peoples,
// soldiers, and the camera's view.

import { GROUND, PLAYER, ENEMY } from './palette.js';
import { isHostileOwner } from '../sim/military.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.base = null;
    this.baseVersion = -1;
  }

  attach(st) {
    this.st = st;
    this.base = document.createElement('canvas');
    this.base.width = st.W;
    this.base.height = st.H;
    this.baseVersion = -1;
    this.canvas.width = st.W * 2;
    this.canvas.height = st.H * 2;
  }

  draw(renderer) {
    const st = this.st;
    const ctx = this.ctx;
    if (this.baseVersion !== st.fogVersion) {
      this.baseVersion = st.fogVersion;
      const g = this.base.getContext('2d');
      const img = g.createImageData(st.W, st.H);
      const d = img.data;
      for (let i = 0; i < st.W * st.H; i++) {
        if (!st.explored[i]) {
          d[i * 4 + 3] = 255;
          d[i * 4] = 18;
          d[i * 4 + 1] = 22;
          d[i * 4 + 2] = 28;
          continue;
        }
        const hex = GROUND[st.terrain[i]][0];
        d[i * 4] = parseInt(hex.slice(1, 3), 16);
        d[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
        d[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
        d[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.drawImage(this.base, 0, 0);

    for (const b of st.buildings) {
      if (b.dead) continue;
      ctx.fillStyle = b.owner === 'player' ? '#ffe9a8' : '#999';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    for (const f of st.factions) {
      if (!st.explored[f.y * st.W + f.x]) continue;
      ctx.fillStyle = f.status === 'conquered' || f.status === 'vassal' ? PLAYER : f.color;
      ctx.fillRect(f.x - 1.5, f.y - 1.5, 4, 4);
      ctx.strokeStyle = f.status === 'hostile' ? ENEMY : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(f.x - 1.5, f.y - 1.5, 4, 4);
    }
    for (const u of st.units) {
      if (u.dead) continue;
      const i = Math.floor(u.y) * st.W + Math.floor(u.x);
      if (u.owner !== 'player' && !st.visible[i]) continue;
      ctx.fillStyle = u.owner === 'player' ? '#7dffb0' : isHostileOwner(st, 'player', u.owner) ? '#ff5a4a' : '#ddd';
      ctx.fillRect(u.x - 0.75, u.y - 0.75, 1.5, 1.5);
    }
    for (const s of st.ships) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
    }

    const tl = renderer.screenToTile(0, 0);
    const br = renderer.screenToTile(renderer.w, renderer.h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  // Minimap pixel → tile.
  toTile(px, py) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((px - r.left) / r.width) * this.st.W, y: ((py - r.top) / r.height) * this.st.H };
  }
}
