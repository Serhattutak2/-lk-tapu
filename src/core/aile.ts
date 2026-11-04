// Konsey'in büyük mafya aileleri ve Büyük Baba tahtı.
// Şehrin tepesinde beş gerçek aile vardır: her birinin reisi, adamları, bir mahallesi ve
// sana karşı bir bağı (dost/düşman) ve bir huyu var. Masanın başında hüküm süren bir
// Büyük Baba oturur. Ya ittifakla, ya suikastla, ya açık savaşla tahtı alırsın; aldıktan
// sonra da herkes tahtını ister — korumak ayrı bir iştir. Hepsi soyut oyun sistemleridir.
import type { CityFamily, DistId, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { addSaygi, addKorku, kademeNo } from './guc';
import { DISTS } from './district';
import { payDirtyFirst, canPay, CITY } from './baron';
import { fightForce } from './feud';

/** Şehir kavgasında arkanı tutan güç: maaşlı adamlar + ailenin erkekleri (nüfuzun). */
export const force = (w: World) => fightForce(w);

const L = (w: World, n: number) => Math.round(n * infl(w.m));
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

interface AileDef { id: string; ad: string; reis: string; trait: CityFamily['trait']; dist: DistId; }
const AILE_DEFS: AileDef[] = [
  { id: 'karayel', ad: 'Karayel', reis: 'Kör Tahsin', trait: 'kan', dist: 'liman' },
  { id: 'demirhan', ad: 'Demirhan', reis: 'Haydar Demirhan', trait: 'siyaset', dist: 'yenisehir' },
  { id: 'tozkoparan', ad: 'Tozkoparan', reis: 'Dursun Ağa', trait: 'hirs', dist: 'sanayi' },
  { id: 'sahinoglu', ad: 'Şahinoğlu', reis: 'Nazmi Şahin', trait: 'para', dist: 'carsi' },
  { id: 'akbaba', ad: 'Akbaba', reis: 'İhsan Akbaba', trait: 'sadakat', dist: 'gecekondu' },
];

export const TRAIT_AD: Record<CityFamily['trait'], string> = {
  kan: 'Kanlı', para: 'Paragöz', siyaset: 'Siyasetçi', sadakat: 'Sadık', hirs: 'Hırslı',
};

/** Aileler kuruldu mu; değilse kur. Yalnız şehir ağalığına yükselince anlam kazanır. */
export function ensureFams(w: World): CityFamily[] {
  if (!w.city.fams) {
    w.city.fams = AILE_DEFS.map((d) => ({
      id: d.id, ad: d.ad, reis: d.reis, trait: d.trait, dist: d.dist,
      men: rint(w, 24, 42), bond: rint(w, -25, -5), alive: true, // köklü ve güçlüler; yeni gelene güvenmezler
    }));
    // En güçlü aile masanın başında: hüküm süren Büyük Baba (ekstra güçlü)
    const strong = [...w.city.fams].sort((a, b) => b.men - a.men)[0];
    strong.men += rint(w, 10, 18);
    w.city.baba = strong.id;
  }
  return w.city.fams;
}

export const fams = (w: World): CityFamily[] => w.city.fams || [];
export const famById = (w: World, id: string) => fams(w).find((f) => f.id === id);
export const aliveFams = (w: World) => fams(w).filter((f) => f.alive);
export const isBaba = (w: World) => w.city.baba === 'biz';
export const babaFam = (w: World) => (w.city.baba && w.city.baba !== 'biz' ? famById(w, w.city.baba) : null);

/** Sana dost aileler (bağ ≥ 40). */
export const allies = (w: World) => aliveFams(w).filter((f) => f.bond >= 40);
/** Masadaki toplam oy: sen + dostların. Büyük Baba'ya oy veren aileler sana karşı sayılır. */
export function votes(w: World): { mine: number; need: number } {
  const al = aliveFams(w);
  let mine = 1; // kendi oyun
  for (const f of al) if (w.city.baba !== f.id && f.bond >= 45) mine += f.bond >= 78 ? 1.5 : 1;
  // Masanın çoğunluğu gerekir ve hüküm süren aile hiçbir zaman sana oy vermez: neredeyse herkesi kazanmalısın
  const need = Math.max(3, al.length - 0.5);
  return { mine, need };
}

export function babaLabel(w: World): string {
  if (isBaba(w)) return `Büyük Baba — ${CITY} senin`;
  const b = babaFam(w);
  return b ? `Büyük Baba: ${b.reis} (${b.ad})` : 'Taht boş';
}

// ---------- Oyuncu eylemleri (arayüz) ----------

/** Bir aileye hediye/jest: bağ artar, para gider. Huya göre farklı tepki. */
export function aileGift(w: World, id: string): { ok: boolean; msg: string } {
  const f = famById(w, id);
  if (!f || !f.alive) return { ok: false, msg: 'Böyle bir aile yok.' };
  const cost = L(w, f.trait === 'para' ? 18000 : 10000);
  if (!canPay(w, cost)) return { ok: false, msg: `Hediye için ${fmt(cost)} lira gerek.` };
  payDirtyFirst(w, cost);
  const up = f.trait === 'para' ? 18 : f.trait === 'sadakat' ? 14 : f.trait === 'kan' ? 7 : 11;
  f.bond = clamp(f.bond + up, -100, 100);
  log(w, `${f.ad} ailesine ${fmt(cost)} liralık bir jest yapıldı; ${f.reis} memnun oldu (bağ ${Math.round(f.bond)}).`, 'olay');
  return { ok: true, msg: `${f.ad} ile aran düzeldi.` };
}

/** Bir aileye baskı/pusu: adamlarını azaltır ama bağ düşer, husumet ve dikkat artar. */
export function ailePress(w: World, id: string): { ok: boolean; msg: string } {
  const f = famById(w, id);
  if (!f || !f.alive) return { ok: false, msg: 'Böyle bir aile yok.' };
  if (w.gang < 4) return { ok: false, msg: 'Pusu için en az dört adam gerek.' };
  w.heat = clamp(w.heat + 10, 0, 100);
  addKorku(w, 6);
  const p = clamp(0.3 + w.gang * 0.03 - f.men * 0.02 + (f.trait === 'kan' ? -0.1 : 0.05), 0.12, 0.85);
  if (chance(w, p)) {
    const k = rint(w, 2, 4);
    f.men = Math.max(0, f.men - k);
    f.bond = clamp(f.bond - 30, -100, 100);
    log(w, `${f.ad} ailesine gece baskını: ${k} adamları saf dışı. ${f.reis} kan davası güdüyor.`, 'olay');
    if (f.men <= 0) famFalls(w, f, 'pusu');
    return { ok: true, msg: `${f.ad} sarsıldı.` };
  }
  const lost = Math.min(w.gang, rint(w, 1, 2));
  w.gang -= lost;
  f.bond = clamp(f.bond - 20, -100, 100);
  log(w, `${f.ad} baskını püskürttü; ${lost} adamın yaralandı. ${f.reis} artık tetikte.`, 'olay');
  return { ok: false, msg: `Pusu tuttu ama ${f.ad} hazırlıklıymış.` };
}

/** Düşman bir aileyle barış masası: husumeti indir, bağı yukarı çek (bedelli). */
export function ailePeace(w: World, id: string): { ok: boolean; msg: string } {
  const f = famById(w, id);
  if (!f || !f.alive) return { ok: false, msg: 'Böyle bir aile yok.' };
  if (f.bond >= 20) return { ok: false, msg: `${f.ad} ile zaten husumetin yok.` };
  const cost = L(w, 14000);
  if (!canPay(w, cost)) return { ok: false, msg: `Barış için ${fmt(cost)} lira gerek.` };
  payDirtyFirst(w, cost);
  f.bond = clamp(f.bond + 35, -100, 60);
  log(w, `${f.ad} ile masaya oturuldu; kan durdu, bölgeler belirlendi (bağ ${Math.round(f.bond)}).`, 'olay');
  return { ok: true, msg: `${f.ad} ile barış sağlandı.` };
}

// ---------- Taht ----------

/** Tahta oynamaya yeterli mi? */
export function canChallenge(w: World): { ok: boolean; why: string } {
  if (isBaba(w)) return { ok: false, why: 'Büyük Baba zaten sensin.' };
  if (kademeNo(w) < 9) return { ok: false, why: 'Önce şehirde Baba seviyesine çık.' };
  if (!babaFam(w)) return { ok: false, why: 'Taht şu an boş.' };
  if (w.gang < 16) return { ok: false, why: 'En az on altı adam gerek.' };
  // Tek başına bir imparatorluğu deviremezsin: ya en az iki dost aile, ya çok büyük bir kadro
  if (allies(w).length < 2 && w.gang < 28) return { ok: false, why: 'Önce ailelerden en az ikisini yanına çek ya da çok daha büyük bir kadro topla.' };
  return { ok: true, why: '' };
}

/** Taht hamlesi: 'oylama' (ittifak), 'suikast', 'savas'. */
export function tahtHamle(w: World, kind: 'oylama' | 'suikast' | 'savas'): { ok: boolean; msg: string } {
  const c = canChallenge(w);
  if (!c.ok) return { ok: false, msg: c.why || 'Henüz vakti değil.' };
  const b = babaFam(w)!;
  if (kind === 'oylama') {
    const v = votes(w);
    if (v.mine < v.need) return { ok: false, msg: `Masada yeterli oyun yok (${v.mine.toFixed(1)}/${v.need.toFixed(1)}). Neredeyse bütün aileleri yanına çekmen gerek.` };
    // Büyük Baba ailesi karşı çıkar; hırslı aileler son anda cayar
    const risk = aliveFams(w).filter((f) => f.trait === 'hirs' && f.bond < 70).length * 0.16;
    if (chance(w, clamp(0.7 - risk, 0.25, 0.88))) return seizeThrone(w, 'oylama', b);
    b.bond = clamp(b.bond - 20, -100, 100);
    for (const f of aliveFams(w)) if (f.id !== b.id && f.trait === 'hirs') f.bond = clamp(f.bond - 15, -100, 100);
    log(w, `Oylamada son anda iki aile çark etti; ${b.reis} koltuğunu korudu. Bu iş sana düşman kazandırdı.`, 'olay');
    return { ok: false, msg: 'Oylama tutmadı; aileler cesaret edemedi.' };
  }
  if (kind === 'suikast') {
    if (w.gang < 16) return { ok: false, msg: 'Suikast için en az on altı adam gerek.' };
    w.heat = clamp(w.heat + 34, 0, 100);
    const sagkol = w.flags.rizaOgul === 'sag' || w.flags.delegate ? 0.08 : 0;
    // Vuruş gücü: maaşlı adamların + ailenin silah tutan erkekleri (nüfuzun)
    const p = clamp(0.2 + force(w) * 0.016 - b.men * 0.028 + allies(w).length * 0.04 + sagkol, 0.08, 0.66);
    if (chance(w, p)) return seizeThrone(w, 'suikast', b);
    w.gang = Math.max(0, w.gang - rint(w, 3, 6));
    addKorku(w, 8);
    for (const f of aliveFams(w)) if (f.id !== b.id) f.bond = clamp(f.bond - 18, -100, 100);
    log(w, `Suikast tutmadı: ${b.reis} sağ kurtuldu, adamların kırıldı. Masa sana sırtını döndü; artık herkes seni bitirmek istiyor.`, 'olay');
    return { ok: false, msg: 'Suikast tutmadı; şimdi herkes sana düşman.' };
  }
  // açık savaş
  if (w.gang < 18) return { ok: false, msg: 'Açık savaş için en az on sekiz adam gerek.' };
  w.heat = clamp(w.heat + 40, 0, 100);
  const enemy = b.men * 1.3 + aliveFams(w).filter((f) => f.id !== b.id && f.bond < 20).reduce((a, f) => a + f.men * 0.6, 0);
  const p = clamp(0.18 + force(w) * 0.018 - enemy * 0.016 + allies(w).length * 0.05, 0.08, 0.68);
  if (chance(w, p)) return seizeThrone(w, 'savas', b);
  w.gang = Math.max(0, Math.round(w.gang * 0.5) - rint(w, 1, 3));
  if (w.lab) { w.lab.prod = 0; w.lab.hap = 0; }
  const loss = Math.round(w.hh.cash * 0.25);
  w.hh.cash -= loss;
  log(w, `Açık savaş kaybedildi: ${b.ad} ve müttefikleri ağır bastı; adamlarının yarısı kırıldı, depolar yağmalandı, ${fmt(loss)} liralık malına çöktüler.`, 'olay');
  return { ok: false, msg: `${b.ad} savaşı kazandı. Ağır bir darbe; bu yaraları sarmak yıllar alır.` };
}

function seizeThrone(w: World, how: string, b: CityFamily): { ok: boolean; msg: string } {
  w.city.baba = 'biz';
  w.flags.konsey = 'baba';
  w.city.throneM = w.m;
  w.flags.konseyYenildi = true;
  addSaygi(w, 20);
  addKorku(w, 12);
  w.flags.namBonus = Number(w.flags.namBonus || 0) + 30;
  if (how === 'suikast') {
    b.alive = false; b.men = 0;
    log(w, `${b.reis} bir gece evinin önünde vuruldu. Sabaha ${CITY}'in yeni Büyük Baba'sı belliydi: ${w.surname}. Masada artık son söz senin.`, 'miras');
  } else if (how === 'oylama') {
    b.bond = clamp(b.bond - 10, -100, 100);
    log(w, `Konsey oyladı: masanın başına ${w.surname} geçti. ${b.reis} koltuğunu bırakıp kenara çekildi. ${CITY}'in Büyük Baba'sı sensin.`, 'miras');
  } else {
    b.men = Math.max(0, Math.round(b.men * 0.3));
    b.bond = -80;
    log(w, `Kanlı bir hesaplaşmadan sonra ${b.ad} diz çöktü. ${CITY}'in tahtı ${w.surname} ailesinin. Ama yenilen düşman unutmaz.`, 'miras');
  }
  // Tahta çıkınca dostların yanında, düşmanların sinmiş olur
  for (const f of aliveFams(w)) if (f.id !== b.id) f.bond = clamp(f.bond + 10, -100, 100);
  return { ok: true, msg: `Büyük Baba sensin!` };
}

/** Tahtı bırak / düşürüldü. */
function loseThrone(w: World, toId: string) {
  w.city.baba = toId;
  w.flags.konsey = toId === '' ? 'uye' : 'dusman';
  w.flags.konseyYenildi = false;
  const f = famById(w, toId);
  addSaygi(w, -15);
  log(w, f ? `${CITY}'in tahtı elinden gitti; masanın başına ${f.reis} (${f.ad}) geçti. Yükseliş kadar sert bir düşüş.` : `Büyük Baba koltuğu boşaldı; şehir yeniden karıştı.`, 'olay');
}

// ---------- Aylık ----------
export function monthlyAile(w: World) {
  // Yalnız şehir ağalığına yükselmiş oyuncuda anlam kazanır
  if (!w.city.open || !w.city.moved || kademeNo(w) < 8) return;
  ensureFams(w);
  const F = aliveFams(w);
  if (!F.length) return;

  // Bağlar yavaşça nötre kayar; huya göre aileler güçlenir/zayıflar
  for (const f of F) {
    f.bond = clamp(f.bond + (f.bond > 0 ? -0.5 : f.bond < 0 ? 0.15 : 0), -100, 100); // dostluk bakımsız kalınca söner
    // Mahallesini sen tuttuysan aile küser: turfu bedelsiz büyütmek husumet doğurur
    if (f.dist && w.city.dist.find((d) => d.id === f.dist)?.o === 'biz') f.bond = clamp(f.bond - 0.8, -100, 100);
    // Köklü aileler yavaşça güçlenir: beklersen karşındaki büyür
    if (chance(w, 0.05)) f.men = clamp(f.men + (f.trait === 'hirs' ? rint(w, 1, 2) : rint(w, 0, 1)), 0, 55);
  }

  if (isBaba(w)) {
    // Büyük Baba isen: ailelerden masa payı (kara para), ama huzursuzluk sürer
    const tribute = F.reduce((a, f) => a + Math.max(0, f.bond) * 6, 0);
    if (tribute > 0) { w.dirty += Math.round(tribute * infl(w.m)); }
    // Hırslı/düşman aileler zamanla güç toplar (taht her zaman tehdit altında)
    for (const f of F) if (f.trait === 'hirs' || f.bond < -30) f.men = clamp(f.men + (chance(w, 0.08) ? 1 : 0), 0, 50);
  } else {
    const b = babaFam(w);
    if (b) {
      // Hüküm süren Baba: bağ düşükse haraç/baskı, yüksekse koruma
      if (b.bond < 0 && chance(w, 0.02)) {
        const loss = Math.round(w.hh.cash * 0.05 + L(w, 3000));
        w.hh.cash = Math.max(0, w.hh.cash - loss);
        w.heat = clamp(w.heat + 5, 0, 100);
        log(w, `Büyük Baba ${b.reis} haddini bildirdi: ${fmt(loss)} liralık işine çöktü. "Masada yerini bil."`, 'olay');
      }
      b.men = clamp(b.men + (chance(w, 0.05) ? 1 : 0), 0, 50);
    } else if (w.city.baba && w.city.baba !== 'biz') {
      // baba ailesi dağılmış: taht boş
      w.city.baba = '';
    }
  }
}

// ---------- Kart üretimi ----------
export function aileCards(w: World): boolean {
  if (!w.city.open || !w.city.moved || kademeNo(w) < 8) return false;
  ensureFams(w);
  const F = aliveFams(w);
  if (!F.length) return false;

  // Tanıtım (bir kez)
  if (!w.flags.aileTanit) {
    w.flags.aileTanit = w.m;
    const b = babaFam(w);
    pushCard(w, {
      id: 'it_aile_intro',
      text: `${CITY}'in yeraltı artık seni bir güç olarak görüyor. Şehri paylaşan beş aile var: ${F.map((f) => `${f.ad} (${f.reis}, ${DISTS[f.dist!].ad})`).join('; ')}. Masanın başında ${b ? `${b.reis} oturuyor — Büyük Baba o.` : 'şimdilik kimse oturmuyor.'} Ya onların dostu olursun, ya bir gün o koltuğa sen oturursun.`,
      opts: [{ t: 'Anladım', k: 'ok' }],
    });
    return true;
  }

  // Büyük Baba isen: taht savunması
  if (isBaba(w)) {
    if (w.m - Number(w.city.throneM || 0) > 8 && chance(w, 0.045)) {
      // En güçlü/en düşman aile ya da hırslı bir aile meydan okur
      const ch = [...F].sort((a, b) => (b.men - b.bond) - (a.men - a.bond))[0];
      if (ch && (ch.men >= 14 || ch.bond < -20 || ch.trait === 'hirs')) {
        w.flags.babaMeydan = ch.id;
        pushCard(w, {
          id: 'it_baba_savun',
          text: `Taht sallanıyor: ${ch.reis} (${ch.ad}) masada ayağa kalktı. "${w.surname} yoruldu. Sıra bende." ${ch.men} adamı var ve kulağa gelen o ki bazı aileler de ona göz kırpıyor. Koltuğun için ne yapacaksın?`,
          opts: [
            { t: w.gang >= 8 ? `Adamlarınla ez (${w.gang} adam)` : 'Adamlarınla ez (adamın az)', k: 'ez' },
            { t: `Satın al, masada tut (${fmt(L(w, 40000))} lira)`, k: 'satin' },
            ...(allies(w).length >= 2 ? [{ t: 'Masayı topla, dostlarınla sustur', k: 'masa' }] : []),
          ],
        });
        return true;
      }
    }
    return false;
  }

  // Taht fırsatı: güçlüysen bir kart seni oynamaya çağırır
  const can = canChallenge(w);
  if (can.ok && !w.flags.tahtTeklif && chance(w, 0.025)) {
    w.flags.tahtTeklif = w.m;
    const b = babaFam(w)!;
    const v = votes(w);
    pushCard(w, {
      id: 'it_baba_firsat',
      text: `${b.reis} yaşlandı, masada sesi eskisi gibi çıkmıyor. Arkanda ${w.gang} maaşlı adam ve ailenin silah tutan erkekleriyle ${force(w)} kişilik bir güç, ${allies(w).length} dost ailen var. Sağ kolun kulağına fısıldadı: "Ağabey, vakit bu vakit. O koltuk seni bekliyor." Nasıl oynarsın?`,
      opts: [
        { t: `Masayı topla, seni oylasınlar (oy ${v.mine.toFixed(1)}/${v.need.toFixed(1)})`, k: 'oylama' },
        { t: `Bir gece ${b.reis}'i hallet (suikast)`, k: 'suikast' },
        ...(w.gang >= 14 ? [{ t: 'Açık savaş: şehri kana bula', k: 'savas' }] : []),
        { t: 'Daha vakit var, bekle', k: 'bekle' },
      ],
    });
    return true;
  }

  // Aile olayı: bir aile ittifak/tehdit/ricada bulunur
  if (chance(w, 0.02)) {
    const f = pick(w, F.filter((x) => !isBaba(w) ? true : x.id !== w.city.baba));
    if (!f) return false;
    if (f.bond <= -40) {
      pushCard(w, {
        id: 'it_aile_ev',
        text: `${f.ad} ailesinden ${f.reis} haber saldı: "${w.surname}, sen bu şehre sonradan geldin. ${DISTS[f.dist!].ad} benim. Bir daha oraya adamını sokarsan kan çıkar." ${f.men} adamı var.`,
        opts: [
          { t: `Barış öner (${fmt(L(w, 14000))} lira)`, k: 'baris' },
          ...(w.gang >= 4 ? [{ t: 'Pusu kur, haddini bildir', k: 'pusu' }] : []),
          { t: 'Boş ver, oralı olma', k: 'yok' },
        ],
        data: { fid: f.id },
      });
      return true;
    }
    if (f.bond >= 50 && f.trait !== 'hirs') {
      pushCard(w, {
        id: 'it_aile_ev',
        text: `${f.reis} (${f.ad}) seni yemeğe çağırdı. "${w.surname}, biz seni kendimizden sayıyoruz. Gel, bir kız alıp verelim, akraba olalım; bu masada arkanı ben kollarım." ${f.trait === 'sadakat' ? 'Sözünün eri bir ailedir.' : ''}`,
        opts: [
          { t: 'Akraba olalım: bağımızı mühürle', k: 'akraba' },
          { t: 'Dostluk yeter', k: 'dost' },
        ],
        data: { fid: f.id },
      });
      return true;
    }
    if (f.trait === 'para' && chance(w, 0.5)) {
      pushCard(w, {
        id: 'it_aile_ev',
        text: `${f.reis} (${f.ad}) bir iş teklif etti: ortak bir yük, temiz para. Ama güveni pahalı: ${fmt(L(w, 12000))} lira koyarsan ortaklık kurulur, bağınız güçlenir.`,
        opts: [
          { t: `Ortak ol (${fmt(L(w, 12000))} lira)`, k: 'ortak' },
          { t: 'Bu sefer olmaz', k: 'yok' },
        ],
        data: { fid: f.id },
      });
      return true;
    }
  }
  return false;
}

// ---------- Çözümleme ----------
export function resolveAile(w: World, id: string, k: string, data?: Record<string, unknown>): boolean {
  if (id === 'it_aile_intro') return true;

  if (id === 'it_baba_firsat') {
    if (k === 'bekle') return true;
    tahtHamle(w, k as 'oylama' | 'suikast' | 'savas');
    return true;
  }

  if (id === 'it_baba_savun') {
    const ch = famById(w, String(w.flags.babaMeydan || ''));
    if (!ch) return true;
    if (k === 'ez') {
      w.heat = clamp(w.heat + 15, 0, 100);
      const p = clamp(0.35 + w.gang * 0.03 - ch.men * 0.02, 0.15, 0.85);
      if (chance(w, p)) {
        ch.men = Math.max(0, ch.men - rint(w, 3, 6));
        ch.bond = -70;
        addKorku(w, 10);
        log(w, `${ch.reis}'in isyanı bastırıldı; adamları kırıldı, kendisi sindi. Taht yerinde.`, 'olay');
        if (ch.men <= 0) famFalls(w, ch, 'savun');
      } else {
        w.gang = Math.max(0, w.gang - rint(w, 3, 6));
        if (chance(w, 0.55)) loseThrone(w, ch.id);
        else log(w, `${ch.reis} sert çıktı; adamların kırıldı ama tahtı kıl payı tuttun.`, 'olay');
      }
    } else if (k === 'satin') {
      if (canPay(w, L(w, 40000))) {
        payDirtyFirst(w, L(w, 40000));
        ch.bond = clamp(ch.bond + 40, -100, 80);
        log(w, `${ch.reis} altınla yatıştırıldı; şimdilik koltuğun güvende. Ama satın alınan sadakat ucuzdur.`, 'olay');
      } else {
        if (chance(w, 0.5)) loseThrone(w, ch.id);
        else log(w, `Parayı denkleştiremedin ama ${ch.reis} tereddüt etti.`, 'olay');
      }
    } else {
      // masa: dostlarla sustur
      const al = allies(w).length;
      if (chance(w, clamp(0.3 + al * 0.14, 0.3, 0.85))) {
        ch.bond = clamp(ch.bond - 10, -100, 100);
        log(w, `Dost aileler ${ch.reis}'e "otur yerine" dedi; isyan masada bastırıldı. Dostların arkanda.`, 'olay');
      } else {
        if (chance(w, 0.45)) loseThrone(w, ch.id);
        else log(w, `Masada istediğin desteği bulamadın; ${ch.reis} daha da cüretlendi.`, 'olay');
      }
    }
    w.flags.babaMeydan = '';
    return true;
  }

  if (id === 'it_aile_ev') {
    const f = famById(w, String(data?.fid || ''));
    if (!f) return true;
    if (k === 'baris') { ailePeace(w, f.id); }
    else if (k === 'pusu') { ailePress(w, f.id); }
    else if (k === 'akraba') { f.bond = clamp(f.bond + 30, -100, 100); addSaygi(w, 6); log(w, `${f.ad} ile akraba olundu; masada en sağlam dostun artık onlar.`, 'evlilik'); }
    else if (k === 'dost') { f.bond = clamp(f.bond + 8, -100, 100); }
    else if (k === 'ortak') { if (canPay(w, L(w, 12000))) { payDirtyFirst(w, L(w, 12000)); f.bond = clamp(f.bond + 20, -100, 100); w.dirty += L(w, 20000); log(w, `${f.ad} ile ortak iş kuruldu; kasaya kara para aktı, bağınız güçlendi.`, 'para'); } }
    else if (k === 'yok') { if (f.bond <= -40) { f.bond = clamp(f.bond - 5, -100, 100); } }
    return true;
  }
  return false;
}

/** Bir aile dağıldı: mahallesi serbest kalır, taht boşsa karışır. */
function famFalls(w: World, f: CityFamily, _how: string) {
  f.alive = false; f.men = 0;
  w.flags.namBonus = Number(w.flags.namBonus || 0) + 8;
  if (f.dist) { const d = w.city.dist.find((x) => x.id === f.dist); if (d && d.o !== 'biz') d.o = w.city.moved ? 'biz' : 'serbest'; }
  log(w, `${f.ad} ailesi dağıldı; ${f.dist ? `${DISTS[f.dist].ad} ${w.city.moved ? 'senin oldu' : 'sahipsiz kaldı'}. ` : ''}Masada bir sandalye daha boşaldı.`, 'olay');
  if (w.city.baba === f.id) w.city.baba = '';
}
