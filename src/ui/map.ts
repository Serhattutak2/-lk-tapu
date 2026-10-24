// İzometrik piksel köy: Karaçam. Düşük çözünürlükte çizilir, tam sayı katıyla büyütülür.
import type { FacId, World } from '../core/types';
import { monthOf, year } from '../core/calendar';
import { hhMembers } from '../core/people';
import { CROPS } from '../core/fields';
import { PLOTS } from '../core/plots';

const W = 480;
const H = 300;
const N = 18;
const OX = W / 2;
const OY = 70;
const HORIZON = 58;
const R = 11; // köyün dışındaki bozkır halkası (karo)

type Tile = 'g' | 'r' | 'f' | 'h' | 'p'; // çimen, yol, ağa tarlası, haşhaş, oyuncu parseli yuvası
type Kind = 'ev' | 'evOyuncu' | 'kahve' | 'cami' | 'okul' | 'konak' | 'cesme' | 'kavak' | 'ahir' | 'bakkal' | 'degirmen' | 'agil';
export type Pick = { kind: 'plot'; i: number } | { kind: 'bld'; k: 'evOyuncu' | 'kahve' | 'bakkal' | 'degirmen' | 'konak' | 'agil' } | { kind: 'fac'; f: FacId } | { kind: 'cityhome' };
interface Bld { x: number; y: number; k: Kind; }

const grid: Tile[][] = [];
for (let y = 0; y < N; y++) {
  grid.push([]);
  for (let x = 0; x < N; x++) grid[y].push('g');
}
const fill = (x0: number, y0: number, x1: number, y1: number, t: Tile) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = t;
};
fill(0, 0, 5, 5, 'f');
fill(11, 0, 17, 5, 'f');
fill(0, 14, 5, 17, 'f');
fill(0, 11, 3, 12, 'h');
for (let i = 0; i < N; i++) {
  grid[8][i] = 'r';
  grid[i][8] = 'r';
}

/** Her tarla 3×2 karo; karonun hangi tarlaya ait olduğu. */
const plotAt: number[][] = Array.from({ length: N }, () => Array(N).fill(-1));
PLOTS.forEach((d, i) => {
  fill(d.x, d.y, d.x + 2, d.y + 1, 'p');
  for (let y = d.y; y <= d.y + 1; y++) for (let x = d.x; x <= d.x + 2; x++) plotAt[y][x] = i;
});

const BLD: Bld[] = [
  { x: 6, y: 6, k: 'ev' }, { x: 7, y: 6, k: 'kahve' }, { x: 9, y: 6, k: 'cami' }, { x: 10, y: 7, k: 'bakkal' },
  { x: 6, y: 7, k: 'ev' }, { x: 9, y: 9, k: 'okul' }, { x: 7, y: 9, k: 'cesme' }, { x: 6, y: 10, k: 'evOyuncu' },
  { x: 10, y: 9, k: 'ev' }, { x: 7, y: 10, k: 'ahir' }, { x: 11, y: 6, k: 'konak' }, { x: 5, y: 9, k: 'ev' }, { x: 1, y: 9, k: 'degirmen' }, { x: -5, y: 5, k: 'agil' },
  { x: 6, y: 4, k: 'kavak' }, { x: 10, y: 4, k: 'kavak' }, { x: 4, y: 7, k: 'kavak' }, { x: 13, y: 8, k: 'kavak' },
  { x: 5, y: 12, k: 'kavak' }, { x: 9, y: 13, k: 'kavak' }, { x: 14, y: 9, k: 'kavak' }, { x: 3, y: 9, k: 'ev' },
];

const sx = (x: number, y: number) => OX + (x - y) * 8;
const sy = (x: number, y: number) => OY + (x + y) * 4;

interface Palette { grass: string; grass2: string; road: string; field: string; field2: string; snow: boolean; leaf: string | null; }
function palette(m: number): Palette {
  const mo = monthOf(m);
  if (mo === 11 || mo <= 1) return { grass: '#dfe5e6', grass2: '#ccd5d8', road: '#c9c0b2', field: '#d7dedf', field2: '#c3cccf', snow: true, leaf: null };
  if (mo === 2) return { grass: '#7d8f4c', grass2: '#6f8044', road: '#9c7f58', field: '#6b4f33', field2: '#5e452d', snow: false, leaf: '#8fa858' };
  if (mo <= 4) return { grass: '#79a347', grass2: '#6b943e', road: '#a88b62', field: '#4f7d2c', field2: '#5d8f33', snow: false, leaf: '#5f9a3a' };
  if (mo <= 6) return { grass: '#93a24a', grass2: '#859341', road: '#b49668', field: '#d9b24c', field2: '#c79f3e', snow: false, leaf: '#4f8a35' };
  if (mo === 7) return { grass: '#a59e55', grass2: '#97904c', road: '#b49668', field: '#bfa262', field2: '#ad9256', snow: false, leaf: '#5d8a38' };
  return { grass: '#8f8a4c', grass2: '#827d45', road: '#a88b62', field: '#7a583b', field2: '#6b4c33', snow: false, leaf: mo === 10 ? null : '#c99a2e' };
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, c: string) {
  const X = sx(x, y);
  const Y = sy(x, y);
  g.fillStyle = c;
  for (let r = 0; r < 8; r++) {
    const d = r < 4 ? r : 7 - r;
    const wdt = 4 + d * 4;
    g.fillRect(X - wdt / 2, Y + r, wdt, 1);
  }
}

/** Tek karolu bina gövdesi: sol duvar, sağ duvar, üst yüz. */
function block(g: CanvasRenderingContext2D, x: number, y: number, h: number, wl: string, wr: string, top: string, inset = 0) {
  const X = sx(x, y);
  const hw = 8 - inset;
  const hh = hw / 2;
  const cy = sy(x, y) + 4 - h; // üst yüzün merkezi
  for (let i = 0; i < hw; i++) {
    g.fillStyle = wl;
    g.fillRect(X - hw + i, cy + Math.floor(i / 2), 1, h);
    g.fillStyle = wr;
    g.fillRect(X + i, cy + Math.floor((hw - 1 - i) / 2), 1, h);
  }
  g.fillStyle = top;
  for (let r = 0; r < hw; r++) {
    const d = r < hh ? r : hw - 1 - r;
    const wdt = 2 + d * 4;
    g.fillRect(X - wdt / 2, cy - hh + r, wdt, 1);
  }
}

function roof(g: CanvasRenderingContext2D, x: number, y: number, h: number, c1: string, c2: string, rh: number) {
  const X = sx(x, y);
  const Y = sy(x, y) - h;
  for (let i = 0; i < rh; i++) {
    const w = 16 - Math.round((i * 16) / rh);
    g.fillStyle = c1;
    g.fillRect(X - w / 2, Y + 4 - i, w / 2, 1);
    g.fillStyle = c2;
    g.fillRect(X, Y + 4 - i, w / 2, 1);
  }
}

function building(g: CanvasRenderingContext2D, b: Bld, p: Palette, t: number, w: World) {
  const X = sx(b.x, b.y);
  const Y = sy(b.x, b.y);
  switch (b.k) {
    case 'ev': {
      const y = year(w.m);
      const brick = y >= 1985;
      block(g, b.x, b.y, brick ? 9 : 7, brick ? '#d9b8a0' : '#c9a876', brick ? '#b89880' : '#a8885a', p.snow ? '#eef1f1' : brick ? '#a3322a' : '#8a6a45', 2);
      g.fillStyle = '#4b3a28';
      g.fillRect(X - 4, Y - 2, 2, 3);
      if (y >= 1975) {
        g.fillStyle = '#7a7a7a';
        g.fillRect(X + 2, Y - (brick ? 18 : 16), 1, 5);
        g.fillRect(X, Y - (brick ? 17 : 15), 5, 1);
      }
      if (y >= 1997) {
        g.fillStyle = '#d8d8d8';
        g.fillRect(X - 5, Y - (brick ? 12 : 10), 3, 2);
      }
      break;
    }
    case 'evOyuncu': {
      const lv = w.hh.house || 0;
      // Köyde ek evler: avlunun yanında küçük kerpiç evler
      for (let i = 0; i < (w.hh.ekEv || 0); i++) {
        const ex = X + 12 + i * 9;
        const ey = Y + 4 + i * 4;
        g.fillStyle = '#c9a876';
        g.fillRect(ex - 4, ey - 6, 8, 6);
        g.fillStyle = p.snow ? '#eef1f1' : '#8a6a45';
        g.fillRect(ex - 5, ey - 8, 10, 2);
        g.fillStyle = '#4b3a28';
        g.fillRect(ex - 1, ey - 3, 2, 3);
      }
      // Sürü: avlunun önünde otlayan koyunlar
      const sh = Math.min(14, Math.ceil((w.hh.suru || 0) / 3));
      for (let i = 0; i < sh; i++) {
        const ox = X - 22 + ((i * 7) % 20) + Math.round(Math.sin((t + i * 13) / 30) * 2);
        const oy = Y + 8 + Math.floor(i / 3) * 3;
        g.fillStyle = p.snow ? '#d9d4c8' : '#f1ede2';
        g.fillRect(ox, oy, 3, 2);
        g.fillStyle = '#3d3226';
        g.fillRect(ox + 3, oy, 1, 1);
      }
      if (lv === 0) block(g, b.x, b.y, 6, '#b99c70', '#957a52', p.snow ? '#e9eded' : '#7a5d3c', 2);
      else if (lv === 1) block(g, b.x, b.y, 7, '#cfae7a', '#ad8d5c', p.snow ? '#eef1f1' : '#86663f', 1);
      else if (lv === 2) {
        block(g, b.x, b.y, 11, '#d9d2c3', '#b8b0a0', '#d9d2c3', 1);
        roof(g, b.x, b.y, 11, '#a3322a', '#842820', 5);
        g.fillStyle = '#5d7f96';
        g.fillRect(X - 6, Y - 7, 2, 2);
        g.fillRect(X + 3, Y - 8, 2, 2);
      } else {
        block(g, b.x, b.y, 15, '#efe6cf', '#cfc4a8', '#efe6cf', 0);
        roof(g, b.x, b.y, 15, '#a3322a', '#842820', 7);
        g.fillStyle = '#5d7f96';
        for (let i = 0; i < 3; i++) g.fillRect(X - 7 + i * 2, Y - 9 - i, 1, 2);
        for (let i = 0; i < 3; i++) g.fillRect(X + 2 + i * 2, Y - 11 + i, 1, 2);
        g.fillStyle = '#d9a441';
        g.fillRect(X - 1, Y - 30, 1, 6);
      }
      g.fillStyle = '#3b2c1e';
      g.fillRect(X - 4, Y - 1, 2, 3);
      // baca dumanı
      for (let i = 0; i < 4; i++) {
        const k = (t / 3 + i * 5) % 18;
        g.fillStyle = `rgba(220,220,215,${0.55 - k / 36})`;
        g.fillRect(X + 2 + Math.round(Math.sin((t + i * 7) / 6) * 1.5), Y - 12 - k, 2, 2);
      }
      // işaret
      const bob = Math.round(Math.sin(t / 5) * 1);
      g.fillStyle = '#d9a441';
      g.fillRect(X - 1, Y - 24 + bob, 3, 3);
      g.fillRect(X, Y - 21 + bob, 1, 2);
      break;
    }
    case 'kahve':
      block(g, b.x, b.y, 7, '#d8c08e', '#b89f6d', '#d8c08e', 1);
      roof(g, b.x, b.y, 7, '#a3322a', '#842820', 5);
      g.fillStyle = '#5a4430';
      g.fillRect(X - 7, Y + 1, 4, 1);
      if (w.hh.biz?.kahve) {
        g.fillStyle = '#d9a441';
        g.fillRect(X + 3, Y - 12, 3, 2);
      }
      break;
    case 'cami':
      block(g, b.x, b.y, 8, '#e8e2d6', '#c9c2b4', '#e8e2d6', 1);
      g.fillStyle = '#9aa3a6';
      g.fillRect(X - 4, Y - 11, 8, 3);
      g.fillRect(X - 3, Y - 13, 6, 2);
      g.fillRect(X - 1, Y - 14, 2, 1);
      // minare
      g.fillStyle = '#efe9de';
      g.fillRect(X + 5, Y - 24, 2, 22);
      g.fillStyle = '#9aa3a6';
      g.fillRect(X + 5, Y - 27, 2, 3);
      g.fillRect(X + 4, Y - 16, 4, 1);
      break;
    case 'okul':
      block(g, b.x, b.y, 7, '#ece6da', '#cdc5b6', '#ece6da', 1);
      roof(g, b.x, b.y, 7, '#a3322a', '#842820', 4);
      g.fillStyle = '#6d6d6d';
      g.fillRect(X - 9, Y - 16, 1, 16);
      g.fillStyle = '#c8261d';
      g.fillRect(X - 8, Y - 16 + (Math.floor(t / 4) % 2), 5, 3);
      break;
    case 'konak':
      block(g, b.x, b.y, 13, '#e2d2b0', '#c2b08c', '#e2d2b0', 0);
      roof(g, b.x, b.y, 13, '#a3322a', '#842820', 6);
      g.fillStyle = '#5a4630';
      for (let i = 0; i < 3; i++) g.fillRect(X + 2 + i * 2, Y - 8 + i, 1, 2);
      for (let i = 0; i < 3; i++) g.fillRect(X - 7 + i * 2, Y - 7 - i + 2, 1, 2);
      if (w.flags.agaKonak) {
        g.fillStyle = '#d9a441';
        g.fillRect(X + 6, Y - 30, 4, 3);
        g.fillStyle = '#5a4128';
        g.fillRect(X + 5, Y - 30, 1, 10);
      }
      break;
    case 'bakkal':
      block(g, b.x, b.y, 7, '#d6c9a4', '#b6a983', '#d6c9a4', 1);
      roof(g, b.x, b.y, 7, '#3f86a6', '#326c86', 4);
      g.fillStyle = w.hh.biz?.bakkal ? '#d9a441' : '#f0e9d6';
      g.fillRect(X - 7, Y - 5, 5, 2);
      break;
    case 'degirmen': {
      block(g, b.x, b.y, 10, '#cdbf9d', '#ab9d7b', '#cdbf9d', 1);
      roof(g, b.x, b.y, 10, '#7a5d3c', '#5f4830', 5);
      const a = (t / 4) % (Math.PI * 2);
      g.fillStyle = '#6a5a46';
      for (let k = 0; k < 4; k++) {
        const an = a + (k * Math.PI) / 2;
        for (let r = 2; r < 9; r++) g.fillRect(Math.round(X - 6 + Math.cos(an) * r), Math.round(Y - 8 + Math.sin(an) * r * 0.8), 1, 1);
      }
      if (w.hh.biz?.degirmen) {
        g.fillStyle = '#a3322a';
        g.fillRect(X + 2, Y - 20, 4, 2);
        g.fillRect(X + 1, Y - 20, 1, 6);
      }
      break;
    }
    case 'agil': {
      block(g, b.x, b.y, 6, '#9a948a', '#7f796f', p.snow ? '#eef1f1' : '#6e5a43', 1);
      g.fillStyle = '#5a4128';
      for (let i = 0; i < 6; i++) g.fillRect(X - 14 + i * 2, Y + 4 + Math.floor(i / 2), 1, 3);
      if (w.hh.agil) {
        g.fillStyle = '#a3322a';
        g.fillRect(X + 4, Y - 14, 3, 2);
        g.fillRect(X + 3, Y - 14, 1, 7);
      }
      if (w.lab && w.lab.site === 'agil') {
        for (let i = 0; i < 5; i++) {
          const k = (t / 2 + i * 4) % 22;
          g.fillStyle = `rgba(190,190,200,${0.6 - k / 40})`;
          g.fillRect(X - 2 + Math.round(Math.sin((t + i * 5) / 5) * 2), Y - 12 - k, 2, 2);
        }
      }
      break;
    }
    case 'ahir':
      block(g, b.x, b.y, 5, '#9c7d55', '#7d6342', p.snow ? '#eef1f1' : '#6e5436', 1);
      break;
    case 'cesme':
      g.fillStyle = '#9a9a92';
      g.fillRect(X - 3, Y - 3, 6, 6);
      g.fillStyle = '#7d7d76';
      g.fillRect(X - 3, Y + 2, 6, 1);
      g.fillStyle = '#6fa8c4';
      g.fillRect(X - 1, Y + 3 + (Math.floor(t / 3) % 2), 1, 1);
      break;
    case 'kavak': {
      const sway = Math.round(Math.sin((t + b.x * 3) / 8) * 0.6);
      g.fillStyle = '#5d4a33';
      g.fillRect(X, Y - 4, 1, 6);
      if (p.leaf) {
        g.fillStyle = p.leaf;
        g.fillRect(X - 1 + sway, Y - 18, 3, 14);
        g.fillRect(X + sway, Y - 20, 1, 2);
      } else {
        g.fillStyle = '#6a5a46';
        g.fillRect(X + sway, Y - 16, 1, 12);
        g.fillRect(X - 1 + sway, Y - 12, 1, 3);
        g.fillRect(X + 1 + sway, Y - 10, 1, 3);
      }
      break;
    }
  }
  void w;
}

function fence(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  g.fillStyle = '#5a4128';
  for (let x = x0; x <= x1 + 1; x++) {
    g.fillRect(sx(x, y0) - 1, sy(x, y0) - 2, 1, 3);
    g.fillRect(sx(x, y1 + 1) - 1, sy(x, y1 + 1) - 2, 1, 3);
  }
  for (let y = y0; y <= y1 + 1; y++) {
    g.fillRect(sx(x0, y) - 1, sy(x0, y) - 2, 1, 3);
    g.fillRect(sx(x1 + 1, y) - 1, sy(x1 + 1, y) - 2, 1, 3);
  }
}

/** Kendi parselimizin zemin rengi: ekin ve olgunluğa göre. */
function parcelTile(w: World, f: World['hh']['parcels'][number], alt: boolean, snow: boolean): string {
  if (snow) return alt ? '#e4e8e8' : '#d3dadb';
  if (!f.crop) return alt ? '#7a5638' : '#6c4b30';
  const st = (w.m - f.sownM) / CROPS[f.crop].grow;
  const pick = (a: string, b: string) => (alt ? a : b);
  if (st < 0.15) return pick('#6f5a36', '#634f30');
  switch (f.crop) {
    case 'bugday':
    case 'arpa':
      return st > 0.8 ? pick('#d9ae45', '#c99d3a') : st > 0.6 ? pick('#a9ab48', '#9b9d40') : pick('#6e9a3c', '#628c35');
    case 'pancar':
      return pick('#3f7d37', '#36702f');
    case 'nohut':
      return st > 0.8 ? pick('#a99a55', '#9a8b4b') : pick('#7aa245', '#6d943d');
    case 'hashas':
      return st > 0.85 ? pick('#9fae76', '#91a06a') : pick('#5f9447', '#55873f');
  }
  return pick('#6b4f33', '#5e452d');
}

/** Deterministik karo gürültüsü */
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const isRiver = (x: number, y: number) => y < 0 && y === -2 - (((x % 9) + 9) % 9 < 4 ? 0 : 1) && x > -R;
const isOutRoad = (x: number, y: number) => (y === 8 && (x < 0 || x >= N)) || (x === 8 && (y < 0 || y >= N));

function sky(g: CanvasRenderingContext2D, m: number, t: number) {
  const mo = monthOf(m);
  const winter = mo === 11 || mo <= 1;
  const top = winter ? '#9fb2bd' : mo >= 8 && mo <= 10 ? '#a9bccb' : '#8fbfdc';
  const low = winter ? '#d9dfe1' : mo >= 8 && mo <= 10 ? '#e4d3a8' : '#dfe6d2';
  const gr = g.createLinearGradient(0, 0, 0, HORIZON + 10);
  gr.addColorStop(0, top);
  gr.addColorStop(1, low);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, HORIZON + 12);
  // bulutlar
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 137 + t * (0.15 + i * 0.05)) % (W + 60)) - 30;
    const cy = 10 + i * 7;
    g.fillRect(cx, cy, 18, 3);
    g.fillRect(cx + 4, cy - 2, 9, 2);
  }
  // uzak dağlar
  for (let x = 0; x < W; x++) {
    const h1 = 30 + 9 * Math.sin(x / 37) + 6 * Math.sin(x / 13 + 1) + 2 * Math.sin(x / 5.3);
    g.fillStyle = winter ? '#8e9ca6' : '#8b98a3';
    g.fillRect(x, h1, 1, HORIZON + 14 - h1);
    if (h1 < 27 || winter) {
      g.fillStyle = '#eef2f3';
      g.fillRect(x, h1, 1, winter ? 4 : 2);
    }
    const h2 = 44 + 5 * Math.sin(x / 29 + 2) + 3 * Math.sin(x / 9);
    g.fillStyle = winter ? '#b9c2c2' : mo >= 5 && mo <= 9 ? '#9c8f5c' : '#7c8a52';
    g.fillRect(x, h2, 1, HORIZON + 14 - h2);
  }
}

function steppe(m: number, alt: boolean): string {
  const mo = monthOf(m);
  if (mo === 11 || mo <= 1) return alt ? '#e2e7e7' : '#d4dbdc';
  if (mo === 2) return alt ? '#8d9150' : '#82864a';
  if (mo <= 4) return alt ? '#8aa451' : '#7e9849';
  if (mo <= 7) return alt ? '#b8a865' : '#ab9b5c';
  return alt ? '#a39058' : '#978550';
}

function shade(hex: string, d: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + d));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}

function outline(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  g.fillStyle = '#ffd866';
  for (let x = x0; x <= x1 + 1; x++) {
    g.fillRect(sx(x, y0), sy(x, y0), 2, 1);
    g.fillRect(sx(x, y1 + 1), sy(x, y1 + 1), 2, 1);
  }
  for (let y = y0; y <= y1 + 1; y++) {
    g.fillRect(sx(x0, y) - 1, sy(x0, y), 2, 1);
    g.fillRect(sx(x1 + 1, y) - 1, sy(x1 + 1, y), 2, 1);
  }
}

const TAPPABLE: string[] = ['evOyuncu', 'kahve', 'bakkal', 'degirmen', 'konak', 'agil'];

/** Şehir: Çukurkent. Aynı izometrik ızgarada apartmanlar, sanayi, gazino, liman. */
const FAC_AT: Partial<Record<FacId, [number, number]>> = { un: [2, 8], tekstil: [4, 8], nakliye: [2, 10], insaat: [4, 10], gazino: [9, 9], sarap: [1, 9], konserve: [5, 9], cimento: [1, 11], otel: [13, 7], liman: [13, 11], banka: [6, 6], medya: [8, 6] };
const isCRoad = (x: number, y: number) => x % 6 === 0 || y % 6 === 0;
const isSea = (x: number, y: number) => x >= 15;

export class VillageMap {
  mode: 'koy' | 'sehir' = 'koy';
  selected: Pick | null = null;
  private tx = { ox: 0, oy: 0, s: 1, dpr: 1 };
  onPick: ((p: Pick | null) => void) | null = null;
  private buf = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private out: CanvasRenderingContext2D;
  private t = 0;
  private raf = 0;
  private last = 0;
  constructor(private canvas: HTMLCanvasElement, private getWorld: () => World | null) {
    this.buf.width = W;
    this.buf.height = H;
    this.g = this.buf.getContext('2d')!;
    this.out = canvas.getContext('2d')!;
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (now - this.last < 90) return;
      this.last = now;
      this.t++;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const px = ((e.clientX - r.left) * this.tx.dpr - this.tx.ox) / this.tx.s;
      const py = ((e.clientY - r.top) * this.tx.dpr - this.tx.oy) / this.tx.s;
      const hit = this.hit(px, py);
      this.selected = hit;
      this.onPick?.(hit);
    });
  }

  /** Tampon koordinatından tarla ya da bina bulur. */
  private hit(X: number, Y: number): Pick | null {
    if (this.mode === 'sehir') {
      for (const f of Object.keys(FAC_AT) as FacId[]) {
        if (!FAC_AT[f]) continue;
        const [fx, fy] = FAC_AT[f];
        if (Math.abs(X - sx(fx, fy)) <= 10 && Y >= sy(fx, fy) - 26 && Y <= sy(fx, fy) + 8) return { kind: 'fac', f };
      }
      for (const [hx, hy] of [[2, 2], [13, 13]] as [number, number][]) {
        if (Math.abs(X - sx(hx, hy)) <= 10 && Y >= sy(hx, hy) - 26 && Y <= sy(hx, hy) + 8) return { kind: 'cityhome' };
      }
      return null;
    }
    for (const b of BLD) {
      if (!TAPPABLE.includes(b.k)) continue;
      const bx = sx(b.x, b.y);
      const by = sy(b.x, b.y);
      if (Math.abs(X - bx) <= 9 && Y >= by - 20 && Y <= by + 7) return { kind: 'bld', k: b.k as Extract<Pick, { kind: 'bld' }>['k'] };
    }
    const u = (X - OX) / 8;
    const v = (Y - OY - 4) / 4;
    const tx = Math.round((u + v) / 2);
    const ty = Math.round((v - u) / 2);
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return null;
    const pi = plotAt[ty][tx];
    return pi >= 0 ? { kind: 'plot', i: pi } : null;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  /** Parseldeki ekinin olgunluğa göre görünümü. */
  private crop(w: World, f: World['hh']['parcels'][number], x: number, y: number, snow: boolean) {
    const g = this.g;
    if (!f.crop || snow) return;
    const st = (w.m - f.sownM) / CROPS[f.crop].grow;
    const X = sx(x, y);
    const Y = sy(x, y);
    const dots: [number, number][] = [[-5, 3], [-2, 2], [1, 3], [4, 4], [-3, 5], [0, 5], [3, 6], [-1, 7], [6, 4], [-6, 4]];
    let c1 = '#7fa04a';
    let c2: string | null = null;
    if (st < 0.2) c1 = '#86a34f';
    if (f.crop === 'bugday' || f.crop === 'arpa') {
      c1 = st > 0.75 ? '#e2bb4e' : st > 0.5 ? '#b6b94a' : '#77a043';
    } else if (f.crop === 'pancar') {
      c1 = st > 0.3 ? '#2f6f36' : '#5d9a40';
    } else if (f.crop === 'nohut') {
      c1 = st > 0.8 ? '#b9a25a' : '#6e9a42';
    } else if (f.crop === 'hashas') {
      c1 = st > 0.85 ? '#a7b07a' : '#6a9a4a';
      const mo = monthOf(w.m);
      if (st > 0.5 && (mo === 4 || mo === 5)) c2 = (Math.floor(this.t / 18) + x + y) % 4 ? '#f4efe6' : f.illegal ? '#c45f8f' : '#d98aa8';
    }
    const n = st < 0.2 ? 3 : st < 0.5 ? 6 : dots.length;
    g.fillStyle = c1;
    for (let i = 0; i < n; i++) g.fillRect(X + dots[i][0], Y + dots[i][1] - (st > 0.5 ? 1 : 0), 1, st > 0.5 ? 2 : 1);
    if (c2) {
      g.fillStyle = c2;
      for (let i = 0; i < n; i += 2) g.fillRect(X + dots[i][0], Y + dots[i][1] - 2, 1, 1);
    }
  }

  private draw() {
    const w = this.getWorld();
    if (!w) return;
    if (this.mode === 'sehir') {
      this.drawCity(w);
      this.blit(w);
      return;
    }
    const g = this.g;
    const p = palette(w.m);
    g.fillStyle = steppe(w.m, false);
    g.fillRect(0, 0, W, H);
    sky(g, w.m, this.t);
    const parcelOf = (i: number) => {
      const st = w.plots?.[i];
      return st && st.o === 'biz' ? w.hh.parcels.find((f) => f.id === st.pid) : undefined;
    };
    const mo = monthOf(w.m);

    // Zemin: önce köyün dışındaki bozkır, dere ve yollar
    for (let s = -2 * R; s < 2 * (N + R); s++) {
      for (let y = -R; y < N + R; y++) {
        const x = s - y;
        if (x < -R || x >= N + R) continue;
        if (x >= 0 && x < N && y >= 0 && y < N) continue;
        if (sy(x, y) + 8 < HORIZON + 2 || sy(x, y) > H || sx(x, y) < -10 || sx(x, y) > W + 10) continue;
        const alt = (x + y) % 2 === 0;
        let c = steppe(w.m, alt);
        if (isOutRoad(x, y)) c = p.road;
        if (isRiver(x, y)) c = p.snow ? (alt ? '#c9dbe3' : '#bcd0d9') : alt ? '#4f8fb0' : '#4785a6';
        diamond(g, x, y, c);
        const X = sx(x, y);
        const Y = sy(x, y);
        if (isRiver(x, y) && !p.snow && (Math.floor(this.t / 6) + x) % 5 === 0) {
          g.fillStyle = '#9fd0e6';
          g.fillRect(X - 2, Y + 3, 3, 1);
        } else if (!isOutRoad(x, y) && !isRiver(x, y)) {
          const h = hash(x, y);
          if (h < 0.08) {
            g.fillStyle = '#8f8a80';
            g.fillRect(X - 2, Y + 3, 3, 2);
            g.fillStyle = '#b3ada2';
            g.fillRect(X - 2, Y + 3, 2, 1);
          } else if (h < 0.16 && !p.snow) {
            g.fillStyle = '#5f7a3a';
            g.fillRect(X + 1, Y + 2, 3, 2);
            g.fillRect(X + 2, Y + 1, 1, 1);
          } else if (h < 0.19) {
            g.fillStyle = '#5d4a33';
            g.fillRect(X, Y - 3, 1, 6);
            g.fillStyle = p.leaf ?? '#7a6a52';
            g.fillRect(X - 2, Y - 8, 5, 5);
          } else if (h > 0.985 && !p.snow) {
            const dx = Math.round(Math.sin(this.t / 25 + x) * 3);
            g.fillStyle = '#f2eee2';
            g.fillRect(X - 3 + dx, Y + 3, 2, 1);
            g.fillRect(X + dx, Y + 4, 2, 1);
            g.fillRect(X + 3 + dx, Y + 2, 2, 1);
          }
        }
      }
    }
    // Köy
    for (let s = 0; s < N * 2; s++) {
      for (let y = 0; y < N; y++) {
        const x = s - y;
        if (x < 0 || x >= N) continue;
        const tl = grid[y][x];
        const alt = (x + y) % 2 === 0;
        let c = alt ? p.grass : p.grass2;
        if (tl === 'r') c = w.tech?.asfalt ? ((x + y) % 2 ? '#56565a' : '#4f4f53') : p.road;
        const pi = plotAt[y][x];
        const own = pi >= 0 ? parcelOf(pi) : undefined;
        if (tl === 'f' || tl === 'h' || (pi >= 0 && !own)) c = alt ? p.field : p.field2;
        if (pi >= 0 && !own && PLOTS[pi].aga && !p.snow) c = alt ? shade(p.field, -10) : shade(p.field2, -10);
        if (own) c = parcelTile(w, own, alt, p.snow);
        diamond(g, x, y, c);
        if (own) this.crop(w, own, x, y, p.snow);
        if (tl === 'h' && (mo === 4 || mo === 5)) {
          // haşhaş çiçekleri
          g.fillStyle = (x + y + Math.floor(this.t / 20)) % 3 ? '#f2eee6' : '#d98aa8';
          g.fillRect(sx(x, y) - 3, sy(x, y) + 3, 1, 1);
          g.fillRect(sx(x, y) + 2, sy(x, y) + 4, 1, 1);
        }
      }
    }
    PLOTS.forEach((d, i) => {
      const st = w.plots?.[i];
      if (!st) return;
      const { x, y } = d;
      if (st.o === 'biz') {
        fence(g, x, y, x + 2, y + 1);
        const X = sx(x + 1, y);
        const Y = sy(x + 1, y);
        g.fillStyle = '#4a3624';
        g.fillRect(X, Y - 9, 1, 9);
        g.fillStyle = '#a3322a';
        g.fillRect(X + 1, Y - 9 + (Math.floor(this.t / 6) % 2), 4, 3);
      } else if (st.o === 'rakip') {
        const X = sx(x + 1, y);
        const Y = sy(x + 1, y);
        g.fillStyle = '#3a3026';
        g.fillRect(X, Y - 9, 1, 9);
        g.fillStyle = '#2f5d8a';
        g.fillRect(X + 1, Y - 9, 4, 3);
      } else if (st.sale) {
        const X = sx(x + 1, y + 1);
        const Y = sy(x + 1, y + 1);
        g.fillStyle = '#5a4128';
        g.fillRect(X, Y - 8, 1, 9);
        g.fillStyle = '#f4efe2';
        g.fillRect(X - 3, Y - 11, 7, 4);
        g.fillStyle = '#a3322a';
        g.fillRect(X - 2, Y - 10, 5, 1);
      }
      if (this.selected && this.selected.kind === 'plot' && this.selected.i === i && Math.floor(this.t / 4) % 2 === 0) outline(g, x, y, x + 2, y + 1);
    });
    // Taşıtlar evin önünde
    const vx = sx(6, 11);
    const vy = sy(6, 11);
    if ((w.hh.veh?.traktor || 0) > 0 && !p.snow) {
      g.fillStyle = '#c0392b';
      g.fillRect(vx - 4, vy + 1, 7, 3);
      g.fillStyle = '#2b2b2b';
      g.fillRect(vx - 5, vy + 3, 4, 4);
      g.fillRect(vx + 2, vy + 4, 2, 2);
    }
    if ((w.hh.veh?.otomobil || 0) > 0) {
      g.fillStyle = '#3f86a6';
      g.fillRect(sx(5, 11) - 4, sy(5, 11) + 2, 8, 3);
      g.fillStyle = '#9fc3d3';
      g.fillRect(sx(5, 11) - 2, sy(5, 11) + 1, 4, 1);
      g.fillStyle = '#222';
      g.fillRect(sx(5, 11) - 3, sy(5, 11) + 5, 2, 1);
      g.fillRect(sx(5, 11) + 2, sy(5, 11) + 5, 2, 1);
    }
    if ((w.hh.veh?.kamyon || 0) > 0) {
      g.fillStyle = '#7d8f4c';
      g.fillRect(sx(7, 11) - 5, sy(7, 11), 10, 5);
      g.fillStyle = '#d9a441';
      g.fillRect(sx(7, 11) + 3, sy(7, 11) + 1, 3, 3);
    }
    if ((w.hh.veh?.esek || 0) > 0 || (w.hh.veh?.araba || 0) > 0) {
      g.fillStyle = '#7d7468';
      g.fillRect(sx(5, 10) - 5, sy(5, 10) + 3, 4, 2);
      g.fillRect(sx(5, 10) - 6, sy(5, 10) + 2, 1, 2);
      if ((w.hh.veh?.araba || 0) > 0) {
        g.fillStyle = '#8a6a45';
        g.fillRect(sx(5, 10) - 1, sy(5, 10) + 2, 5, 2);
      }
    }
    if (this.selected && this.selected.kind === 'bld') {
      const b = BLD.find((q) => this.selected && this.selected.kind === 'bld' && q.k === this.selected.k);
      if (b && Math.floor(this.t / 4) % 2 === 0) outline(g, b.x, b.y, b.x, b.y);
    }

    // İnsanlar ve hayvanlar
    const workers = hhMembers(w).filter((q) => !q.away && !q.sick && (q.job === 'tarla' || q.job === 'coban' || q.job === 'kendi'));
    const working = mo >= 3 && mo <= 9;
    const figs: { x: number; y: number; c: string }[] = [];
    workers.forEach((q, i) => {
      if (!working && q.job === 'tarla') return;
      let bx: number;
      let by: number;
      if (q.job === 'coban') {
        bx = 13 + (i % 3);
        by = 9 + ((i * 2) % 3);
        for (let k = 0; k < 5; k++) {
          const a = this.t / 30 + k * 1.3 + i;
          figs.push({ x: sx(bx, by) + Math.round(Math.cos(a) * 9), y: sy(bx, by) + 2 + Math.round(Math.sin(a * 1.3) * 4), c: p.snow ? '#efe9de' : '#f0ece2' });
        }
      } else if (q.job === 'kendi' && w.plots?.some((s2) => s2.pid === q.parcel)) {
        const k = w.plots.findIndex((s2) => s2.pid === q.parcel);
        bx = PLOTS[k].x + 1;
        by = PLOTS[k].y + 1;
      } else {
        const fields: [number, number][] = [[2, 2], [14, 2], [2, 15], [4, 3], [13, 4]];
        [bx, by] = fields[i % fields.length];
      }
      const X = sx(bx, by) + Math.round(Math.sin(this.t / 9 + i * 2) * 6);
      const Y = sy(bx, by) + 2 + Math.round(Math.cos(this.t / 11 + i) * 2);
      figs.push({ x: X, y: Y - 4, c: q.sex === 'K' ? '#b8443a' : '#3f5f86' });
    });

    // Elektrik direkleri, araçlar, dron
    if (w.tech?.elektrik) {
      g.strokeStyle = 'rgba(40,40,40,0.5)';
      for (let i = 0; i < N; i += 3) {
        for (const [px, py] of [[i, 7], [9, i]] as [number, number][]) {
          const X = sx(px, py) + 4;
          const Y = sy(px, py) + 2;
          g.fillStyle = '#5d4a33';
          g.fillRect(X, Y - 12, 1, 12);
          g.fillRect(X - 2, Y - 12, 5, 1);
        }
      }
    }
    if (year(w.m) >= 1985) {
      for (let k = 0; k < 3; k++) {
        const along = (this.t * 0.25 + k * 7) % N;
        const horiz = k % 2 === 0;
        const X = sx(horiz ? along : 8, horiz ? 8 : along);
        const Y = sy(horiz ? along : 8, horiz ? 8 : along);
        g.fillStyle = ['#c0392b', '#3f86a6', '#e0c341'][k];
        g.fillRect(Math.round(X) - 2, Math.round(Y) + 2, 4, 2);
      }
    }
    if (w.tech?.dron && w.hh.parcels.length) {
      const a = this.t / 12;
      g.fillStyle = '#222';
      g.fillRect(Math.round(sx(14, 13) + Math.cos(a) * 20), Math.round(sy(14, 13) - 20 + Math.sin(a) * 6), 3, 1);
    }

    // Binalar (ressam sırası)
    const order = [...BLD].sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const b of order) building(g, b, p, this.t, w);
    for (const f of figs) {
      g.fillStyle = f.c;
      g.fillRect(f.x, f.y, 2, 3);
      g.fillStyle = '#e8c9a0';
      g.fillRect(f.x, f.y - 1, 2, 1);
    }

    // Kar
    if (p.snow) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 60; i++) {
        const x = (i * 53 + this.t * (1 + (i % 3))) % W;
        const y = (i * 37 + this.t * 2 * (1 + (i % 2))) % H;
        g.fillRect(x, y, 1, 1);
      }
    }

    this.blit(w);
  }

  private drawCity(w: World) {
    const g = this.g;
    const t = this.t;
    const snow0 = palette(w.m).snow;
    g.fillStyle = snow0 ? '#d1d8db' : '#837f73';
    g.fillRect(0, 0, W, H);
    sky(g, w.m, t);
    // uzak şehir silueti
    for (let x = 0; x < W; x += 6) {
      const h = 20 + Math.round(hash(x, 3) * 22);
      g.fillStyle = '#8a96a0';
      g.fillRect(x, HORIZON + 12 - h, 5, h);
      if (hash(x, 9) > 0.7) {
        g.fillStyle = '#c9d4db';
        g.fillRect(x + 2, HORIZON + 14 - h, 1, 1);
      }
    }
    const snow = palette(w.m).snow;
    for (let s = -2 * R; s < 2 * (N + R); s++) {
      for (let y = -R; y < N + R; y++) {
        const x = s - y;
        if (x < -R || x >= N + R) continue;
        if (sy(x, y) + 8 < HORIZON + 2 || sy(x, y) > H || sx(x, y) < -10 || sx(x, y) > W + 10) continue;
        const alt = (x + y) % 2 === 0;
        let c = snow ? (alt ? '#dfe4e6' : '#d1d8db') : alt ? '#8d8a7e' : '#837f73';
        if (isSea(x, y)) c = alt ? '#3d7c9e' : '#367294';
        else if (isCRoad(x, y)) c = alt ? '#4c4c4e' : '#454547';
        else if (x < 4 && y < 4) c = snow ? '#e7ecec' : alt ? '#6f9a48' : '#648d40';
        diamond(g, x, y, c);
        if (isSea(x, y) && (Math.floor(t / 5) + x * 3 + y) % 7 === 0) {
          g.fillStyle = '#9cc9df';
          g.fillRect(sx(x, y) - 2, sy(x, y) + 3, 3, 1);
        }
        if (isCRoad(x, y) && !isSea(x, y) && (x + y) % 2 === 0) {
          g.fillStyle = '#c9b45a';
          g.fillRect(sx(x, y), sy(x, y) + 4, 1, 1);
        }
      }
    }
    // binalar: ressam sırası
    const items: { d: number; f: () => void }[] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (isCRoad(x, y) || isSea(x, y) || (x < 4 && y < 4)) continue;
        const fac = (Object.keys(FAC_AT) as FacId[]).find((f) => FAC_AT[f] && FAC_AT[f]![0] === x && FAC_AT[f]![1] === y);
        const d = x + y;
        if (fac) {
          items.push({ d, f: () => this.facSprite(w, fac, x, y) });
          continue;
        }
        if ((x === 1 || x === 3 || x === 5) && y >= 7 && y <= 11) continue; // sanayi boşlukları
        const hv = hash(x, y);
        if (hv < 0.3) {
          // park ve meydan
          items.push({
            d,
            f: () => {
              const X = sx(x, y);
              const Y = sy(x, y);
              g.fillStyle = snow ? '#c9d2d4' : '#6b8f45';
              g.fillRect(X - 6, Y + 2, 12, 4);
              g.fillStyle = '#5d4a33';
              g.fillRect(X, Y - 3, 1, 5);
              g.fillStyle = snow ? '#9aa7a9' : '#4f7a35';
              g.fillRect(X - 2, Y - 8, 5, 5);
            },
          });
          continue;
        }
        const h = 6 + Math.round(hv * 16);
        const tone = ['#d8d0bf', '#cbbfa6', '#e2d6c4', '#bfb6a8', '#d6c3a9'][Math.floor(hash(y, x) * 5)];
        items.push({
          d,
          f: () => {
            block(g, x, y, h, tone, shade(tone, -28), shade(tone, 12), 1);
            const X = sx(x, y);
            const Y = sy(x, y) + 4 - h;
            for (let k = 2; k < h - 1; k += 3) {
              g.fillStyle = hash(x * 7 + k, y + t / 40) > 0.6 ? '#f2d98a' : '#5f6f7c';
              g.fillRect(X - 5, Y + k + 2, 1, 1);
              g.fillRect(X + 3, Y + k + 1, 1, 1);
            }
            if (x === 13 && y === 13 && w.city.home >= 1) {
              g.fillStyle = '#a3322a';
              g.fillRect(X + 1, Y - 6, 3, 2);
              g.fillRect(X, Y - 6, 1, 6);
            }
          },
        });
      }
    }
    // villa
    if (w.city.home >= 2) {
      items.push({
        d: 4,
        f: () => {
          block(g, 2, 2, 9, '#f4efe4', '#d8d0c0', '#f4efe4', 0);
          roof(g, 2, 2, 9, '#a3322a', '#842820', 5);
          g.fillStyle = '#5fb3d6';
          g.fillRect(sx(2, 3) - 4, sy(2, 3) + 2, 8, 3);
          g.fillStyle = '#d9a441';
          g.fillRect(sx(2, 2) - 1, sy(2, 2) - 22, 1, 6);
        },
      });
    }
    items.sort((a, b) => a.d - b.d).forEach((it) => it.f());
    // araçlar
    for (let k = 0; k < 8; k++) {
      const along = (t * 0.6 + k * 23) % (N * 1.0);
      const lane = (k % 3) * 6;
      const horiz = k % 2 === 0;
      const x = horiz ? along : lane;
      const y = horiz ? lane : along;
      g.fillStyle = ['#c0392b', '#e0c341', '#2f5d8a', '#ddd'][k % 4];
      g.fillRect(Math.round(sx(x, y)) - 1, Math.round(sy(x, y)) + 3, 3, 2);
    }
    // gemi
    const sxp = sx(16, 4 + ((t / 30) % 8));
    g.fillStyle = '#2b2b2b';
    g.fillRect(sxp - 8, sy(16, 4 + ((t / 30) % 8)) + 2, 14, 3);
    g.fillStyle = '#c0392b';
    g.fillRect(sxp - 2, sy(16, 4 + ((t / 30) % 8)) - 2, 3, 4);
    if (this.selected && this.selected.kind === 'fac' && FAC_AT[this.selected.f]) {
      const [fx, fy] = FAC_AT[this.selected.f]!;
      if (Math.floor(t / 4) % 2 === 0) outline(g, fx, fy, fx, fy);
    }
  }

  private facSprite(w: World, f: FacId, x: number, y: number) {
    const g = this.g;
    const t = this.t;
    const own = !!w.city.facs[f];
    const X = sx(x, y);
    const Y = sy(x, y);
    if (f === 'gazino') {
      block(g, x, y, 12, '#3b2a4a', '#2d2038', '#4b365e', 0);
      const on = Math.floor(t / 3) % 2 === 0;
      g.fillStyle = on ? '#ff4fa0' : '#ffd24f';
      g.fillRect(X - 6, Y - 10, 12, 2);
      g.fillStyle = on ? '#ffd24f' : '#ff4fa0';
      g.fillRect(X - 4, Y - 6, 2, 1);
      g.fillRect(X + 2, Y - 7, 2, 1);
    } else {
      const col = f === 'un' ? '#d9cfb8' : f === 'tekstil' ? '#b9a69a' : f === 'nakliye' ? '#9aa2a8' : '#c8b07a';
      block(g, x, y, f === 'insaat' ? 6 : 10, col, shade(col, -30), shade(col, 10), 0);
      if (f === 'insaat') {
        g.fillStyle = '#e0a020';
        g.fillRect(X + 2, Y - 30, 1, 26);
        g.fillRect(X - 8, Y - 30, 16, 1);
        g.fillRect(X - 8, Y - 29 + (Math.floor(t / 8) % 6), 1, 4);
      } else {
        g.fillStyle = '#7a6a5a';
        g.fillRect(X + 3, Y - 22, 2, 14);
        if (own || f === 'un') {
          for (let i = 0; i < 4; i++) {
            const k = (t / 2 + i * 5) % 18;
            g.fillStyle = `rgba(200,200,200,${0.6 - k / 32})`;
            g.fillRect(X + 3 + Math.round(Math.sin((t + i * 6) / 5) * 2), Y - 24 - k, 2, 2);
          }
        }
        if (f === 'nakliye') {
          g.fillStyle = '#c0392b';
          g.fillRect(X - 10, Y + 3, 6, 3);
          g.fillRect(X - 3, Y + 5, 6, 3);
        }
      }
    }
    if (own) {
      g.fillStyle = '#4a3624';
      g.fillRect(X - 8, Y - 18, 1, 10);
      g.fillStyle = '#a3322a';
      g.fillRect(X - 7, Y - 18 + (Math.floor(t / 6) % 2), 4, 3);
    }
  }

  private blit(w: World) {
    const p = palette(w.m);
    // Ekrana ölçekle
    const c = this.canvas;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.round(c.clientWidth * dpr);
    const ch = Math.round(c.clientHeight * dpr);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const o = this.out;
    o.imageSmoothingEnabled = false;
    o.fillStyle = this.mode === 'sehir' ? (p.snow ? '#d1d8db' : '#837f73') : steppe(w.m, false);
    o.fillRect(0, 0, cw, ch);
    // Köyün kapladığı alan (yaklaşık 300x170) ekrana sığar; çevresi bozkır ve dağlarla dolar
    const s = Math.min(cw / 300, ch / 170);
    const dw = Math.round(W * s);
    const dh = Math.round(H * s);
    const ox = Math.round(cw / 2 - OX * s);
    const oy = Math.round(ch / 2 - (OY + 72) * s);
    if (oy > 0) {
      // Tamponun üstünde kalan boşluk gökyüzüyle dolsun
      const mo = monthOf(w.m);
      o.fillStyle = mo === 11 || mo <= 1 ? '#9fb2bd' : mo >= 8 && mo <= 10 ? '#a9bccb' : '#8fbfdc';
      o.fillRect(0, 0, cw, oy + 2);
    }
    o.drawImage(this.buf, ox, oy, dw, dh);
    this.tx = { ox, oy, s, dpr };
  }
}
