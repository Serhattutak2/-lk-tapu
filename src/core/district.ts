// Çukurkent'in mahalleleri: her birinin sahibi, esnaf bağlılığı, polis varlığı ve yatırımları vardır.
import type { DInv, DistId, DistrictState, LedgerLine, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { infl, year } from './calendar';
import { log } from './people';
import { pushCard } from './cards';
import { has } from './era';

export interface DistDef { id: DistId; ad: string; base: number; from: number; desc: string; }
export const DISTS: Record<DistId, DistDef> = {
  liman: { id: 'liman', ad: 'Liman', base: 1400, from: 0, desc: 'Gemiler, konteynerler, gümrük. Mal buradan girer çıkar.' },
  carsi: { id: 'carsi', ad: 'Eski Çarşı', base: 1100, from: 0, desc: 'Kuyumcular, manifaturacılar, hanlar. Esnaf eski usul, sözüne bakar.' },
  sanayi: { id: 'sanayi', ad: 'Sanayi', base: 900, from: 0, desc: 'Tornacılar, oto tamirciler, depolar. Gece boş, gündüz kalabalık.' },
  gecekondu: { id: 'gecekondu', ad: 'Gecekondu', base: 600, from: 0, desc: 'Köyden göçenlerin mahallesi. Fakir ama kalabalık; adam bulmak kolay.' },
  yenisehir: { id: 'yenisehir', ad: 'Yenişehir', base: 1600, from: 1983, desc: 'Apartmanlar, bankalar, yeni zenginler. Polis de burada çok.' },
  kordon: { id: 'kordon', ad: 'Kordon', base: 2100, from: 1990, desc: 'Deniz kıyısı, oteller, gece hayatı. Çok para, çok göz.' },
};

export interface InvDef { id: DInv; ad: string; price: number; income: number; laund: number; loy: number; desc: string; }
export const INVS: Record<DInv, InvDef> = {
  kahvehane: { id: 'kahvehane', ad: 'Kıraathane', price: 15000, income: 250, laund: 2000, loy: 8, desc: 'Mahallenin kulağı. Esnafın bağlılığı artar.' },
  galeri: { id: 'galeri', ad: 'Oto galeri', price: 40000, income: 600, laund: 9000, loy: 2, desc: 'Arabalar, senetler, nakit. Aklamak için birebir.' },
  otel: { id: 'otel', ad: 'Otel', price: 90000, income: 1500, laund: 12000, loy: 4, desc: 'Turist, iş adamı, misafir. Düzenli ve temiz kazanç.' },
  pavyon: { id: 'pavyon', ad: 'Pavyon', price: 60000, income: 1300, laund: 15000, loy: -4, desc: 'Gece hayatının kalbi. Çok para ama polis ve rakip burada.' },
  site: { id: 'site', ad: 'Konut sitesi', price: 160000, income: 2600, laund: 20000, loy: 6, desc: 'Kat karşılığı yükselen bloklar. Kentsel dönüşüm yıllarında altın değerinde.' },
};

export function initDistricts(): DistrictState[] {
  const own: Record<DistId, DistrictState['o']> = { liman: 'cete', carsi: 'serbest', sanayi: 'serbest', gecekondu: 'serbest', yenisehir: 'serbest', kordon: 'cete' };
  return (Object.keys(DISTS) as DistId[]).map((id) => ({ id, o: own[id], loy: 30, pol: id === 'yenisehir' ? 55 : id === 'gecekondu' ? 15 : 30, inv: {} }));
}

export function syncTurf(w: World) {
  w.city.turf = w.city.dist.filter((d) => d.o === 'biz').length;
  if (w.crew && !w.crew.gone) w.crew.turf = w.city.dist.filter((d) => d.o === 'cete').length;
}

export const distOpen = (w: World, d: DistrictState) => year(w.m) >= DISTS[d.id].from;
export const invPrice = (w: World, i: DInv) => Math.round((INVS[i].price * infl(w.m)) / 1000) * 1000;

/** Bir mahalleyi almak için gereken adam */
export function menNeeded(w: World, d: DistrictState): number {
  return 4 + w.city.turf * 2 + Math.round(d.pol / 20) + (d.o === 'cete' && w.crew && !w.crew.gone ? Math.round(w.crew.men / 3) : 0);
}

export function distIncome(w: World, d: DistrictState): number {
  if (d.o !== 'biz') return 0;
  let v = DISTS[d.id].base * (0.5 + d.loy / 100);
  for (const i of Object.keys(d.inv) as DInv[]) v += INVS[i].income * (d.inv[i] || 0);
  return Math.round(v * infl(w.m));
}

export function distLaunder(w: World): number {
  let c = 0;
  for (const d of w.city.dist) if (d.o === 'biz') for (const i of Object.keys(d.inv) as DInv[]) c += INVS[i].laund * (d.inv[i] || 0);
  return Math.round(c * infl(w.m));
}

export function takeDistrict(w: World, id: DistId): { ok: boolean; msg: string } {
  const d = w.city.dist.find((x) => x.id === id)!;
  if (!w.city.moved) return { ok: false, msg: 'Şehirde yaşamadan mahalle tutulmaz.' };
  if (!distOpen(w, d)) return { ok: false, msg: `${DISTS[id].ad} ${DISTS[id].from}'den önce yok.` };
  if (d.o === 'biz') return { ok: false, msg: 'Zaten senin.' };
  const need = menNeeded(w, d);
  if (w.gang < need) return { ok: false, msg: `${DISTS[id].ad} için en az ${need} adam gerekir.` };
  const p = clamp(0.5 + (w.gang - need) * 0.05 + (has(w, 'cep') ? 0.08 : 0) - d.pol / 300, 0.15, 0.9);
  w.heat = clamp(w.heat + 8 + d.pol / 10, 0, 100);
  const c = w.crew;
  if (chance(w, p)) {
    const wasCrew = d.o === 'cete';
    d.o = 'biz';
    d.loy = 20;
    if (wasCrew && c && !c.gone) {
      c.feud = clamp(c.feud + 25, 0, 100);
      c.men = Math.max(0, c.men - rint(w, 1, 2));
    }
    syncTurf(w);
    log(w, `${DISTS[id].ad} artık senin adamlarının. ${wasCrew ? `${c?.name ?? 'Çete'} geri çekildi ama bunu unutmayacak.` : 'Esnaf yeni efendiye alışmaya çalışıyor.'}`, 'olay');
    return { ok: true, msg: `${DISTS[id].ad} senin.` };
  }
  w.gang = Math.max(0, w.gang - rint(w, 1, 2));
  if (c && !c.gone) c.feud = clamp(c.feud + 15, 0, 100);
  log(w, `${DISTS[id].ad}'i alma girişimi kanlı bitti; adamlarından bazıları dönmedi.`, 'olay');
  return { ok: false, msg: 'Girişim başarısız; adam kaybettin.' };
}

export function invest(w: World, id: DistId, i: DInv): { ok: boolean; msg: string } {
  const d = w.city.dist.find((x) => x.id === id)!;
  if (d.o !== 'biz') return { ok: false, msg: 'Önce mahalle senin olmalı.' };
  if ((d.inv[i] || 0) >= 2) return { ok: false, msg: 'Bu mahallede bundan yeterince var.' };
  if (i === 'site' && year(w.m) < 1985) return { ok: false, msg: 'Konut sitesi işi 1985\'ten sonra başlar.' };
  const p = invPrice(w, i);
  if (w.hh.cash < p) return { ok: false, msg: `Temiz parada ${(p - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= p;
  d.inv[i] = (d.inv[i] || 0) + 1;
  d.loy = clamp(d.loy + INVS[i].loy, 0, 100);
  log(w, `${DISTS[id].ad}'de ${INVS[i].ad.toLowerCase()} açıldı (${p.toLocaleString('tr-TR')} lira).`, 'tapu');
  return { ok: true, msg: `${INVS[i].ad} açıldı.` };
}

/** Aylık: mahalle gelirleri, bağlılık, polis, çetenin karşı hamleleri */
export function monthlyDistricts(w: World, lines: LedgerLine[]) {
  let v = 0;
  for (const d of w.city.dist) {
    if (d.o !== 'biz') continue;
    v += distIncome(w, d);
    d.loy = clamp(d.loy + (d.loy < 50 ? 0.3 : -0.05), 0, 100);
    d.pol = clamp(d.pol + (w.heat > 60 ? 0.4 : -0.2), 0, 100);
  }
  if (v) {
    w.dirty += v;
    w.heat = clamp(w.heat + 0.25 * w.city.turf, 0, 100);
    lines.push({ t: `${w.city.turf} mahalleden haraç ve kazanç (kara kasaya)`, v });
  }
}

/** Mahalle olayları: esnaf direnişi, karakol, kentsel dönüşüm, çete baskını */
export function districtCards(w: World): boolean {
  const mine = w.city.dist.filter((d) => d.o === 'biz');
  if (!mine.length) return false;
  const d = pick(w, mine);
  const ad = DISTS[d.id].ad;
  if (d.loy < 30 && chance(w, 0.02)) {
    pushCard(w, {
      id: 'mah_esnaf',
      data: { d: d.id },
      text: `${ad} esnafı haraca isyan etti. Dükkânlar kepenk kapattı, muhtar gazetecileri çağırdı. Mahalle sana bakıyor.`,
      opts: [{ t: 'Haracı düşür, esnafla barış', k: 'barış' }, { t: 'Gözdağı ver', k: 'gozdagi' }, { t: 'Mahalleden çekil', k: 'cekil' }],
    });
    return true;
  }
  if (d.pol < 70 && w.heat > 50 && chance(w, 0.015)) {
    d.pol = clamp(d.pol + 30, 0, 100);
    pushCard(w, { id: 'bilgi', text: `${ad}'e yeni bir polis karakolu açıldı. Devriyeler arttı; buradan kazanç azalacak, dikkat artacak.`, opts: [{ t: 'Anlaşıldı', k: 'ok' }] });
    return true;
  }
  if (year(w.m) >= 2005 && (d.id === 'gecekondu' || d.id === 'sanayi') && !w.flags['donusum' + d.id] && chance(w, 0.02)) {
    w.flags['donusum' + d.id] = true;
    const pay = Math.round(400000 * infl(w.m));
    pushCard(w, {
      id: 'donusum',
      data: { d: d.id, pay },
      text: `Kentsel dönüşüm: ${ad} yıkılıp yeniden yapılacak. Senin adamların mahallenin her kapısını tanıyor. Belediye ve büyük müteahhitler seninle masaya oturmak istiyor.`,
      opts: [
        { t: w.city.facs.insaat ? 'İhaleyi kendi inşaat şirketine al' : 'Ortak ol, payını al', k: 'al' },
        { t: 'Esnafı ve halkı koru, karşı çık', k: 'koru' },
      ],
    });
    return true;
  }
  return false;
}

export function resolveDistrict(w: World, id: string, k: string, data: Record<string, unknown> | undefined): boolean {
  if (id === 'mah_esnaf') {
    const d = w.city.dist.find((x) => x.id === data?.d);
    if (!d) return true;
    if (k === 'barış') {
      d.loy = clamp(d.loy + 30, 0, 100);
      log(w, `${DISTS[d.id].ad} esnafıyla barışıldı; haraç düştü, kepenkler açıldı.`, 'olay');
    } else if (k === 'gozdagi') {
      w.heat = clamp(w.heat + 12, 0, 100);
      if (chance(w, 0.6)) {
        d.loy = clamp(d.loy + 15, 0, 100);
        log(w, `${DISTS[d.id].ad}'de birkaç dükkânın camı indi. Ertesi gün herkes haracını ödedi.`, 'olay');
      } else {
        d.o = 'serbest';
        syncTurf(w);
        log(w, `${DISTS[d.id].ad}'de gözdağı ters tepti: mahalle ayaklandı ve adamlarını kovdu.`, 'olay');
      }
    } else {
      d.o = 'serbest';
      d.inv = {};
      syncTurf(w);
      log(w, `${DISTS[d.id].ad}'den çekilindi.`, 'olay');
    }
    return true;
  }
  if (id === 'donusum') {
    const d = w.city.dist.find((x) => x.id === data?.d);
    const pay = (data?.pay as number) || 0;
    if (k === 'al') {
      const v = Math.round(pay * (w.city.facs.insaat ? 1.6 : 0.8));
      w.hh.cash += v;
      if (d) d.loy = clamp(d.loy - 30, 0, 100);
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 6;
      log(w, `Kentsel dönüşüm: ${d ? DISTS[d.id].ad : 'mahalle'} yıkıldı, yerine bloklar yükseldi. Senin payın ${v.toLocaleString('tr-TR')} lira.`, 'para');
    } else {
      if (d) d.loy = clamp(d.loy + 40, 0, 100);
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 3;
      log(w, `Kentsel dönüşüme karşı çıkıldı. Mahalle halkı seni koruyucusu sayıyor.`, 'olay');
    }
    return true;
  }
  return false;
}
