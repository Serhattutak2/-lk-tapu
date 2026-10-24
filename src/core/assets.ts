// Mülk ve güç: ev, taşıtlar, köy işletmeleri, toprak alımı, nam (itibar) ve unvan.
import { niyetIs } from './yil';
import type { BizId, LedgerLine, Person, VehicleId, World } from './types';
import { chance, clamp } from './rng';
import { age, alive, fullName, hhMembers, log } from './people';
import { infl, monthOf, year } from './calendar';
import { newParcel } from './fields';
import { offerChance, offerPrice, plotOwnerName, PLOTS, plotPrice } from './plots';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

// ---------- Ev ----------
export interface HouseDef { lvl: number; ad: string; price: number; nam: number; desc: string; }
export const HOUSES: HouseDef[] = [
  { lvl: 0, ad: 'Ağanın kira evi', price: 0, nam: 0, desc: 'Tek göz, toprak damlı. Her ay ağaya kira.' },
  { lvl: 1, ad: 'Kendi kerpiç evimiz', price: 9000, nam: 6, desc: 'Kira biter. Kapının önünde kimseye hesap vermezsin.' },
  { lvl: 2, ad: 'İki katlı taş ev', price: 29000, nam: 16, desc: 'Sobalı, camlı. Kışın hastalık azalır, köyde sözün dinlenir.' },
  { lvl: 3, ad: 'Konak', price: 98000, nam: 40, desc: 'Avlulu, misafir odalı. Ağanın konağından büyük.' },
];
export const housePrice = (w: World, lvl: number) => Math.round((HOUSES[lvl].price * infl(w.m)) / 100) * 100;

// ---------- Taşıtlar ----------
export interface VehicleDef { id: VehicleId; ad: string; price: number; from: number; nam: number; upkeep: number; desc: string; }
export const VEHICLES: Record<VehicleId, VehicleDef> = {
  esek: { id: 'esek', ad: 'Eşek', price: 320, from: 1925, nam: 1, upkeep: 8, desc: 'Tarlaya yük taşır. Parsellerde iş gücüne +0,3.' },
  araba: { id: 'araba', ad: 'At arabası', price: 1900, from: 1925, nam: 3, upkeep: 25, desc: 'Ürünü ilçe pazarına sen götürürsün: bütün hasat satışları %6 daha fazla.' },
  traktor: { id: 'traktor', ad: 'Traktör', price: 33000, from: 1967, nam: 12, upkeep: 0, desc: 'Her traktör 2,5 işçi gücü verir; işçisi eksik parsellere kendiliğinden gider. Çalıştığı ay mazot yakar.' },
  otomobil: { id: 'otomobil', ad: 'Otomobil', price: 43000, from: 1967, nam: 15, upkeep: 120, desc: 'Hastayı doktora vaktinde yetiştirir; ağır hastalıkta ölüm riski düşer. Köy herkes kimin geldiğini bilir.' },
  kamyon: { id: 'kamyon', ad: 'Kamyon', price: 66000, from: 1970, nam: 10, upkeep: 180, desc: 'Bir aile üyesi şoför olursa nakliyeden aylık kazanç. Kara Rıza\'nın malı da kasada gider: kaçak fiyat %20 artar.' },
};
export const vehiclePrice = (w: World, v: VehicleId) => Math.round((VEHICLES[v].price * infl(w.m)) / 10) * 10;
export const TRACTOR_POWER = 2.5;
export const tractorFuel = (w: World) => Math.round(140 * infl(w.m));

// ---------- İşletmeler ----------
export interface BizDef { id: BizId; ad: string; price: number; income: number; from: number; namReq: number; nam: number; desc: string; }
export const BIZ: Record<BizId, BizDef> = {
  bakkal: { id: 'bakkal', ad: 'Köy bakkalı', price: 12000, income: 300, from: 1925, namReq: 0, nam: 6, desc: 'Yaşlı Bakkal Nuri dükkânı devretmek istiyor. Başına aileden biri geçerse tam kazanç; geçmezse çırağı yarısını çalar.' },
  kahve: { id: 'kahve', ad: 'Kahvehane', price: 18500, income: 360, from: 1928, namReq: 10, nam: 8, desc: 'Köyün bütün sözü burada döner. Sahibi her şeyi duyar: Kara Rıza ile tanışmak kolaylaşır, ihbarlar önceden kulağına gelir.' },
  degirmen: { id: 'degirmen', ad: 'Değirmen', price: 42000, income: 520, from: 1935, namReq: 30, nam: 18, desc: 'Derenin üstündeki su değirmeni: köyün bütün buğdayı burada öğütülür. Temmuz–Ekim arası kazanç iki katına çıkar.' },
};
export const bizPrice = (w: World, b: BizId) => Math.round((BIZ[b].price * infl(w.m)) / 100) * 100;

export function bizManager(w: World, b: BizId): Person | undefined {
  return hhMembers(w).find((p) => p.job === 'isletme' && p.biz === b && !p.away);
}

export function bizIncome(w: World, b: BizId): number {
  const d = BIZ[b];
  const mgr = bizManager(w, b);
  let f = mgr ? 0.7 + (mgr.sk.ticaret / 100) * 0.6 : 0.45;
  const mo = monthOf(w.m);
  if (b === 'degirmen' && mo >= 6 && mo <= 9) f *= 2;
  if (b === 'bakkal' && mo === 11) f *= 0.8;
  return Math.round(d.income * f * infl(w.m) * (niyetIs(w, 'ticaret') ? 1.12 : 1) * (Number(w.flags.salgin || 0) > w.m ? 0.7 : 1));
}

// ---------- Nam ve unvan ----------
export function nam(w: World): number {
  let n = w.hh.parcels.length * 4;
  n += HOUSES[w.hh.house].nam;
  for (const v of Object.keys(VEHICLES) as VehicleId[]) n += (w.hh.veh[v] || 0) * VEHICLES[v].nam;
  for (const b of Object.keys(BIZ) as BizId[]) if (w.hh.biz[b]) n += BIZ[b].nam;
  n += Math.min(20, w.hh.cash / infl(w.m) / 2500);
  if (w.hh.debt > 0) n -= Math.min(10, w.hh.debt / infl(w.m) / 300);
  n += Number(w.flags.namBonus || 0);
  return Math.max(0, Math.round(n));
}

export const TITLES: { min: number; ad: string }[] = [
  { min: 0, ad: 'Gündelikçi ailesi' },
  { min: 6, ad: 'Toprak sahibi' },
  { min: 18, ad: 'Hali vakti yerinde' },
  { min: 35, ad: 'Köyün ileri geleni' },
  { min: 60, ad: 'Eşraftan' },
  { min: 90, ad: 'Ağa' },
];
export function title(w: World): { ad: string; next?: { ad: string; min: number } } {
  const n = nam(w);
  let i = 0;
  while (i + 1 < TITLES.length && n >= TITLES[i + 1].min) i++;
  return { ad: w.hh.parcels.length === 0 && i > 0 ? 'Topraksız ama varlıklı' : TITLES[i].ad, next: TITLES[i + 1] };
}

// ---------- Eylemler ----------

export function landBlockers(w: World): string[] {
  const out: string[] = [];
  if (w.hh.debt > 0) out.push('Ağaya borcun varken kimse sana toprak satmaz; önce borç kapanmalı.');
  if (((w.flags.agaKin as number) || 0) >= year(w.m) && w.pol?.seat !== 'muhtar') out.push(`Ağa köyde "o aileye toprak satmayın" dedi; ${w.flags.agaKin} yılına kadar kimse satmaya cesaret edemez.`);
  return out;
}

export function buyPlot(w: World, i: number): { ok: boolean; msg: string } {
  const s = w.plots[i];
  const d = PLOTS[i];
  if (!s || s.o === 'biz') return { ok: false, msg: 'Bu tarla zaten senin.' };
  const blk = landBlockers(w);
  if (blk.length) return { ok: false, msg: blk[0] };
  const price = offerPrice(w, i);
  if (w.hh.cash < price) return { ok: false, msg: `Bu tarla için ${fmt(price - w.hh.cash)} lira eksik.` };
  const p = offerChance(w, i, nam(w));
  if (p <= 0) return { ok: false, msg: s.o === 'aga' ? ((s.madM ?? 0) > w.m ? 'Ağa geçen teklifini daha unutmadı; biraz bekle.' : 'Ağa sana toprak satmaz. Önce köyde adın büyümeli (nam 35).') : `${plotOwnerName(w, i)} şimdilik seninle konuşmuyor; birkaç ay sonra yeniden dene.` };
  const owner = plotOwnerName(w, i);
  if (!chance(w, p)) {
    s.madM = w.m + (s.o === 'aga' ? 6 : 3);
    log(w, `${owner}, ${d.yer} mevkiindeki tarlası için yapılan ${fmt(price)} liralık teklifi geri çevirdi.`, 'tapu');
    return { ok: false, msg: `${owner} teklifi geri çevirdi. ${s.o === 'aga' ? 'Altı' : 'Üç'} ay sonra yeniden sorabilirsin.` };
  }
  w.hh.cash -= price;
  const first = w.hh.parcels.length === 0;
  const par = newParcel(w, price);
  s.o = 'biz';
  s.pid = par.id;
  s.sale = false;
  if (first) {
    w.flags.ilkTapu = w.m;
    log(w, `İLK TAPU: ${w.surname} ailesi ${d.yer} mevkiinde 5 dönüm tarla aldı (satan: ${owner}, ${fmt(price)} lira). Ailenin ilk kendi toprağı.`, 'tapu');
  } else {
    log(w, `${d.yer} mevkiinde 5 dönüm tarla alındı (satan: ${owner}, ${fmt(price)} lira). Toplam ${w.hh.land} dönüm.`, 'tapu');
  }
  if (s.o === 'biz' && d.aga) log(w, `Bozbey Ağa ilk kez kendi toprağından bir parçayı ${w.surname} ailesine sattı. Köyde dengeler değişiyor.`, 'olay');
  return { ok: true, msg: first ? 'ilk' : 'Tapu senin.' };
}

export function buyHouse(w: World): { ok: boolean; msg: string } {
  const next = w.hh.house + 1;
  if (next >= HOUSES.length) return { ok: false, msg: 'Daha büyük ev yok.' };
  const price = housePrice(w, next);
  if (w.hh.cash < price) return { ok: false, msg: `${fmt(price - w.hh.cash)} lira eksik.` };
  w.hh.cash -= price;
  w.hh.house = next;
  if (next === 1) w.hh.rent = 0;
  log(w, `${HOUSES[next].ad}: ${fmt(price)} liraya ${next === 1 ? 'alındı. Ağaya kira bitti' : 'yapıldı'}.`, 'tapu');
  return { ok: true, msg: `${HOUSES[next].ad} senin.` };
}

export function buyVehicle(w: World, v: VehicleId): { ok: boolean; msg: string } {
  const d = VEHICLES[v];
  if (year(w.m) < d.from) return { ok: false, msg: `${d.ad} köye ancak ${d.from}'de gelir.` };
  const price = vehiclePrice(w, v);
  if (w.hh.cash < price) return { ok: false, msg: `${fmt(price - w.hh.cash)} lira eksik.` };
  w.hh.cash -= price;
  w.hh.veh[v] = (w.hh.veh[v] || 0) + 1;
  log(w, `${d.ad} alındı: ${fmt(price)} lira.${v === 'traktor' && (w.hh.veh.traktor || 0) === 1 ? ' Köyün ikinci traktörü artık bizim avluda.' : ''}`, 'tapu');
  return { ok: true, msg: `${d.ad} alındı.` };
}

export function sellVehicle(w: World, v: VehicleId): number {
  const have = w.hh.veh[v] || 0;
  if (have <= 0) return 0;
  const val = Math.round(vehiclePrice(w, v) * 0.55);
  w.hh.veh[v] = have - 1;
  w.hh.cash += val;
  log(w, `${VEHICLES[v].ad} ${fmt(val)} liraya satıldı.`, 'para');
  return val;
}

export function bizAvailable(w: World, b: BizId): string | null {
  const d = BIZ[b];
  if (w.hh.biz[b]) return 'Zaten senin.';
  if (year(w.m) < d.from) return `${d.from}'den önce satılmaz.`;
  if (nam(w) < d.namReq) return `Sahibi bu işi ancak adı sayılan birine devreder (nam ${d.namReq}).`;
  return null;
}

export function buyBiz(w: World, b: BizId): { ok: boolean; msg: string } {
  const why = bizAvailable(w, b);
  if (why) return { ok: false, msg: why };
  const price = bizPrice(w, b);
  if (w.hh.cash < price) return { ok: false, msg: `${fmt(price - w.hh.cash)} lira eksik.` };
  w.hh.cash -= price;
  w.hh.biz[b] = w.m + 1;
  log(w, `${BIZ[b].ad} ${fmt(price)} liraya devralındı.`, 'tapu');
  return { ok: true, msg: `${BIZ[b].ad} artık senin.` };
}

export function setManager(w: World, b: BizId, pid: string | null): boolean {
  const old = bizManager(w, b);
  if (old) {
    old.job = 'tarla';
    old.biz = undefined;
  }
  if (!pid) return true;
  const p = w.people[pid];
  if (!alive(p) || !p.inHH || p.away || age(w, p) < 16) return false;
  p.job = 'isletme';
  p.biz = b;
  p.parcel = undefined;
  return true;
}

/** Aylık: taşıt giderleri, işletme kazançları, kamyon nakliyesi. */
export function monthlyAssets(w: World, lines: LedgerLine[]) {
  for (const v of Object.keys(VEHICLES) as VehicleId[]) {
    const n = w.hh.veh[v] || 0;
    if (!n || !VEHICLES[v].upkeep) continue;
    const c = Math.round(VEHICLES[v].upkeep * n * infl(w.m));
    w.hh.cash -= c;
    lines.push({ t: `${VEHICLES[v].ad}${n > 1 ? ` (${n})` : ''}: bakım ve yem/benzin`, v: -c });
  }
  for (const b of Object.keys(BIZ) as BizId[]) {
    if (!w.hh.biz[b]) continue;
    const v = bizIncome(w, b);
    w.hh.cash += v;
    const mgr = bizManager(w, b);
    lines.push({ t: `${BIZ[b].ad}${mgr ? ` (${mgr.first} başında)` : ' (başında kimse yok)'}`, v });
    if (mgr) mgr.sk.ticaret = clamp(mgr.sk.ticaret + 0.5 * (0.55 + mgr.tr.zeka / 10) * (1 - mgr.sk.ticaret / 110), 0, 100);
  }
  // Ev: taş ev ve konak kışın sağlığı korur
  if (w.hh.house >= 2 && (monthOf(w.m) === 0 || monthOf(w.m) === 11)) {
    for (const p of hhMembers(w)) p.hp = clamp(p.hp + 0.8, 0, 100);
  }
  // Kahvehane sahibine kulak: Isı yükselince uyarı
  if (w.hh.biz.kahve && w.heat >= 40 && !w.flags.kahveUyari) {
    w.flags.kahveUyari = true;
    log(w, `Kahvehanede jandarmanın senin adını sorduğu konuşuluyor.`, 'olay');
  }
  if (w.heat < 30) w.flags.kahveUyari = false;
}

export function sofor(w: World): Person | undefined {
  return hhMembers(w).find((p) => p.job === 'sofor' && !p.away);
}

export { fullName };
