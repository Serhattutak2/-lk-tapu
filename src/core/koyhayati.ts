// Köy hayatının takvimi: yılın belli günlerinde dönen gelenekler. Her biri bir seçim, her seçim bir iz bırakır.
// Hıdrellez, harman şenliği ve güreş, kış masalları, yağmur duası, sünnet düğünü, bağ bozumu, seyyar satıcı, kar.
import type { Person, World } from './types';
import { chance, clamp, pick } from './rng';
import { age, fullName, hhMembers, log, P } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { addHatir, KOMSULAR } from './komsu';

const L = (w: World, n: number) => Math.round(n * infl(w.m));
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const nb = (w: World, n: number) => (w.flags.namBonus = Number(w.flags.namBonus || 0) + n);
const relAll = (w: World, d: number, f?: (p: Person) => boolean) => {
  for (const p of hhMembers(w)) if (!f || f(p)) p.rel = clamp(p.rel + d, -100, 100);
};
const once = (w: World, key: string) => {
  const k = 'kv_' + key + year(w.m);
  if (w.flags[k]) return false;
  w.flags[k] = true;
  return true;
};

export function koyCards(w: World): boolean {
  const mo = monthOf(w.m);
  const y = year(w.m);
  const young = hhMembers(w).filter((p) => age(w, p) >= 14 && age(w, p) <= 25 && !p.away);

  // Hıdrellez: 6 Mayıs (Nisan sonu/Mayıs)
  if (mo === 4 && young.length && chance(w, 0.35) && once(w, 'hidrellez')) {
    pushCard(w, {
      id: 'kv_hidrellez',
      text: `Hıdrellez gecesi. Gençler gül dalına dilek bağlıyor, ateşin üstünden atlıyor; kızlar yüzüklerini testiye atıp mani söylüyor. ${young.length > 1 ? 'Evin gençleri' : fullName(young[0])} kapının önünde izin bekliyor.`,
      opts: [
        { t: `Şenliği biz düzenleyelim: helva, lokum, davul (${fmt(L(w, 200))} lira)`, k: 'duzen' },
        { t: 'Gitsinler, eğlensinler', k: 'git' },
        { t: 'Bu adetler bize göre değil', k: 'yok' },
      ],
    });
    return true;
  }
  // Harman şenliği ve karakucak güreşi (Ağustos)
  const pehlivan = hhMembers(w).filter((p) => p.sex === 'E' && p.blood && !p.away && age(w, p) >= 16 && age(w, p) <= 35).sort((a, b) => b.tr.beden - a.tr.beden)[0];
  if (mo === 7 && pehlivan && chance(w, 0.3) && once(w, 'gures')) {
    pushCard(w, {
      id: 'kv_gures',
      pid: pehlivan.id,
      text: `Harman bitti, şenlik var. Meydanda davul zurna, karakucak güreşi; ödül bir koç ve bir kuşak. ${fullName(pehlivan)} (${age(w, pehlivan)}) peşrev çekmek için senin iznini bekliyor. Karşısında ${pick(w, ['komşu köyün namlı pehlivanı', `${w.rival.gone ? 'kasabanın kasabı' : w.rival.name + 'ların en iri oğlu'}`, 'yaylanın çobanı'])} var.`,
      opts: [{ t: 'Güreşsin, yüzümüzü kara çıkarmasın', k: 'gures' }, { t: 'Seyirci kalalım', k: 'yok' }],
    });
    return true;
  }
  // Kış masalları (Ocak)
  if (mo === 0 && chance(w, 0.25) && once(w, 'masal')) {
    pushCard(w, {
      id: 'kv_masal',
      text: `Kar dizi geçti, köy beyaza gömüldü. Akşamları odalarda sıra gezmesi başladı: kestane közde, Kör Veli Köroğlu'nu, Keloğlan'ı, dağların eşkıyalarını anlatıyor. Bu gece sıra hangi evde?`,
      opts: [{ t: `Bizim odada toplansınlar (${fmt(L(w, 80))} lira ikram)`, k: 'bizde' }, { t: 'Komşuya gidelim', k: 'git' }, { t: 'Erken yatalım', k: 'yok' }],
    });
    return true;
  }
  // Yağmur duası (kurak bahar)
  if ((mo === 3 || mo === 4) && w.rain < 0.85 && w.hh.parcels.length && once(w, 'yagmur')) {
    pushCard(w, {
      id: 'kv_yagmur',
      text: `Bahar kurak geçiyor; ekinler sararmaya başladı. İmam köyü tepedeki türbeye yağmur duasına çağırdı; kazanlarda pilav kaynayacak, kurban kesilecek.`,
      opts: [{ t: `Kurbanı biz keselim (${fmt(L(w, 500))} lira)`, k: 'kurban' }, { t: 'Duaya katılalım', k: 'katil' }, { t: 'Duayla yağmur yağmaz; kuyu açalım', k: 'yok' }],
    });
    return true;
  }
  // Sünnet düğünü
  const oglan = hhMembers(w).find((p) => p.sex === 'E' && p.blood && !p.away && age(w, p) >= 7 && age(w, p) <= 10 && !w.flags['sunnet' + p.id]);
  if (oglan && mo >= 5 && mo <= 8 && chance(w, 0.05)) {
    w.flags['sunnet' + oglan.id] = true;
    pushCard(w, {
      id: 'kv_sunnet',
      pid: oglan.id,
      text: `${fullName(oglan)} (${age(w, oglan)}) sünnet yaşına geldi. Beyaz elbisesi, şapkası hazır; bütün köy ne kadar büyük bir düğün yapılacağını konuşuyor.`,
      opts: [
        { t: `Üç gün düğün: atlı gezinti, karagöz, pehlivanlar (${fmt(L(w, 1600))} lira)`, k: 'buyuk' },
        { t: `Mevlit ve sofra (${fmt(L(w, 450))} lira)`, k: 'sade' },
        { t: 'Sadece aile arasında', k: 'yok' },
      ],
    });
    return true;
  }
  // Bağ bozumu (Eylül; şarap fabrikası ya da köyde bağ)
  if (mo === 8 && (w.city.facs.sarap || chance(w, 0.08)) && once(w, 'bag')) {
    pushCard(w, {
      id: 'kv_bag',
      text: `Bağ bozumu. Kadınlar sepet sepet üzüm taşıyor, kazanlarda pekmez kaynıyor, çocukların ağzı yüzü şıra. ${w.city.facs.sarap ? 'Şarap fabrikanın kamyonları köyün yolunda.' : 'Komşular bağa yardıma çağırıyor.'}`,
      opts: [{ t: w.city.facs.sarap ? `Toplayıcılara çift yevmiye ver (${fmt(L(w, 600))} lira)` : 'Bütün aile bağa gitsin', k: 'cift' }, { t: 'Her zamanki gibi', k: 'yok' }],
    });
    return true;
  }
  // Seyyar satıcı (yılda bir, rastgele)
  if (chance(w, 0.012) && once(w, 'seyyar')) {
    const mal = y < 1950 ? pick(w, ['basma kumaş', 'gümüş bilezik', 'cep saati', 'ayna ve tarak']) : y < 1985 ? pick(w, ['pilli radyo', 'naylon terlik', 'kol saati', 'plak']) : pick(w, ['cep telefonu', 'spor ayakkabı', 'bilgisayar oyunu', 'parfüm']);
    pushCard(w, {
      id: 'kv_seyyar',
      data: { mal },
      text: `Kasabadan bir seyyar satıcı köye geldi; eşeğinin ya da minibüsünün üstü rengârenk. Çocuklar etrafını sardı. En çok bakılan: ${mal}.`,
      opts: [{ t: `Evdekilere birer hediye al (${fmt(L(w, 30) * Math.max(1, hhMembers(w).length))} lira)`, k: 'al' }, { t: 'Sadece çocuklara', k: 'cocuk' }, { t: 'Paraya kıymayalım', k: 'yok' }],
    });
    return true;
  }
  // Kar: köyün yolu kapandı
  if ((mo === 0 || mo === 1) && chance(w, 0.03) && once(w, 'kar')) {
    const hasta = hhMembers(w).find((p) => p.sick);
    pushCard(w, {
      id: 'kv_kar',
      pid: hasta?.id,
      text: `Üç gündür tipi dinmiyor; köyün yolu kapandı, telgraf telleri koptu. ${hasta ? `${fullName(hasta)} hasta yatıyor, ilacı bitmek üzere.` : 'Erzakı az olan evler kaygılı.'}`,
      opts: [
        { t: 'Erkekler kızakla kasabaya yol açsın', k: 'yol' },
        { t: 'Ambarımızı açalım, erzakı olmayana dağıtalım', k: 'ambar' },
        { t: 'Kapıyı kapat, bekle', k: 'yok' },
      ],
    });
    return true;
  }
  return false;
}

export function resolveKoy(w: World, id: string, k: string, pid: string | undefined): boolean {
  if (!id.startsWith('kv_')) return false;
  const p = P(w, pid);
  if (id === 'kv_hidrellez') {
    if (k === 'duzen') {
      w.hh.cash -= L(w, 200);
      nb(w, 2);
      relAll(w, 6, (q) => age(w, q) <= 30);
    } else if (k === 'git') relAll(w, 3, (q) => age(w, q) <= 30);
    else relAll(w, -6, (q) => age(w, q) <= 30);
  } else if (id === 'kv_gures' && p) {
    if (k === 'gures') {
      if (chance(w, 0.25 + p.tr.beden * 0.06)) {
        nb(w, 4);
        p.rel = clamp(p.rel + 15, -100, 100);
        w.hh.suru = (w.hh.suru || 0) + (w.hh.rooms.ahir || w.hh.agil ? 1 : 0);
        log(w, `${fullName(p)} meydanın başpehlivanı oldu: koçu ve kuşağı aldı, omuzlarda köyü dolaştırıldı.`, 'olay');
      } else {
        p.hp = clamp(p.hp - 6, 5, 100);
        log(w, `${fullName(p)} güreşte sırtı yere geldi; ama yiğitçe kaybetti, el sıkıştı.`, 'olay');
      }
    }
  } else if (id === 'kv_masal') {
    if (k === 'bizde') {
      w.hh.cash -= L(w, 80);
      relAll(w, 4);
      addHatir(w, 'veli', 6);
      for (const q of hhMembers(w)) if (age(w, q) < 14) q.sk.ticaret = clamp(q.sk.ticaret + 1, 0, 100);
    } else if (k === 'git') relAll(w, 2);
  } else if (id === 'kv_yagmur') {
    if (k === 'kurban') {
      w.hh.cash -= L(w, 500);
      nb(w, 3);
      addHatir(w, 'omer', 8);
    }
    if (k !== 'yok' && chance(w, 0.45)) {
      w.rain = clamp(w.rain + 0.2, 0.5, 1.4);
      log(w, `Duadan üç gün sonra bulutlar toplandı; bereketli bir yağmur yağdı.`, 'olay');
    } else if (k !== 'yok') log(w, `Dualar edildi ama gök inat etti.`, 'olay');
  } else if (id === 'kv_sunnet' && p) {
    if (k === 'buyuk') {
      w.hh.cash -= L(w, 1600);
      nb(w, 4);
      p.rel = clamp(p.rel + 15, -100, 100);
      relAll(w, 4);
      KOMSULAR.forEach((x) => addHatir(w, x.id, 3));
      log(w, `${fullName(p)} için üç gün sünnet düğünü yapıldı; atlı gezintiyi bütün köy izledi.`, 'olay');
    } else if (k === 'sade') {
      w.hh.cash -= L(w, 450);
      nb(w, 1);
      p.rel = clamp(p.rel + 6, -100, 100);
    } else p.rel = clamp(p.rel - 4, -100, 100);
  } else if (id === 'kv_bag') {
    if (k === 'cift') {
      if (w.city.facs.sarap) w.hh.cash -= L(w, 600);
      nb(w, 2);
      relAll(w, 3);
      if (!w.city.facs.sarap) w.hh.cash += L(w, 120);
    }
  } else if (id === 'kv_seyyar') {
    const n = Math.max(1, hhMembers(w).length);
    if (k === 'al') {
      w.hh.cash -= L(w, 30) * n;
      relAll(w, 5);
    } else if (k === 'cocuk') {
      w.hh.cash -= L(w, 10) * n;
      relAll(w, 5, (q) => age(w, q) < 14);
    } else relAll(w, -2, (q) => age(w, q) < 14);
  } else if (id === 'kv_kar') {
    if (k === 'yol') {
      const m = hhMembers(w).filter((q) => q.sex === 'E' && age(w, q) >= 16 && age(w, q) <= 50)[0];
      if (p) {
        p.sick = 0;
        p.hp = clamp(p.hp + 8, 0, 100);
      }
      nb(w, 2);
      if (m && chance(w, 0.2)) {
        m.hp = clamp(m.hp - 12, 5, 100);
        m.sick = 2;
        log(w, `${m.first} tipide yol açarken üşüttü; ama ilaç köye ulaştı.`, 'olay');
      } else log(w, `Kızaklar kasabaya ulaştı; ilaç da erzak da köye geldi.`, 'olay');
    } else if (k === 'ambar') {
      const a = w.hh.ambar || {};
      for (const c of Object.keys(a) as (keyof typeof a)[]) a[c] = (a[c] || 0) * 0.85;
      nb(w, 4);
      KOMSULAR.forEach((x) => addHatir(w, x.id, 5));
      log(w, `Kar günlerinde ambarın kapısı köye açıldı; kimse aç yatmadı.`, 'olay');
    } else if (p) p.hp = clamp(p.hp - 10, 3, 100);
  }
  return true;
}
