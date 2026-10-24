// Aile içi: küslük ve barışma, aile büyüklerinin sözü, gençlerin istekleri, bayramlar, kardeş kavgası,
// hanedeki düğünler. Bağlılık (rel) artık sadece sayı değil: düşen küser, küsen az çalışır, sonunda gider.
import type { Person, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P, relationTo } from './people';
import { infl, kurbanMonth, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { marry, splitBranch } from './life';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const L = (w: World, n: number) => Math.round(n * infl(w.m));
const others = (w: World) => hhMembers(w).filter((p) => p.id !== w.playerId && !p.away);
const relOf = (w: World, p: Person) => {
  const pl = P(w, w.playerId);
  return alive(pl) ? relationTo(w, pl, p).toLowerCase() : 'akraban';
};
const bump = (p: Person, d: number) => (p.rel = clamp(p.rel + d, -100, 100));

/** Hanenin büyüğü: oyuncudan yaşlı, 55 üstü en yaşlı kişi */
export function elder(w: World): Person | undefined {
  const pl = P(w, w.playerId);
  return others(w).filter((p) => age(w, p) >= 55 && (!pl || p.b < pl.b)).sort((a, b) => a.b - b.b)[0];
}

/** Aylık: küsenler ve barışanlar; küsen uzun süre küs kalırsa evi terk eder. */
export function monthlyFamily(w: World) {
  for (const p of others(w)) {
    if (age(w, p) < 12) continue;
    if (!p.kus && p.rel < -30) {
      p.kus = w.m;
      log(w, `${fullName(p)} sana küstü: sofraya gelmiyor, selam vermiyor, işi isteksiz yapıyor.`, 'olay');
    } else if (p.kus && p.rel >= 0) {
      p.kus = undefined;
      log(w, `${fullName(p)} ile barışıldı; yeniden aynı sofrada.`, 'olay');
    } else if (p.kus && w.m - p.kus > 18 && age(w, p) >= 20 && p.blood && p.id !== w.heirId && chance(w, 0.04)) {
      splitBranch(w, p, 'küslüğü bitmeyince');
    }
  }
}

export function familyCards(w: World): boolean {
  const pl = P(w, w.playerId);
  if (!alive(pl)) return false;
  const mo = monthOf(w.m);
  const yr = year(w.m);

  // Küs olan biri varsa gönül alma kartı
  const kus = others(w).find((p) => p.kus && w.m - p.kus >= 1 && !w.flags['kusSor' + p.id + '_' + p.kus]);
  if (kus) {
    w.flags['kusSor' + kus.id + '_' + kus.kus] = true;
    const e = elder(w);
    const older = kus.b < pl.b;
    pushCard(w, {
      id: 'fa_kus',
      pid: kus.id,
      text: `${fullName(kus)} (${relOf(w, kus)}, ${age(w, kus)}) haftalardır seninle konuşmuyor. ${older ? 'Bir büyüğün küsmesi köyde ayıp sayılır; herkes kimin elini öpeceğine bakıyor.' : 'Kapısını kapatıp içine kapandı.'}`,
      opts: [
        ...(older ? [{ t: 'Elini öp, özür dile', k: 'elop' }] : [{ t: 'Yanına otur, dertleş', k: 'dertles' }]),
        { t: `Gönlünü al: hediye (${fmt(L(w, 400))} lira)`, k: 'hediye' },
        ...(e && e.id !== kus.id && e.rel >= 10 ? [{ t: `${e.first} araya girsin`, k: 'buyuk' }] : []),
        { t: 'Kendi bilir', k: 'birak' },
      ],
    });
    return true;
  }

  // Ramazan Bayramı: harçlık ve bayramlık (Kurban'dan yaklaşık iki ay önce)
  const rb = (kurbanMonth(yr) + 10) % 12;
  if (mo === rb && !w.flags['bayram' + yr] && others(w).length >= 2) {
    w.flags['bayram' + yr] = true;
    const n = others(w).length;
    pushCard(w, {
      id: 'fa_bayram',
      text: `Bayram sabahı. Çocuklar yeni giysi bekliyor, büyükler el öptürecek, akrabalar kapıda. Hanede ${n} kişi var.`,
      opts: [
        { t: `Herkese bayramlık, çocuklara harçlık (${fmt(L(w, 45) * n)} lira)`, k: 'bol' },
        { t: `Sadece çocuklara harçlık (${fmt(L(w, 12) * n)} lira)`, k: 'az' },
        { t: 'Bu bayram elimiz dar', k: 'yok' },
      ],
      data: { n },
    });
    return true;
  }

  // Aile büyüğünün öğüdü
  const e = elder(w);
  if (e && e.rel > -20 && chance(w, 0.008)) {
    const ogut = pick(w, [
      { t: `"Toprağı satan, ocağını satar. Ne olursa olsun tarlaya dokunmayın."`, k: 'toprak' },
      { t: `"Kanı kan ile yıkamazsın. ${w.rival.gone ? 'Gelecek komşuyla' : w.rival.name + 'larla'} bir sofraya oturun."`, k: 'baris' },
      { t: `"Bu karanlık işler bizi bitirecek. Oğlanı o adamlardan uzak tut."`, k: 'temiz' },
      { t: `"Çocukları okutun. Bizim gibi gündelikçi kalmasınlar."`, k: 'okul' },
      { t: `"Komşunun derdi bizim derdimizdir. Kimseyi kapıdan boş çevirmeyin."`, k: 'komsu' },
    ]);
    pushCard(w, {
      id: 'fa_ogut',
      pid: e.id,
      data: { ogut: ogut.k },
      text: `${fullName(e)} (${age(w, e)}) akşam seni yanına çağırdı, tespihini çekerek konuştu: ${ogut.t}`,
      opts: [{ t: 'Başım üstüne, söz', k: 'dinle' }, { t: 'Saygıyla dinle ama kendi bildiğini yap', k: 'gec' }, { t: '"Artık devir değişti" de', k: 'karsi' }],
    });
    return true;
  }

  // Gençlerin istekleri
  const genc = others(w).filter((p) => p.blood && age(w, p) >= 13 && age(w, p) <= 24 && !p.kus);
  if (genc.length && chance(w, 0.01)) {
    const g = pick(w, genc);
    const istek = pick(w, [
      { t: yr < 1950 ? 'kasabadaki panayıra gitmek, bir çift yeni çarık' : yr < 1980 ? 'bir bisiklet' : yr < 2000 ? 'bir kasetçalar ve şehirde bir hafta' : 'bir cep telefonu', c: 300 },
      { t: 'şehirde bir zanaat öğrenmek için çıraklık parası', c: 600 },
      { t: 'arkadaşlarıyla düğün eğlencesine gitmek ve takacak bir altın', c: 450 },
      { t: 'kendi eline bir kuzu, kendi sürüsünü büyütmek', c: 250 },
    ]);
    pushCard(w, {
      id: 'fa_genc',
      pid: g.id,
      data: { c: L(w, istek.c) },
      text: `${fullName(g)} (${relOf(w, g)}, ${age(w, g)}) utana sıkıla bir şey istedi: ${istek.t}. "Bir kere de bizim için," diyor.`,
      opts: [{ t: `Olsun (${fmt(L(w, istek.c))} lira)`, k: 'evet' }, { t: 'Bir dahaki hasatta', k: 'sonra' }, { t: 'Böyle şımarıklık olmaz', k: 'hayir' }],
    });
    return true;
  }

  // Kardeş kavgası
  const ad = others(w).filter((p) => p.blood && age(w, p) >= 20 && age(w, p) <= 60);
  if (ad.length >= 2 && chance(w, 0.005)) {
    const [a, b] = [ad[0], ad[1]];
    const konu = pick(w, ['mirasta kimin hangi tarlayı alacağı', 'kimin karısının evde daha çok çalıştığı', 'babadan kalan tüfek', 'düğünde takılan altınlar']);
    pushCard(w, {
      id: 'fa_kavga',
      data: { a: a.id, b: b.id },
      text: `${a.first} ile ${b.first} avluda birbirine girdi; konu ${konu}. İkisi de sana bakıyor: "Sen söyle, kim haklı?"`,
      opts: [
        { t: `${a.first} haklı`, k: 'a' },
        { t: `${b.first} haklı`, k: 'b' },
        { t: `İkisine de gönül al (${fmt(L(w, 500))} lira)`, k: 'ikisi' },
        { t: 'Kendi aralarında halletsinler', k: 'karisma' },
      ],
    });
    return true;
  }
  return false;
}

/** Hanedeki biri evlenecek: düğün kartı (life.ts çağırır). */
export function weddingCard(w: World, p: Person, s: Person) {
  const big = L(w, 1800 * (0.85 + rint(w, 0, 30) / 100));
  const mid = L(w, 500);
  pushCard(w, {
    id: 'fa_dugun',
    pid: p.id,
    data: { s: s.id, big, mid },
    text: `${fullName(p)} (${relOf(w, p)}, ${age(w, p)}) ile ${s.first} ${s.last} evlenmek istiyor. ${p.sex === 'K' ? 'Gelin gidecek; çeyizi ve düğünü bizden.' : 'Gelin bu eve gelecek.'} Köyde düğün, ailenin nasıl bir aile olduğunu gösterir.`,
    opts: [
      { t: `Üç gün davul zurna, bütün köy davetli (${fmt(big)} lira)`, k: 'buyuk' },
      { t: `Sade bir düğün (${fmt(mid)} lira)`, k: 'sade' },
      { t: 'Düğün yok, nikâh kıyılsın yeter', k: 'nikah' },
      { t: 'Bu evlilik olmaz', k: 'ret' },
    ],
  });
}

export function resolveFamily(w: World, id: string, k: string, pid: string | undefined, d: Record<string, unknown> | undefined): boolean {
  if (!id.startsWith('fa_')) return false;
  const p = P(w, pid);
  const data = d ?? {};
  if (id === 'fa_kus' && alive(p)) {
    if (k === 'elop') {
      bump(p, 45);
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 1;
      log(w, `${fullName(p)}'in eli öpüldü; büyüklüğünü yaptı, barıştı.`, 'olay');
    } else if (k === 'dertles') {
      bump(p, chance(w, 0.6) ? 40 : 15);
    } else if (k === 'hediye') {
      w.hh.cash -= L(w, 400);
      bump(p, 35);
    } else if (k === 'buyuk') {
      if (chance(w, 0.7)) {
        bump(p, 45);
        log(w, `Aile büyüğünün sözü yere düşmedi; ${p.first} barıştı.`, 'olay');
      } else bump(p, 5);
    } else bump(p, -5);
    return true;
  }
  if (id === 'fa_bayram') {
    const n = Number(data.n || 1);
    const ps = others(w);
    if (k === 'bol') {
      w.hh.cash -= L(w, 45) * n;
      for (const q of ps) bump(q, 9);
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 1;
    } else if (k === 'az') {
      w.hh.cash -= L(w, 12) * n;
      for (const q of ps) if (age(w, q) < 16) bump(q, 6);
    } else for (const q of ps) if (age(w, q) < 16) bump(q, -4);
    return true;
  }
  if (id === 'fa_ogut' && alive(p)) {
    const o = String(data.ogut || '');
    if (k === 'dinle') {
      bump(p, 20);
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 1;
      w.flags['soz_' + o] = w.m;
      if (o === 'baris' && !w.rival.gone) w.rival.feud = clamp(w.rival.feud - 10, 0, 100);
      if (o === 'temiz') w.heat = clamp(w.heat - 5, 0, 100);
      log(w, `${p.first}'e söz verildi. Büyüğün duası alındı.`, 'olay');
    } else if (k === 'gec') bump(p, -6);
    else {
      bump(p, -30);
      log(w, `${fullName(p)} kırıldı: "Biz de bir zamanlar gençtik."`, 'olay');
    }
    return true;
  }
  if (id === 'fa_genc' && alive(p)) {
    if (k === 'evet') {
      w.hh.cash -= Number(data.c || 0);
      bump(p, 25);
      p.sk.zanaat = clamp(p.sk.zanaat + 2, 0, 100);
    } else if (k === 'sonra') bump(p, -5);
    else bump(p, -25);
    return true;
  }
  if (id === 'fa_kavga') {
    const a = P(w, data.a as string);
    const b = P(w, data.b as string);
    if (k === 'a' && a && b) {
      bump(a, 15);
      bump(b, -35);
    } else if (k === 'b' && a && b) {
      bump(b, 15);
      bump(a, -35);
    } else if (k === 'ikisi') {
      w.hh.cash -= L(w, 500);
      if (a) bump(a, 8);
      if (b) bump(b, 8);
    } else {
      if (a) bump(a, -10);
      if (b) bump(b, -10);
      if (a && b && chance(w, 0.3)) splitBranch(w, a.b < b.b ? b : a, 'kardeşiyle kavgadan sonra');
    }
    return true;
  }
  if (id === 'fa_dugun' && alive(p)) {
    const s = P(w, data.s as string);
    if (!s) return true;
    if (k === 'ret') {
      bump(p, -40);
      log(w, `${fullName(p)} sevdiğiyle evlendirilmedi.`, 'olay');
      if (chance(w, 0.25) && age(w, p) >= 18 && p.id !== w.heirId) {
        marry(w, p, s);
        log(w, `${p.first} bir gece ${s.first} ile kaçtı; artık başka bir evde.`, 'olay');
      }
      return true;
    }
    marry(w, p, s);
    if (k === 'buyuk') {
      w.hh.cash -= Number(data.big || 0);
      for (const q of hhMembers(w)) bump(q, 6);
      bump(p, 20);
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 2;
      if (!w.rival.gone) w.rival.feud = clamp(w.rival.feud - 3, 0, 100);
      log(w, `${fullName(p)} ile ${fullName(s)} için üç gün düğün yapıldı. Davul sesi komşu köylerden duyuldu.`, 'evlilik');
    } else if (k === 'sade') {
      w.hh.cash -= Number(data.mid || 0);
      bump(p, 8);
      log(w, `${fullName(p)} ile ${fullName(s)} sade bir düğünle evlendi.`, 'evlilik');
    } else {
      bump(p, -12);
      w.flags.namBonus = Number(w.flags.namBonus || 0) - 1;
      log(w, `${fullName(p)} ile ${fullName(s)}'in nikâhı kıyıldı; düğün yapılmadı. Köyde "cimri" dediler.`, 'evlilik');
    }
    return true;
  }
  return true;
}
