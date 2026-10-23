// Kendi tarlalarımız: ekim, iş gücü, bakım, hasat.
// Değerler 1965 lirasıdır ve 5 dönümlük bir parsel içindir; infl() ile yıllara taşınır.
// Üretim soyut tutulur: oyuncu tarım tekniğini değil, iş gücünü, parayı ve riski yönetir.
import type { CropId, LedgerLine, Parcel, Person, World } from './types';
import { clamp, gauss } from './rng';
import { age, alive, fullName, hhMembers, log } from './people';
import { dateText, infl, monthOf, year } from './calendar';
import { JOBS, wage } from './jobs';
import { pushCard } from './cards';

export interface CropDef {
  id: CropId;
  ad: string;
  sow: number[];      // ekilebileceği aylar (0 = Ocak)
  grow: number;       // ekimden hasada ay
  need: number;       // yoğun aylarda gereken işçi
  seed: number;       // tohum ve gübre (1965 lirası)
  value: number;      // tam bakım ve normal yağışta hasat değeri (1965 lirası)
  rainSens: number;   // yağışa duyarlılık
  desc: string;
}

export const CROPS: Record<CropId, CropDef> = {
  bugday: { id: 'bugday', ad: 'Buğday', sow: [9, 10], grow: 9, need: 1, seed: 70, value: 1800, rainSens: 1, desc: 'Güzün ekilir, temmuzda biçilir. Az iş ister, ekmek parası çıkarır.' },
  arpa: { id: 'arpa', ad: 'Arpa', sow: [9, 10], grow: 8, need: 1, seed: 50, value: 1450, rainSens: 0.6, desc: 'Buğdaydan ucuz ama kuraklığa dayanıklı.' },
  nohut: { id: 'nohut', ad: 'Nohut', sow: [2, 3], grow: 5, need: 1, seed: 80, value: 1650, rainSens: 1.1, desc: 'Baharda ekilir, ağustosta toplanır. Kısa sürer.' },
  pancar: { id: 'pancar', ad: 'Şeker pancarı', sow: [3], grow: 6, need: 2, seed: 140, value: 3900, rainSens: 1.3, desc: 'Nisanda ekilir, ekimde fabrikaya gider. Çok iş ve su ister, iyi para eder.' },
  hashas: { id: 'hashas', ad: 'Haşhaş', sow: [9, 10], grow: 8, need: 2, seed: 60, value: 3300, rainSens: 1, desc: 'Ruhsatla ekilir, hasat devlete teslim edilir. Kara para da buradan çıkar.' },
};

/** Haşhaş: tam bakımda bir parselden çıkan çuval, devlet ve kaçak fiyatı (1965 lirası). */
export const HASHAS_SACKS = 12;
export const DEVLET_PRICE = 275;
export const KACAK_PRICE = 1050;
export const IRGAT_WAGE = 190;

export const BAN_FROM = 1972;
export const BAN_TO = 1974;
export const isBanYear = (y: number) => y >= BAN_FROM && y <= BAN_TO;

export const devletPrice = (w: World) => Math.round(DEVLET_PRICE * infl(w.m));
export const kacakPrice = (w: World) => Math.round(KACAK_PRICE * infl(w.m) * (isBanYear(year(w.m)) ? 1.5 : 1));
export const irgatWage = (w: World) => Math.round(IRGAT_WAGE * infl(w.m));
export const seedCost = (w: World, c: CropId) => Math.round(CROPS[c].seed * infl(w.m));

/** Parselin ekimden bu yana geçen ay sayısına göre durumu. */
export function stageOf(w: World, p: Parcel): number {
  if (!p.crop) return -1;
  return (w.m - p.sownM) / CROPS[p.crop].grow;
}

export const harvestMonth = (p: Parcel) => (p.crop ? p.sownM + CROPS[p.crop].grow : -1);

/** Bu ay parselin ne kadar iş gücü istediği. */
export function laborNeed(w: World, p: Parcel): number {
  if (!p.crop) return 0;
  const d = CROPS[p.crop];
  const k = w.m - p.sownM;
  if (k < 0 || k > d.grow) return 0;
  const mo = monthOf(w.m);
  if (mo === 11 || mo === 0 || mo === 1) return 0; // kış uykusu
  const heavy = k === 0 || k >= d.grow - 2;
  return heavy ? d.need : d.need * 0.4;
}

export function workersOf(w: World, p: Parcel): Person[] {
  return hhMembers(w).filter((q) => q.job === 'kendi' && q.parcel === p.id && !q.away);
}

export function workerPower(w: World, q: Person): number {
  const a = age(w, q);
  let e = 0.55 + (q.sk.tarim / 100) * 0.6;
  if (a < 14) e *= 0.5;
  else if (a > 60) e *= 0.6;
  if (q.sick) e *= 0.2;
  return e;
}

export function laborGot(w: World, p: Parcel): number {
  return workersOf(w, p).reduce((s, q) => s + workerPower(w, q), 0) + p.hired * 0.85;
}

export const careOf = (p: Parcel) => (p.careN ? p.careSum / p.careN : 1);

export function canSow(w: World, c: CropId): boolean {
  return CROPS[c].sow.includes(monthOf(w.m));
}

export function sowableNow(w: World): CropId[] {
  return (Object.keys(CROPS) as CropId[]).filter((c) => canSow(w, c));
}

export function hasRuhsat(w: World): boolean {
  return w.ruhsat === year(w.m) && !isBanYear(year(w.m));
}

/** Beklenen hasat değeri (bugünkü bakımla). */
export function expectedValue(w: World, p: Parcel): number {
  if (!p.crop) return 0;
  return Math.round(CROPS[p.crop].value * Math.pow(careOf(p), 1.2) * infl(w.m));
}

export function newParcel(w: World, price: number): Parcel {
  const no = w.hh.parcels.length + 1;
  const p: Parcel = { id: 'f' + w.nextId++, no, boughtM: w.m, price, crop: null, sownM: 0, illegal: false, hired: 0, careSum: 0, careN: 0, lastNeed: 0, lastGot: 0, hist: [] };
  w.hh.parcels.push(p);
  w.hh.land = w.hh.parcels.length * 5;
  return p;
}

// ---------- Oyuncu eylemleri ----------

export function sow(w: World, pid: string, c: CropId): string | null {
  const p = w.hh.parcels.find((x) => x.id === pid);
  if (!p) return 'Parsel bulunamadı.';
  if (p.crop) return 'Bu parselde zaten ekin var.';
  if (!canSow(w, c)) return `${CROPS[c].ad} bu ay ekilmez.`;
  const cost = seedCost(w, c);
  if (w.hh.cash < cost) return `Tohum için ${cost} lira gerekiyor.`;
  w.hh.cash -= cost;
  p.crop = c;
  p.sownM = w.m;
  p.careSum = 0;
  p.careN = 0;
  p.illegal = c === 'hashas' && !hasRuhsat(w);
  if (p.illegal) {
    w.heat = clamp(w.heat + 12, 0, 100);
    log(w, `${p.no}. parsele ruhsatsız haşhaş ekildi. Köyde bunu görenler oldu.`, 'olay');
  } else {
    log(w, `${p.no}. parsele ${CROPS[c].ad.toLowerCase()} ekildi (tohum ${cost} lira).`, 'is');
  }
  return null;
}

export function assignWorker(w: World, personId: string, parcelId: string | null): boolean {
  const q = w.people[personId];
  if (!alive(q) || !q.inHH || q.away) return false;
  if (parcelId === null) {
    if (q.job === 'kendi') {
      q.job = 'tarla';
      q.parcel = undefined;
    }
    return true;
  }
  if (!w.hh.parcels.some((x) => x.id === parcelId)) return false;
  if (age(w, q) < 10) return false;
  q.job = 'kendi';
  q.parcel = parcelId;
  return true;
}

export function setHired(w: World, parcelId: string, n: number): boolean {
  const p = w.hh.parcels.find((x) => x.id === parcelId);
  if (!p) return false;
  p.hired = clamp(Math.round(n), 0, 4);
  return true;
}

// ---------- Aylık işleyiş ----------

/** Kendi tarlası çalışanlarının bu ayki boş-ay gündeliği (parselde iş yoksa başkasının tarlasına giderler). */
export function idleWage(w: World, q: Person): number {
  const p = w.hh.parcels.find((x) => x.id === q.parcel);
  if (p && laborNeed(w, p) > 0) return 0;
  const saved = q.job;
  q.job = 'tarla';
  const v = Math.round(wage(w, q) * 0.7);
  q.job = saved;
  return v;
}

export function monthlyFields(w: World, lines: LedgerLine[]) {
  // Geçersiz atamaları temizle
  for (const q of Object.values(w.people)) {
    if (q.job === 'kendi' && !w.hh.parcels.some((x) => x.id === q.parcel)) {
      q.job = JOBS.tarla.id;
      q.parcel = undefined;
    }
  }
  for (const p of w.hh.parcels) {
    const need = laborNeed(w, p);
    const got = laborGot(w, p);
    p.lastNeed = need;
    p.lastGot = got;
    if (need > 0) {
      p.careSum += clamp(got / need, 0, 1);
      p.careN++;
      if (p.hired > 0) {
        const cost = p.hired * irgatWage(w);
        w.hh.cash -= cost;
        lines.push({ t: `${p.no}. parsel: ${p.hired} ırgat`, v: -cost });
      }
      for (const q of workersOf(w, p)) q.sk.tarim = clamp(q.sk.tarim + 0.6 * (0.55 + q.tr.zeka / 10) * (1 - q.sk.tarim / 110), 0, 100);
    }
    if (p.crop && w.m >= harvestMonth(p)) harvest(w, p, lines);
  }
}

function harvest(w: World, p: Parcel, lines: LedgerLine[]) {
  const c = p.crop!;
  const d = CROPS[c];
  const best = Math.max(0, ...workersOf(w, p).map((q) => q.sk.tarim));
  const rainF = 1 + (w.rain - 1) * d.rainSens;
  const mult = Math.pow(careOf(p), 1.2) * clamp(rainF, 0.3, 1.5) * (0.88 + best / 400) * clamp(gauss(w, 1, 0.08), 0.75, 1.25) * (w.flags.dolu === p.id ? 0.55 : 1);
  if (w.flags.dolu === p.id) w.flags.dolu = '';
  const weather = w.rain < 0.8 ? ', kurak yıl' : w.rain > 1.2 ? ', bereketli yıl' : '';
  if (c === 'hashas') {
    const sacks = Math.max(1, Math.round(HASHAS_SACKS * mult));
    const ill = p.illegal;
    p.crop = null;
    p.illegal = false;
    p.hist.unshift({ m: w.m, crop: c, v: sacks, t: `${sacks} çuval${ill ? ', ruhsatsız' : ''}` });
    p.hist.length = Math.min(p.hist.length, 8);
    hashasCard(w, p, sacks, ill);
    return;
  }
  const v = Math.round(d.value * mult * infl(w.m));
  w.hh.cash += v;
  lines.push({ t: `${p.no}. parsel: ${d.ad.toLowerCase()} hasadı`, v });
  p.hist.unshift({ m: w.m, crop: c, v, t: `${v.toLocaleString('tr-TR')} lira${weather}` });
  p.hist.length = Math.min(p.hist.length, 8);
  log(w, `${p.no}. parselin ${d.ad.toLowerCase()} hasadı ${v} liraya satıldı (bakım %${Math.round(careOf(p) * 100)}${weather}).`, 'para');
  p.crop = null;
}

function hashasCard(w: World, p: Parcel, sacks: number, illegal: boolean) {
  const dp = devletPrice(w);
  const kp = kacakPrice(w);
  const rza = !!w.flags.kacakci;
  const half = Math.ceil(sacks / 2);
  const opts: { t: string; k: string }[] = [];
  let text: string;
  if (!illegal) {
    text = `${p.no}. parselde haşhaş hasadı bitti: ${sacks} çuval. Devlet çuvalı ${dp} liradan alıyor, toplam ${(sacks * dp).toLocaleString('tr-TR')} lira.`;
    text += rza
      ? ` Kara Rıza ise çuval başına ${kp} lira veriyor. Beyanda eksik gösterirsen fark senin olur, ama jandarmanın gözü de üstüne çevrilir.`
      : ' Kayıt dışı alıcı tanımıyorsun; saklarsan bir gün işe yarayabilir.';
    opts.push({ t: `Hepsini devlete teslim et (${(sacks * dp).toLocaleString('tr-TR')} lira)`, k: 'devlet' });
    if (rza) opts.push({ t: `Yarısını Kara Rıza'ya sat (${half} çuval)`, k: 'yari_kacak' });
    opts.push({ t: `Yarısını zulaya sakla (${half} çuval)`, k: 'yari_zula' });
    if (rza) opts.push({ t: `Hepsini Kara Rıza'ya sat, devlete kötü hasat de`, k: 'hepsi_kacak' });
  } else {
    text = `Ruhsatsız ektiğin haşhaştan ${sacks} çuval çıktı. Devlete teslim edemezsin; elde tutmak da tehlikeli.`;
    if (rza) opts.push({ t: `Kara Rıza'ya sat (${(sacks * kp).toLocaleString('tr-TR')} lira)`, k: 'hepsi_kacak' });
    opts.push({ t: 'Zulaya sakla', k: 'hepsi_zula' });
    opts.push({ t: 'Yak, iz kalmasın', k: 'yak' });
  }
  pushCard(w, { id: 'hashas_hasat', text, opts, data: { sacks, parcel: p.no, illegal } });
}

export function resolveHashas(w: World, sacks: number, no: number, k: string) {
  const dp = devletPrice(w);
  const kp = kacakPrice(w);
  const half = Math.ceil(sacks / 2);
  let gov = 0;
  let black = 0;
  let stash = 0;
  if (k === 'devlet') gov = sacks;
  else if (k === 'yari_kacak') { gov = sacks - half; black = half; }
  else if (k === 'yari_zula') { gov = sacks - half; stash = half; }
  else if (k === 'hepsi_kacak') black = sacks;
  else if (k === 'hepsi_zula') stash = sacks;
  const money = gov * dp + black * kp;
  w.hh.cash += money;
  w.hh.stash += stash;
  w.heat = clamp(w.heat + black * 1.6 + stash * 0.9 + (k === 'hepsi_kacak' && gov === 0 ? 8 : 0), 0, 100);
  w.flags.kacakToplam = ((w.flags.kacakToplam as number) || 0) + black;
  const parts: string[] = [];
  if (gov) parts.push(`${gov} çuval devlete (${(gov * dp).toLocaleString('tr-TR')} lira)`);
  if (black) parts.push(`${black} çuval Kara Rıza'ya (${(black * kp).toLocaleString('tr-TR')} lira)`);
  if (stash) parts.push(`${stash} çuval zulaya`);
  if (k === 'yak') parts.push(`${sacks} çuval gece yakıldı`);
  log(w, `${no}. parselin haşhaşı: ${parts.join(', ')}.`, black || stash ? 'olay' : 'para');
}

export function sellStash(w: World): number {
  if (!w.flags.kacakci || w.hh.stash <= 0) return 0;
  const n = w.hh.stash;
  const v = n * kacakPrice(w);
  w.hh.cash += v;
  w.hh.stash = 0;
  w.heat = clamp(w.heat + n * 1.2, 0, 100);
  w.flags.kacakToplam = ((w.flags.kacakToplam as number) || 0) + n;
  log(w, `Zuladaki ${n} çuval Kara Rıza'ya ${v} liraya satıldı.`, 'olay');
  return v;
}

export function fieldSummary(w: World, p: Parcel): string {
  if (!p.crop) return 'Boş';
  const h = harvestMonth(p);
  return `${CROPS[p.crop].ad}${p.illegal ? ' (ruhsatsız)' : ''}, hasat ${dateText(h)}`;
}

export function personFieldLabel(w: World, q: Person): string {
  const p = w.hh.parcels.find((x) => x.id === q.parcel);
  return p ? `${p.no}. parselde` : 'Kendi tarlamızda';
}

export { fullName };
