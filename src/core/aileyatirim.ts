// Aile yatırımları: hane halkına yapılan harcamalar. Bazıları sürekli gider (hoca, hekim),
// bazıları tek seferlik moral/itibar hamlesi (harçlık, tören). Etkiler growth/health/nam üzerinden işler.
import type { World } from './types';
import { clamp } from './rng';
import { log, hhMembers } from './people';
import { infl, year } from './calendar';

// ---- Sürekli giderli hizmetler (flags.hoca / flags.hekim) ----
export const hocaPay = (w: World) => Math.round(650 * infl(w.m));
export const hekimPay = (w: World) => Math.round(1100 * infl(w.m));

export function toggleHoca(w: World): { ok: boolean; msg: string } {
  w.flags.hoca = !w.flags.hoca;
  log(w, w.flags.hoca ? `Köye özel hoca tutuldu; evin çocukları daha hızlı öğrenecek (ayda ${hocaPay(w).toLocaleString('tr-TR')} lira).` : `Özel hocadan vazgeçildi.`, 'olay');
  return { ok: true, msg: w.flags.hoca ? 'Özel hoca tutuldu.' : 'Özel hoca bırakıldı.' };
}
export function toggleHekim(w: World): { ok: boolean; msg: string } {
  w.flags.hekim = !w.flags.hekim;
  log(w, w.flags.hekim ? `Aileye bakan bir hekim tutuldu; hastalıklar kısalır, ölüm riski düşer (ayda ${hekimPay(w).toLocaleString('tr-TR')} lira).` : `Aile hekiminden vazgeçildi.`, 'olay');
  return { ok: true, msg: w.flags.hekim ? 'Aile hekimi tutuldu.' : 'Hekim bırakıldı.' };
}

/** Aylık gider (economy içinde çağrılır). */
export function monthlyAileYatirim(w: World, lines: { t: string; v: number }[]) {
  if (w.flags.hoca) { const c = hocaPay(w); w.hh.cash -= c; lines.push({ t: 'Özel hoca ücreti', v: -c }); }
  if (w.flags.hekim) { const c = hekimPay(w); w.hh.cash -= c; lines.push({ t: 'Aile hekimi ücreti', v: -c }); }
}

// ---- Tek seferlik hamleler ----
export const harclikCost = (w: World) => Math.round(hhMembers(w).length * 120 * infl(w.m));
export const torenCost = (w: World) => Math.round((6000 + Number(nam(w)) * 40) * infl(w.m));

function nam(w: World): number { return Number(w.flags.namBonus || 0) + w.hh.parcels.length * 4; }

export function harclikVer(w: World): { ok: boolean; msg: string } {
  const c = harclikCost(w);
  if (w.hh.cash < c) return { ok: false, msg: `Harçlık için ${c.toLocaleString('tr-TR')} lira gerekiyor.` };
  if (Number(w.flags.harclikM || 0) > w.m) return { ok: false, msg: 'Bu yıl harçlık zaten dağıtıldı.' };
  w.hh.cash -= c;
  w.flags.harclikM = w.m + 12;
  for (const p of hhMembers(w)) p.rel = clamp(p.rel + 8, -100, 100);
  log(w, `Hane halkına harçlık ve hediye dağıtıldı; herkesin yüzü güldü, aile bağı güçlendi.`, 'para');
  return { ok: true, msg: 'Harçlık dağıtıldı; aile bağlılığı arttı.' };
}

export function torenYap(w: World): { ok: boolean; msg: string } {
  const c = torenCost(w);
  if (w.hh.cash < c) return { ok: false, msg: `Tören için ${c.toLocaleString('tr-TR')} lira gerekiyor.` };
  if (Number(w.flags.torenM || 0) > w.m) return { ok: false, msg: 'Yakın zamanda zaten büyük bir tören verdin.' };
  w.hh.cash -= c;
  w.flags.torenM = w.m + 36;
  w.flags.namBonus = Number(w.flags.namBonus || 0) + 8;
  if (w.flags.saygi !== undefined) w.flags.saygi = clamp(Number(w.flags.saygi) + 8, 0, 100);
  for (const p of hhMembers(w)) p.rel = clamp(p.rel + 5, -100, 100);
  log(w, `Köye büyük bir ziyafet verildi: davul zurna, kazanlar kaynadı. ${year(w.m)} yılı köyde uzun süre konuşulacak. Nam ve saygı arttı.`, 'olay');
  return { ok: true, msg: 'Tören verildi; nam ve saygı arttı.' };
}

export const harclikVar = (w: World) => Number(w.flags.harclikM || 0) > w.m;
export const torenVar = (w: World) => Number(w.flags.torenM || 0) > w.m;
