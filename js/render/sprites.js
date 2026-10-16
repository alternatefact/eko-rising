// Hand-drawn sprites. Every function draws in "base pixels": one tile is 32
// units wide, and the caller has already translated and scaled the context.

import { THATCH, THATCH_DARK, MUD, MUD_DARK, EARTH, ZINC, PLAYER, CARRY, SKIN, FOREIGN_COAT } from './palette.js';
import { hash2 } from '../core/rng.js';

const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function rect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function rrect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function shadow(ctx, x, y, rx, ry) {
  ellipse(ctx, x, y, rx, ry, 'rgba(20,14,6,0.28)');
}

function line(ctx, x0, y0, x1, y1, color, width) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

// --- Roofs ---------------------------------------------------------------

export function roundRoof(ctx, cx, cy, r, color = THATCH, dark = THATCH_DARK) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#e2c17a');
  g.addColorStop(0.6, color);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,20,0.35)';
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2);
    ctx.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, TAU);
  ctx.stroke();
  circle(ctx, cx, cy, r * 0.13, dark);
}

function gableRoof(ctx, x, y, w, h, era) {
  const zinc = era >= 3;
  const base = zinc ? ZINC : THATCH;
  const dark = zinc ? '#8d969b' : THATCH_DARK;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, zinc ? '#d6dce0' : '#ddbb72');
  g.addColorStop(0.5, base);
  g.addColorStop(0.5, dark);
  g.addColorStop(1, zinc ? '#9aa3a8' : '#b38e4c');
  rrect(ctx, x, y, w, h, 3, g);
  ctx.strokeStyle = zinc ? 'rgba(80,90,95,0.45)' : 'rgba(90,60,20,0.35)';
  ctx.lineWidth = 0.8;
  const step = zinc ? 3 : 4;
  for (let k = x + step; k < x + w - 1; k += step) {
    ctx.beginPath();
    ctx.moveTo(k, y + 1);
    ctx.lineTo(k, y + h - 1);
    ctx.stroke();
  }
  if (zinc) {
    // A rust patch or two: no Lagos roof is spotless.
    ellipse(ctx, x + w * 0.7, y + h * 0.3, w * 0.12, h * 0.15, 'rgba(160,82,45,0.35)');
  }
  line(ctx, x + 2, y + h / 2, x + w - 2, y + h / 2, zinc ? '#7d868b' : '#8f6c32', 1.2);
}

// --- Buildings -------------------------------------------------------------

function hut(ctx, cx, cy, r, opts = {}) {
  shadow(ctx, cx + 3, cy + r * 0.55, r * 1.05, r * 0.55);
  circle(ctx, cx, cy + r * 0.28, r * 0.88, opts.wall || MUD);
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.28 + r * 0.5, r * 0.22, Math.PI, 0);
  ctx.fillStyle = '#2b1a10';
  ctx.fill();
  roundRoof(ctx, cx, cy - r * 0.1, r, opts.roof, opts.roofDark);
}

function earthPatch(ctx, x, y, w, h) {
  ellipse(ctx, x + w / 2, y + h / 2, w / 2, h / 2, 'rgba(176,128,82,0.45)');
}

const DRAW = {
  compound(ctx, b, t, st) {
    earthPatch(ctx, -6, -4, 108, 106);
    shadow(ctx, 52, 90, 48, 10);
    // Outer laterite walls with thatch over the rooms around the courtyard.
    rrect(ctx, 6, 10, 84, 80, 6, MUD_DARK);
    rect(ctx, 30, 34, 36, 34, '#c49a6c');
    circle(ctx, 48, 51, 5, '#5b8fa3');
    gableRoof(ctx, 4, 4, 88, 24, st.era);
    gableRoof(ctx, 4, 66, 88, 24, st.era);
    ctx.save();
    ctx.translate(4, 28);
    gableRoof(ctx, 0, 0, 24, 38, st.era);
    ctx.restore();
    gableRoof(ctx, 68, 28, 24, 38, st.era);
    rect(ctx, 42, 80, 12, 10, '#2b1a10');
    // Family shrine pot and a mortar for pounding yam.
    circle(ctx, 36, 60, 3, '#7a3e22');
    circle(ctx, 60, 42, 3.5, '#6d4c2f');
    flag(ctx, 84, 4, PLAYER, t);
  },

  campfire(ctx, b, t) {
    earthPatch(ctx, -4, -2, 72, 68);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      circle(ctx, 32 + Math.cos(a) * 10, 34 + Math.sin(a) * 8, 2.6, '#8c8c8c');
    }
    line(ctx, 24, 38, 40, 30, '#5a3a20', 3);
    line(ctx, 24, 30, 40, 38, '#5a3a20', 3);
    const f = Math.sin(t * 9) * 1.5;
    ctx.beginPath();
    ctx.moveTo(25, 36);
    ctx.quadraticCurveTo(32, 18 + f, 39, 36);
    ctx.fillStyle = '#f39c12';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(28, 36);
    ctx.quadraticCurveTo(32, 25 - f, 36, 36);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    // Sleeping mats.
    rrect(ctx, 6, 48, 16, 8, 2, '#c9a35b');
    rrect(ctx, 44, 50, 16, 8, 2, '#b5884a');
  },

  hut(ctx, b, t, st) {
    earthPatch(ctx, 2, 6, 60, 56);
    hut(ctx, 32, 30, 22, st.era >= 3 && b.id % 3 === 0 ? { roof: ZINC, roofDark: '#8d969b' } : {});
    circle(ctx, 54, 52, 3.5, '#6b3d22');
  },

  house(ctx, b, t, st) {
    earthPatch(ctx, -2, 2, 68, 62);
    shadow(ctx, 34, 58, 30, 6);
    rrect(ctx, 4, 12, 56, 46, 3, MUD);
    rect(ctx, 22, 28, 20, 16, '#c49a6c');
    gableRoof(ctx, 2, 6, 60, 18, st.era);
    gableRoof(ctx, 2, 40, 60, 18, st.era);
    rect(ctx, 28, 50, 8, 8, '#2b1a10');
    rect(ctx, 10, 50, 6, 5, '#e8dcc0');
    rect(ctx, 48, 50, 6, 5, '#e8dcc0');
  },

  farm(ctx, b, t) {
    rrect(ctx, 3, 3, 90, 90, 6, '#8a5a34');
    ctx.strokeStyle = 'rgba(60,35,15,0.4)';
    ctx.lineWidth = 1;
    for (let y = 14; y < 90; y += 20) {
      ctx.beginPath();
      ctx.moveTo(6, y + 6);
      ctx.lineTo(90, y + 6);
      ctx.stroke();
    }
    const g = b.growth || 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 15 + col * 22;
        const y = 15 + row * 21;
        ellipse(ctx, x, y + 3, 8, 5, '#6e4426');
        ellipse(ctx, x - 1, y + 2, 6, 3.5, '#7f4f2c');
        if (g > 0.08) {
          // Yam vines climbing their stakes.
          const h = 4 + g * 14;
          line(ctx, x, y + 2, x + 1, y + 2 - h, '#7a5a35', 1.2);
          const leaves = 1 + Math.floor(g * 4);
          for (let k = 0; k < leaves; k++) {
            const ly = y + 1 - (h * (k + 1)) / (leaves + 0.5);
            ellipse(ctx, x + (k % 2 ? 3 : -2), ly, 3.2, 2, g > 0.95 ? '#5c8f2a' : '#4f9a36');
          }
        }
      }
    }
    // Stick fence.
    ctx.strokeStyle = '#6b4b2a';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 4]);
    rrect(ctx, 2, 2, 92, 92, 6, null, '#6b4b2a');
    ctx.setLineDash([]);
    if (g >= 1) {
      ctx.font = '14px sans-serif';
      ctx.fillText('🍠', 70, 92);
    }
  },

  woodcutter(ctx, b, t, st) {
    earthPatch(ctx, 0, 4, 64, 58);
    shadow(ctx, 24, 40, 18, 6);
    rrect(ctx, 6, 14, 34, 24, 2, MUD);
    gableRoof(ctx, 4, 6, 38, 18, st.era);
    // Log pile.
    for (let k = 0; k < 5; k++) {
      const x = 44 + (k % 3) * 6;
      const y = 44 - Math.floor(k / 3) * 6;
      circle(ctx, x, y, 3.4, '#8b5a2b');
      circle(ctx, x, y, 2, '#c49a6c');
    }
    circle(ctx, 18, 52, 5, '#7a5230');
    circle(ctx, 18, 52, 3.4, '#b98b5a');
    line(ctx, 20, 50, 26, 44, '#5a3a20', 1.5);
    rect(ctx, 25, 42, 4, 3, '#7f8c8d');
  },

  hunter(ctx, b, t, st) {
    earthPatch(ctx, 0, 4, 64, 58);
    hut(ctx, 22, 26, 16, {});
    // Drying rack with a hide.
    line(ctx, 40, 36, 40, 58, '#5a3a20', 2);
    line(ctx, 58, 36, 58, 58, '#5a3a20', 2);
    line(ctx, 38, 38, 60, 38, '#5a3a20', 2);
    rrect(ctx, 42, 39, 14, 14, 3, '#c8a06a');
    circle(ctx, 49, 46, 2, '#8b5a2b');
    ctx.beginPath();
    ctx.arc(10, 50, 8, -1.2, 1.2);
    ctx.strokeStyle = '#6b4b2a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  fisher(ctx, b, t) {
    rect(ctx, 4, 10, 56, 44, '#9b7348');
    ctx.strokeStyle = 'rgba(60,35,15,0.5)';
    ctx.lineWidth = 1;
    for (let x = 10; x < 60; x += 6) line(ctx, x, 10, x, 54, 'rgba(60,35,15,0.4)', 1);
    // Dugout canoe and a drying net.
    ctx.beginPath();
    ctx.ellipse(32, 60, 26, 5, 0, 0, TAU);
    ctx.fillStyle = '#6b4226';
    ctx.fill();
    ellipse(ctx, 32, 59, 22, 3, '#3d2514');
    ctx.strokeStyle = 'rgba(230,230,220,0.7)';
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 6; k++) {
      line(ctx, 10 + k * 4, 16, 14 + k * 4, 36, 'rgba(230,230,220,0.6)', 0.8);
      line(ctx, 10, 18 + k * 3.5, 34, 18 + k * 3.5, 'rgba(230,230,220,0.6)', 0.8);
    }
    for (let k = 0; k < 4; k++) ellipse(ctx, 44 + (k % 2) * 7, 22 + Math.floor(k / 2) * 9, 4, 1.8, '#c9d3da');
  },

  storehouse(ctx, b, t, st) {
    earthPatch(ctx, -2, 4, 68, 60);
    shadow(ctx, 32, 56, 28, 6);
    rrect(ctx, 6, 16, 52, 38, 3, MUD);
    gableRoof(ctx, 3, 6, 58, 26, st.era);
    rect(ctx, 26, 40, 12, 14, '#2b1a10');
    for (let k = 0; k < 3; k++) rrect(ctx, 6 + k * 7, 46, 6, 9, 2, '#d8c49a');
    circle(ctx, 50, 52, 4, '#7a3e22');
  },

  granary(ctx, b, t) {
    earthPatch(ctx, 0, 4, 64, 58);
    const spots = [[18, 22], [44, 22], [31, 42]];
    for (const [x, y] of spots) {
      shadow(ctx, x + 2, y + 14, 12, 4);
      line(ctx, x - 6, y + 6, x - 6, y + 14, '#5a3a20', 2);
      line(ctx, x + 6, y + 6, x + 6, y + 14, '#5a3a20', 2);
      circle(ctx, x, y + 4, 9, MUD);
      roundRoof(ctx, x, y, 11);
    }
  },

  palisade(ctx, b, t, st, n) {
    wallPiece(ctx, n, '#7a5230', '#5a3a20', false);
  },

  stonewall(ctx, b, t, st, n) {
    wallPiece(ctx, n, '#9c958a', '#77716a', true);
  },

  gate(ctx, b, t, st, n) {
    const horiz = n.l || n.r || !(n.u || n.d);
    ctx.save();
    if (!horiz) {
      ctx.translate(32, 0);
      ctx.rotate(Math.PI / 2);
    }
    rect(ctx, 0, 11, 32, 10, '#6b4226');
    for (let x = 2; x < 32; x += 5) line(ctx, x, 11, x, 21, '#4a2c1a', 1);
    rect(ctx, -2, 7, 6, 18, '#4a2c1a');
    rect(ctx, 28, 7, 6, 18, '#4a2c1a');
    ctx.restore();
  },

  well(ctx, b, t) {
    shadow(ctx, 17, 24, 12, 5);
    circle(ctx, 16, 18, 11, '#8d8577');
    circle(ctx, 16, 18, 7, '#2f6f8a');
    circle(ctx, 14, 16, 2, 'rgba(255,255,255,0.5)');
    line(ctx, 5, 8, 27, 8, '#5a3a20', 2);
  },

  shrine(ctx, b, t) {
    earthPatch(ctx, 0, 4, 64, 58);
    // Sacred iroko tree.
    shadow(ctx, 48, 34, 14, 6);
    circle(ctx, 46, 18, 14, '#2e5d2a');
    circle(ctx, 42, 14, 8, '#3f7a35');
    hut(ctx, 22, 34, 14, { wall: '#efe6d2' });
    // White cloth and red beads for the òrìṣà.
    rect(ctx, 14, 48, 16, 3, '#ffffff');
    for (let k = 0; k < 5; k++) circle(ctx, 15 + k * 3.5, 54, 1.4, k % 2 ? '#ffffff' : '#c0392b');
    circle(ctx, 40, 50, 3, '#6d3b1f');
  },

  market(ctx, b, t) {
    earthPatch(ctx, -4, -2, 104, 100);
    const cols = ['#e74c3c', '#f1c40f', '#27ae60', '#2980b9', '#e67e22', '#8e44ad'];
    for (let k = 0; k < 6; k++) {
      const x = 18 + (k % 3) * 30;
      const y = 22 + Math.floor(k / 3) * 38;
      shadow(ctx, x + 3, y + 14, 12, 4);
      rect(ctx, x - 10, y + 6, 20, 8, '#8b5a2b');
      for (let j = 0; j < 4; j++) circle(ctx, x - 7 + j * 5, y + 9, 2, ['#f39c12', '#c0392b', '#27ae60', '#ecf0f1'][(j + k) % 4]);
      // Bright umbrellas, as every Lagos market has.
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, TAU);
      ctx.fillStyle = cols[k];
      ctx.fill();
      for (let s = 0; s < 6; s += 2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, 12, (s / 6) * TAU, ((s + 1) / 6) * TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
    }
  },

  quarry(ctx, b, t) {
    rrect(ctx, 4, 6, 56, 52, 8, '#8f877b');
    rrect(ctx, 12, 14, 40, 36, 6, '#7a7266');
    rrect(ctx, 20, 22, 24, 20, 4, '#655e54');
    for (let k = 0; k < 4; k++) rect(ctx, 6 + k * 13, 52, 10, 7, '#b5ada0');
  },

  watchtower(ctx, b, t) {
    shadow(ctx, 40, 54, 22, 7);
    for (const [x, y] of [[18, 26], [46, 26], [18, 52], [46, 52]]) line(ctx, x, y, 32 + (x - 32) * 0.6, 14, '#5a3a20', 3);
    rrect(ctx, 14, 0, 36, 28, 3, '#8b5a2b');
    for (let x = 16; x < 50; x += 5) line(ctx, x, 1, x, 27, 'rgba(50,30,10,0.4)', 1);
    roundRoof(ctx, 32, 6, 16);
    flag(ctx, 46, -14, PLAYER, t);
  },

  warcamp(ctx, b, t) {
    earthPatch(ctx, -4, -2, 104, 100);
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(48, 50, 44, 0, TAU);
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
    hut(ctx, 28, 30, 14);
    hut(ctx, 70, 34, 14);
    // Spear rack.
    for (let k = 0; k < 6; k++) line(ctx, 36 + k * 5, 78, 34 + k * 5, 58, '#6b4b2a', 1.5);
    line(ctx, 32, 70, 66, 70, '#4a2c1a', 2.5);
    flag(ctx, 48, 30, PLAYER, t, 1.4);
  },

  palace(ctx, b, t, st) {
    // The square in front, where strangers gather in a town.
    ellipse(ctx, 64, 150, 60, 22, 'rgba(176,128,82,0.55)');
    shadow(ctx, 30, 140, 14, 5);
    circle(ctx, 24, 128, 14, '#2e5d2a');
    circle(ctx, 20, 124, 8, '#3f7a35');
    earthPatch(ctx, -6, -4, 140, 136);
    shadow(ctx, 68, 124, 62, 10);
    rrect(ctx, 6, 8, 116, 112, 6, '#7e3b22');
    rect(ctx, 38, 40, 52, 46, '#c49a6c');
    circle(ctx, 64, 63, 7, '#5b8fa3');
    gableRoof(ctx, 2, 2, 124, 30, st.era);
    gableRoof(ctx, 2, 92, 124, 30, st.era);
    gableRoof(ctx, 2, 32, 30, 60, st.era);
    gableRoof(ctx, 96, 32, 30, 60, st.era);
    // Carved veranda posts at the gate.
    for (let k = 0; k < 4; k++) {
      rect(ctx, 46 + k * 11, 110, 4, 14, '#5a3a20');
      circle(ctx, 48 + k * 11, 112, 2, '#c49a6c');
    }
    rect(ctx, 56, 112, 16, 12, '#2b1a10');
    flag(ctx, 8, -10, PLAYER, t, 1.4);
    flag(ctx, 112, -10, '#f1c40f', t + 1, 1.4);
  },

  palmpress(ctx, b, t, st) {
    earthPatch(ctx, 0, 4, 64, 58);
    hut(ctx, 20, 24, 15);
    circle(ctx, 46, 44, 11, '#5a3a20');
    circle(ctx, 46, 44, 8, '#d35400');
    circle(ctx, 43, 41, 2.5, 'rgba(255,200,120,0.6)');
    for (let k = 0; k < 7; k++) circle(ctx, 12 + (k % 4) * 5, 50 + Math.floor(k / 4) * 4, 2.2, k % 2 ? '#c0392b' : '#e67e22');
  },

  ironmine(ctx, b, t) {
    rrect(ctx, 2, 4, 60, 54, 10, '#7d6a58');
    ellipse(ctx, 30, 28, 16, 12, '#2a1d14');
    line(ctx, 14, 40, 14, 18, '#6b4226', 3);
    line(ctx, 46, 40, 46, 18, '#6b4226', 3);
    line(ctx, 12, 18, 48, 18, '#6b4226', 3);
    rrect(ctx, 38, 46, 16, 9, 2, '#5b4a42');
    for (let k = 0; k < 3; k++) circle(ctx, 42 + k * 4, 46, 2.5, '#8a4b32');
  },

  blacksmith(ctx, b, t, st) {
    earthPatch(ctx, 0, 4, 64, 58);
    shadow(ctx, 30, 50, 26, 6);
    rrect(ctx, 6, 18, 40, 30, 2, MUD);
    gableRoof(ctx, 4, 8, 44, 20, st.era);
    // Furnace and smoke.
    circle(ctx, 50, 44, 9, '#7a3e22');
    circle(ctx, 50, 44, 4.5, `rgba(255,${140 + Math.floor(Math.sin(t * 7) * 40)},40,0.95)`);
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.6 + k / 3) % 1;
      circle(ctx, 50 + Math.sin(p * 6 + k) * 3, 34 - p * 26, 3 + p * 4, `rgba(90,90,90,${0.45 * (1 - p)})`);
    }
    rect(ctx, 20, 52, 10, 4, '#555');
  },

  canoeyard(ctx, b, t) {
    rrect(ctx, 2, 4, 60, 56, 6, '#d9c290');
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(32, 16 + k * 16);
      ctx.rotate(-0.15 + k * 0.1);
      ellipse(ctx, 0, 0, 26, 5, '#6b4226');
      ellipse(ctx, 0, -0.5, 22, 3, '#3d2514');
      ctx.restore();
    }
    line(ctx, 52, 6, 58, 30, '#8b5a2b', 2);
  },

  tradingpost(ctx, b, t, st) {
    earthPatch(ctx, -4, -2, 104, 100);
    shadow(ctx, 50, 84, 44, 8);
    rrect(ctx, 8, 24, 80, 56, 2, '#efe8d8');
    // Red-tiled hip roof.
    ctx.beginPath();
    ctx.moveTo(4, 30);
    ctx.lineTo(20, 8);
    ctx.lineTo(76, 8);
    ctx.lineTo(92, 30);
    ctx.closePath();
    ctx.fillStyle = '#b5532f';
    ctx.fill();
    for (let y = 12; y < 30; y += 4) line(ctx, 10, y, 86, y, 'rgba(90,30,10,0.35)', 1);
    for (let k = 0; k < 4; k++) rect(ctx, 16 + k * 18, 44, 8, 12, '#4d6b7a');
    rect(ctx, 42, 64, 12, 16, '#5a3a20');
    for (let k = 0; k < 3; k++) rrect(ctx, 66 + k * 8, 82, 7, 8, 1, '#8b5a2b');
    circle(ctx, 18, 88, 4, '#5a3a20');
    const partner = st.flags.britishPartner || st.flags.colonized ? '#b22234' : st.flags.frenchPact ? '#2c5aa0' : '#c9a227';
    flag(ctx, 84, -8, partner, t);
  },

  fort(ctx, b, t) {
    shadow(ctx, 50, 92, 46, 8);
    ctx.beginPath();
    const pts = [[48, 0], [96, 22], [90, 80], [48, 96], [6, 80], [0, 22]];
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = '#9c958a';
    ctx.fill();
    ctx.strokeStyle = '#6f695f';
    ctx.lineWidth = 3;
    ctx.stroke();
    rrect(ctx, 26, 28, 44, 40, 4, '#b4ad9f');
    for (const [x, y, a] of [[48, 6, -1.57], [90, 26, -0.4], [86, 76, 0.5], [10, 76, 2.6], [6, 26, -2.7]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      rect(ctx, 0, -2.5, 14, 5, '#222');
      ctx.restore();
    }
    flag(ctx, 48, 10, PLAYER, t, 1.3);
  },

  school(ctx, b, t, st) {
    earthPatch(ctx, -4, -2, 104, 70);
    shadow(ctx, 50, 58, 44, 6);
    rrect(ctx, 6, 18, 84, 40, 2, '#e9dfc9');
    gableRoof(ctx, 2, 8, 92, 22, 3);
    for (let k = 0; k < 5; k++) rect(ctx, 14 + k * 15, 38, 8, 10, '#4d6b7a');
    rect(ctx, 44, 44, 10, 14, '#5a3a20');
    flag(ctx, 92, -6, PLAYER, t);
  },

  assembly(ctx, b, t) {
    earthPatch(ctx, -6, -2, 108, 104);
    shadow(ctx, 50, 90, 46, 8);
    rrect(ctx, 6, 30, 84, 58, 3, '#f4f1ea');
    for (let k = 0; k < 6; k++) rect(ctx, 12 + k * 14, 50, 5, 38, '#ddd6c6');
    const g = ctx.createRadialGradient(42, 22, 3, 48, 30, 26);
    g.addColorStop(0, '#4fbf7a');
    g.addColorStop(1, '#0d6b3a');
    ctx.beginPath();
    ctx.ellipse(48, 32, 26, 22, 0, Math.PI, 0);
    ctx.fillStyle = g;
    ctx.fill();
    nigeriaFlag(ctx, 48, -16, t);
  },
};

function wallPiece(ctx, n, color, dark, stone) {
  const c = 16;
  const thick = stone ? 12 : 9;
  const arm = (x0, y0, x1, y1) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = dark;
    ctx.lineWidth = thick + 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = thick;
    ctx.stroke();
    ctx.lineCap = 'butt';
  };
  shadow(ctx, c + 3, c + 6, 12, 5);
  if (n.l) arm(c, c, 0, c);
  if (n.r) arm(c, c, 32, c);
  if (n.u) arm(c, c, c, 0);
  if (n.d) arm(c, c, c, 32);
  if (!n.l && !n.r && !n.u && !n.d) arm(c - 6, c, c + 6, c);
  if (stone) {
    rrect(ctx, c - 8, c - 8, 16, 16, 2, '#b2ab9f', dark);
  } else {
    for (let k = -1; k <= 1; k++) {
      circle(ctx, c + k * 5, c, 3.4, '#8b6239');
      circle(ctx, c + k * 5, c - 1, 1.6, '#b08355');
    }
  }
}

function flag(ctx, x, y, color, t, scale = 1) {
  line(ctx, x, y, x, y + 26 * scale, '#3b2a1a', 1.6);
  const wave = Math.sin(t * 4 + x) * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 7 * scale, y - 2 + wave, x + 14 * scale, y + wave * 0.5);
  ctx.lineTo(x + 14 * scale, y + 9 * scale + wave * 0.5);
  ctx.quadraticCurveTo(x + 7 * scale, y + 7 * scale + wave, x, y + 9 * scale);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function nigeriaFlag(ctx, x, y, t) {
  line(ctx, x, y, x, y + 36, '#3b2a1a', 2);
  const wave = Math.sin(t * 4) * 1.5;
  const w = 24;
  const h = 14;
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = k === 1 ? '#ffffff' : '#008751';
    ctx.beginPath();
    ctx.moveTo(x + (k * w) / 3, y + wave * (k / 3));
    ctx.lineTo(x + ((k + 1) * w) / 3, y + wave * ((k + 1) / 3));
    ctx.lineTo(x + ((k + 1) * w) / 3, y + h + wave * ((k + 1) / 3));
    ctx.lineTo(x + (k * w) / 3, y + h + wave * (k / 3));
    ctx.closePath();
    ctx.fill();
  }
}

export function drawBuilding(ctx, b, t, st, neighbours) {
  const fn = DRAW[b.type];
  if (!fn) {
    rect(ctx, 0, 0, b.w * 32, b.h * 32, '#999');
    return;
  }
  if (b.built < 1) {
    // Foundations, scaffolding, and the building rising out of them.
    rrect(ctx, 2, 2, b.w * 32 - 4, b.h * 32 - 4, 4, 'rgba(140,100,60,0.55)');
    ctx.save();
    ctx.globalAlpha = 0.25 + b.built * 0.6;
    fn(ctx, b, t, st, neighbours);
    ctx.restore();
    ctx.strokeStyle = '#6b4b2a';
    ctx.lineWidth = 1.5;
    for (let x = 6; x < b.w * 32; x += 14) line(ctx, x, 4, x, b.h * 32 - 4, '#6b4b2a', 1.5);
    line(ctx, 4, b.h * 16, b.w * 32 - 4, b.h * 16, '#6b4b2a', 1.5);
    return;
  }
  fn(ctx, b, t, st, neighbours);
}

// --- Villages of other peoples ---------------------------------------------------

export function drawVillage(ctx, f, t, ownerColor) {
  const n = f.huts;
  // Positions are in tiles relative to the village centre.
  const spots = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + hash2(k, f.x, 7) * 0.6;
    const r = 1.6 + hash2(k, f.y, 9) * 1.5;
    spots.push([Math.cos(a) * r, Math.sin(a) * r * 0.85]);
  }
  ellipse(ctx, 0, 0, 4 * 32, 3.4 * 32, 'rgba(176,128,82,0.45)');
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.9 * 32, 3.3 * 32, 0, 0, TAU);
  ctx.strokeStyle = f.style === 'camp' ? 'rgba(60,40,20,0.5)' : '#6b4226';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.setLineDash([]);
  spots.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of spots) {
    if (f.style === 'camp') {
      shadow(ctx, x * 32 + 3, y * 32 + 10, 13, 4);
      ctx.beginPath();
      ctx.moveTo(x * 32 - 12, y * 32 + 10);
      ctx.lineTo(x * 32, y * 32 - 10);
      ctx.lineTo(x * 32 + 12, y * 32 + 10);
      ctx.closePath();
      ctx.fillStyle = '#6d5a43';
      ctx.fill();
    } else {
      hut(ctx, x * 32, y * 32, 13, { wall: MUD, roof: THATCH });
    }
  }
  if (f.style === 'camp') {
    circle(ctx, 0, 6, 5, '#f39c12');
    circle(ctx, 0, 6, 2.5, '#ffe066');
  }
  flag(ctx, 2, -30, ownerColor, t, 1.6);
}

// --- People -----------------------------------------------------------------------

function carried(ctx, r, x, y) {
  switch (r) {
    case 'wood':
      rect(ctx, x - 6, y - 2, 12, 2.5, CARRY.wood);
      rect(ctx, x - 5, y - 4.5, 10, 2.5, '#8b6239');
      break;
    case 'yam':
      ellipse(ctx, x, y - 2, 6, 3.4, '#a0703a');
      ellipse(ctx, x - 2, y - 3.5, 3.2, 1.6, CARRY.yam);
      ellipse(ctx, x + 2.5, y - 3, 3, 1.6, '#7a4a20');
      break;
    case 'fish':
      ellipse(ctx, x, y - 2, 6, 3.2, '#8b6239');
      ellipse(ctx, x, y - 3.4, 4, 1.4, CARRY.fish);
      break;
    case 'meat':
      ellipse(ctx, x, y - 2.5, 4.5, 3, CARRY.meat);
      break;
    case 'palmoil':
      circle(ctx, x, y - 3, 3.6, CARRY.palmoil);
      circle(ctx, x - 1, y - 4, 1, 'rgba(255,220,160,0.7)');
      break;
    case 'weapons':
      line(ctx, x - 6, y - 3, x + 6, y - 3, CARRY.weapons, 1.5);
      line(ctx, x - 6, y - 1.5, x + 6, y - 1.5, CARRY.weapons, 1.5);
      break;
    default:
      rrect(ctx, x - 4, y - 5, 8, 5, 1, CARRY[r] || '#999');
  }
}

// A person at (0, 0) in base pixels, feet at the origin.
export function drawPerson(ctx, p, t, moving, opts = {}) {
  const bob = moving ? Math.abs(Math.sin(t * 10 + p.id)) * 1.6 : 0;
  const skin = SKIN[p.id % SKIN.length];
  shadow(ctx, 0, 0, 5, 2);
  const y = -bob;
  if (p.female) {
    // Wrapper and blouse.
    ctx.beginPath();
    ctx.moveTo(-4.5, y);
    ctx.lineTo(-3.5, y - 9);
    ctx.lineTo(3.5, y - 9);
    ctx.lineTo(4.5, y);
    ctx.closePath();
    ctx.fillStyle = p.cloth;
    ctx.fill();
    rrect(ctx, -3.5, y - 12, 7, 4, 1.5, p.wrap);
    circle(ctx, 0, y - 14.5, 2.8, skin);
    // Gele headwrap.
    ellipse(ctx, 0, y - 17, 4.6, 2.4, p.wrap);
    ellipse(ctx, 2.5, y - 18.2, 2.2, 1.6, p.wrap);
  } else {
    rrect(ctx, -3, y - 5, 2.4, 5, 1, '#3b2a1a');
    rrect(ctx, 0.6, y - 5, 2.4, 5, 1, '#3b2a1a');
    rrect(ctx, -4.2, y - 12, 8.4, 8, 2, p.cloth);
    circle(ctx, 0, y - 14.5, 2.8, skin);
    // Fila cap.
    ellipse(ctx, 0.6, y - 16.6, 2.9, 1.5, p.wrap);
  }
  if (p.carry) carried(ctx, p.carry.r, 0, y - 18);
  if (opts.tool === 'axe' && !p.carry) {
    const sw = Math.sin(t * 8 + p.id) * 0.6;
    ctx.save();
    ctx.translate(4, y - 9);
    ctx.rotate(sw);
    line(ctx, 0, 0, 0, -8, '#5a3a20', 1.2);
    rect(ctx, -1, -9, 4, 3, '#7f8c8d');
    ctx.restore();
  } else if (opts.tool === 'hoe' && !p.carry) {
    const sw = Math.sin(t * 5 + p.id) * 0.5;
    ctx.save();
    ctx.translate(4, y - 8);
    ctx.rotate(0.6 + sw);
    line(ctx, 0, 0, 0, 9, '#5a3a20', 1.2);
    rect(ctx, -2, 8, 4, 2, '#7f8c8d');
    ctx.restore();
  }
}

export function drawSoldier(ctx, u, t, moving, color, opts = {}) {
  const bob = moving ? Math.abs(Math.sin(t * 11 + u.id)) * 1.4 : 0;
  const y = -bob;
  const skin = SKIN[u.id % SKIN.length];
  ellipse(ctx, 0, 0, 7, 3, color);
  ellipse(ctx, 0, 0, 5, 2, 'rgba(0,0,0,0.25)');
  const face = u.facing || 1;
  if (u.type === 'horseman') {
    ellipse(ctx, 0, y - 6, 9, 4.5, '#6b4226');
    ellipse(ctx, 8 * face, y - 10, 3, 2.4, '#5a3a20');
    for (const dx of [-6, -3, 3, 6]) line(ctx, dx, y - 3, dx, y + 1, '#4a2c1a', 1.4);
  }
  const lift = u.type === 'horseman' ? 7 : 0;
  const coat = FOREIGN_COAT[u.type] || (u.type === 'edo' ? '#b8860b' : u.type === 'slaver' ? '#3b3b3b' : u.type === 'bandit' ? '#5d4e3a' : u.cloth || '#efe6d2');
  rrect(ctx, -3, y - 5 - lift, 2.4, 5, 1, '#3b2a1a');
  rrect(ctx, 0.6, y - 5 - lift, 2.4, 5, 1, '#3b2a1a');
  rrect(ctx, -4.5, y - 12.5 - lift, 9, 8.5, 2, coat);
  // A sash in the owner's colour so sides are easy to tell apart.
  line(ctx, -4.5, y - 11 - lift, 4.5, y - 6 - lift, color, 1.8);
  circle(ctx, 0, y - 15 - lift, 3, ['soldado', 'french', 'marine'].includes(u.type) ? '#e8c3a0' : skin);
  if (u.type === 'marine') rect(ctx, -3, y - 19.5 - lift, 6, 3, '#111');
  else if (u.type === 'soldado') ellipse(ctx, 0, y - 17.5 - lift, 4, 1.8, '#9aa0a6');
  else if (u.type === 'french') rect(ctx, -2.8, y - 19 - lift, 5.6, 2.6, '#1d3b70');
  else if (u.type === 'edo') ellipse(ctx, 0, y - 17.5 - lift, 3.4, 2, '#c0392b');
  else ellipse(ctx, 0.5, y - 17.3 - lift, 3, 1.6, color);

  const swing = opts.swing ? Math.sin(Math.min(1, opts.swing) * Math.PI) * 0.9 : 0;
  ctx.save();
  ctx.translate(4.5 * face, y - 10 - lift);
  ctx.scale(face, 1);
  switch (u.type) {
    case 'archer':
    case 'bowman':
      ctx.beginPath();
      ctx.arc(1, 0, 7, -1.2, 1.2);
      ctx.strokeStyle = '#6b4b2a';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      line(ctx, 3.5, -6.5, 3.5, 6.5, 'rgba(240,240,230,0.8)', 0.6);
      break;
    case 'musketeer':
    case 'soldado':
    case 'french':
    case 'marine':
      ctx.rotate(-0.5 + swing * 0.2);
      line(ctx, -2, 2, 13, 2, '#3b2a1a', 2);
      line(ctx, 8, 2, 13, 2, '#555', 1.4);
      break;
    case 'swordsman':
    case 'edo':
      ctx.rotate(-0.8 + swing * 1.6);
      line(ctx, 0, 0, 0, -11, '#c0c6c9', 2);
      line(ctx, -2.5, -1, 2.5, -1, '#6b4b2a', 1.5);
      break;
    case 'scout':
      ctx.rotate(-0.3 + swing);
      line(ctx, 0, 2, 0, -7, '#5a3a20', 1.2);
      break;
    default:
      ctx.rotate(-0.25 + swing * 0.8);
      line(ctx, 0, 6, 0, -14, '#6b4b2a', 1.4);
      ctx.beginPath();
      ctx.moveTo(-1.8, -13);
      ctx.lineTo(0, -18);
      ctx.lineTo(1.8, -13);
      ctx.fillStyle = '#b8bec2';
      ctx.fill();
  }
  ctx.restore();
  if (['spearman', 'swordsman', 'warrior', 'edo', 'bandit', 'slaver'].includes(u.type)) {
    ellipse(ctx, -4.5 * face, y - 9 - lift, 2.8, 5, u.type === 'edo' ? '#8b5a2b' : '#a0703a');
    ellipse(ctx, -4.5 * face, y - 9 - lift, 1.2, 2.5, color);
  }
}

export function drawAnimal(ctx, a, t, moving) {
  const face = a.facing || 1;
  if (a.carcass) {
    shadow(ctx, 0, 1, 7, 2.5);
    ellipse(ctx, 0, -2, 7, 3, a.type === 'pig' ? '#4b3b33' : '#a57b4c');
    circle(ctx, 2, -1, 1.6, '#8e2b20');
    return;
  }
  const bob = moving ? Math.abs(Math.sin(t * 12 + a.id)) : 0;
  shadow(ctx, 0, 0, 7, 2.5);
  ctx.save();
  ctx.scale(face, 1);
  if (a.type === 'pig') {
    for (const dx of [-4, -1.5, 2, 4]) line(ctx, dx, -3, dx, 0, '#2f2520', 1.4);
    ellipse(ctx, 0, -5 - bob, 7, 4, '#4b3b33');
    ellipse(ctx, 6, -5.5 - bob, 3, 2.4, '#3e302a');
    circle(ctx, 8.6, -5.4 - bob, 1, '#c9a28c');
    line(ctx, 7, -4 - bob, 8.5, -2.6 - bob, '#e8e0d0', 0.8);
  } else {
    for (const dx of [-4, -2, 2.5, 4.5]) line(ctx, dx, -4, dx + (moving ? Math.sin(t * 14 + dx) : 0), 0, '#6b4b2a', 1.1);
    ellipse(ctx, 0, -6.5 - bob, 6.5, 3.4, '#b5874f');
    ellipse(ctx, 0, -5.4 - bob, 5, 1.6, '#efe2c8');
    ellipse(ctx, 6.5, -10 - bob, 2.2, 2, '#a57b4c');
    line(ctx, 6, -11.5 - bob, 4.6, -15.5 - bob, '#3b2a1a', 0.9);
    line(ctx, 7.2, -11.5 - bob, 7, -15.8 - bob, '#3b2a1a', 0.9);
  }
  ctx.restore();
}

export function drawShip(ctx, s, t, color) {
  const face = s.facing || 1;
  const rock = Math.sin(t * 1.6 + s.id) * 0.04;
  ctx.save();
  ctx.rotate(rock);
  ctx.scale(face, 1);
  ellipse(ctx, 0, 6, 46, 9, 'rgba(10,40,60,0.35)');
  ctx.beginPath();
  ctx.moveTo(-40, -6);
  ctx.lineTo(36, -6);
  ctx.quadraticCurveTo(50, -6, 46, 2);
  ctx.lineTo(30, 10);
  ctx.lineTo(-34, 10);
  ctx.quadraticCurveTo(-44, 4, -40, -6);
  ctx.fillStyle = '#5b3a1f';
  ctx.fill();
  rect(ctx, -38, -6, 76, 3, '#8b5a2b');
  for (const [x, h, w] of [[-18, 44, 22], [10, 52, 26], [30, 30, 14]]) {
    line(ctx, x, -6, x, -6 - h, '#3b2a1a', 2);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, -10 - h * 0.85);
    ctx.quadraticCurveTo(x + 4, -8 - h * 0.5, x - w / 2, -12);
    ctx.lineTo(x + w / 2, -12);
    ctx.quadraticCurveTo(x + w / 2 + 4, -8 - h * 0.5, x + w / 2, -10 - h * 0.85);
    ctx.closePath();
    ctx.fillStyle = '#f2ece0';
    ctx.fill();
    if (color === '#c9a227') {
      line(ctx, x, -12 - h * 0.7, x, -16 - h * 0.2, '#c0392b', 2.4);
      line(ctx, x - 4, -14 - h * 0.45, x + 4, -14 - h * 0.45, '#c0392b', 2.4);
    }
  }
  flag(ctx, 10, -72, color, t, 1.2);
  ctx.restore();
}

export function drawPoi(ctx, p, t) {
  const bob = Math.sin(t * 3 + p.id) * 2;
  shadow(ctx, 0, 0, 7, 2.5);
  circle(ctx, 0, -16 + bob, 9, '#f6c343');
  circle(ctx, 0, -16 + bob, 7, '#fff4cc');
  ctx.fillStyle = '#7a4b00';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, -15.5 + bob);
}

export function drawProjectile(ctx, f) {
  const k = Math.min(1, f.t / f.dur);
  const x = f.x0 + (f.x1 - f.x0) * k;
  const y = f.y0 + (f.y1 - f.y0) * k;
  const arc = f.kind === 'shot' ? 0 : Math.sin(k * Math.PI) * (f.kind === 'ball' ? 1.4 : 0.6);
  if (f.kind === 'shot') {
    if (f.t < f.dur) line(ctx, f.x0 * 32, f.y0 * 32 - 10, x * 32, y * 32 - 10, 'rgba(255,230,140,0.9)', 1.4);
    if (f.t < 0.08) circle(ctx, f.x0 * 32, f.y0 * 32 - 10, 3, 'rgba(255,240,180,0.9)');
    return;
  }
  if (f.t > f.dur) {
    if (f.kind === 'ball') circle(ctx, f.x1 * 32, f.y1 * 32, 10 * (1 - (f.t - f.dur) / 0.15), 'rgba(255,160,60,0.6)');
    return;
  }
  const px = x * 32;
  const py = (y - arc) * 32 - 10;
  if (f.kind === 'ball') {
    circle(ctx, px, py, 3, '#111');
  } else {
    const dx = f.x1 - f.x0;
    const dy = f.y1 - f.y0;
    const a = Math.atan2(dy, dx);
    line(ctx, px - Math.cos(a) * 6, py - Math.sin(a) * 6, px, py, '#3b2a1a', 1.2);
  }
}
