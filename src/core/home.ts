// Ev içi: odalar, ahır, samanlık zulası, misafir odası, bodrum. Kalabalık ev aileyi dağıtır.
import type { LedgerLine, Person, RoomId, World } from './types';
import { chance, clamp } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { isAncestor, splitBranch } from './life';

export interface RoomDef { id: RoomId; ad: string; price: number; max: number; desc: string; }
export const ROOMS: Record<RoomId, RoomDef> = {
  oda: { id: 'oda', ad: 'Yatak odası', price: 3200, max: 4, desc: 'Üç kişi daha sığar. Evlenen oğullar gelinleriyle baba evinde kalabilir.' },
  ahir: { id: 'ahir', ad: 'Ahır', price: 3800, max: 1, desc: 'İnek ve koyun. Evde işlere bakan biri varsa her ay süt, yoğurt, peynir parası.' },
  samanlik: { id: 'samanlik', ad: 'Samanlık', price: 2600, max: 1, desc: 'Samanın altına çift dip. Zuladaki mal daha az dikkat çeker, baskında bulunması zorlaşır.' },
  misafir: { id: 'misafir', ad: 'Misafir odası', price: 6500, max: 1, desc: 'Sedirli, kilimli. Muhtar da arabulucu da burada ağırlanır: nam artar, barış ucuzlar.' },
  bodrum: { id: 'bodrum', ad: 'Gizli bodrum', price: 5200, max: 1, desc: 'Avlunun altında, tahta kapaklı. Atölye kurulabilecek ilk yer.' },
};

/** Ev türüne göre ek oda yeri ve temel kapasite. */
export const SLOTS = [0, 2, 4, 7];
export const BASE_CAP = [5, 7, 10, 15];

export const roomPrice = (w: World, r: RoomId) => Math.round((ROOMS[r].price * infl(w.m)) / 100) * 100;
export const roomCount = (w: World) => Object.values(w.hh.rooms).reduce((a: number, b) => a + (b || 0), 0);
export const capacity = (w: World) => BASE_CAP[w.hh.house] + (w.hh.rooms.oda || 0) * 3 + (w.hh.ekEv || 0) * 6;

/** Köyün içinde ikinci, üçüncü ev: aile aynı avluda dağılmadan büyür. */
export const EKEV_MAX = 999;
export const ekEvPrice = (w: World) => Math.round((11500 * infl(w.m) * (1 + (w.hh.ekEv || 0) * 0.35)) / 100) * 100;
export function buildEkEv(w: World): { ok: boolean; msg: string } {
  if ((w.hh.ekEv || 0) >= EKEV_MAX) return { ok: false, msg: 'Köyde satılık ev kalmadı.' };
  const p = ekEvPrice(w);
  if (w.hh.cash < p) return { ok: false, msg: `${(p - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= p;
  w.hh.ekEv = (w.hh.ekEv || 0) + 1;
  for (const q of hhMembers(w)) q.rel = clamp(q.rel + 4, -100, 100);
  log(w, `Köyde ${w.surname} ailesi ${w.hh.ekEv}. evini satın aldı (${p.toLocaleString('tr-TR')} lira). Aile aynı mahallede, dağılmadan büyüyor.`, 'tapu');
  return { ok: true, msg: 'Ev alındı; altı kişi daha sığar.' };
}
export const residents = (w: World) => hhMembers(w).filter((p) => p.away !== 'gurbet' && p.away !== 'hapis').length;
export const crowded = (w: World) => residents(w) > capacity(w);

export function canBuild(w: World, r: RoomId): string | null {
  if (w.hh.house === 0) return 'Kira evine oda yapılmaz; önce kendi evin olmalı.';
  if ((w.hh.rooms[r] || 0) >= ROOMS[r].max) return 'Bundan daha fazla yapılmaz.';
  if (roomCount(w) >= SLOTS[w.hh.house]) return 'Evde yer kalmadı; daha büyük ev gerekiyor.';
  return null;
}

export function buildRoom(w: World, r: RoomId): { ok: boolean; msg: string } {
  const why = canBuild(w, r);
  if (why) return { ok: false, msg: why };
  const price = roomPrice(w, r);
  if (w.hh.cash < price) return { ok: false, msg: `${(price - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= price;
  w.hh.rooms[r] = (w.hh.rooms[r] || 0) + 1;
  log(w, `Eve ${ROOMS[r].ad.toLowerCase()} yapıldı (${price.toLocaleString('tr-TR')} lira).`, 'tapu');
  return { ok: true, msg: `${ROOMS[r].ad} hazır.` };
}

export function monthlyHome(w: World, lines: LedgerLine[]) {
  if (w.hh.rooms.ahir && Number(w.flags.ahirKapali || 0) <= w.m) {
    const keeper = hhMembers(w).find((p) => !p.away && (p.job === 'ev' || p.job === 'coban'));
    const v = Math.round((keeper ? 170 : 60) * infl(w.m) * (w.tech?.buzdolabi ? 1.3 : 1));
    w.hh.cash += v;
    lines.push({ t: `Ahır: süt, yoğurt, peynir${keeper ? '' : ' (bakan yok)'}`, v });
  }
  // Kalabalık ev huzursuzluk getirir
  if (crowded(w)) {
    for (const p of hhMembers(w)) if (p.id !== w.playerId) p.rel = clamp(p.rel - 0.6, -100, 100);
  } else {
    for (const p of hhMembers(w)) if (p.rel < 40) p.rel = clamp(p.rel + 0.15, -100, 100);
  }
}

/** Ayrılmak isteyen evli oğul: kart üretir (otomatik ayrılmaz). */
export function homeCards(w: World): boolean {
  const pl = P(w, w.playerId);
  for (const p of hhMembers(w)) {
    if (!p.blood || p.id === w.playerId || p.id === w.heirId || p.sex !== 'E' || p.away) continue;
    if (pl && isAncestor(w, p, pl)) continue;
    if (!alive(P(w, p.sp))) continue;
    if (age(w, p) < 24) continue;
    const kids = p.kids.filter((k) => alive(w.people[k])).length;
    const push = (crowded(w) ? 0.02 : 0.003) + (p.rel < 0 ? 0.02 : 0) + (kids >= 3 ? 0.005 : 0);
    if (!chance(w, push)) continue;
    const why = crowded(w) ? `Ev dar geliyor; ${residents(w)} kişi ${capacity(w)} kişilik evde yaşıyor.` : p.rel < 0 ? 'Seninle arası bozuk.' : 'Kendi ocağını tütürmek istiyor.';
    const opts = [{ t: 'Gönlünü al, kalsın (rızasını parayla al)', k: 'para' }, { t: 'Baba ocağından ayrılınmaz de', k: 'emir' }, { t: 'İzin ver, kendi evini açsın', k: 'izin' }];
    if ((w.hh.ekEv || 0) < EKEV_MAX && w.hh.cash >= ekEvPrice(w)) opts.unshift({ t: `Köyde ona ayrı bir ev al, aile dağılmasın (${ekEvPrice(w).toLocaleString('tr-TR')} lira)`, k: 'ekev' });
    const r = canBuildRoomNow(w);
    if (r) opts.unshift({ t: `Ona bir oda yap (${roomPrice(w, 'oda').toLocaleString('tr-TR')} lira)`, k: 'oda' });
    pushCard(w, {
      id: 'ayri_ev',
      pid: p.id,
      text: `${fullName(p)} (${age(w, p)}) karısı ve çocuklarıyla ayrı eve çıkmak istiyor. ${why} Giderse tarlada bir çift el eksilir, giderken payını da ister.`,
      opts,
      data: { gift: Math.round(600 * infl(w.m)) },
    });
    return true;
  }
  return false;
}

function canBuildRoomNow(w: World) {
  return canBuild(w, 'oda') === null && w.hh.cash >= roomPrice(w, 'oda');
}

export function resolveHome(w: World, id: string, pid: string | undefined, k: string, data: Record<string, unknown> | undefined): boolean {
  if (id !== 'ayri_ev') return false;
  const p = P(w, pid);
  if (!alive(p)) return true;
  if (k === 'ekev') {
    buildEkEv(w);
    p.rel = clamp(p.rel + 25, -100, 100);
    log(w, `${fullName(p)} kendi evine çıktı ama ailenin içinde kaldı; aynı sofraya oturmaya devam ediyor.`, 'olay');
  } else if (k === 'oda') {
    buildRoom(w, 'oda');
    p.rel = clamp(p.rel + 20, -100, 100);
    log(w, `${fullName(p)} için yeni oda yapıldı; ayrılmaktan vazgeçti.`, 'olay');
  } else if (k === 'para') {
    const g = (data?.gift as number) || 0;
    w.hh.cash -= g;
    p.rel = clamp(p.rel + 15, -100, 100);
    log(w, `${fullName(p)} kalsın diye eline ${g.toLocaleString('tr-TR')} lira verildi; şimdilik kalıyor.`, 'olay');
  } else if (k === 'emir') {
    if (p.rel > 20 || (p.tr.uyum >= 6 && chance(w, 0.7))) {
      p.rel = clamp(p.rel - 15, -100, 100);
      log(w, `${fullName(p)} sesini çıkarmadı ve kaldı. Ama içine attı.`, 'olay');
    } else {
      p.rel = clamp(p.rel - 40, -100, 100);
      splitBranch(w, p, 'babasının sözünü dinlemeyip kapıyı çarparak');
    }
  } else {
    splitBranch(w, p, 'helalleşerek');
  }
  return true;
}

export function homeOf(w: World): Person[] {
  return hhMembers(w);
}
