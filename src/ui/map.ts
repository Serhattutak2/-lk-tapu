// İzometrik piksel köy: Karaçam. Düşük çözünürlükte çizilir, tam sayı katıyla büyütülür.
import type { World } from '../core/types';
import { monthOf } from '../core/calendar';
import { hhMembers } from '../core/people';
import { CROPS } from '../core/fields';
import { PLOTS } from '../core/plots';

const W = 320;
const H = 196;
const N = 18;
const OX = W / 2;
const OY = 26;

type Tile = 'g' | 'r' | 'f' | 'h' | 'p'; // çimen, yol, ağa tarlası, haşhaş, oyuncu parseli yuvası
type Kind = 'ev' | 'evOyuncu' | 'kahve' | 'cami' | 'okul' | 'konak' | 'cesme' | 'kavak' | 'ahir' | 'bakkal' | 'degirmen';
export type Pick = { kind: 'plot'; i: number } | { kind: 'bld'; k: 'evOyuncu' | 'kahve' | 'bakkal' | 'degirmen' | 'konak' };
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
  { x: 10, y: 9, k: 'ev' }, { x: 7, y: 10, k: 'ahir' }, { x: 11, y: 6, k: 'konak' }, { x: 5, y: 9, k: 'ev' }, { x: 1, y: 9, k: 'degirmen' },
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
    case 'ev':
      block(g, b.x, b.y, 7, '#c9a876', '#a8885a', p.snow ? '#eef1f1' : '#8a6a45', 2);
      g.fillStyle = '#4b3a28';
      g.fillRect(X - 4, Y - 2, 2, 3);
      break;
    case 'evOyuncu': {
      const lv = w.hh.house || 0;
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

const TAPPABLE: string[] = ['evOyuncu', 'kahve', 'bakkal', 'degirmen', 'konak'];

export class VillageMap {
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
    const g = this.g;
    const p = palette(w.m);
    g.fillStyle = p.snow ? '#b9c3c6' : '#3d4f2f';
    g.fillRect(0, 0, W, H);
    const parcelOf = (i: number) => {
      const st = w.plots?.[i];
      return st && st.o === 'biz' ? w.hh.parcels.find((f) => f.id === st.pid) : undefined;
    };
    const mo = monthOf(w.m);

    // Zemin
    for (let s = 0; s < N * 2; s++) {
      for (let y = 0; y < N; y++) {
        const x = s - y;
        if (x < 0 || x >= N) continue;
        const tl = grid[y][x];
        const alt = (x + y) % 2 === 0;
        let c = alt ? p.grass : p.grass2;
        if (tl === 'r') c = p.road;
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
    o.fillStyle = p.snow ? '#b9c3c6' : '#3d4f2f';
    o.fillRect(0, 0, cw, ch);
    // Köyün kapladığı alan (yaklaşık 300x185) ekrana sığacak kadar büyütülür
    const s = Math.min(cw / 300, ch / 185);
    const dw = Math.round(W * s);
    const dh = Math.round(H * s);
    const ox = Math.round((cw - dw) / 2);
    const oy = Math.round((ch - dh) / 2 - 6 * s);
    o.drawImage(this.buf, ox, oy, dw, dh);
    this.tx = { ox, oy, s, dpr };
  }
}
