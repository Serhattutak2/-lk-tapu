// Yıl defteri: her Ocak geçen yılın hesabı ve bu yılın niyeti. Niyet bir yıl boyunca bir alana bereket verir.
import type { World } from './types';
import { clamp } from './rng';
import { hhMembers, log } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';

export type Niyet = 'toprak' | 'ticaret' | 'aile' | 'yeralti' | 'nam';
export const NIYET: Record<Niyet, { ad: string; desc: string }> = {
  toprak: { ad: 'Toprak yılı', desc: 'Bütün hasatlar %8 fazla, köylüler tarla satmaya daha yatkın.' },
  ticaret: { ad: 'Ticaret yılı', desc: 'İşletme, fabrika ve tüccar kazancı %12 fazla.' },
  aile: { ad: 'Aile yılı', desc: 'Evde bağlılık her ay artar, küskünlükler kolay geçer, sağlık iyileşir.' },
  yeralti: { ad: 'Karanlık yıl', desc: 'Kaçak mal %12 pahalı satılır; jandarmanın dikkati daha hızlı söner.' },
  nam: { ad: 'Hayır yılı', desc: 'Köye yapılan her iyilik, her düğün, her kurban iki kat konuşulur: nam her ay biraz artar.' },
};

export const niyet = (w: World): Niyet | null => (Number(w.flags.niyetY || 0) === year(w.m) ? ((w.flags.niyet as Niyet) || null) : null);
export const niyetIs = (w: World, n: Niyet) => niyet(w) === n;

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const worth = (w: World) => w.hh.cash + w.dirty - w.hh.debt;

/** Ocak: geçen yılın özeti ve niyet kartı */
export function yearCard(w: World): boolean {
  if (monthOf(w.m) !== 0 || w.flags['yd' + year(w.m)]) return false;
  w.flags['yd' + year(w.m)] = true;
  const y = year(w.m) - 1;
  const from = w.m - 12;
  const ev = w.chronicle.filter((e) => e.m >= from && e.m < w.m);
  const births = ev.filter((e) => e.k === 'dogum').length;
  const deaths = ev.filter((e) => e.k === 'olum').length;
  const weds = ev.filter((e) => e.k === 'evlilik').length;
  const prev = Number(w.flags.ydWorth ?? worth(w));
  const d = worth(w) - prev;
  w.flags.ydWorth = worth(w);
  const harvest = w.hh.parcels.reduce((a, f) => a + f.hist.filter((h) => h.m >= from).reduce((x, h) => x + (h.crop === 'hashas' ? 0 : h.v), 0), 0);
  const parts = [
    d >= 0 ? `Varlık ${fmt(d)} lira arttı` : `Varlık ${fmt(-d)} lira eridi`,
    harvest ? `tarlalardan ${fmt(harvest)} lira hasat` : '',
    births ? `${births} doğum` : '',
    weds ? `${weds} düğün` : '',
    deaths ? `${deaths} cenaze` : '',
  ].filter(Boolean);
  const first = !w.flags.ydIlk;
  w.flags.ydIlk = true;
  pushCard(w, {
    id: 'yil',
    text: `${first ? 'Yıl defteri: her Ocak geçen yılın hesabı tutulur ve bu yıl neye ağırlık verileceğine karar verilir. ' : ''}${y} yılı kapandı. ${parts.join(', ')}. Hanede ${hhMembers(w).length} kişi. ${year(w.m)} yılı için niyetin ne?`,
    opts: (Object.keys(NIYET) as Niyet[]).map((k) => ({ t: `${NIYET[k].ad}: ${NIYET[k].desc}`, k })),
  });
  return true;
}

export function resolveYear(w: World, id: string, k: string): boolean {
  if (id !== 'yil') return false;
  if (k in NIYET) {
    w.flags.niyet = k;
    w.flags.niyetY = year(w.m);
    log(w, `${year(w.m)} için niyet: ${NIYET[k as Niyet].ad}.`, 'miras');
  }
  return true;
}

/** Aylık niyet etkileri (diğerleri ilgili hesapların içinde) */
export function monthlyNiyet(w: World) {
  const n = niyet(w);
  if (n === 'aile') {
    for (const p of hhMembers(w)) {
      p.rel = clamp(p.rel + 0.8, -100, 100);
      p.hp = clamp(p.hp + 0.2, 0, 100);
    }
  } else if (n === 'yeralti') w.heat = clamp(w.heat - 0.5, 0, 100);
  else if (n === 'nam' && w.m % 3 === 0) w.flags.namBonus = Number(w.flags.namBonus || 0) + 1;
  void infl;
}
