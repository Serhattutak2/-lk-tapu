// Meslekler. Ücretler 1965 Türk lirası, aylık. Denge ayarı otomatik testlerle yapılır.
import type { JobId, Person, SkillId, World } from './types';
import { infl, isWorkSeason, year } from './calendar';
import { age } from './people';

export interface JobDef {
  id: JobId;
  ad: string;
  skill: SkillId | null;
  minAge: number;
  maxAge: number;
  summer: number;   // iş mevsimi (Nisan–Ekim) temel ücret
  winter: number;   // kış temel ücret
  physical: boolean;
  risk: number;     // aylık iş kazası olasılığı
  gain: number;     // aylık beceri kazancı
  desc: string;
  sex?: 'E' | 'K';  // o çağda yalnızca bu cinsiyete açık meslek
  unlock?: (w: World, p: Person) => boolean;
}

export const JOBS: Record<JobId, JobDef> = {
  tarla: { id: 'tarla', ad: 'Tarla gündelikçisi', skill: 'tarim', minAge: 11, maxAge: 70, summer: 215, winter: 50, physical: true, risk: 0.0004, gain: 1.4, desc: 'Ağanın ve büyük çiftçilerin tarlasında gündelik iş. Yazın bol, kışın yok gibi.' },
  kendi: { id: 'kendi', ad: 'Kendi tarlamızda', skill: 'tarim', minAge: 10, maxAge: 75, summer: 0, winter: 0, physical: true, risk: 0.0003, gain: 0, desc: 'Ailenin kendi parselinde çalışır. Parselde iş yokken başkasının tarlasına gündeliğe gider.', unlock: (w) => w.hh.parcels.length > 0 },
  isletme: { id: 'isletme', ad: 'İşletmenin başında', skill: 'ticaret', minAge: 16, maxAge: 80, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Ailenin bakkalını, kahvehanesini ya da değirmenini yönetir. Kazanç işletmenin hesabına yazılır.', unlock: (w) => Object.values(w.hh.biz).some(Boolean) },
  sofor: { id: 'sofor', ad: 'Kamyon şoförü', skill: 'ticaret', minAge: 18, maxAge: 65, summer: 560, winter: 460, physical: false, risk: 0.0012, gain: 0.8, desc: 'Ailenin kamyonuyla nakliye yapar. Yollarda kaza riski var.', unlock: (w, p) => (w.hh.veh.kamyon || 0) > Object.values(w.people).filter((q) => q.job === 'sofor' && q.inHH && q.id !== p.id).length },
  lab: { id: 'lab', ad: 'Atölyede', skill: 'zanaat', minAge: 16, maxAge: 65, summer: 0, winter: 0, physical: false, risk: 0.0015, gain: 0, desc: 'Gizli atölyede çalışır. Ustalaştıkça mal kaliteli çıkar, kaza azalır. Ağzı sıkı olmalı.', unlock: (w) => !!w.lab },
  univ: { id: 'univ', ad: 'Üniversitede', skill: null, minAge: 17, maxAge: 26, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Şehirde okuyor. Dört yıl harç ve yurt parası; sonunda avukat, doktor ya da mühendis olur.', unlock: (w, p) => !p.dip && p.sk.ticaret + p.tr.zeka * 4 >= 30 },
  avukat: { id: 'avukat', ad: 'Avukat', skill: 'ticaret', minAge: 22, maxAge: 75, summer: 950, winter: 950, physical: false, risk: 0, gain: 0.4, desc: 'Ailenin hukuk işlerine bakar: hapis cezaları kısalır.', unlock: (_w, p) => p.dip === 'hukuk' },
  doktor: { id: 'doktor', ad: 'Doktor', skill: 'ticaret', minAge: 23, maxAge: 75, summer: 1150, winter: 1150, physical: false, risk: 0, gain: 0.3, desc: 'Ailenin sağlığına bakar: hastalıklar kısa sürer, ölüm riski düşer.', unlock: (_w, p) => p.dip === 'tip' },
  muhendis: { id: 'muhendis', ad: 'Mühendis', skill: 'zanaat', minAge: 22, maxAge: 70, summer: 850, winter: 850, physical: false, risk: 0, gain: 0.5, desc: 'Fabrikalar ve atölye daha verimli çalışır.', unlock: (_w, p) => p.dip === 'muh' },
  ogretmen: { id: 'ogretmen', ad: 'Köy öğretmeni', skill: 'ticaret', minAge: 18, maxAge: 70, summer: 420, winter: 420, physical: false, risk: 0, gain: 0.5, desc: 'Köy okulunda ders verir. Düzenli maaş; köyde sözü dinlenir, çocukları okumaya meraklı olur.', unlock: (_w, p) => p.dip === 'ogret' },
  coban: { id: 'coban', ad: 'Çoban', skill: 'tarim', minAge: 10, maxAge: 70, summer: 130, winter: 110, physical: true, risk: 0.0003, gain: 0.8, desc: 'Köyün sürüsünü otlatır. Az ama her ay kazanç.' },
  insaat: { id: 'insaat', ad: 'İnşaat işçisi', skill: 'insaat', minAge: 15, maxAge: 60, summer: 300, winter: 80, physical: true, risk: 0.0014, gain: 1.6, sex: 'E', desc: 'İlçedeki şantiyelerde iş. İyi para, ama kaza riski yüksek.' },
  cirak: { id: 'cirak', ad: 'Demirci çırağı', skill: 'zanaat', minAge: 11, maxAge: 30, summer: 80, winter: 80, physical: false, risk: 0.0002, gain: 2.6, desc: 'Az kazanır ama hızlı öğrenir. Yeterince ustalaşınca usta olur.' },
  usta: { id: 'usta', ad: 'Demirci ustası', skill: 'zanaat', minAge: 18, maxAge: 75, summer: 380, winter: 340, physical: false, risk: 0.0002, gain: 0.6, desc: 'Köyün nalını, sabanını yapar. Yıl boyu düzenli kazanç.', unlock: (_w, p) => p.sk.zanaat >= 55 },
  tuccar: { id: 'tuccar', ad: 'Tüccar yanında', skill: 'ticaret', minAge: 16, maxAge: 70, summer: 270, winter: 230, physical: false, risk: 0.0001, gain: 1.8, desc: 'Hububat tüccarının yanında alım satım öğrenir. Bağlantı kazandırır.', unlock: (w) => !!w.flags.tuccar },
  berber: { id: 'berber', ad: 'Berber', skill: 'zanaat', minAge: 15, maxAge: 70, summer: 240, winter: 240, physical: false, risk: 0, gain: 1.2, desc: 'Köyün tıraşı, sohbeti, dedikodusu burada. Düzenli kazanç; köyde olup biteni herkesten önce duyar.' },
  asci: { id: 'asci', ad: 'Aşçı', skill: 'zanaat', minAge: 16, maxAge: 70, summer: 260, winter: 230, physical: false, risk: 0.0002, gain: 1.1, desc: 'Düğün, mevlit, bayram; kazan onun elinde kaynar. Hane mutfak gideri azalır.' },
  ebe: { id: 'ebe', ad: 'Ebe', skill: 'ticaret', minAge: 20, maxAge: 70, summer: 210, winter: 210, physical: false, risk: 0, gain: 0.7, desc: 'Köyün çocuklarını o doğurtur. Ailede ebe varsa doğumlar daha sağlıklı geçer.', unlock: (_w, p) => p.sex === 'K' },
  imam: { id: 'imam', ad: 'İmam', skill: 'ticaret', minAge: 20, maxAge: 80, summer: 300, winter: 300, physical: false, risk: 0, gain: 0.5, desc: 'Köyün namazını kıldırır, nikâhını kıyar, ölüsünü yıkar. Sözü dinlenir: barış ucuzlar, saygı artar.', unlock: (_w, p) => p.sex === 'E' },
  postaci: { id: 'postaci', ad: 'Postacı', skill: 'ticaret', minAge: 18, maxAge: 60, summer: 320, winter: 300, physical: true, risk: 0.0004, gain: 1.0, desc: 'Mektubu, havaleyi, haberi o taşır. Köyle şehir arasındaki köprü; her kapıyı bilir.', unlock: (w) => year(w.m) >= 1930 },
  terzi: { id: 'terzi', ad: 'Terzi', skill: 'zanaat', minAge: 15, maxAge: 70, summer: 250, winter: 250, physical: false, risk: 0, gain: 1.3, desc: 'Çeyiz, bayramlık, takım elbise. Şehir büyüdükçe işi artar.', unlock: (w) => year(w.m) >= 1935 },
  gazeteci: { id: 'gazeteci', ad: 'Gazeteci', skill: 'ticaret', minAge: 20, maxAge: 70, summer: 620, winter: 620, physical: false, risk: 0.0003, gain: 0.7, desc: 'Kalemi keskin. Ailenin karanlık işlerine dair haberler yumuşar; adın gazetede hayırla anılır.', unlock: (_w, p) => p.dip === 'hukuk' || p.sk.ticaret >= 40 },
  mimar: { id: 'mimar', ad: 'Mimar', skill: 'zanaat', minAge: 23, maxAge: 70, summer: 900, winter: 900, physical: false, risk: 0, gain: 0.5, desc: 'Apartman, otel, fabrika; hepsini o çizer. İnşaat ve mülk işleri daha verimli.', unlock: (_w, p) => p.dip === 'muh' },
  bankaci: { id: 'bankaci', ad: 'Banka müdürü', skill: 'ticaret', minAge: 25, maxAge: 70, summer: 1100, winter: 1100, physical: false, risk: 0, gain: 0.5, desc: 'Paranın yolunu bilir. Aklama ve kredi işleri kolaylaşır.', unlock: (w, p) => (p.dip === 'hukuk' || p.sk.ticaret >= 55) && year(w.m) >= 1960 },
  sarkici: { id: 'sarkici', ad: 'Şarkıcı', skill: 'ticaret', minAge: 16, maxAge: 60, summer: 700, winter: 700, physical: false, risk: 0.0002, gain: 0.6, desc: 'Gazino sahnelerinin yıldızı. İyi para, çok göz; şehirde ailenin vitrini.', unlock: (w) => year(w.m) >= 1960 },
  memur: { id: 'memur', ad: 'Devlet memuru', skill: 'ticaret', minAge: 18, maxAge: 65, summer: 360, winter: 360, physical: false, risk: 0, gain: 0.6, desc: 'Nüfus, tapu, vergi dairesi... Düzenli maaş ve devlet kapısında bir tanıdık. Resmî işler kolaylaşır.', unlock: (w, p) => year(w.m) >= 1930 && p.sk.ticaret + p.tr.zeka * 3 >= 24 },
  elektrikci: { id: 'elektrikci', ad: 'Elektrikçi', skill: 'zanaat', minAge: 16, maxAge: 65, summer: 420, winter: 400, physical: true, risk: 0.0008, gain: 1.3, desc: 'Direkleri, sigortaları, motorları o onarır. Köye elektrik geldikten sonra aranan bir zanaat.', unlock: (w) => !!w.tech?.elektrik || year(w.m) >= 1955 },
  hemsire: { id: 'hemsire', ad: 'Hemşire', skill: 'ticaret', minAge: 18, maxAge: 65, summer: 400, winter: 400, physical: false, risk: 0.0001, gain: 0.8, desc: 'İlçe hastanesinde ya da sağlık ocağında çalışır. Ailede hasta olursa daha iyi bakılır.', unlock: (w) => year(w.m) >= 1945 },
  ev: { id: 'ev', ad: 'Ev işleri', skill: null, minAge: 10, maxAge: 99, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Evi çekip çevirir. Hanenin mutfak giderini azaltır, hastalara bakar.' },
  okul: { id: 'okul', ad: 'Okul', skill: null, minAge: 7, maxAge: 15, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Okuyan çocuk ileride daha hızlı öğrenir ve daha iyi işlere girer.' },
  yok: { id: 'yok', ad: 'Boşta', skill: null, minAge: 0, maxAge: 999, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Çalışmıyor.' },
};

export function jobAllowed(w: World, p: Person, j: JobId): boolean {
  const d = JOBS[j];
  const a = age(w, p);
  if (a < d.minAge || a > d.maxAge) return false;
  if (d.sex && p.sex !== d.sex) return false;
  if (d.unlock && !d.unlock(w, p)) return false;
  return true;
}

export function jobsFor(w: World, p: Person): JobDef[] {
  return Object.values(JOBS).filter((j) => jobAllowed(w, p, j.id));
}

/** Kişinin bu ayki kazancı. */
export function wage(w: World, p: Person): number {
  const d = JOBS[p.job];
  if (!d || p.away) return 0;
  const base = isWorkSeason(w.m) ? d.summer : d.winter;
  if (!base) return 0;
  const sk = d.skill ? p.sk[d.skill] : 0;
  let f = 0.6 + 0.4 * (sk / 100);
  if (d.physical) f *= 0.8 + 0.04 * p.tr.beden;
  const a = age(w, p);
  if (a < 15) f *= 0.6;
  if (a > 60) f *= 0.75;
  if (p.sick) f *= 0.3;
  if (p.kus) f *= 0.6;
  if (p.job === 'insaat' && Number(w.flags.tren || 0) > w.m) f *= 2;
  if (p.job === 'tuccar' && w.flags.niyet === 'ticaret' && Number(w.flags.niyetY) === year(w.m)) f *= 1.12; // küs olan isteksiz çalışır
  if ((p.job === 'tarla' || p.job === 'insaat') && w.tech?.bisiklet) f *= 1.08;
  if (p.job === 'ogretmen' && year(w.m) < 1960) f *= 1.15; // köy öğretmeni o yıllarda baş tacı
  return Math.round(base * f * infl(w.m));
}

/** Varsayılan iş seçimi: yeni yetişkinler ve yapay zekâ aile üyeleri için. */
export function defaultJob(w: World, p: Person): JobId {
  const a = age(w, p);
  if (a < 7) return 'yok';
  if (a <= 11) return jobAllowed(w, p, 'okul') && w.hh.cash > 300 ? 'okul' : a >= 10 ? 'coban' : 'yok';
  if (a >= 68) return 'ev';
  if (p.dip === 'muh' && jobAllowed(w, p, 'mimar')) return 'mimar';
  if (p.sex === 'K' && p.sk.ticaret >= 20 && jobAllowed(w, p, 'ebe')) return 'ebe';
  if (p.sex === 'E' && p.tr.uyum >= 7 && p.sk.ticaret >= 15 && jobAllowed(w, p, 'imam')) return 'imam';
  if (p.sk.zanaat >= 25 && jobAllowed(w, p, 'berber')) return 'berber';
  if (jobAllowed(w, p, 'usta')) return 'usta';
  if (jobAllowed(w, p, 'tuccar') && p.sk.ticaret >= 20) return 'tuccar';
  if (p.sk.zanaat >= 15 && jobAllowed(w, p, 'cirak')) return 'cirak';
  if (p.tr.beden >= 7 && jobAllowed(w, p, 'insaat') && p.sex === 'E') return 'insaat';
  return 'tarla';
}
