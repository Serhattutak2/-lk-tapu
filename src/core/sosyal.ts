// Sosyal/ekonomik olay paketi (v1.2): mevcut sistemlerle çakışmayan, taze durumlar.
// Dört olay: ticaret kervanı, eşraf ağırlama, şenlik sponsorluğu, bilge hoca danışması.
// Hepsi soyut, sınırlı etkili oyun olaylarıdır. Kart idleri "g3_" önekiyle başlar (bot + DECISION tanır).
import type { World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log, fullName, hhMembers, P, alive } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { addSaygi } from './guc';
import { nam } from './assets';

const L = (w: World, n: number) => Math.round(n * infl(w.m));
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const bump = (w: World, d: number) => { w.flags.namBonus = Number(w.flags.namBonus || 0) + d; };

// ---------------- 1) Ticaret kervanı ----------------
function kervanCard(w: World): boolean {
  if (!chance(w, 0.4)) return false;
  const nerede = w.city.moved ? 'şehrin hanına' : 'köyün yoluna';
  pushCard(w, {
    id: 'g3_kervan',
    text: `Uzak diyarlardan bir ticaret kervanı ${nerede} indi. Kervanbaşı malını toptan, ucuza bırakmak istiyor — ${w.city.moved ? 'şehirde' : 'pazarda'} iyi paraya satılır ama yolda bozulur, çalınır, fiyat düşer; risk senin. ${fmt(L(w, 6000))} lira ister.`,
    opts: [
      { t: `Toptan al, kârına sat (${fmt(L(w, 6000))} lira — belki kazanç, belki zarar)`, k: 'al' },
      { t: 'Riske girme, geç', k: 'yok' },
    ],
  });
  return true;
}

// ---------------- 2) Eşraf/bey ağırlama ----------------
function esrafCard(w: World): boolean {
  if (nam(w) < 15 && !w.city.open) return false;
  if (!chance(w, 0.35)) return false;
  const kim = w.city.moved ? 'şehrin ileri gelenlerinden biri' : 'yörenin beyi';
  pushCard(w, {
    id: 'g3_esraf',
    text: `Haber geldi: ${kim} yolu buraya düşmüş, bu akşam senin konuğun olacak. Nasıl ağırladığın kulaktan kulağa yayılır — iyi bir sofra itibar kazandırır, cimrilik ise dile düşürür.`,
    opts: [
      { t: `Kapını aç, ziyafet ver (${fmt(L(w, 4000))} lira)`, k: 'agirla' },
      { t: 'Sade bir sofrayla karşıla', k: 'sade' },
    ],
  });
  return true;
}

// ---------------- 3) Şenlik sponsorluğu ----------------
function senlikCard(w: World): boolean {
  if (!chance(w, 0.3)) return false;
  const tur = w.city.moved ? pick(w, ['mahalle şenliği', 'esnaf bayramı']) : pick(w, ['hasat şenliği', 'bahar hıdırellezi', 'güreş meydanı']);
  pushCard(w, {
    id: 'g3_senlik',
    text: `Bu yıl ${tur} için para toplanıyor. Davul zurna, ikram, ödüller… Masrafı sen üstlenirsen şenlik senin adınla anılır, halkın gönlünü kazanırsın.`,
    opts: [
      { t: `Şenliği sen finanse et (${fmt(L(w, 3500))} lira)`, k: 'sponsor' },
      { t: 'Bu sene karışma', k: 'yok' },
    ],
  });
  return true;
}

// ---------------- 4) Bilge hoca danışması ----------------
function hocaCard(w: World): boolean {
  if (!chance(w, 0.3)) return false;
  pushCard(w, {
    id: 'g3_hoca',
    text: `Diyar diyar gezen, sözü dinlenen yaşlı bir âlim kasabaya uğradı. Kapına gelip akıl danışabilir, hayır duasını alabilirsin — böyle adamların duası da bereketi de konuşulur.`,
    opts: [
      { t: `Danış, hayır duasını al (${fmt(L(w, 1500))} lira sadaka)`, k: 'danis' },
      { t: 'Yoluna devam etsin', k: 'yok' },
    ],
  });
  return true;
}

/** Dağıtıcı: her ay sırayla dener; biri tetiklenince genel bekleme koyar. */
export function sosyalCards(w: World): boolean {
  if (w.flags.interregnum || w.over) return false;
  if (Number(w.flags.g3next || 0) > w.m) return false;
  const fired = kervanCard(w) || esrafCard(w) || senlikCard(w) || hocaCard(w);
  if (fired) w.flags.g3next = w.m + rint(w, 8, 16);
  return fired;
}

export function resolveSosyal(w: World, id: string, k: string): boolean {
  if (id === 'g3_kervan') {
    if (k === 'al') {
      const bet = L(w, 6000);
      if (w.hh.cash < bet) { log(w, `Kervandan mal alacak nakdin yoktu.`, 'para'); return true; }
      w.hh.cash -= bet;
      const pl = P(w, w.playerId);
      const tic = pl ? (pl.sk?.ticaret ?? 0) : 0; // ticaret yeteneği şansı iyileştirir
      if (chance(w, clamp(0.45 + tic / 250, 0.45, 0.8))) {
        const kar = Math.round(bet * (1.4 + rint(w, 0, 10) / 10));
        w.hh.cash += kar;
        log(w, `Kervandan aldığın malı iyi paraya sattın; ${fmt(kar)} lira döndü. Ticaret aklın para kazandırdı.`, 'para');
      } else {
        const kalan = Math.round(bet * (0.3 + rint(w, 0, 4) / 10));
        w.hh.cash += kalan;
        log(w, `Mal umduğun gibi gitmedi — bir kısmı bozuldu, fiyat düştü. Koyduğun paranın ancak ${fmt(kalan)} lirasını kurtardın.`, 'para');
      }
    } else log(w, `Kervanı uğurladın; riske girmedin.`, 'olay');
    return true;
  }

  if (id === 'g3_esraf') {
    if (k === 'agirla') {
      w.hh.cash -= L(w, 4000);
      addSaygi(w, 7);
      bump(w, 6);
      for (const m of hhMembers(w)) if (alive(m)) m.rel = clamp(m.rel + 2, -100, 100);
      log(w, `Konuğu görkemli bir sofrayla ağırladın; adın "eli açık, sofrası bol" diye anıldı. Hanen de bu itibardan gurur duydu.`, 'olay');
    } else {
      addSaygi(w, 1);
      log(w, `Konuğu sade bir sofrayla karşıladın; kimse incinmedi ama kimse de etkilenmedi.`, 'olay');
    }
    return true;
  }

  if (id === 'g3_senlik') {
    if (k === 'sponsor') {
      w.hh.cash -= L(w, 3500);
      addSaygi(w, 6);
      bump(w, 8);
      for (const m of hhMembers(w)) if (alive(m)) m.rel = clamp(m.rel + 1, -100, 100);
      log(w, `Şenliğin masrafını üstlendin; meydan senin adınla doldu, halk seni bağrına bastı.`, 'olay');
    } else log(w, `Şenliğe karışmadın; bu sene başkaları öne çıktı.`, 'olay');
    return true;
  }

  if (id === 'g3_hoca') {
    if (k === 'danis') {
      w.hh.cash -= L(w, 1500);
      // Küçük bir hayır: hastaysa hanenden birine şifa, değilse itibar/bağlılık
      const hasta = hhMembers(w).find((m) => alive(m) && Number(m.sick || 0) > 0);
      if (hasta) {
        hasta.sick = Math.max(0, Number(hasta.sick) - rint(w, 1, 3));
        hasta.hp = clamp(hasta.hp + rint(w, 5, 12), 0, 100);
        log(w, `Âlime danıştın, duasını aldın; ${fullName(hasta)} o günlerde toparlanmaya başladı. Kimi "duanın bereketi" dedi.`, 'olay');
      } else {
        bump(w, 4);
        addSaygi(w, 3);
        log(w, `Âlimin sohbeti ve duası eve bereket kattı; verdiğin akılla işlerin biraz daha rahat yürüdü.`, 'olay');
      }
    } else log(w, `Âlimi ağırlamadan yoluna uğurladın.`, 'olay');
    return true;
  }

  return false;
}
