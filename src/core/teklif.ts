// Sözleşmeli iş teklifleri: ara ara gelen, ailenin yıllarca kazanacağı parayı tek seferde vaat eden tehlikeli işler.
// Gönderdiğin kişi (maaşlı adamın ya da aileden biri) cezaevine girebilir, hatta ölebilir.
// KAPSAM: hedef daima yeraltından biri / rakip aileden biri ya da soyut "mal taşıma"dır. Devlet görevlisi asla hedef değildir.
import type { Person, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { die } from './life';
import { jailYears } from './events';
import { rP } from './feud';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

/** Ailenin kabaca yıllık kazancı (teklif bedelini ölçeklemek için). */
function annualIncome(w: World): number {
  const li = (w.lastIncome || 0) * 12;
  const floor = 2600 * infl(w.m) * (1 + w.hh.parcels.length * 0.4);
  return Math.max(li, floor);
}

/** İşe gönderilebilecek aile ferdi: cesur, yetişkin, oyuncu/varis değil. */
function brave(w: World): Person | undefined {
  return hhMembers(w)
    .filter((p) => p.blood && p.sex === 'E' && !p.away && age(w, p) >= 18 && age(w, p) <= 55 && p.id !== w.playerId && p.id !== w.heirId)
    .sort((a, b) => (b.tr.hirs + b.tr.beden) - (a.tr.hirs + a.tr.beden))[0];
}

export function teklifCards(w: World): boolean {
  if (w.flags.interregnum || w.over) return false;
  if (Number(w.flags.teklifNext || 0) > w.m) return false;
  const pl = P(w, w.playerId);
  if (!alive(pl)) return false;
  // Yeraltına bulaşmış olmak gerekir: ya Rıza ile tanışık, ya adamın var, ya şehir açık.
  const inWorld = !!w.flags.kacakci || w.gang > 0 || w.city.open;
  if (!inWorld) return false;
  const cand = brave(w);
  if (w.gang < 1 && !cand) return false;
  if (!chance(w, 0.05)) return false;

  const yillik = annualIncome(w);
  const bigJob = w.city.open || w.gang >= 3;
  const kind = bigJob && chance(w, 0.5) ? 'is' : 'tasi';
  const reward = Math.round(yillik * (kind === 'is' ? rint(w, 4, 6) : rint(w, 3, 4)) / 500) * 500;

  const who = w.city.open ? pick(w, ['şehirden bir tüccar', 'Çukurkent\'ten tanıdık bir adam', 'limandaki bir komisyoncu']) : (w.flags.kacakci ? 'Kara Rıza\'nın adamlarından biri' : 'kasabadan tanıdık biri');

  const opts: { t: string; k: string }[] = [];
  if (w.gang >= 1) opts.push({ t: 'Maaşlı adamlarımdan birini yolla', k: 'man' });
  if (cand) opts.push({ t: `${cand.first}'i (${age(w, cand)}) gönder`, k: 'rel' });
  opts.push({ t: 'Bu işe bulaşmam', k: 'hayir' });

  const text = kind === 'tasi'
    ? `Gece kahvede ${who} yanına oturdu: "Bir yük var, ${w.city.open ? 'şehrin öbür ucuna' : 'kasabaya'} sağ salim götürülecek. Kimse açıp bakmayacak. İşi tutana ${fmt(reward)} lira — peşin." Böyle bir para ailenin yıllarca çalışıp kazanacağı kadar. Ama yük ortada kalırsa taşıyan içeri girer.`
    : `${who} sesini alçalttı: "${!w.rival.gone ? rP(w) + "'dan" : 'Bir aileden'} bir baş belası var; ortadan kaybolursa herkes rahatlar. Bu iş için ${fmt(reward)} lira veririm." Ağır para, ama ağır iş: giden ya yıllarca yatar ya dönmez.`;

  pushCard(w, {
    id: kind === 'tasi' ? 'teklif_tasi' : 'teklif_is',
    text,
    opts,
    data: { reward, pid: cand?.id },
  });
  w.flags.teklifNext = w.m + rint(w, 10, 28);
  return true;
}

export function resolveTeklif(w: World, id: string, k: string, data: Record<string, unknown> | undefined): boolean {
  if (id !== 'teklif_tasi' && id !== 'teklif_is') return false;
  const hit = id === 'teklif_is';
  const reward = (data?.reward as number) || 0;
  if (k === 'hayir') {
    log(w, `Teklif geri çevrildi. ${hit ? 'Böyle işlere bulaşmadın; kimileri "akıllı adam" dedi.' : 'Yükü taşımadın; adam başkasını buldu.'}`, 'olay');
    return true;
  }

  // Gönderilen kişi ve başarı/ risk
  let sent: Person | undefined;
  let name = 'Adamın';
  if (k === 'rel') { sent = P(w, data?.pid as string); if (sent) name = fullName(sent); }
  const useMan = k === 'man' || !sent;
  if (useMan && w.gang < 1) { log(w, 'Gönderecek adam kalmamıştı; iş suya düştü.', 'olay'); return true; }

  // Başarı şansı: adam daha profesyonel; aile ferdi daha riskli. Hit işi genel olarak daha tehlikeli.
  const skill = useMan ? 0.72 : clamp(0.5 + ((sent!.tr.hirs + sent!.tr.beden) / 40), 0.45, 0.8);
  const succ = clamp(skill - (hit ? 0.18 : 0) + (w.city.net ? 0.06 : 0), 0.25, 0.9);

  if (chance(w, succ)) {
    // Başarılı: para gelir, dikkat/korku artar
    w.hh.cash += reward;
    w.heat = clamp(w.heat + (hit ? 18 : 9), 0, 100);
    w.flags.korku = clamp(Number(w.flags.korku || 0) + (hit ? 10 : 3), 0, 100);
    if (hit) {
      w.flags.baskiPuan = Number(w.flags.baskiPuan || 0) + 6;
      if (w.rival && !w.rival.gone) { w.rival.feud = clamp(w.rival.feud + 20, 0, 100); w.rival.men = Math.max(0, w.rival.men - 1); }
      log(w, `İş temiz bitti. ${useMan ? 'Adamların' : name} ortalığı toparladı; ${fmt(reward)} lira kasaya girdi. Artık senden çekiniyorlar ama jandarma da kulak kabarttı.`, 'para');
    } else {
      log(w, `Yük yerine ulaştı. ${fmt(reward)} lira peşin alındı. ${useMan ? 'Adamların' : name} işi sorunsuz götürdü.`, 'para');
    }
    if (sent && k === 'rel') sent.rel = clamp(sent.rel + 6, -100, 100);
    return true;
  }

  // Başarısız: iş ters gitti
  w.heat = clamp(w.heat + (hit ? 24 : 14), 0, 100);
  if (useMan) {
    w.gang = Math.max(0, w.gang - 1);
    const dead = hit && chance(w, 0.5);
    log(w, dead
      ? `İş ters gitti; adamlarından biri vuruldu, cesedi dere yatağında bulundu. Para da gelmedi, dikkat de arttı.`
      : `İş ters gitti; adamlarından biri yakalanıp içeri girdi. Para gelmedi.`, 'olay');
    return true;
  }
  // Aile ferdi gönderildi: cezaevi ya da ölüm
  if (sent && alive(sent)) {
    if (hit && chance(w, 0.4)) {
      die(w, sent, 'karanlık bir işte');
      log(w, `${name} o işten sağ dönmedi. Bir kurşun, bir de kapıda bırakılan ceset... Aileye yıllarca sürecek bir yas ve bir kan davası kaldı.`, 'olum');
      if (w.rival && !w.rival.gone) w.rival.feud = clamp(w.rival.feud + 25, 0, 100);
    } else {
      const yil = jailYears(w, rint(w, hit ? 10 : 4, hit ? 18 : 9));
      sent.away = 'hapis';
      sent.awayUntil = w.m + 12 * yil;
      sent.job = 'yok';
      sent.parcel = undefined;
      sent.rel = clamp(sent.rel - 12, -100, 100);
      log(w, `${name} suçüstü yakalandı. ${yil} yıl hapis yedi; o para yerine ailenin boynuna bir dava, bir de utanç bindi.`, 'olay');
    }
  }
  return true;
}
