// Köy yapıları: su, mutfak, avlu ve hayır eserleri. Tek seferlik alınır, flags'te işaretlenir.
// Bazıları kalıcı etki yapar (kuyu kuraklığı, duvar baskını azaltır), bazıları aylık küçük tasarruf getirir.
import type { LedgerLine, World } from './types';
import { clamp } from './rng';
import { log } from './people';
import { infl } from './calendar';
import { nam } from './assets';

export interface Yapi { id: string; ad: string; desc: string; price: (w: World) => number; need?: (w: World) => string | null; }

export const YAPILAR: Yapi[] = [
  { id: 'kuyu', ad: 'Kuyu', desc: 'Avluya kuyu: kuraklık artık bütün tarlalarını yarı yarıya az vurur. Susuz yılların korkusu azalır.', price: (w) => Math.round(5200 * infl(w.m)) },
  { id: 'firin', ad: 'Taş fırın ve kiler', desc: 'Kendi ekmeğini pişirir, ürününü kilerde saklarsın. Hane mutfak gideri her ay düşer.', price: (w) => Math.round(2600 * infl(w.m)), need: (w) => (w.hh.house >= 1 ? null : 'Önce kendi evini al.') },
  { id: 'duvar', ad: 'Taş avlu duvarı', desc: 'Avlunun çevresine yüksek taş duvar: namını büyütür, gece baskınlarında evin ve ekinin daha güvende olur.', price: (w) => Math.round(7000 * infl(w.m)), need: (w) => (w.hh.house >= 1 ? null : 'Duvar örmek için önce kendi evin olmalı.') },
  { id: 'cesme', ad: 'Köy çeşmesi yaptır', desc: 'Köy meydanına çeşme: suyu herkese akar. Hayrın konuşulur, adın ve saygın büyür.', price: (w) => Math.round(9000 * infl(w.m)) },
  { id: 'cami', ad: 'Cami/mescit onart', desc: 'Köyün mescidini onartır, minare diktirirsin. Köyün duası üstünde; saygı ve itibar kalıcı artar.', price: (w) => Math.round(16000 * infl(w.m)) },
];

export const yapiVar = (w: World, id: string) => !!w.flags['yp_' + id];

export function buyYapi(w: World, id: string): { ok: boolean; msg: string } {
  const d = YAPILAR.find((x) => x.id === id);
  if (!d) return { ok: false, msg: 'Yok.' };
  if (yapiVar(w, id)) return { ok: false, msg: 'Zaten yaptırdın.' };
  const n = d.need?.(w);
  if (n) return { ok: false, msg: n };
  const c = d.price(w);
  if (w.hh.cash < c) return { ok: false, msg: `${(c - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= c;
  w.flags['yp_' + id] = 1;
  if (id === 'kuyu') w.flags.kuyu = true; // hasat hesabı bu bayrağı okur
  if (id === 'cesme' || id === 'cami') {
    w.flags.hayirPuan = Number(w.flags.hayirPuan || 0) + (id === 'cami' ? 8 : 5);
    w.flags.namBonus = Number(w.flags.namBonus || 0) + (id === 'cami' ? 10 : 6);
    if (w.flags.saygi !== undefined) w.flags.saygi = clamp(Number(w.flags.saygi) + (id === 'cami' ? 10 : 7), 0, 100);
    log(w, `${d.ad.replace(' yaptır', '').replace(' onart', '')} köye kazandırıldı. Köy seni hayırla anıyor.`, 'olay');
  } else if (id === 'duvar') {
    w.flags.namBonus = Number(w.flags.namBonus || 0) + 4;
    log(w, `Avluya taş duvar örüldü.`, 'is');
  } else {
    log(w, `${d.ad} yaptırıldı.`, 'is');
  }
  return { ok: true, msg: `${d.ad} tamam.` };
}

/** Fırın/kiler tasarrufu: aylık mutfak giderini biraz kısar. */
export function monthlyYapi(w: World, lines: LedgerLine[]) {
  if (yapiVar(w, 'firin')) {
    const kisi = w.hh.members.length;
    const tasarruf = Math.round(kisi * 18 * infl(w.m));
    if (tasarruf) { w.hh.cash += tasarruf; lines.push({ t: 'Fırın ve kiler: mutfak tasarrufu', v: tasarruf }); }
  }
  void nam;
}

export const yapiOzet = (w: World): string => YAPILAR.filter((d) => yapiVar(w, d.id)).map((d) => d.ad).join(', ');
