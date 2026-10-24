// Koyun sürüsü: ahır ve ağıl kadar yer, çoban varsa tam verim. Baharda kuzu, yazın süt, haziranda yün,
// kışın yem gideri. Fiyat hayvan piyasasıyla oynar. Kurbanda sürüden kesilebilir.
import type { LedgerLine, World } from './types';
import { chance, clamp, rint } from './rng';
import { hhMembers, log } from './people';
import { infl, monthOf } from './calendar';
import { mk } from './market';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
export const suru = (w: World) => w.hh.suru || 0;
/** Sürünün sığacağı yer: ahır 12, dağdaki ağıl 40 koyun daha */
export const suruCap = (w: World) => (w.hh.rooms.ahir ? 12 : 0) + (w.hh.agil ? 40 : 0);
export const sheepPrice = (w: World) => Math.round((380 * infl(w.m) * mk(w, 'hayvan')) / 10) * 10;
export const coban = (w: World) => hhMembers(w).some((p) => p.job === 'coban' && !p.away);

export function buySheep(w: World, n: number): { ok: boolean; msg: string } {
  const cap = suruCap(w);
  if (!cap) return { ok: false, msg: 'Önce bir ahır yap ya da dağdaki ağılı al.' };
  const k = Math.min(n, cap - suru(w));
  if (k <= 0) return { ok: false, msg: 'Ahır ve ağıl dolu.' };
  const c = sheepPrice(w) * k;
  if (w.hh.cash < c) return { ok: false, msg: `${fmt(c - w.hh.cash)} lira eksik.` };
  w.hh.cash -= c;
  w.hh.suru = suru(w) + k;
  log(w, `Hayvan pazarından ${k} koyun alındı (${fmt(c)} lira). Sürü ${w.hh.suru} baş.`, 'tapu');
  return { ok: true, msg: `${k} koyun alındı.` };
}

export function sellSheep(w: World, n: number): number {
  const k = Math.min(n, suru(w));
  if (k <= 0) return 0;
  const v = Math.round(sheepPrice(w) * 0.85) * k;
  w.hh.suru = suru(w) - k;
  w.hh.cash += v;
  log(w, `${k} koyun satıldı: ${fmt(v)} lira.`, 'para');
  return v;
}

export function monthlySuru(w: World, lines: LedgerLine[]) {
  const n = suru(w);
  if (n <= 0) return;
  const mo = monthOf(w.m);
  const f = coban(w) ? 1 : 0.55;
  const cap = suruCap(w);
  if (cap < n) {
    // Ahır ya da ağıl gittiyse fazlası satılır
    sellSheep(w, n - cap);
  }
  if (mo >= 3 && mo <= 8) {
    const v = Math.round(n * 7 * f * infl(w.m));
    w.hh.cash += v;
    lines.push({ t: `Sürü: süt ve peynir (${suru(w)} koyun${coban(w) ? '' : ', çoban yok'})`, v });
  }
  if (mo === 5) {
    const v = Math.round(n * 14 * f * infl(w.m) * mk(w, 'hayvan'));
    w.hh.cash += v;
    lines.push({ t: 'Sürü: yün kırkımı', v });
  }
  if (mo === 2 || mo === 3) {
    const born = Math.round(n * (mo === 2 ? 0.2 : 0.15) * f);
    if (born > 0) {
      const room = Math.max(0, cap - n);
      const keep = Math.min(born, room);
      w.hh.suru = n + keep;
      const sold = born - keep;
      if (sold > 0) {
        const v = Math.round(sheepPrice(w) * 0.6) * sold;
        w.hh.cash += v;
        lines.push({ t: `Sürü: ${sold} kuzu satıldı`, v });
      }
      if (keep) log(w, `Ağılda ${keep} kuzu doğdu; sürü ${w.hh.suru} baş.`, 'is');
    }
  }
  if (mo === 11 || mo <= 1) {
    const c = Math.round(n * 6 * infl(w.m) * (w.hh.rooms.samanlik ? 0.6 : 1));
    w.hh.cash -= c;
    lines.push({ t: `Sürünün kış yemi${w.hh.rooms.samanlik ? ' (samanlıktan)' : ''}`, v: -c });
  }
  if ((mo === 0 || mo === 1) && !coban(w) && chance(w, 0.04)) {
    const k = Math.min(suru(w), rint(w, 1, 3));
    w.hh.suru = suru(w) - k;
    log(w, `Başında çoban olmayan sürüden ${k} koyun kayboldu.`, 'olay');
  }
  w.hh.suru = clamp(suru(w), 0, 999);
}
