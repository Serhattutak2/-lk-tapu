// Gizli atölye: haşhaştan çıkan ham malı paket ve hapa çeviren SOYUT üretim zinciri.
// Oyun yalnızca kapasite, kalite, para, dikkat ve risk yönetir. Gerçek kimya, malzeme ya da yöntem YOKTUR.
import type { LabSite, LabState, LedgerLine, Person, World } from './types';
import { chance, clamp, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { infl, year } from './calendar';
import { pushCard } from './cards';
import { die } from './life';
import { canPay, netBonus, payDirtyFirst } from './baron';
import { hasEngineer } from './events';

export interface LabLevel { lvl: number; ad: string; price: number; cap: number; from: number; desc: string; }
export const LAB_LEVELS: LabLevel[] = [
  { lvl: 0, ad: '', price: 0, cap: 0, from: 0, desc: '' },
  { lvl: 1, ad: 'Atölye', price: 9000, cap: 3, from: 1969, desc: 'Bir masa, birkaç kazan. Ayda 3 çuval ham malı pakete çevirir.' },
  { lvl: 2, ad: 'Laboratuvar', price: 36000, cap: 8, from: 1972, desc: 'Düzgün ekipman, havalandırma. Ayda 8 çuval; kaza riski düşer.' },
  { lvl: 3, ad: 'Hap imalathanesi', price: 110000, cap: 14, from: 1977, desc: 'Ham mal artık hap olarak çıkar: kolisi paketin iki katı eder. Ama böyle bir işin kokusu uzağa gider.' },
];

export const SITES: Record<LabSite, { ad: string; heat: number; find: number; need: string }> = {
  bodrum: { ad: 'Evin gizli bodrumu', heat: 1.3, find: 1.0, need: 'Evde gizli bodrum olmalı.' },
  degirmen: { ad: 'Değirmenin arkası', heat: 0.85, find: 0.7, need: 'Değirmen senin olmalı.' },
  agil: { ad: 'Dağdaki ağıl', heat: 0.6, find: 0.45, need: 'Dağdaki ağılı satın almalısın.' },
};

export const AGIL_PRICE = 7500;
export const PAKET_PRICE = 3000;
export const HAP_PRICE = 6400;
export const HAM_PRICE = 1400;
export const CEVDET_PAY = 1100;

/** Şebeke, ortaklık ve nakliye şirketi satış fiyatını artırır. */
export const routeBonus = (w: World) => netBonus(w) * (w.city?.facs?.nakliye ? 1.15 : 1);

export const paketPrice = (w: World) => Math.round(PAKET_PRICE * infl(w.m));
export const hapPrice = (w: World) => Math.round(HAP_PRICE * infl(w.m));
export const hamPrice = (w: World) => Math.round(HAM_PRICE * infl(w.m));
export const cevdetPay = (w: World) => Math.round(CEVDET_PAY * infl(w.m));
export const labPrice = (w: World, lvl: number) => Math.round((LAB_LEVELS[lvl].price * infl(w.m)) / 100) * 100;

export function siteOk(w: World, s: LabSite): boolean {
  if (s === 'bodrum') return !!w.hh.rooms.bodrum;
  if (s === 'degirmen') return !!w.hh.biz.degirmen;
  return !!w.hh.agil;
}

export function labWorkers(w: World): Person[] {
  return hhMembers(w).filter((p) => p.job === 'lab' && !p.away);
}

/** Atölyenin bu ayki ustalığı: kimyager ya da çalışan aile üyelerinin zanaatı. */
export function labSkill(w: World): number {
  const lab = w.lab;
  if (!lab) return 0;
  const fam = labWorkers(w).reduce((m, p) => Math.max(m, p.sk.zanaat), 0);
  return Math.max(fam, lab.chem === 'cevdet' ? 72 : 0);
}

export function labCapacity(w: World): number {
  const lab = w.lab;
  if (!lab) return 0;
  const hands = labWorkers(w).length + (lab.chem ? 1 : 0);
  if (!hands) return 0;
  return Math.round(LAB_LEVELS[lab.lvl].cap * Math.min(1, 0.5 + hands * 0.25)) + (w.tech?.elektrik ? 1 : 0);
}

export function unlocked(w: World): string | null {
  if (!w.flags.kacakci) return 'Önce Kara Rıza ile tanışmalısın.';
  if (year(w.m) < LAB_LEVELS[1].from) return `${LAB_LEVELS[1].from}'den önce böyle bir iş kurulmaz.`;
  if (!w.flags.cevdetTanis) return 'Rıza, işi bilen biriyle tanıştırmadan atölye kurulmaz.';
  return null;
}

export function buildLab(w: World, site: LabSite): { ok: boolean; msg: string } {
  const why = unlocked(w);
  if (why) return { ok: false, msg: why };
  if (!siteOk(w, site)) return { ok: false, msg: SITES[site].need };
  const next = (w.lab?.lvl || 0) + 1;
  if (next > 3) return { ok: false, msg: 'Daha büyüğü yok.' };
  const L = LAB_LEVELS[next];
  if (year(w.m) < L.from) return { ok: false, msg: `${L.ad} ancak ${L.from}'den sonra kurulabilir.` };
  const price = labPrice(w, next);
  if (!canPay(w, price)) return { ok: false, msg: `${(price - w.hh.cash - w.dirty).toLocaleString('tr-TR')} lira eksik.` };
  payDirtyFirst(w, price);
  if (!w.lab) w.lab = { lvl: 1, site, raw: 0, prod: 0, hap: 0, chem: null, q: 0.5, made: 0 };
  else {
    w.lab.lvl = next;
    w.lab.site = site;
  }
  w.heat = clamp(w.heat + 6, 0, 100);
  log(w, `${SITES[site].ad}: ${L.ad} kuruldu (${price.toLocaleString('tr-TR')} lira). Bunu aileden kimin bildiğine dikkat et.`, 'olay');
  return { ok: true, msg: `${L.ad} kuruldu.` };
}

export function buyAgil(w: World): { ok: boolean; msg: string } {
  if (w.hh.agil) return { ok: false, msg: 'Ağıl zaten senin.' };
  const p = Math.round(AGIL_PRICE * infl(w.m));
  if (w.hh.cash < p) return { ok: false, msg: `${(p - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= p;
  w.hh.agil = true;
  log(w, `Dağ yolundaki eski ağıl ${p.toLocaleString('tr-TR')} liraya alındı. Köyden görünmüyor.`, 'tapu');
  return { ok: true, msg: 'Ağıl senin.' };
}

export function hireCevdet(w: World, on: boolean) {
  if (!w.lab) return;
  w.lab.chem = on ? 'cevdet' : null;
  log(w, on ? `İstanbullu Kimyager Cevdet atölyenin başına geçti. Az konuşur, çok para ister.` : `Kimyager Cevdet'in işine son verildi. Giderken her şeyi gördüğünü unutma.`, 'olay');
  if (!on) w.flags.cevdetKizgin = year(w.m) + 2;
}

export function buyRaw(w: World, n: number): { ok: boolean; msg: string } {
  if (!w.lab) return { ok: false, msg: 'Atölye yok.' };
  const cost = n * hamPrice(w);
  if (!canPay(w, cost)) return { ok: false, msg: 'Para yetmiyor.' };
  payDirtyFirst(w, cost);
  w.lab.raw += n;
  w.heat = clamp(w.heat + n * 0.4, 0, 100);
  return { ok: true, msg: `Rıza'dan ${n} çuval ham mal geldi.` };
}

export function moveStash(w: World): number {
  if (!w.lab || w.hh.stash <= 0) return 0;
  const n = w.hh.stash;
  w.lab.raw += n;
  w.hh.stash = 0;
  return n;
}

export function sellProduct(w: World): number {
  const lab = w.lab;
  if (!lab || (!lab.prod && !lab.hap)) return 0;
  const qf = 0.7 + lab.q * 0.6;
  const v = Math.round((lab.prod * paketPrice(w) + lab.hap * hapPrice(w)) * qf * routeBonus(w) * (w.flags.odul_usta ? 1.12 : 1));
  w.heat = clamp(w.heat + lab.prod * 2.2 + lab.hap * 3, 0, 100);
  w.dirty += v;
  w.flags.labKazanc = Number(w.flags.labKazanc || 0) + v;
  log(w, `${w.city.net ? 'Şebekenin dağıtıcıları' : "Kara Rıza'nın adamları"} ${lab.prod ? `${lab.prod} paket` : ''}${lab.prod && lab.hap ? ' ve ' : ''}${lab.hap ? `${lab.hap} koli hap` : ''} aldı: ${v.toLocaleString('tr-TR')} lira kara kasaya girdi.`, 'olay');
  lab.prod = 0;
  lab.hap = 0;
  return v;
}

/** Aylık üretim, maaş, Isı, kaza. */
export function monthlyLab(w: World, lines: LedgerLine[]) {
  const lab = w.lab;
  if (!lab) return;
  if (lab.chem === 'cevdet') {
    const pay = cevdetPay(w);
    payDirtyFirst(w, pay);
    lines.push({ t: 'Kimyager Cevdet: aylığı', v: -pay });
  }
  const cap = labCapacity(w);
  const n = Math.min(cap, lab.raw);
  const sk = labSkill(w);
  if (n > 0) {
    lab.raw -= n;
    lab.q = clamp(0.3 + sk / 140 + lab.lvl * 0.06 + (hasEngineer(w) ? 0.05 : 0), 0.2, 1);
    if (lab.lvl >= 3) lab.hap += n;
    else lab.prod += n;
    lab.made += n;
    w.heat = clamp(w.heat + n * 0.9 * SITES[lab.site].heat, 0, 100);
    for (const p of labWorkers(w)) p.sk.zanaat = clamp(p.sk.zanaat + 0.8 * (0.55 + p.tr.zeka / 10) * (1 - p.sk.zanaat / 110), 0, 100);
  }
  // Depodaki ürün de kokar
  if (lab.prod + lab.hap > 0) w.heat = clamp(w.heat + 0.25 * (lab.prod + lab.hap) * SITES[lab.site].heat, 0, 100);

  // Kaza
  if (n > 0) {
    const risk = 0.006 * (1.4 - sk / 100) * (lab.lvl === 2 ? 0.6 : 1);
    if (chance(w, risk)) accident(w);
  }
}

function accident(w: World) {
  const lab = w.lab!;
  const hurt = labWorkers(w);
  const v = hurt.length ? hurt[rint(w, 0, hurt.length - 1)] : undefined;
  const fatal = !!v && chance(w, 0.3);
  w.heat = clamp(w.heat + 18, 0, 100);
  const lost = lab.raw + lab.prod + lab.hap;
  lab.raw = 0;
  lab.prod = 0;
  lab.hap = 0;
  if (lab.lvl > 1) lab.lvl--;
  else w.lab = null;
  let txt = `${SITES[lab.site].ad}: atölyede yangın çıktı. ${lost ? `${lost} birimlik mal yandı. ` : ''}Duman köyden görüldü.`;
  if (v && fatal) {
    die(w, v, 'atölye yangını');
    txt += ` ${fullName(v)} dumandan kurtulamadı.`;
  } else if (v) {
    v.hp = clamp(v.hp - 30, 5, 100);
    v.sick = 4;
    txt += ` ${fullName(v)} ağır yandı.`;
  }
  pushCard(w, { id: 'bilgi', text: txt + ' Herkese "ahır yandı" diyeceksiniz.', opts: [{ t: 'Sesini çıkarma', k: 'ok' }] });
}

/** Kartlar: kimyagerle tanışma, Cevdet'in ihaneti. */
export function labCards(w: World): boolean {
  const pl = P(w, w.playerId);
  if (!alive(pl)) return false;
  if (w.flags.kacakci && !w.flags.cevdetTanis && !w.flags.cevdetRet && year(w.m) >= LAB_LEVELS[1].from && Number(w.flags.kacakToplam || 0) >= 6 && chance(w, 0.05)) {
    pushCard(w, {
      id: 'cevdet',
      text: `Kara Rıza bu kez yanında biriyle geldi: gözlüklü, İstanbul ağızlı, ince parmaklı bir adam. "Cevdet Bey kimyagerdir. Sen çuval satıyorsun, biz onu paket yapıp on katına satıyoruz. Bir atölyen olsa o kâr senin olur."`,
      opts: [{ t: 'Konuşalım', k: 'evet' }, { t: 'Ben çiftçiyim', k: 'hayir' }],
    });
    return true;
  }
  // Kimyager ihaneti: Isı yükselince ya da kovulunca
  const lab = w.lab;
  if (lab && (lab.chem === 'cevdet' || Number(w.flags.cevdetKizgin || 0) >= year(w.m)) && w.heat > 55 && chance(w, 0.02)) {
    pushCard(w, {
      id: 'cevdet_ihanet',
      text: `Kahvede fısıltı: Kimyager Cevdet jandarmaya ifade vermiş. Yarın değilse öbür gün baskın gelecek. Elinde çok az zaman var.`,
      opts: [
        { t: 'Atölyeyi söküp her şeyi yak', k: 'yak' },
        { t: `Cevdet'in sesini parayla kes (${Math.round(15000 * infl(w.m)).toLocaleString('tr-TR')} lira)`, k: 'para' },
        { t: 'Bekle, blöf olabilir', k: 'bekle' },
      ],
    });
    return true;
  }
  return false;
}

export function resolveLab(w: World, id: string, k: string): boolean {
  if (id === 'cevdet') {
    if (k === 'evet') {
      w.flags.cevdetTanis = true;
      log(w, `Kimyager Cevdet ile tanışıldı. Atölye kurmak artık mümkün.`, 'olay');
    } else w.flags.cevdetRet = true;
    return true;
  }
  if (id === 'cevdet_ihanet') {
    const lab = w.lab;
    if (k === 'yak') {
      w.lab = null;
      w.heat = clamp(w.heat * 0.5, 0, 100);
      log(w, `Atölye bir gecede söküldü, ne varsa yakıldı. Baskın geldiğinde jandarma bir şey bulamadı.`, 'olay');
    } else if (k === 'para') {
      w.hh.cash -= Math.round(15000 * infl(w.m));
      w.heat = clamp(w.heat - 20, 0, 100);
      if (lab) lab.chem = null;
      log(w, `Cevdet'e para verildi; ifadesini geri aldı ve şehirden gitti.`, 'olay');
    } else {
      w.heat = clamp(w.heat + 30, 0, 100);
      log(w, `Fısıltıya kulak asılmadı.`, 'olay');
    }
    return true;
  }
  return false;
}

export { age };
