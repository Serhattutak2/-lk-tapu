// Lakap: oyuncunun oynayış tarzına göre köyün ona taktığı ad.
// Hiçbir yeni veri tutmaz; her şey mevcut dünya durumundan okunur.
// Kaçakçılık yapmadıysan "Kaçakçı" denmez; kan dökmediysen "Kanlı" denmez.
import type { World } from './types';
import { P, age } from './people';
import { nam } from './assets';
import { korku, saygi } from './guc';

const kills = (w: World) => (w.flags.yokEdilen ? String(w.flags.yokEdilen).split(',').filter(Boolean).length : 0);

interface Rule { ep: string; when: (w: World) => boolean; }

// Üstten alta öncelik: en güçlü/karakteristik olan kazanır. Hepsi bir ada ön ek olarak okunur.
const RULES: Rule[] = [
  { ep: 'Koca', when: (w) => w.flags.konsey === 'baba' },
  { ep: 'Deli', when: (w) => kills(w) >= 3 && korku(w) > saygi(w) + 18 },
  { ep: 'Kanlı', when: (w) => kills(w) >= 1 && korku(w) >= saygi(w) },
  { ep: 'Patron', when: (w) => w.city.net },
  { ep: 'Üstat', when: (w) => (w.lab?.lvl || 0) >= 2 },
  { ep: 'Kaçakçı', when: (w) => !!w.flags.kacakci && (w.lab?.lvl || 0) >= 1 },
  { ep: 'Zehir', when: (w) => !!w.flags.kacakci && korku(w) > saygi(w) },
  { ep: 'Reis', when: (w) => w.pol.seat === 'vekil' || w.pol.seat === 'belediye' },
  { ep: 'Kaçakçı', when: (w) => !!w.flags.kacakci },
  { ep: 'Kabadayı', when: (w) => w.gang >= 6 || (w.gang >= 3 && korku(w) > saygi(w)) },
  { ep: 'Hacı', when: (w) => Number(w.flags.hayirPuan || 0) >= 8 && saygi(w) >= korku(w) },
  { ep: 'Ağa', when: (w) => nam(w) >= 90 && w.hh.parcels.length >= 6 },
  { ep: 'Toprak', when: (w) => w.hh.parcels.length >= 10 },
  { ep: 'Eşraf', when: (w) => saygi(w) >= 50 && saygi(w) > korku(w) },
  { ep: 'Çiftçi', when: (w) => w.hh.parcels.length >= 3 },
  { ep: 'Varlıklı', when: (w) => nam(w) >= 35 },
];

/** Oyuncunun o anki lakabı (yalnızca ön ek sözcük). */
export function epithet(w: World): string {
  for (const r of RULES) if (r.when(w)) return r.ep;
  const pl = P(w, w.playerId);
  if (pl && age(w, pl) <= 22) return 'Delikanlı';
  return 'Çaylak';
}

/** Lakaplı tam ad: "Deli Mehmet" gibi. */
export function lakapName(w: World): string {
  const pl = P(w, w.playerId);
  if (!pl) return epithet(w);
  return `${epithet(w)} ${pl.first}`;
}

/** Ailenin aşiret/sülale adı. Açılışta seçilir; yoksa soyadından türetilir. */
export function asiret(w: World): string {
  const a = String(w.flags.asiret || '').trim();
  if (a) return a;
  const s = (w.surname || 'Ocak').trim();
  const son = s.slice(-1).toLowerCase();
  const back = 'aıouâ'.includes(son) || /[aıou]/.test(s.slice(-2, -1));
  return s + (back ? 'lar' : 'ler');
}
