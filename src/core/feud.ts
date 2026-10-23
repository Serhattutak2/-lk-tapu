// Rakip aile ve kan davası: Kocabaşlar. Toprak, namus ve kara para yüzünden büyüyen husumet.
import type { LedgerLine, Person, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, makePerson, P, removeFromHH } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { die, makeSpouseFor, marry } from './life';
import { PLOTS } from './plots';
import { jailYears } from './events';
import { has } from './era';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
export const feudLabel = (f: number) => (f < 10 ? 'Selam veriliyor' : f < 30 ? 'Soğukluk var' : f < 55 ? 'Düşmanlık' : f < 80 ? 'Kan davası eşiğinde' : 'Kan davası');
export const KOCABAS_MEN = ['Kâzım', 'Rüstem', 'Haydar', 'Zülfü', 'Cemil', 'Hamit', 'Remzi', 'Selim', 'Bayram', 'Ferhat'];

const PL: Record<string, [string, string, string]> = {
  Kocabaş: ['Kocabaşlar', "Kocabaşlar'ın", "Kocabaşlar'dan"],
  Sarıkaya: ['Sarıkayalar', "Sarıkayalar'ın", "Sarıkayalar'dan"],
  Bozbey: ['Bozbeyler', "Bozbeyler'in", "Bozbeyler'den"],
  Gümüşdere: ['Gümüşdereliler', "Gümüşdereliler'in", "Gümüşdereliler'den"],
};
const pl = (w: World) => PL[w.rival.name] ?? [w.rival.name + ' ailesi', w.rival.name + ' ailesinin', w.rival.name + ' ailesinden'];
/** Rakip ailenin adı: çoğul, iyelik, ayrılma halleri */
export const rP = (w: World) => pl(w)[0];
export const rG = (w: World) => pl(w)[1];
export const rA = (w: World) => pl(w)[2];

export const diyet = (w: World) => Math.round(9000 * infl(w.m));

/** Pusuya düşebilecek erkekler: 15-60 yaş, cezaevinde ve gurbette olmayanlar. */
export function targets(w: World): Person[] {
  return hhMembers(w).filter((p) => p.blood && p.sex === 'E' && !p.away && age(w, p) >= 15 && age(w, p) <= 60);
}

export function setLock(w: World, on: boolean) {
  w.rival.lock = on;
  log(w, on ? `Kan davası yüzünden ailenin erkekleri evden çıkmıyor. Tarlaya kadınlar ve ırgatlar gidiyor.` : `Erkekler yeniden sokağa çıkıyor.`, 'olay');
}

/** Kilit açıkken erkekler gündeliğe, tarlaya, işe gitmez. */
export const lockedOut = (w: World, p: Person) => w.rival.lock && p.blood && p.sex === 'E' && age(w, p) >= 15 && age(w, p) <= 60;

/** Rakip ailenin erkekleri tükendi mi? Tükendiyse köyden silinir. */
export function checkGone(w: World) {
  const r = w.rival;
  if (r.gone || r.men > 0) return;
  r.gone = true;
  r.lock = false;
  r.feud = 0;
  r.blood = 0;
  let n = 0;
  w.plots.forEach((p) => {
    if (p.o === 'rakip') {
      p.o = 'koy';
      p.sale = true;
      p.ask = 0.75;
      n++;
    }
  });
  w.flags.namBonus = Number(w.flags.namBonus || 0) + 8;
  w.flags.yokEdilen = (w.flags.yokEdilen ? w.flags.yokEdilen + ', ' : '') + rP(w);
  w.flags.nextRival = w.m + rint(w, 18, 48);
  log(w, `${rA(w)} silah tutacak erkek kalmadı. Kadınlar ve çocuklar bir gece köyü terk etti.${n ? ` ${n} tarlaları ucuza satışa çıktı.` : ''} Köyde artık ${w.surname} adı korkuyla anılıyor.`, 'olay');
}

const NEXT: { name: string; intro: string }[] = [
  { name: 'Sarıkaya', intro: 'Komşu köyden Sarıkayalar, boşalan toprakların kokusunu alıp Karaçam\'a yerleşti. Beş kardeşler, hepsi silahlı ve senin adını duymuşlar.' },
  { name: 'Bozbey', intro: 'Bozbey Ağa\'nın oğulları babalarının topraklarını eriten aileye kin besliyor. Konakta silahlar yağlanıyor.' },
  { name: 'Gümüşdere', intro: 'Gümüşdere aşiretinden bir kol Karaçam\'a indi. Kalabalıklar, sert insanlar; kaçakçılıkta da gözleri var.' },
];

/** Gelen yeni rakip aile */
function arrive(w: World) {
  const used = String(w.flags.rakipler || 'Kocabaş').split(',');
  const nx = NEXT.find((n) => !used.includes(n.name)) ?? { name: 'Gümüşdere', intro: NEXT[2].intro };
  w.flags.rakipler = [...used, nx.name].join(',');
  w.rival = { name: nx.name, power: 35, feud: 15, blood: 0, lock: false, dead: 0, theirDead: 0, peaceM: w.m, men: rint(w, 5, 8) + (w.hh.parcels.length > 10 ? 2 : 0), gone: false, since: w.m };
  log(w, nx.intro, 'olay');
  const sale = w.plots.map((p, i) => (p.o === 'koy' && p.sale ? i : -1)).filter((i) => i >= 0).slice(0, 2);
  for (const i of sale) {
    w.plots[i].o = 'rakip';
    w.plots[i].sale = false;
  }
}

export const gangPay = (w: World) => Math.round(420 * infl(w.m));

/** Adamlarla rakibe baskın. */
export function attackRival(w: World): { ok: boolean; msg: string } {
  const r = w.rival;
  if (r.gone) return { ok: false, msg: 'Köyde hesaplaşacak bir aile kalmadı.' };
  const fam = targets(w).filter((t) => t.id !== w.playerId).length;
  const men = w.gang + Math.min(2, fam);
  if (w.gang < 2) return { ok: false, msg: 'Bu iş için en az iki maaşlı adam gerekir.' };
  const p = clamp(0.3 + 0.07 * men - 0.06 * r.men + (has(w, 'cep') ? 0.08 : 0), 0.1, 0.85);
  r.feud = 100;
  w.heat = clamp(w.heat + 14, 0, 100);
  if (chance(w, p)) {
    const k = Math.min(r.men, rint(w, 1, 2));
    r.men -= k;
    r.theirDead += k;
    r.blood += k;
    log(w, `Gece baskını: adamların ${rA(w)} ${k} kişiyi indirdi. Köy sabaha kadar uyumadı.`, 'olay');
    checkGone(w);
    return { ok: true, msg: r.gone ? `${rP(w)} köyden silindi.` : `${k} kişi düştü. Geriye ${r.men} erkekleri kaldı.` };
  }
  w.gang = Math.max(0, w.gang - 1);
  if (fam && chance(w, 0.25)) {
    const a = targets(w).filter((t) => t.id !== w.playerId)[0];
    a.away = 'hapis';
    a.awayUntil = w.m + 12 * jailYears(w, rint(w, 5, 10));
    a.job = 'yok';
    a.parcel = undefined;
    log(w, `Baskın boşa çıktı. Adamlarından biri öldü; ${fullName(a)} yakalandı ve uzun hapis yedi.`, 'olay');
    return { ok: false, msg: 'Baskın boşa çıktı, bir adam öldü ve aileden biri yakalandı.' };
  }
  log(w, `Baskın boşa çıktı: ${rP(w)} hazırlıklıydı. Adamlarından biri dönmedi.`, 'olay');
  return { ok: false, msg: 'Baskın boşa çıktı, bir adamını kaybettin.' };
}

export function monthlyFeud(w: World, lines: LedgerLine[]) {
  if (w.rival.gone) {
    if (w.m >= Number(w.flags.nextRival || 0)) arrive(w);
    return;
  }
  const r = w.rival;
  if ((w.m - r.since) % 40 === 39 && r.men < 9) r.men++;
  // Husumet zamanla biraz söner, kan borcu varsa sönmez
  if (r.blood === 0 && w.m - r.peaceM < 24) r.feud = clamp(r.feud - 0.25, 0, 100);
  // Rakip toprak toplar
  const sale = w.plots.map((p, i) => (p.o === 'koy' && p.sale ? i : -1)).filter((i) => i >= 0);
  if (sale.length && chance(w, 0.025)) {
    const i = pick(w, sale);
    w.plots[i].o = 'rakip';
    w.plots[i].sale = false;
    r.power = clamp(r.power + 4, 0, 100);
    log(w, `${rP(w)} ${PLOTS[i].yer} mevkiindeki tarlayı kaptı. Köyde toprak için yarışan bir aile daha var.`, 'tapu');
  }
  if (r.lock) {
    const lost = targets(w).length;
    if (lost) lines.push({ t: `Kan davası: ${lost} erkek evden çıkamıyor`, v: 0 });
  }
  void monthOf;
}

export function feudCards(w: World): boolean {
  const r = w.rival;
  const pl = P(w, w.playerId);
  if (!alive(pl) || r.gone) return false;
  const ours = w.hh.parcels.length;
  const theirs = w.plots.filter((p) => p.o === 'rakip').length;

  // Pusu: husumet yüksekken
  if (r.feud >= 50) {
    const ts = targets(w);
    const p = ((r.lock ? 0.008 : 0.035) * (r.feud / 80)) / (1 + w.gang * 0.25);
    if (ts.length && chance(w, p) && w.gang > 0 && chance(w, 0.45)) {
      w.gang--;
      r.feud = clamp(r.feud + 6, 0, 100);
      log(w, `Pusu: ${rP(w)} yolu kesti, korumalardan biri vuruldu. Aileden kimseye bir şey olmadı.`, 'olay');
      return false;
    }
    if (ts.length && chance(w, p)) {
      const v = pick(w, ts.filter((t) => t.id !== w.playerId).length ? ts.filter((t) => t.id !== w.playerId) : ts);
      const wasPlayer = v.id === w.playerId;
      r.dead++;
      r.blood -= 1;
      r.feud = clamp(r.feud + 15, 0, 100);
      die(w, v, 'kan davası');
      if (w.over || wasPlayer) return true;
      const avenger = targets(w).filter((t) => t.id !== w.playerId).sort((a, b) => b.tr.hirs - a.tr.hirs)[0];
      pushCard(w, {
        id: 'kan',
        pid: avenger?.id,
        text: `${fullName(v)} dere yolunda pusuya düşürüldü. ${rG(w)} işi olduğunu bütün köy biliyor. Mezarlıkta herkes ${w.surname} ailesinin ne yapacağına bakıyor.`,
        opts: [
          ...(avenger ? [{ t: `${avenger.first} kanını yerde bırakmasın`, k: 'intikam' }] : []),
          { t: `Arabulucu çağır, diyet iste (${fmt(diyet(w))} lira)`, k: 'diyet' },
          { t: 'Sabret, kan kanla yıkanmaz', k: 'sabir' },
        ],
      });
      return true;
    }
  }

  // Kocabaşlar baskı yapar: ekin yakma, ihbar
  if (r.feud >= 75 && chance(w, 0.02)) {
    const grow = w.hh.parcels.filter((f) => f.crop);
    if (grow.length && chance(w, 0.5)) {
      const f = pick(w, grow);
      f.crop = null;
      f.illegal = false;
      log(w, `Gece ${f.no}. parselin ekini ateşe verildi. Ayak izleri ${rG(w)} tarlasına gidiyor.`, 'olay');
    } else {
      w.heat = clamp(w.heat + 20, 0, 100);
      log(w, `${rP(w)} jandarmaya isimsiz bir mektup yolladı. Komutan senin evini soruyor.`, 'olay');
    }
    return false;
  }

  // Sınır kavgası
  if (ours && theirs && r.feud < 70 && chance(w, 0.012)) {
    const k = pick(w, KOCABAS_MEN);
    pushCard(w, {
      id: 'sinir',
      text: `${rA(w)} ${k}, sabah karanlığında saban sürüp tarlanın sınır taşını iki adım içeri almış. Tarlada senin ırgatlarınla onun oğulları karşı karşıya, ellerinde kazma.`,
      opts: [{ t: 'Alttan al, iki adım için kan dökülmez', k: 'alttan' }, { t: 'Muhtara ve tapuya şikâyet et', k: 'sikayet' }, { t: 'Sopayla git, taşı yerine koy', k: 'sopa' }],
    });
    return true;
  }

  // Kız kaçırma
  const girl = hhMembers(w).find((p) => p.blood && p.sex === 'K' && !p.sp && !p.away && age(w, p) >= 16 && age(w, p) <= 22 && p.id !== w.playerId && p.id !== w.heirId);
  if (girl && !w.flags['kacti' + girl.id] && chance(w, 0.004 + (r.feud > 30 ? 0.004 : 0))) {
    w.flags['kacti' + girl.id] = true;
    const boy = pick(w, KOCABAS_MEN);
    pushCard(w, {
      id: 'kacirma',
      pid: girl.id,
      text: `${girl.first} gece evden kaçtı. ${rA(w)} ${boy} ile gitmiş. Kimi "kaçırdılar" diyor, kimi "kendi gitti". Sabah bütün köy kapının önünde.`,
      opts: [{ t: 'Düğün yap, iki aile hısım olsun', k: 'dugun' }, { t: 'Kızı geri getirin', k: 'geri' }, { t: 'O artık bu evin kızı değil', k: 'evlatlik' }],
      data: { boy },
    });
    return true;
  }

  // Barış teklifi
  if (r.feud >= 40 && w.m - r.peaceM > 24 && chance(w, 0.02)) {
    const misafir = !!w.hh.rooms.misafir;
    const cost = Math.round(diyet(w) * (misafir ? 0.5 : 1) * (r.blood < 0 ? 1.5 : r.blood > 0 ? 0.3 : 0.8));
    pushCard(w, {
      id: 'baris',
      text: `Köyün imamı ve komşu köyün ağası, ${rP(w)} ile aranızı bulmak istiyor. ${r.blood < 0 ? 'Onların kanı sizde; diyet ağır olacak.' : r.blood > 0 ? 'Sizin kanınız onlarda; diyeti onlar ödemeli ama yemeği siz vereceksiniz.' : 'Henüz kan dökülmedi; bir sofra, birkaç hediye yeter.'}${misafir ? ' Misafir odanız olduğu için masraf yarıya iner.' : ''}`,
      opts: [{ t: `Sofrayı kur (${fmt(cost)} lira)`, k: 'evet' }, { t: `${rP(w)} ile aynı sofraya oturmam`, k: 'hayir' }],
      data: { cost },
    });
    return true;
  }

  // Husumetin ilk kıvılcımı: Kocabaşlar'ın aynı tarlaya göz koyması
  if (r.feud < 15 && ours >= 1 && chance(w, 0.014)) {
    r.feud = clamp(r.feud + 12, 0, 100);
    log(w, `${rP(w)} köyde "bu ailenin parası temiz değil" diye dolaşıyor. Toprak alımını kıskanıyorlar.`, 'olay');
  }
  return false;
}

export function resolveFeud(w: World, id: string, pid: string | undefined, k: string, data: Record<string, unknown> | undefined): boolean {
  const r = w.rival;
  switch (id) {
    case 'sinir':
      if (k === 'alttan') {
        w.flags.namBonus = Number(w.flags.namBonus || 0) - 2;
        log(w, `Sınır taşı kavgasında alttan alındı. Köyde "sesleri çıkmadı" dendi.`, 'olay');
      } else if (k === 'sikayet') {
        const c = Math.round(700 * infl(w.m));
        w.hh.cash -= c;
        r.feud = clamp(r.feud + 6, 0, 100);
        if (chance(w, 0.6)) log(w, `Tapu memuru geldi, sınırı yeniden ölçtü. Taş yerine kondu (${fmt(c)} lira masraf).`, 'olay');
        else log(w, `Şikâyet sürüncemede kaldı; ${fmt(c)} lira gitti, taş yerinde değil.`, 'olay');
      } else {
        r.feud = clamp(r.feud + 22, 0, 100);
        const hurt = targets(w).filter((t) => t.id !== w.playerId);
        if (hurt.length && chance(w, 0.5)) {
          const h = pick(w, hurt);
          h.hp = clamp(h.hp - 25, 5, 100);
          h.sick = 3;
          log(w, `Tarlada sopalar konuştu. ${fullName(h)} başından yaralandı ama taş yerine kondu.`, 'olay');
        } else log(w, `Sopalı kavgada ${rP(w)} geri çekildi. Taş yerine kondu, ama bu iş burada bitmez.`, 'olay');
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 2;
      }
      return true;
    case 'kacirma': {
      const g = P(w, pid);
      if (!alive(g)) return true;
      if (k === 'dugun') {
        const s = makeSpouseFor(w, g, false);
        s.first = (data?.boy as string) || s.first;
        s.last = w.rival.name;
        marry(w, g, s);
        if (g.inHH) removeFromHH(w, g);
        r.feud = clamp(r.feud - 25, 0, 100);
        r.peaceM = w.m;
        log(w, `${g.first}, ${s.first} ${w.rival.name} ile evlendi. İki aile hısım oldu; husumet yumuşadı.`, 'evlilik');
      } else if (k === 'geri') {
        r.feud = clamp(r.feud + 35, 0, 100);
        g.rel = clamp(g.rel - 30, -100, 100);
        log(w, `${g.first} zorla eve getirildi. ${rP(w)} bunu namus meselesi saydı.`, 'olay');
      } else {
        if (g.inHH) removeFromHH(w, g);
        g.blood = false;
        r.feud = clamp(r.feud + 10, 0, 100);
        log(w, `${g.first} evlatlıktan reddedildi. Adı bu evde bir daha anılmayacak.`, 'olay');
      }
      return true;
    }
    case 'kan': {
      if (k === 'intikam') {
        const a = P(w, pid);
        r.theirDead++;
        r.blood += 1;
        r.men = Math.max(0, r.men - 1);
        r.feud = clamp(r.feud + 10, 0, 100);
        w.heat = clamp(w.heat + 25, 0, 100);
        const victim = pick(w, KOCABAS_MEN);
        if (alive(a) && chance(w, 0.55)) {
          a.away = 'hapis';
          a.awayUntil = w.m + 12 * jailYears(w, rint(w, 8, 15));
          a.job = 'yok';
          a.parcel = undefined;
          log(w, `${fullName(a)}, ${rA(w)} ${victim} adlı adamı vurdu ve teslim oldu. Ağır ceza ${Math.round((a.awayUntil - w.m) / 12)} yıl verdi.`, 'olay');
        } else {
          log(w, `${rA(w)} ${victim}, bir düğün dönüşü vuruldu. Kimin yaptığını herkes biliyor ama kimse görmedi.`, 'olay');
        }
        checkGone(w);
      } else if (k === 'diyet') {
        if (chance(w, r.feud > 85 ? 0.35 : 0.65)) {
          w.hh.cash += Math.round(diyet(w) * 0.7);
          r.blood = 0;
          r.feud = clamp(r.feud - 45, 0, 100);
          r.peaceM = w.m;
          log(w, `Arabulucular araya girdi; ${rP(w)} diyet ödedi, Kuran'a el basıldı. Kan davası şimdilik bitti.`, 'olay');
        } else {
          log(w, `${rP(w)} arabulucuları kapıdan çevirdi.`, 'olay');
          r.feud = clamp(r.feud + 5, 0, 100);
        }
      } else {
        w.flags.namBonus = Number(w.flags.namBonus || 0) - 6;
        r.feud = clamp(r.feud - 5, 0, 100);
        log(w, `Aile sabretti. Köyde kimi "akıllıca" dedi, kimi arkadan güldü.`, 'olay');
      }
      return true;
    }
    case 'baris':
      if (k === 'evet') {
        const c = (data?.cost as number) || 0;
        w.hh.cash -= c;
        r.feud = clamp(r.feud - 50, 0, 100);
        r.blood = 0;
        r.peaceM = w.m;
        if (r.lock) r.lock = false;
        log(w, `Barış sofrası kuruldu (${fmt(c)} lira). İki aile el sıkıştı.`, 'olay');
      } else {
        r.feud = clamp(r.feud + 8, 0, 100);
        r.peaceM = w.m;
        log(w, `Barış teklifi geri çevrildi.`, 'olay');
      }
      return true;
  }
  return false;
}

export { makePerson, year };
