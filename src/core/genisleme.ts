// Genişleme paketi (v4): mevcut derin sistemleri KIRMADAN onları tamamlayan yeni kararlar.
// Altı tema: köy→şehir işçi göçü, köy işleri, Konsey'in ortak talepleri, yeraltı derinliği,
// soyut lab piyasası, itibar/nam ekseni, stratejik evlilik. Hepsi soyut oyun olaylarıdır;
// gerçek üretim/işleme yöntemi YOKTUR. Tüm kart idleri "g2_" önekiyle başlar (bot + DECISION bunu tanır).
import type { World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log, fullName, hhMembers, bloodLiving, age, P, alive } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { korku, saygi, addKorku, addSaygi, kademeNo } from './guc';
import { nam } from './assets';
import { aliveFams, ensureFams } from './aile';

const L = (w: World, n: number) => Math.round(n * infl(w.m));
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

/** İtibar ekseni: + cömert/namuslu … − korkulan/sert. Sadece renk/anlatı için tutulur. */
function shiftItibar(w: World, d: number) {
  w.flags.itibarEksen = clamp(Number(w.flags.itibarEksen || 0) + d, -100, 100);
}

// ---------------- 1) Köy → Şehir: işçi göçü ----------------
function gocCard(w: World): boolean {
  if (!w.city.open || !w.city.moved) return false;
  if (Object.keys(w.city.facs).length === 0) return false; // işçi ihtiyacı olsun
  if (!chance(w, 0.5)) return false;
  pushCard(w, {
    id: 'g2_goc',
    text: `Köyden şehre göç büyüyor: traktör tarlada insanın işini aldı, gençler iş aramak için ${w.city.firm ? 'senin kapına' : 'sanayiye'} akın ediyor. Kapında onlarca yoksul, iş bekleyen adam var. Ne yaparsın?`,
    opts: [
      { t: `Fabrikalarında çalıştır (${fmt(L(w, 6000))} lira — ucuz işçi, bol üretim)`, k: 'isci' },
      { t: 'Aralarından sağlamları yanına al (adam topla)', k: 'adam' },
      { t: 'Kapıyı kapat, işim olmaz', k: 'yok' },
    ],
  });
  return true;
}

// ---------------- 2) Köy işleri ----------------
function koyisCard(w: World): boolean {
  if (w.city.moved) return false;
  const pl = P(w, w.playerId);
  if (!pl || age(w, pl) < 16) return false;
  if (!chance(w, 0.4)) return false;
  const kind = pick(w, ['irgat', 'degirmen', 'pazar']);
  if (kind === 'irgat') {
    pushCard(w, {
      id: 'g2_koyis',
      text: `Hasat vakti geldi, çevre köyler ırgat arıyor. Sözü geçen biri olarak gündelikçileri toplayıp tarlalara götürebilir, aradan da pay alabilirsin.`,
      opts: [
        { t: 'Irgatbaşı ol, ekipleri sen kur', k: 'irgat' },
        { t: 'Uğraşmam', k: 'yok' },
      ],
    });
  } else if (kind === 'degirmen') {
    pushCard(w, {
      id: 'g2_koyis',
      text: `Köyün değirmeni yaşlı Rüstem'den kaldı; oğulları şehre gitti. Değirmene ortak olup un öğütme işinden pay alabilirsin (${fmt(L(w, 2500))} lira).`,
      opts: [
        { t: `Ortak ol (${fmt(L(w, 2500))} lira)`, k: 'degirmen' },
        { t: 'Gerek yok', k: 'yok' },
      ],
    });
  } else {
    pushCard(w, {
      id: 'g2_koyis',
      text: `İlçe pazarında bir tezgâh boşaldı. Köyün ürününü toplayıp pazarda satan olursan hem köylü kazanır hem sen aradan pay alırsın.`,
      opts: [
        { t: 'Pazarcılığa başla', k: 'pazar' },
        { t: 'Bu iş bana göre değil', k: 'yok' },
      ],
    });
  }
  return true;
}

// ---------------- 3) Konsey'in ortak talebi ----------------
function konseyTalepCard(w: World): boolean {
  if (!w.city.open || !w.city.moved || kademeNo(w) < 8) return false;
  if (w.city.baba === 'biz') return false; // Baba isen sana talep gelmez
  ensureFams(w);
  const F = aliveFams(w);
  if (F.length < 2) return false;
  if (!chance(w, 0.4)) return false;
  pushCard(w, {
    id: 'g2_konsey_talep',
    text: `Konsey topluca haber saldı: "${w.surname}, bu şehirde kazanıyorsun ama masaya payını vermiyorsun. Ya ortak kasaya katkını yaparsın, ya da bu masa sana kapanır." Beş ailenin ortak sesi bu.`,
    opts: [
      { t: `Masa payını öde (${fmt(L(w, 20000))} lira)`, k: 'ode' },
      { t: 'Güçlü bir aileye jest yap, gönlünü al', k: 'jest' },
      { t: 'Reddet: "Kimseye hesap vermem"', k: 'ret' },
    ],
  });
  return true;
}

// ---------------- 4) Yeraltı derinliği: kabadayı ----------------
function yerCard(w: World): boolean {
  if (w.gang < 1 && !w.city.open) return false;
  if (!chance(w, 0.4)) return false;
  pushCard(w, {
    id: 'g2_yer',
    text: `${w.city.moved ? 'Mahallenin' : 'Kasabanın'} tanınmış bir kabadayısı karşına dikildi: "Senin adını duyuyorum. Ya beni yanına alırsın, ya da bu sokaklarda işin zorlaşır." Yanında birkaç adamı da var.`,
    opts: [
      { t: `Maaşa bağla, yanına al (${fmt(L(w, 5000))} lira)`, k: 'al' },
      { t: 'Haddini bildir, korkut', k: 'doven' },
      { t: 'İşim olmaz, geç', k: 'yok' },
    ],
  });
  return true;
}

// ---------------- 5) Soyut lab piyasası (gerçek yöntem YOK) ----------------
function labPiyasaCard(w: World): boolean {
  if (!w.lab) return false;
  const stok = (w.lab.prod || 0) + (w.lab.hap || 0);
  if (stok < 2) return false;
  if (!chance(w, 0.45)) return false;
  pushCard(w, {
    id: 'g2_lab_piyasa',
    text: `Uzaktan bir alıcı haber yolladı: elindeki malın tamamını bir kerede, peşin almak istiyor — ama pazarlık sert. Şimdi toptan boşaltırsan kasaya iyi para girer; beklersen fiyat yükselebilir de düşebilir de.`,
    opts: [
      { t: 'Toptan sat, eldekini boşalt', k: 'sat' },
      { t: 'Beklet, fiyat yükselsin (riskli)', k: 'bekle' },
    ],
  });
  return true;
}

// ---------------- 6) İtibar / nam ekseni ----------------
function itibarCard(w: World): boolean {
  if (nam(w) < 25 && !w.city.open) return false;
  if (!chance(w, 0.35)) return false;
  pushCard(w, {
    id: 'g2_itibar',
    text: `Sana borçlu, eli darda bir aile kapına geldi; borcu ödeyecek halleri yok. Mahallenin gözü üstünde: nasıl davranırsan öyle anılacaksın.`,
    opts: [
      { t: 'Borcu sil, cömertlik göster', k: 'comert' },
      { t: 'Ödet, herkese ders olsun', k: 'korkut' },
    ],
  });
  return true;
}

// ---------------- 7) Stratejik evlilik (köy/kasaba) ----------------
function evlilikCard(w: World): boolean {
  if (w.city.moved) return false;
  if (w.rival.gone || w.rival.feud < 20) return false;
  const genc = bloodLiving(w).find((p) => alive(p) && age(w, p) >= 17 && age(w, p) <= 45 && p.id !== w.playerId && !alive(P(w, p.sp)));
  if (!genc) return false;
  if (!chance(w, 0.3)) return false;
  pushCard(w, {
    id: 'g2_evlilik',
    text: `Köyün ileri gelenleri araya girdi: ${w.rival.name} ailesiyle kan davasını durdurmak için bir yol var — ${fullName(genc)} ile onların bir ferdini evlendirmek. Kız alıp vermek iki ocağı akraba yapar, kanı durdurur. Çeyiz ve düğün ${fmt(L(w, 3500))} liraya mal olur.`,
    opts: [
      { t: `Dünürlük kur, kanı durdur (${fmt(L(w, 3500))} lira)`, k: 'evet' },
      { t: 'Olmaz, bu düşmanlık biterse ben biterim', k: 'yok' },
    ],
    data: { pid: genc.id },
  });
  return true;
}

/** Dağıtıcı: her ay sırayla dener; biri tetiklenince genel bekleme koyar. */
export function genislemeCards(w: World): boolean {
  if (w.flags.interregnum || w.over) return false;
  if (Number(w.flags.g2next || 0) > w.m) return false;
  const fired =
    konseyTalepCard(w) || gocCard(w) || labPiyasaCard(w) || yerCard(w) ||
    itibarCard(w) || evlilikCard(w) || koyisCard(w);
  if (fired) w.flags.g2next = w.m + rint(w, 7, 15);
  return fired;
}

export function resolveGenisleme(w: World, id: string, k: string, data?: Record<string, unknown>): boolean {
  if (id === 'g2_goc') {
    if (k === 'isci') {
      w.hh.cash -= L(w, 6000);
      const kazanc = L(w, rint(w, 9000, 17000));
      w.hh.cash += kazanc;
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 4;
      shiftItibar(w, 6);
      log(w, `Göçmen işçileri fabrikalarında çalıştırdın; ucuz emek üretimi uçurdu, sezon sonunda ${fmt(kazanc)} lira kâr çıktı. "İş veren adam" dediler.`, 'para');
    } else if (k === 'adam') {
      w.hh.cash -= L(w, 4000);
      w.gang += rint(w, 1, 2);
      addKorku(w, 4);
      w.heat = clamp(w.heat + 4, 0, 100);
      log(w, `Göçmenlerin arasından sağlam birkaç delikanlıyı yanına kattın; kadron büyüdü.`, 'olay');
    } else {
      shiftItibar(w, -2);
      log(w, `Kapını kapattın; iş bekleyenler başka kapılara dağıldı.`, 'olay');
    }
    return true;
  }

  if (id === 'g2_koyis') {
    if (k === 'irgat') {
      const kazanc = L(w, rint(w, 1500, 3500));
      w.hh.cash += kazanc;
      addSaygi(w, 4);
      log(w, `Irgat ekiplerini kurup tarlalara götürdün; aradan ${fmt(kazanc)} lira pay aldın, köylü "işini bilen adam" dedi.`, 'para');
    } else if (k === 'degirmen') {
      w.hh.cash -= L(w, 2500);
      const kazanc = L(w, rint(w, 3500, 6000));
      w.hh.cash += kazanc;
      log(w, `Değirmene ortak oldun; un öğütme işinden sezon boyunca ${fmt(kazanc)} lira döndü.`, 'para');
    } else if (k === 'pazar') {
      const kazanc = L(w, rint(w, 2000, 4500));
      w.hh.cash += kazanc;
      addSaygi(w, 3);
      log(w, `İlçe pazarında tezgâh açtın; köyün ürününü satıp ${fmt(kazanc)} lira kazandın.`, 'para');
    } else {
      log(w, `Köy işine girmedin.`, 'olay');
    }
    return true;
  }

  if (id === 'g2_konsey_talep') {
    const F = aliveFams(w);
    if (k === 'ode') {
      const cost = L(w, 20000);
      if (w.dirty >= cost) w.dirty -= cost; else w.hh.cash -= cost;
      for (const f of F) f.bond = clamp(f.bond + 6, -100, 100);
      log(w, `Masa payını ödedin; beş ailenin de yüzü yumuşadı. Şimdilik seni rahat bırakırlar.`, 'para');
    } else if (k === 'jest') {
      const cost = L(w, 12000);
      if (w.dirty >= cost) w.dirty -= cost; else w.hh.cash -= cost;
      const strong = [...F].sort((a, b) => b.men - a.men)[0];
      if (strong) strong.bond = clamp(strong.bond + 14, -100, 100);
      for (const f of F) if (f !== strong) f.bond = clamp(f.bond + 2, -100, 100);
      log(w, `En güçlü aileye büyük bir jest yaptın; ${strong ? strong.reis : 'reis'} seni masada savundu, gerginlik dağıldı.`, 'olay');
    } else {
      for (const f of F) f.bond = clamp(f.bond - 10, -100, 100);
      addKorku(w, 6);
      w.heat = clamp(w.heat + 4, 0, 100);
      shiftItibar(w, -4);
      log(w, `Konsey'e boyun eğmedin: "Kimseye hesap vermem." Beş aile de bu cevabı unutmayacak; husumet büyüdü.`, 'olay');
    }
    return true;
  }

  if (id === 'g2_yer') {
    if (k === 'al') {
      w.hh.cash -= L(w, 5000);
      w.gang += 1;
      addKorku(w, 3);
      log(w, `Kabadayıyı maaşa bağladın; sokakta lafın daha çok geçer artık.`, 'olay');
    } else if (k === 'doven') {
      w.heat = clamp(w.heat + 6, 0, 100);
      addKorku(w, 5);
      if (chance(w, clamp(0.4 + w.gang * 0.03, 0.3, 0.8))) {
        log(w, `Kabadayıya haddini bildirdin; adamlarıyla sinip köşesine çekildi. Korkun arttı.`, 'olay');
      } else {
        w.gang = Math.max(0, w.gang - 1);
        log(w, `Kabadayı sert çıktı; arbede oldu, bir adamın yaralandı. Husumet büyüdü.`, 'olay');
      }
    } else {
      log(w, `Kabadayıyla uğraşmadın, yoluna gittin.`, 'olay');
    }
    return true;
  }

  if (id === 'g2_lab_piyasa') {
    if (!w.lab) return true;
    const stok = (w.lab.prod || 0) + (w.lab.hap || 0);
    if (k === 'sat') {
      const birim = L(w, 1400);
      const gelir = Math.round(stok * birim * clamp(Number(w.lab.talep ?? 1), 0.75, 1.45));
      w.dirty += gelir;
      w.lab.prod = 0; w.lab.hap = 0;
      w.lab.talep = clamp((w.lab.talep ?? 1) - 0.1, 0.75, 1.45);
      w.heat = clamp(w.heat + 4, 0, 100);
      log(w, `Eldeki malı toptan boşalttın; kara kasaya ${fmt(gelir)} lira girdi. Piyasa bir süre durgunlaşır.`, 'para');
    } else {
      if (chance(w, 0.5)) {
        w.lab.talep = clamp((w.lab.talep ?? 1) + 0.2, 0.75, 1.45);
        log(w, `Bekledin ve kazandın: piyasada mal kıtlaştı, fiyat yükseldi. Elindeki daha değerli şimdi.`, 'olay');
      } else {
        w.lab.talep = clamp((w.lab.talep ?? 1) - 0.18, 0.75, 1.45);
        log(w, `Beklemek ters tepti: piyasaya bol mal düştü, fiyat geriledi. Elindeki değer kaybetti.`, 'olay');
      }
    }
    return true;
  }

  if (id === 'g2_itibar') {
    if (k === 'comert') {
      w.hh.cash -= L(w, rint(w, 2000, 5000));
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 8;
      addSaygi(w, 6);
      shiftItibar(w, 12);
      log(w, `Borcu sildin, eli darda aileyi kurtardın. Mahalle "yüreği var" dedi; adın temiz anıldı.`, 'olay');
    } else {
      const al = L(w, rint(w, 3000, 6000));
      w.dirty += al;
      addKorku(w, 8);
      shiftItibar(w, -12);
      log(w, `Borcu zorla ödettirdin; mahalle sindi. "Ona borçlanmak ateşle oynamak" dediler.`, 'olay');
    }
    return true;
  }

  if (id === 'g2_evlilik') {
    if (k === 'evet') {
      w.hh.cash -= L(w, 3500);
      const genc = P(w, String(data?.pid || ''));
      w.rival.feud = clamp(w.rival.feud - 30, 0, 100);
      w.rival.blood = clamp(w.rival.blood + 1, -5, 5);
      w.rival.peaceM = w.m;
      addSaygi(w, 8);
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 4;
      shiftItibar(w, 6);
      log(w, `${genc ? fullName(genc) : 'Ailenden biri'} ile ${w.rival.name} ailesinden bir fert nişanlandı; iki ocak dünür oldu, kan durdu. Düğünde iki aile aynı sofraya oturdu.`, 'evlilik');
    } else {
      log(w, `Dünürlüğü reddettin; kan davası sürecek.`, 'olay');
    }
    return true;
  }

  return false;
}
