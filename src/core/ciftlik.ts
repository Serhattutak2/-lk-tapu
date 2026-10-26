// Hayvancılık ve bahçe: mülke derinlik katan, aylık küçük gelirler getiren varlıklar.
// Hepsi flags'te sayı/işaret olarak durur. Köyde yaşarken anlamlı; şehre taşınınca köy geliri biter.
import type { LedgerLine, World } from './types';
import { infl, monthOf } from './calendar';

export interface Ciftlik { id: string; ad: string; desc: string; price: (w: World) => number; max: number; step: number; }

export const CIFTLIK: Ciftlik[] = [
  { id: 'inek', ad: 'Süt ineği', desc: 'Her ay süt ve peynir getirir; kışın yem ister. Ahır ne kadar genişse o kadar beslersin.', price: (w) => Math.round(1800 * infl(w.m)), max: 20, step: 1 },
  { id: 'tavuk', ad: 'Tavuk (5\'li)', desc: 'Yumurta ve bayramlık. Ucuz, bakımı kolay; her ay azar azar para.', price: (w) => Math.round(90 * infl(w.m)), max: 60, step: 5 },
  { id: 'ari', ad: 'Arı kovanı', desc: 'Nisan–Eylül arası bal verir; kışın susar. Köyün balı pazarda kapış kapış.', price: (w) => Math.round(420 * infl(w.m)), max: 24, step: 1 },
];
// Tek seferlik alınan bahçeler (0/1)
export const BAHCE: Ciftlik[] = [
  { id: 'meyve', ad: 'Meyve bahçesi', desc: 'Elma, kayısı, erik. Yıllar geçtikçe ağaçlar büyür; yaz sonu bol gelir.', price: (w) => Math.round(6500 * infl(w.m)), max: 1, step: 1 },
  { id: 'ceviz', ad: 'Ceviz ağaçları', desc: 'Sabırlı işin karşılığı: her ekim ayında tek seferde dolgun bir kazanç.', price: (w) => Math.round(4800 * infl(w.m)), max: 1, step: 1 },
  { id: 'bostan', ad: 'Bostan (sebze bahçesi)', desc: 'Domates, biber, kavun, karpuz. Yazın hane sofrası bedava, fazlası pazara.', price: (w) => Math.round(1100 * infl(w.m)), max: 1, step: 1 },
];

export const ciftN = (w: World, id: string) => Number(w.flags['cf_' + id] || 0);
export const bahceVar = (w: World, id: string) => !!w.flags['bh_' + id];

export function buyCiftlik(w: World, id: string): { ok: boolean; msg: string } {
  const d = CIFTLIK.find((x) => x.id === id);
  if (!d) return { ok: false, msg: 'Yok.' };
  if (ciftN(w, id) + d.step > d.max) return { ok: false, msg: 'Daha fazlasına yerin yok.' };
  const c = d.price(w) * d.step;
  if (w.hh.cash < c) return { ok: false, msg: `${(c - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= c;
  w.flags['cf_' + id] = ciftN(w, id) + d.step;
  return { ok: true, msg: `${d.ad} alındı.` };
}

export function sellCiftlik(w: World, id: string): { ok: boolean; msg: string } {
  const d = CIFTLIK.find((x) => x.id === id);
  if (!d || ciftN(w, id) <= 0) return { ok: false, msg: 'Satacak bir şey yok.' };
  const v = Math.round(d.price(w) * d.step * 0.6);
  w.hh.cash += v;
  w.flags['cf_' + id] = ciftN(w, id) - d.step;
  return { ok: true, msg: `Satıldı: ${v.toLocaleString('tr-TR')} lira.` };
}

export function buyBahce(w: World, id: string): { ok: boolean; msg: string } {
  const d = BAHCE.find((x) => x.id === id);
  if (!d) return { ok: false, msg: 'Yok.' };
  if (bahceVar(w, id)) return { ok: false, msg: 'Zaten var.' };
  const c = d.price(w);
  if (w.hh.cash < c) return { ok: false, msg: `${(c - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= c;
  w.flags['bh_' + id] = 1;
  if (id === 'meyve' || id === 'ceviz') w.flags['bh_' + id + 'Y'] = w.m; // dikildiği ay (büyüme için)
  return { ok: true, msg: `${d.ad} alındı.` };
}

/** Aylık çiftlik/bahçe geliri (temiz para). */
export function monthlyCiftlik(w: World, lines: LedgerLine[]) {
  if (w.city.moved) return; // köyü bıraktıysan köy varlıkları gelir getirmez
  const mo = monthOf(w.m);
  const inf = infl(w.m);
  let gelir = 0;
  const inek = ciftN(w, 'inek');
  if (inek > 0) {
    const kis = mo === 11 || mo === 0 || mo === 1;
    const sut = inek * (kis ? 55 : 95) * inf;
    const yem = kis ? inek * 35 * inf : 0;
    gelir += sut - yem;
    if (sut - yem) lines.push({ t: `Ahır: ${inek} inek süt/peynir${kis ? ' (kış yemi düştü)' : ''}`, v: Math.round(sut - yem) });
  }
  const tavuk = ciftN(w, 'tavuk');
  if (tavuk > 0) { const v = Math.round(tavuk * 5 * inf); gelir += v; lines.push({ t: `Kümes: ${tavuk} tavuk yumurta`, v }); }
  const ari = ciftN(w, 'ari');
  if (ari > 0 && mo >= 3 && mo <= 8) { const v = Math.round(ari * 55 * inf); gelir += v; lines.push({ t: `${ari} kovan bal`, v }); }
  // Bahçeler
  if (bahceVar(w, 'meyve') && mo >= 7 && mo <= 9) {
    const yas = Math.min(4, Math.floor((w.m - Number(w.flags.bh_meyveY || w.m)) / 12));
    const v = Math.round((900 + yas * 250) * inf);
    gelir += v; lines.push({ t: 'Meyve bahçesi hasadı', v });
  }
  if (bahceVar(w, 'ceviz') && mo === 9) {
    const yas = Math.min(5, Math.floor((w.m - Number(w.flags.bh_cevizY || w.m)) / 12));
    const v = Math.round((1100 + yas * 300) * inf);
    gelir += v; lines.push({ t: 'Ceviz hasadı', v });
  }
  if (bahceVar(w, 'bostan') && mo >= 5 && mo <= 8) {
    const v = Math.round(180 * inf);
    gelir += v; lines.push({ t: 'Bostan: sofra + pazar', v });
  }
  w.hh.cash += Math.round(gelir);
}

export const ciftlikOzet = (w: World): string => {
  const parts: string[] = [];
  for (const d of CIFTLIK) { const n = ciftN(w, d.id); if (n) parts.push(`${n} ${d.id === 'tavuk' ? 'tavuk' : d.id === 'inek' ? 'inek' : 'kovan'}`); }
  for (const d of BAHCE) if (bahceVar(w, d.id)) parts.push(d.ad.toLowerCase());
  return parts.join(', ');
};
