// Yeraltı işletmeleri: tefecilik, kumar ve muhbir ağı. Hepsi yerel ve soyut; kara para getirir,
// jandarmanın dikkatini ve korkuyu oynatır. Seviyeler flags'te durur: tefeci, kumar (0-4), muhbir (0/1).
import type { LedgerLine, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log, P, alive, hhMembers, fullName } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';

const inWorld = (w: World) => !!w.flags.kacakci || w.gang > 0 || w.city.open;

export interface YerOp { id: string; ad: string; desc: string; max: number; cost: (w: World, lvl: number) => number; }
export const YEROPS: YerOp[] = [
  { id: 'tefeci', ad: 'Tefecilik', desc: 'Köyün ve esnafın sıkışanına faizle para verirsin. Her ay faiz döner; ödeyemeyen kapına düşer.', max: 4, cost: (w, l) => Math.round((4000 + l * 6000) * infl(w.m)) },
  { id: 'kumar', ad: 'Kumarhane', desc: 'Arka odada iskambil, tavla, zar. Kaybeden hep kasadır — yani sen. Para akar ama polis de kokuyu alır.', max: 4, cost: (w, l) => Math.round((5000 + l * 8000) * infl(w.m)) },
  { id: 'kacak', ad: 'Kaçak mal (sigara/içki)', desc: 'Gümrüksüz sigara, içki, çay... Kamyonlarla girer, mahalleye dağılır. İyi para, ama en çok dikkat çeken iş.', max: 4, cost: (w, l) => Math.round((6000 + l * 9000) * infl(w.m)) },
  { id: 'sahte', ad: 'Sahte evrak atölyesi', desc: 'Pasaport, ruhsat, tapu sureti, fatura... Hem başkasına satarsın hem kendi işini kolaylaştırırsın; jandarmanın gözünü boyarsın.', max: 2, cost: (w, l) => Math.round((11000 + l * 14000) * infl(w.m)) },
  { id: 'muhbir', ad: 'Muhbir ağı', desc: 'Karakolda, belediyede, kahvede kulakların olur. Baskın öncesi haber alır, dikkati hızlı söndürürsün. Aylık gider.', max: 1, cost: (w) => Math.round(9000 * infl(w.m)) },
];

export const yerLvl = (w: World, id: string) => Number(w.flags['yr_' + id] || 0);
export const yerAcik = (w: World) => inWorld(w);

export function buildYerOp(w: World, id: string): { ok: boolean; msg: string } {
  const d = YEROPS.find((x) => x.id === id);
  if (!d) return { ok: false, msg: 'Yok.' };
  if (!inWorld(w)) return { ok: false, msg: 'Önce yeraltında bir tanıdık edinmelisin.' };
  const lvl = yerLvl(w, id);
  if (lvl >= d.max) return { ok: false, msg: 'En üst seviyedesin.' };
  const c = d.cost(w, lvl);
  if (w.hh.cash < c && w.dirty < c) return { ok: false, msg: `${c.toLocaleString('tr-TR')} lira gerekiyor.` };
  // Önce kara para, sonra temiz
  if (w.dirty >= c) w.dirty -= c; else w.hh.cash -= c;
  w.flags['yr_' + id] = lvl + 1;
  const adlar: Record<string, string> = { tefeci: 'Tefecilik ağını', kumar: 'Kumarhaneyi', kacak: 'Kaçak mal ağını', sahte: 'Sahte evrak atölyesini', muhbir: 'Muhbir ağını' };
  log(w, `${adlar[id]} ${lvl === 0 ? 'kurdun' : 'büyüttün'} (seviye ${lvl + 1}).`, 'olay');
  return { ok: true, msg: `${d.ad} seviye ${lvl + 1}.` };
}

/** Aylık yeraltı geliri ve etkileri. */
export function monthlyYeralti(w: World, lines: LedgerLine[]) {
  const inf = infl(w.m);
  const city = w.city.moved || w.city.open ? 1.6 : 1;
  const tef = yerLvl(w, 'tefeci');
  if (tef > 0) {
    const v = Math.round(tef * 620 * inf * city);
    w.dirty += v;
    w.heat = clamp(w.heat + tef * 0.4, 0, 100);
    w.flags.korku = clamp(Number(w.flags.korku || 0) + tef * 0.2, 0, 100);
    lines.push({ t: `Tefecilik faizi (sv.${tef})`, v: 0 });
    void v;
  }
  const kum = yerLvl(w, 'kumar');
  if (kum > 0) {
    const v = Math.round(kum * 540 * inf * city * (0.75 + rint(w, 0, 10) / 20)); // kumarda şans oynar
    w.dirty += v;
    w.heat = clamp(w.heat + kum * 0.7, 0, 100);
    lines.push({ t: `Kumarhane kazancı (sv.${kum})`, v: 0 });
    void v;
  }
  const kac = yerLvl(w, 'kacak');
  if (kac > 0) {
    const v = Math.round(kac * 820 * inf * city);
    w.dirty += v;
    w.heat = clamp(w.heat + kac * 1.1, 0, 100);
    lines.push({ t: `Kaçak mal kazancı (sv.${kac})`, v: 0 });
    void v;
  }
  const sah = yerLvl(w, 'sahte');
  if (sah > 0) {
    const v = Math.round(sah * 500 * inf);
    w.dirty += v;
    w.heat = clamp(w.heat - sah * 0.9, 0, 100); // evrak işleri izi karartır
    lines.push({ t: `Sahte evrak atölyesi (sv.${sah})`, v: 0 });
    void v;
  }
  if (yerLvl(w, 'muhbir') > 0) {
    const gider = Math.round(900 * inf);
    w.hh.cash -= gider;
    w.heat = clamp(w.heat - 1.2, 0, 100);
    lines.push({ t: 'Muhbir ağı gideri', v: -gider });
  }
}

/** Tefecilikte ara ara: ödeyemeyen borçlu kartı. */
export function yeraltiCards(w: World): boolean {
  if (w.flags.interregnum || w.over) return false;
  const tef = yerLvl(w, 'tefeci');
  if (tef < 1) return false;
  if (!alive(P(w, w.playerId))) return false;
  if (Number(w.flags.tefeciNext || 0) > w.m) return false;
  if (!chance(w, 0.04 + tef * 0.01)) return false;
  w.flags.tefeciNext = w.m + rint(w, 6, 16);
  const borclu = pick(w, ['Köylü Memiş', 'Nalbur Kâzım', 'Bakkal Sülü', 'Celep Receb', 'Kiracı Dursun', 'Değirmenci Haşim']);
  const tutar = Math.round((2200 + tef * 1800) * infl(w.m));
  pushCard(w, {
    id: 'yer_borc',
    text: `${borclu} tefeci borcunu ödeyemedi (${tutar.toLocaleString('tr-TR')} lira). Kapına geldi, "biraz daha süre" diye yalvarıyor. Adamların ne yapacağına bakıyor.`,
    opts: [
      { t: 'Süre tanı, faizi biraz şişir', k: 'sure' },
      { t: 'Adamları yolla, neyi var neyi yok al', k: 'al' },
      { t: 'Helal olsun, borcu sil (köy seni konuşsun)', k: 'sil' },
    ],
    data: { tutar },
  });
  return true;
}

export function resolveYeralti(w: World, id: string, k: string, data: Record<string, unknown> | undefined): boolean {
  if (id !== 'yer_borc') return false;
  const tutar = (data?.tutar as number) || 0;
  if (k === 'sure') {
    w.dirty += Math.round(tutar * 0.15);
    log(w, `Borçluya süre tanıdın; faiz işledi, defterine biraz daha yazıldı.`, 'para');
  } else if (k === 'al') {
    w.dirty += Math.round(tutar * 0.8);
    w.heat = clamp(w.heat + 6, 0, 100);
    w.flags.korku = clamp(Number(w.flags.korku || 0) + 6, 0, 100);
    if (w.flags.saygi !== undefined) w.flags.saygi = clamp(Number(w.flags.saygi) - 4, 0, 100);
    log(w, `Adamların borçlunun evine girdi; eli boş dönmedi. Köy bir daha senin kapına borca gelmeye korkacak.`, 'olay');
  } else {
    w.flags.hayirPuan = Number(w.flags.hayirPuan || 0) + 2;
    if (w.flags.saygi !== undefined) w.flags.saygi = clamp(Number(w.flags.saygi) + 6, 0, 100);
    log(w, `Borcu sildin. "Kötü adam ama vicdanı var" dediler; köyde saygın arttı.`, 'olay');
  }
  return true;
}

export const yeraltiOzet = (w: World): string => {
  const parts: string[] = [];
  for (const d of YEROPS) { const l = yerLvl(w, d.id); if (l) parts.push(`${d.ad}${d.max > 1 ? ' sv.' + l : ''}`); }
  void hhMembers; void fullName;
  return parts.join(', ');
};
