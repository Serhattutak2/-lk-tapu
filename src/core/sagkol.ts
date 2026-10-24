// Sağ kol: güvendiğin bir aile ferdine yetki verirsin, senin yerine bazı kararları o alır.
// Hangi işleri ona bıraktığını sen seçersin. Sadakati ve becerisi işleri ne kadar iyi yaptığını belirler.
// Sadakat düşerse senden çalar ya da düşmana kayar.
import type { Card, JobId, Person, World } from './types';
import { chance, clamp, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { defaultJob } from './jobs';
import { infl } from './calendar';
import { pushCard } from './cards';

export type Yetki = 'meslek' | 'koy' | 'tarla' | 'olay';
export const YETKI_AD: Record<Yetki, string> = {
  meslek: 'Meslek atamaları',
  koy: 'Köy gelenekleri (bayram, düğün, imece)',
  tarla: 'Tarla ve ambar işleri',
  olay: 'Küçük günlük olaylar',
};

export const sagkol = (w: World): Person | undefined => P(w, String(w.flags.sagkol || ''));
export const sadakat = (w: World) => clamp(Number(w.flags.sagkolSad ?? 60), 0, 100);
const hasYetki = (w: World, y: Yetki) => sagkol(w) && String(w.flags.sagkolYetki || '').includes(y);

export function setSagkol(w: World, pid: string | null): { ok: boolean; msg: string } {
  if (!pid) {
    w.flags.sagkol = '';
    return { ok: true, msg: 'Sağ kol görevden alındı.' };
  }
  const p = P(w, pid);
  if (!alive(p) || !p.inHH || p.away || age(w, p) < 18) return { ok: false, msg: 'Bu kişi sağ kol olamaz.' };
  w.flags.sagkol = pid;
  w.flags.sagkolSad = Math.max(sadakat(w), Math.round(50 + p.rel / 4));
  log(w, `${fullName(p)} ailenin sağ kolu oldu. Artık bazı işleri senin adına o yürütecek.`, 'olay');
  return { ok: true, msg: `${p.first} sağ kolun.` };
}

export function toggleYetki(w: World, y: Yetki) {
  const cur = String(w.flags.sagkolYetki || '');
  w.flags.sagkolYetki = cur.includes(y) ? cur.replace(y, '') : cur + y;
}
export const yetkiVar = (w: World, y: Yetki) => String(w.flags.sagkolYetki || '').includes(y);

/** Bir kart sağ kola devredilebilir mi? */
function delegable(w: World, c: Card): Yetki | null {
  if (!sagkol(w)) return null;
  if (c.id.startsWith('meslek:') && hasYetki(w, 'meslek')) return 'meslek';
  if (c.id.startsWith('kv_') && hasYetki(w, 'koy')) return 'koy';
  if ((c.id.startsWith('fa_') || c.id === 'dugun') && hasYetki(w, 'koy')) return 'koy';
  if ((c.id.startsWith('ev:') || c.id.startsWith('km_')) && hasYetki(w, 'olay')) return 'olay';
  return null;
}

/** Sağ kolun bir karta vereceği cevap. Beceri yüksekse akıllı, sadakat düşükse kötü niyetli. */
function sagkolChoice(w: World, c: Card): string {
  const p = sagkol(w)!;
  const beceri = (p.sk.ticaret + p.tr.zeka * 5) / 2;
  const sad = sadakat(w);
  if (c.id.startsWith('meslek:')) {
    const want = defaultJob(w, P(w, c.pid)!);
    return (c.opts.find((o) => o.k === want) ?? c.opts[0]).k;
  }
  // Para isteyen seçenekler
  const ucuz = c.opts.filter((o) => !/\(\d/.test(o.t) && !/lira\)/.test(o.t));
  const pahali = c.opts.filter((o) => /lira\)/.test(o.t));
  // Sadık ve becerikli sağ kol: namı artıran cömert seçimi yapar; sadakatsiz: en ucuzu seçip farkı cebe atar
  if (sad < 35 && ucuz.length) {
    w.flags.sagkolZimmet = Number(w.flags.sagkolZimmet || 0) + 1;
    return ucuz[0].k;
  }
  if (beceri > 45 && pahali.length && w.hh.cash > 20000 * infl(w.m)) return pahali[0].k;
  const pool = ucuz.length ? ucuz : c.opts;
  return pool[Math.floor(rint(w, 0, pool.length - 1))].k;
}

/** advance() içinde generateCards'tan sonra: devredilen kartları sağ kol kapatır. */
export function delegate(w: World, resolve: (uid: number, k: string) => void) {
  let guard = 0;
  while (w.cards.length && guard++ < 8) {
    const c = w.cards[0];
    const y = delegable(w, c);
    if (!y) break;
    const k = sagkolChoice(w, c);
    resolve(c.uid, k);
  }
}

/** Aylık: sadakat kayması ve ihanet. */
export function monthlySagkol(w: World) {
  const p = sagkol(w);
  if (!p || !alive(p) || !p.inHH || p.away) {
    if (w.flags.sagkol && (!p || !alive(p))) w.flags.sagkol = '';
    return;
  }
  // Sadakat kişisel bağlılığa, aç gözlülüğe ve güç dengesine göre kayar
  const hedef = clamp(50 + p.rel / 3 - p.tr.hirs * 2 + (w.gang > 8 ? 10 : 0), 0, 100);
  w.flags.sagkolSad = clamp(sadakat(w) + (hedef - sadakat(w)) * 0.08, 0, 100);
  // Zimmet: sadakatsiz sağ kol çalar
  if (Number(w.flags.sagkolZimmet || 0) >= 3 && chance(w, 0.1)) {
    w.flags.sagkolZimmet = 0;
    const c = Math.round(w.hh.cash * 0.08);
    w.hh.cash -= c;
    log(w, `${fullName(p)} senin adına yürüttüğü işlerden kendine pay çıkarmış: kasadan ${c.toLocaleString('tr-TR')} lira eksik.`, 'para');
  }
  // İhanet
  if (sadakat(w) < 20 && p.tr.hirs >= 6 && chance(w, 0.03)) {
    pushCard(w, {
      id: 'sg_ihanet',
      pid: p.id,
      text: `${fullName(p)} yıllardır sağ kolundu; ama gözü yükseldi. Adamlarından bir kısmını kendine çekmiş, "artık emir almam, ortak olmazsak karşındayım" diyor.`,
      opts: [
        { t: 'Ortak et, yarı yarıya bölüşün', k: 'ortak' },
        { t: 'Affet ama yetkisini al', k: 'affet' },
        { t: 'İhaneti cezasız kalmaz, adamlarına sor', k: 'ceza' },
      ],
    });
  }
}

export function resolveSagkol(w: World, id: string, k: string, pid: string | undefined): boolean {
  if (id !== 'sg_ihanet') return false;
  const p = P(w, pid);
  if (!alive(p)) return true;
  w.flags.sagkol = '';
  if (k === 'ortak') {
    w.flags.sagkolSad = 70;
    w.flags.ortakPay = (w.flags.ortakPay ? w.flags.ortakPay + ',' : '') + p.id;
    log(w, `${fullName(p)} ile ortak olundu; kazanç bölüşülüyor ama barış sağlandı.`, 'olay');
  } else if (k === 'affet') {
    p.rel = clamp(p.rel - 10, -100, 100);
    log(w, `${fullName(p)} affedildi ama yetkisi alındı. Gözü hâlâ yukarıda.`, 'olay');
  } else {
    if (chance(w, clamp(w.gang / 12, 0.3, 0.8))) {
      w.gang = Math.max(0, w.gang - 1);
      p.away = 'gurbet';
      p.awayUntil = w.m + 9999;
      log(w, `${fullName(p)} bir gece şehri terk etti; bir daha adı anılmadı.`, 'olay');
    } else {
      w.flags.hain = p.id;
      w.gang = Math.max(0, w.gang - 2);
      w.heat = clamp(w.heat + 10, 0, 100);
      log(w, `${fullName(p)} adamlarının yarısını da alıp düşman safına geçti. Artık içini bilen bir düşmanın var.`, 'olay');
    }
  }
  return true;
}
