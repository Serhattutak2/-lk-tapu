// Banka hesabı: parayı kasadan bankaya koyarsın. Göz önünde olmaz (jandarmanın dikkatini çekmez,
// baskında güvende), küçük faiz işler ama enflasyonu zar zor karşılar — zenginlik aracı değil, kasa.
import type { World } from './types';
import { year } from './calendar';
import { log } from './people';

export const bankaBal = (w: World) => Number(w.flags.banka || 0);
export const bankaAcik = (w: World) => year(w.m) >= 1950 || w.city.open || w.city.moved;

export function bankaYatir(w: World, amt: number): { ok: boolean; msg: string } {
  if (!bankaAcik(w)) return { ok: false, msg: 'Yakında bir banka şubesi yok.' };
  amt = Math.floor(amt);
  if (amt <= 0) return { ok: false, msg: 'Geçersiz tutar.' };
  if (w.hh.cash < amt) return { ok: false, msg: 'Kasada o kadar para yok.' };
  w.hh.cash -= amt;
  w.flags.banka = bankaBal(w) + amt;
  return { ok: true, msg: `${amt.toLocaleString('tr-TR')} lira bankaya yatırıldı.` };
}

export function bankaCek(w: World, amt: number): { ok: boolean; msg: string } {
  amt = Math.floor(amt);
  if (amt <= 0) return { ok: false, msg: 'Geçersiz tutar.' };
  if (bankaBal(w) < amt) return { ok: false, msg: 'Hesapta o kadar para yok.' };
  w.flags.banka = bankaBal(w) - amt;
  w.hh.cash += amt;
  return { ok: true, msg: `${amt.toLocaleString('tr-TR')} lira çekildi.` };
}

/** Aylık faiz. Bankacı ailede ise biraz daha yüksek. */
export function monthlyBanka(w: World) {
  const bal = bankaBal(w);
  if (bal <= 0) return;
  const bankaci = Object.values(w.people).some((p) => p.job === 'bankaci' && p.inHH && !p.away && p.d === undefined);
  const rate = 0.0035 + (bankaci ? 0.0015 : 0); // aylık; enflasyonu (~%0,37) ancak karşılar
  const faiz = Math.round(bal * rate);
  if (faiz > 0) {
    w.flags.banka = bal + faiz;
    if (w.m % 12 === 0) log(w, `Banka hesabına yıllık faiz işledi; birikim ${Math.round(bankaBal(w)).toLocaleString('tr-TR')} lira.`, 'para');
  }
}
