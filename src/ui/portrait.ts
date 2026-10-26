// Piksel portre: her kişi için yaşına, cinsiyetine, huyuna ve çağa göre oluşan bir yüz.
// SVG döner; doğrudan HTML'e gömülür, ayrı canvas gerekmez. Aynı kişi hep aynı yüz.
import type { Person, World } from '../core/types';
import { year } from '../core/calendar';

const SKIN = ['#e7b98f', '#d9a97c', '#c89268', '#b67c52', '#a66a43'];
const HAIR = ['#2a2018', '#3a2a1c', '#4a3624', '#1c1712', '#5a4a38', '#8a7a68'];
const SCARF = ['#9c3b3b', '#3f6f8a', '#7a7a3a', '#6a4a7a', '#3a7a5a', '#a8692e'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** px: SVG rect yardımcı */
const r = (x: number, y: number, w: number, h: number, c: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;

export function portraitSVG(p: Person, w: World, size = 40): string {
  const h = hash(p.id);
  const dead = p.d !== undefined;
  const a = dead ? (p.d! - p.b) / 12 : (w.m - p.b) / 12;
  const y = dead ? year(p.d!) : year(w.m);
  const skin = SKIN[h % SKIN.length];
  const grey = a > 58;
  const hair = grey ? (a > 70 ? '#d8d2c6' : '#9a948a') : HAIR[(h >> 3) % HAIR.length];
  const male = p.sex === 'E';
  const sick = !!p.sick && !dead;
  const happy = !dead && p.rel > 50;
  const sad = !dead && (p.rel < -10 || sick);
  const bg = dead ? '#2a2630' : '#161a22';

  const o: string[] = [];
  o.push(`<rect width="16" height="16" fill="${bg}"/>`);
  // Boyun ve omuz
  o.push(r(6, 13, 4, 3, skin));
  o.push(r(3, 15, 10, 1, dead ? '#3a3340' : (male ? '#4a4038' : SCARF[(h >> 7) % SCARF.length])));
  // Yüz
  o.push(r(5, 5, 6, 8, skin));
  o.push(r(4, 6, 1, 5, skin));
  o.push(r(11, 6, 1, 5, skin));
  // Saç / başlık
  if (!male) {
    // başörtüsü
    const sc = SCARF[(h >> 5) % SCARF.length];
    o.push(r(4, 3, 8, 3, sc));
    o.push(r(3, 5, 1, 6, sc));
    o.push(r(12, 5, 1, 6, sc));
    o.push(r(5, 5, 6, 1, sc));
  } else {
    o.push(r(5, 3, 6, 2, hair));
    o.push(r(4, 4, 8, 1, hair));
    // başlık: çağa göre
    if (y >= 1980 && a >= 30 && (h & 2)) o.push(r(4, 2, 8, 2, '#2a2a2a')); // şapka
    else if (y < 1945 && a >= 25) { o.push(r(5, 2, 6, 2, '#d8d0bc')); o.push(r(4, 3, 8, 1, '#c8c0ac')); } // kasket
    else if (a >= 45 && (h & 4)) o.push(r(5, 2, 6, 1, '#efe8d6')); // takke
  }
  // Gözler
  const eye = sad ? '#3a3a3a' : '#201810';
  o.push(r(6, 8, 1, 1, eye));
  o.push(r(9, 8, 1, 1, eye));
  if (a > 64) { o.push(r(5, 7, 2, 1, '#00000022')); o.push(r(9, 7, 2, 1, '#00000022')); } // kaş sarkması
  // Kaşlar
  o.push(r(6, 7, 1, 1, hair));
  o.push(r(9, 7, 1, 1, hair));
  // Ağız
  if (dead) o.push(r(6, 11, 4, 1, '#5a5560'));
  else if (happy) { o.push(r(6, 11, 4, 1, '#7a3b36')); o.push(r(7, 12, 2, 1, '#7a3b36')); }
  else if (sad) { o.push(r(6, 12, 4, 1, '#6a3030')); o.push(r(6, 11, 1, 1, '#6a3030')); o.push(r(9, 11, 1, 1, '#6a3030')); }
  else o.push(r(6, 11, 4, 1, '#6a3b36'));
  // Bıyık / sakal (erkek, yaş)
  if (male && a >= 18) {
    const mc = grey ? '#cfcabf' : hair;
    o.push(r(6, 10, 4, 1, mc));
    if (a >= 55 || (h & 8)) { o.push(r(5, 11, 6, 2, mc)); o.push(r(6, 13, 4, 1, mc)); } // sakal
  }
  // Hastalık soluk
  if (sick) o.push(`<rect width="16" height="16" fill="#8fae8f" opacity="0.12"/>`);
  if (dead) o.push(`<rect width="16" height="16" fill="#000" opacity="0.25"/>`);

  return `<svg class="portre" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${o.join('')}</svg>`;
}

/** Olay kartı sahnesi: türüne göre küçük bir manzara. */
export function sceneSVG(id: string, w: World): string {
  const night = /^(kan|baskin|kacirma|kursun|rk_|ce_|cete|it_oylama|kmt|narkotik|soygun|zehir|teklif_is)/.test(id) || id.includes('yas');
  const sky = night ? '#141828' : (year(w.m) >= 1985 ? '#3a4a6a' : '#6a7a94');
  const o: string[] = [`<rect width="48" height="20" fill="${sky}"/>`];
  const g = (x: number, y: number, ww: number, hh: number, c: string) => o.push(`<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${c}"/>`);
  // zemin
  g(0, 15, 48, 5, night ? '#1a1712' : '#5a4a32');
  if (night) for (let i = 0; i < 8; i++) g((i * 61) % 46 + 1, (i * 7) % 11 + 1, 1, 1, '#d8d0b0'); // yıldız
  const scene = (() => {
    if (id.startsWith('kan') || id.includes('cenaze') || id.startsWith('ag_olum') || id.includes('yas')) return 'cenaze';
    if (id.startsWith('baskin') || id.startsWith('kmt') || id.startsWith('narkotik')) return 'karakol';
    if (id.startsWith('dugun') || id.startsWith('fa_dugun') || id.startsWith('kv_sunnet') || id.startsWith('kv_hidrellez') || id.startsWith('kv_bag') || id.startsWith('gorucu') || id.startsWith('kacirma') || id.includes('dugun')) return 'dugun';
    if (id === 'kacakci' || id === 'teklif_tasi' || id === 'harac_basla' || id.startsWith('km_') || id.startsWith('kv_masal') || id.startsWith('kv_seyyar') || id === 'tuccar' || id === 'ev:kahve') return 'kahve';
    if (id.startsWith('ce_') || id.startsWith('cete') || id.startsWith('it_') || id.startsWith('rk_') || id.startsWith('kursun') || id.startsWith('soygun') || id === 'teklif_is') return 'gece';
    // Köy olayları: köy manzarası (tarla); yalnızca açıkça şehir/yeraltı olanlar şehir alır
    if (id.startsWith('tapu') || id.startsWith('q:') || id.startsWith('hi:') || id.startsWith('ev:') || id.startsWith('kv_') || id.startsWith('fa_') || id.startsWith('ag_') || id.startsWith('ruhsat') || id.startsWith('plan_') || id.startsWith('meslek:') || id.startsWith('hastalik') || id.startsWith('hashas')) return 'tarla';
    if (id.startsWith('nw_') || id.startsWith('dz_') || id === 'it_konsey') return 'sehir';
    return 'tarla';
  })();
  if (scene === 'cenaze') {
    for (let i = 0; i < 5; i++) g(8 + i * 7, 9, 3, 6, '#2a2630'); // yas tutanlar
    g(20, 11, 8, 2, '#8a7a5a'); // tabut
  } else if (scene === 'karakol') {
    g(16, 6, 16, 9, night ? '#2a2a34' : '#b8a884');
    g(22, 9, 4, 6, '#4a4030'); // kapı
    g(23, 2, 2, 4, '#9c3b3b'); g(22, 2, 4, 1, '#c8c0ac'); // bayrak direği
  } else if (scene === 'dugun') {
    for (let i = 0; i < 10; i++) g(3 + i * 4, 4 + (i % 3), 1, 11 - (i % 3), ['#9c3b3b', '#d9a441', '#3f86a6', '#7f9a4a'][i % 4]); // ışıklar/halay
  } else if (scene === 'kahve') {
    g(10, 7, 28, 8, night ? '#2a241c' : '#8a6a44');
    for (let i = 0; i < 4; i++) g(13 + i * 6, 10, 2, 2, '#d8d0b0'); // masa fincanları
  } else if (scene === 'gece') {
    g(6, 7, 10, 8, '#201c16'); g(30, 6, 10, 9, '#201c16');
    g(22, 3, 2, 2, '#d9a441'); // fener
  } else if (scene === 'tarla') {
    for (let i = 0; i < 48; i += 3) g(i, 15, 2, 1, '#8a6a3a');
    g(30, 6, 10, 9, night ? '#2a241c' : '#c9a876'); // ev
  } else {
    for (let i = 0; i < 6; i++) g(4 + i * 7, 4 + (i % 2) * 3, 5, 11 - (i % 2) * 3, night ? '#20242e' : '#7a7266'); // şehir silüeti
    for (let i = 0; i < 6; i++) if (night) g(6 + i * 7, 7, 1, 1, '#d9a441');
  }
  return `<svg class="scene" viewBox="0 0 48 20" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${o.join('')}</svg>`;
}
