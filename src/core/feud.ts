// Rakip aile ve kan davası: Kocabaşlar. Toprak, namus ve kara para yüzünden büyüyen husumet.
import type { LedgerLine, Person, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, makePerson, P, removeFromHH } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { die, makeSpouseFor, marry } from './life';
import { PLOTS } from './plots';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
export const feudLabel = (f: number) => (f < 10 ? 'Selam veriliyor' : f < 30 ? 'Soğukluk var' : f < 55 ? 'Düşmanlık' : f < 80 ? 'Kan davası eşiğinde' : 'Kan davası');
export const KOCABAS_MEN = ['Kâzım', 'Rüstem', 'Haydar', 'Zülfü', 'Cemil', 'Hamit', 'Remzi', 'Selim', 'Bayram', 'Ferhat'];

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

export function monthlyFeud(w: World, lines: LedgerLine[]) {
  const r = w.rival;
  // Husumet zamanla biraz söner, kan borcu varsa sönmez
  if (r.blood === 0) r.feud = clamp(r.feud - 0.25, 0, 100);
  // Rakip toprak toplar
  const sale = w.plots.map((p, i) => (p.o === 'koy' && p.sale ? i : -1)).filter((i) => i >= 0);
  if (sale.length && chance(w, 0.025)) {
    const i = pick(w, sale);
    w.plots[i].o = 'rakip';
    w.plots[i].sale = false;
    r.power = clamp(r.power + 4, 0, 100);
    log(w, `Kocabaşlar ${PLOTS[i].yer} mevkiindeki tarlayı kaptı. Köyde toprak için yarışan bir aile daha var.`, 'tapu');
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
  if (!alive(pl)) return false;
  const ours = w.hh.parcels.length;
  const theirs = w.plots.filter((p) => p.o === 'rakip').length;

  // Pusu: husumet yüksekken
  if (r.feud >= 60) {
    const ts = targets(w);
    const p = (r.lock ? 0.008 : 0.035) * (r.feud / 80);
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
        text: `${fullName(v)} dere yolunda pusuya düşürüldü. Kocabaşlar'ın işi olduğunu bütün köy biliyor. Mezarlıkta herkes ${w.surname} ailesinin ne yapacağına bakıyor.`,
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
      log(w, `Gece ${f.no}. parselin ekini ateşe verildi. Ayak izleri Kocabaşlar'ın tarlasına gidiyor.`, 'olay');
    } else {
      w.heat = clamp(w.heat + 20, 0, 100);
      log(w, `Kocabaşlar jandarmaya isimsiz bir mektup yolladı. Komutan senin evini soruyor.`, 'olay');
    }
    return false;
  }

  // Sınır kavgası
  if (ours && theirs && r.feud < 70 && chance(w, 0.012)) {
    const k = pick(w, KOCABAS_MEN);
    pushCard(w, {
      id: 'sinir',
      text: `Kocabaşlar'dan ${k}, sabah karanlığında saban sürüp tarlanın sınır taşını iki adım içeri almış. Tarlada senin ırgatlarınla onun oğulları karşı karşıya, ellerinde kazma.`,
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
      text: `${girl.first} gece evden kaçtı. Kocabaşlar'dan ${boy} ile gitmiş. Kimi "kaçırdılar" diyor, kimi "kendi gitti". Sabah bütün köy kapının önünde.`,
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
      text: `Köyün imamı ve komşu köyün ağası, Kocabaşlar'la aranızı bulmak istiyor. ${r.blood < 0 ? 'Onların kanı sizde; diyet ağır olacak.' : r.blood > 0 ? 'Sizin kanınız onlarda; diyeti onlar ödemeli ama yemeği siz vereceksiniz.' : 'Henüz kan dökülmedi; bir sofra, birkaç hediye yeter.'}${misafir ? ' Misafir odanız olduğu için masraf yarıya iner.' : ''}`,
      opts: [{ t: `Sofrayı kur (${fmt(cost)} lira)`, k: 'evet' }, { t: 'Kocabaşlarla aynı sofraya oturmam', k: 'hayir' }],
      data: { cost },
    });
    return true;
  }

  // Husumetin ilk kıvılcımı: Kocabaşlar'ın aynı tarlaya göz koyması
  if (r.feud < 15 && ours >= 1 && chance(w, 0.014)) {
    r.feud = clamp(r.feud + 12, 0, 100);
    log(w, `Kocabaşlar köyde "bu ailenin parası temiz değil" diye dolaşıyor. Toprak alımını kıskanıyorlar.`, 'olay');
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
        } else log(w, `Sopalı kavgada Kocabaşlar geri çekildi. Taş yerine kondu, ama bu iş burada bitmez.`, 'olay');
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 2;
      }
      return true;
    case 'kacirma': {
      const g = P(w, pid);
      if (!alive(g)) return true;
      if (k === 'dugun') {
        const s = makeSpouseFor(w, g, false);
        s.first = (data?.boy as string) || s.first;
        s.last = 'Kocabaş';
        marry(w, g, s);
        if (g.inHH) removeFromHH(w, g);
        r.feud = clamp(r.feud - 25, 0, 100);
        r.peaceM = w.m;
        log(w, `${g.first}, ${s.first} Kocabaş ile evlendi. İki aile hısım oldu; husumet yumuşadı.`, 'evlilik');
      } else if (k === 'geri') {
        r.feud = clamp(r.feud + 35, 0, 100);
        g.rel = clamp(g.rel - 30, -100, 100);
        log(w, `${g.first} zorla eve getirildi. Kocabaşlar bunu namus meselesi saydı.`, 'olay');
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
        r.feud = clamp(r.feud + 10, 0, 100);
        w.heat = clamp(w.heat + 25, 0, 100);
        const victim = pick(w, KOCABAS_MEN);
        if (alive(a) && chance(w, 0.55)) {
          a.away = 'hapis';
          a.awayUntil = w.m + 12 * rint(w, 8, 15);
          a.job = 'yok';
          a.parcel = undefined;
          log(w, `${fullName(a)}, ${victim} Kocabaş'ı vurdu ve teslim oldu. Ağır ceza ${Math.round((a.awayUntil - w.m) / 12)} yıl verdi.`, 'olay');
        } else {
          log(w, `${victim} Kocabaş, bir düğün dönüşü vuruldu. Kimin yaptığını herkes biliyor ama kimse görmedi.`, 'olay');
        }
      } else if (k === 'diyet') {
        if (chance(w, r.feud > 85 ? 0.35 : 0.65)) {
          w.hh.cash += Math.round(diyet(w) * 0.7);
          r.blood = 0;
          r.feud = clamp(r.feud - 45, 0, 100);
          r.peaceM = w.m;
          log(w, `Arabulucular araya girdi; Kocabaşlar diyet ödedi, Kuran'a el basıldı. Kan davası şimdilik bitti.`, 'olay');
        } else {
          log(w, `Kocabaşlar arabulucuları kapıdan çevirdi.`, 'olay');
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
