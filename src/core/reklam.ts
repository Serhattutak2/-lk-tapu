// Reklam ödüllerinin OYUNA dokunan kısmı (çekirdek, düz JSON). Arayüz önce reklamı oynatır,
// ödül hak edilirse buradaki fonksiyonu çağırır. Dengeyi bozmayacak kadar ölçülü ödüller.
import type { World } from './types';
import { infl, year } from './calendar';
import { log } from './people';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

/** "Bereket" ödüllü reklamı yılda bir alınabilir. */
export const bereketVar = (w: World): boolean => !w.over && Number(w.flags.bereketY || 0) < year(w.m);

/** Yılda bir, reklam karşılığı mütevazı bir nakit: enflasyona göre ~bir aylık orta gelir. */
export function bereket(w: World): { ok: boolean; msg: string } {
  if (!bereketVar(w)) return { ok: false, msg: 'Bu yıl bereket zaten alındı; gelecek yıl yine.' };
  w.flags.bereketY = year(w.m);
  const amt = Math.round((1500 + Number(w.flags.nesil || 1) * 250) * infl(w.m));
  w.hh.cash += amt;
  log(w, `Hayır kapısı: beklenmedik bir bereket, ${fmt(amt)} lira kasaya girdi.`, 'para');
  return { ok: true, msg: `${fmt(amt)} lira bereket kasaya girdi.` };
}

/** Son felaketin açtığı yaradan bir kısmını (≈%40) reklam karşılığı geri al. Felaket başına bir kez. */
export const toparlanmaVar = (w: World): boolean => Number(w.flags.krizLoss || 0) > 0;

export function toparlan(w: World): { ok: boolean; msg: string } {
  const loss = Number(w.flags.krizLoss || 0);
  if (loss <= 0) return { ok: false, msg: 'Toparlanacak taze bir zarar yok.' };
  w.flags.krizLoss = 0;
  const back = Math.round(loss * 0.4);
  w.hh.cash += back;
  log(w, `Felaketin ardından sıkı durdun; tanıdıklar, eski alacaklar derken ${fmt(back)} liralık yaran sarıldı.`, 'para');
  return { ok: true, msg: `${fmt(back)} lira geri geldi.` };
}
