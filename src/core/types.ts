// İlk Tapu — oyun durumunun veri modeli.
// ALTIN KURAL: World yalnızca düz JSON'dur. İçine asla fonksiyon, sınıf ya da Date koyma.
// Kayıt sistemi ve otomatik testler bunu denetler.

export type Sex = 'E' | 'K';
export type SkillId = 'tarim' | 'insaat' | 'zanaat' | 'ticaret';
export type JobId = 'tarla' | 'kendi' | 'isletme' | 'sofor' | 'lab' | 'univ' | 'avukat' | 'doktor' | 'muhendis' | 'ogretmen' | 'coban' | 'insaat' | 'cirak' | 'usta' | 'tuccar' | 'ev' | 'okul' | 'yok';
export type VehicleId = 'esek' | 'araba' | 'traktor' | 'otomobil' | 'kamyon';
export type BizId = 'bakkal' | 'kahve' | 'degirmen';
export type RoomId = 'oda' | 'ahir' | 'samanlik' | 'misafir' | 'bodrum';
export type LabSite = 'bodrum' | 'degirmen' | 'agil';
export type TechId = 'pulluk' | 'gramofon' | 'dikis' | 'kinin' | 'penisilin' | 'bisiklet' | 'koyyolu' | 'radyo' | 'elektrik' | 'telefon' | 'buzdolabi' | 'tv' | 'telsiz' | 'bicer' | 'asfalt' | 'sulama' | 'bilgisayar' | 'cep' | 'kamera' | 'dinleme' | 'kripto' | 'dron' | 'uydu';
export type DistId = 'liman' | 'carsi' | 'sanayi' | 'gecekondu' | 'yenisehir' | 'kordon';
export type DInv = 'kahvehane' | 'galeri' | 'otel' | 'pavyon' | 'site';
export type FacId = 'un' | 'nakliye' | 'tekstil' | 'gazino' | 'insaat' | 'sarap' | 'konserve' | 'cimento' | 'liman' | 'otel' | 'banka' | 'medya';
export type CropId = 'bugday' | 'arpa' | 'nohut' | 'pancar' | 'hashas' | 'tutun' | 'aycicegi';

export interface Traits {
  zeka: number;  // 1-10
  beden: number; // 1-10
  hirs: number;  // 1-10
  uyum: number;  // 1-10 (aileye bağlılık / geçimlilik)
}

export interface Person {
  id: string;
  first: string;
  last: string;
  sex: Sex;
  b: number;            // doğum ayı (kampanya başı Ocak = 0)
  d?: number;           // ölüm ayı
  cause?: string;       // ölüm nedeni
  fa?: string;          // baba
  mo?: string;          // anne
  sp?: string;          // eş (ölse de kalır)
  kids: string[];
  blood: boolean;       // hanedanın kan bağı
  inHH: boolean;        // oyuncunun hanesinde mi yaşıyor
  away?: 'gurbet' | 'hapis' | 'asker' | 'rehin' | 'okul';
  dip?: 'hukuk' | 'tip' | 'muh' | 'ogret'; // diploma (üniversite ya da köy enstitüsü)
  awayUntil?: number;
  hp: number;           // sağlık 0-100
  sick?: number;        // kalan hastalık ayı
  tr: Traits;
  sk: Record<SkillId, number>; // 0-100
  job: JobId;
  parcel?: string;      // job === 'kendi' ise çalıştığı parsel
  biz?: BizId;          // job === 'isletme' ise başında durduğu işletme
  rel: number;          // oyuncuya bağlılık -100..100
  kus?: number;         // küstüyse: küstüğü ay
}

export interface ChronicleEntry {
  m: number;
  t: string;
  k: 'dogum' | 'olum' | 'evlilik' | 'is' | 'para' | 'miras' | 'olay' | 'tapu' | 'son';
}

export interface CardOption {
  t: string; // düğme yazısı
  k: string; // seçenek anahtarı
}

export interface Card {
  uid: number;
  id: string;           // kart türü (CARDS tablosundaki anahtar)
  m: number;
  pid?: string;         // ilgili kişi
  text: string;
  opts: CardOption[];
  data?: Record<string, unknown>;
}

export interface Parcel {
  id: string;
  no: number;           // 1. parsel, 2. parsel…
  boughtM: number;
  price: number;
  crop: CropId | null;
  sownM: number;
  illegal: boolean;     // ruhsatsız haşhaş
  hired: number;        // dışarıdan tutulan ırgat sayısı
  mode: 'kendi' | 'yarici'; // kendimiz mi ekiyoruz, yarıcıya mı verdik
  trac: number;         // geçen ay gelen traktör gücü
  careSum: number;      // bakım puanı birikimi
  careN: number;
  lastNeed: number;     // geçen ayki iş gücü ihtiyacı
  lastGot: number;      // geçen ay gelen iş gücü
  plan?: CropId | null; // ekim planı: boş kalınca kendiliğinden ekilir
  hist: { m: number; crop: CropId; v: number; t: string }[];
}

export interface Household {
  cash: number;
  debt: number;
  rent: number;
  land: number;         // sahip olunan dönüm (parsel sayısı × 5)
  members: string[];
  parcels: Parcel[];
  stash: number;        // zuladaki çuval
  house: number;        // 0 kira evi, 1 kerpiç, 2 taş ev, 3 konak
  veh: Partial<Record<VehicleId, number>>;
  biz: Partial<Record<BizId, number>>; // sahip olunan işletmeler: alındığı ay
  rooms: Partial<Record<RoomId, number>>; // evdeki ek odalar
  agil: boolean;        // dağdaki ağıl
  ambar?: Partial<Record<CropId, number>>; // ambardaki ürün (temel değer birimi)
  ekEv?: number;        // köyde yapılan ek evler (aile dağılmasın diye)
  suru?: number;        // koyun sürüsü
}

/** Gizli atölye: soyut bir üretim zinciri (ham mal → paket → hap). */
export interface LabState {
  lvl: number;          // 1 atölye, 2 laboratuvar, 3 hap imalathanesi
  site: LabSite;
  raw: number;          // bekleyen ham mal (çuval)
  prod: number;         // hazır paket
  hap: number;          // hazır hap kolisi
  chem: 'cevdet' | null; // dışarıdan kimyager
  q: number;            // son partinin kalitesi 0-1
  made: number;         // bugüne kadar üretilen
}

/** Rakip aile ve kan davası. */
export interface RivalState {
  name: string;
  power: number;        // 0-100
  feud: number;         // 0-100 husumet
  blood: number;        // >0: onlar bize kan borçlu, <0: biz onlara
  lock: boolean;        // erkekler evden çıkmıyor
  dead: number;         // bizden kaybedilen
  theirDead: number;    // onlardan
  peaceM: number;       // son barış ayı
  men: number;          // silah tutabilecek erkekleri
  gone: boolean;        // köyden silindi mi
  since: number;        // köye geldiği ay
}

export interface CityState {
  open: boolean;        // şehir açıldı mı
  home: number;         // şehirdeki ev kademesi (en iyi daire)
  homes?: number;       // şehirde sahip olunan toplam konut sayısı
  moved: boolean;       // aile şehre taşındı mı
  facs: Partial<Record<FacId, { since: number; mgr?: string; n?: number; guard?: number; down?: number }>>;
  deniz?: { gemi: number; ihracat: number; kazanc: number }; // deniz aşırı operasyonlar
  turf: number;         // kontrol edilen mahalle
  net: boolean;         // Kara Rıza'nın şebekesi artık bizim
  laundered: number;    // bugüne kadar aklanan
  dist: DistrictState[]; // şehrin mahalleleri
}

export interface DistrictState {
  id: DistId;
  o: 'biz' | 'cete' | 'serbest';
  loy: number;          // esnafın bağlılığı 0-100
  pol: number;          // polis varlığı 0-100
  inv: Partial<Record<DInv, number>>;
}

export interface PolState {
  seat: 'muhtar' | 'belediye' | 'vekil' | null;
  until: number;        // görev bitiş ayı
  tried: number;        // son aday olunan ay
}

export interface CrewState {
  name: string;
  men: number;
  feud: number;
  turf: number;
  gone: boolean;
}

export interface PlotState {
  o: 'aga' | 'koy' | 'biz' | 'rakip';
  pid?: string;         // bizimse parsel kimliği
  ask: number;          // sahibinin fiyat çarpanı
  sale: boolean;        // satışta mı
  mad: number;          // (eski) bu yıla kadar teklif dinlemez
  madM?: number;        // bu aya kadar teklif dinlemez
}

export interface LedgerLine {
  t: string;
  v: number;
}

export interface World {
  v: number;
  seed: number;
  rng: number;          // rastgele sayı üretecinin durumu
  m: number;            // şu anki ay (kampanya başı Ocak = 0)
  y0?: number;          // takvim tabanı: 1925 (yeni) ya da 1965 (eski kayıt)
  mk?: Partial<Record<CropId | 'hayvan', number>>; // bu yılın piyasa fiyat çarpanları
  nextId: number;
  nextCard: number;
  surname: string;
  people: Record<string, Person>;
  hh: Household;
  playerId: string;
  heirId: string | null;
  cards: Card[];
  chronicle: ChronicleEntry[];
  flags: Record<string, number | boolean | string>;
  rain: number;         // bu yılın yağış çarpanı
  lastIncome: number;
  lastExpense: number;
  lines: LedgerLine[];  // geçen ayın gelir-gider dökümü
  heat: number;         // jandarmanın dikkati 0-100
  ruhsat: number;       // haşhaş ruhsatının geçerli olduğu yıl (0 = yok)
  plots: PlotState[];   // köydeki bütün tarlaların sahipliği ve satış durumu
  lab: LabState | null;
  rival: RivalState;
  dirty: number;        // kara para: yasal mülk almak için aklanmalı
  gang: number;         // maaşlı adamlar (korumalar)
  city: CityState;
  crew: CrewState | null; // şehirdeki rakip çete
  tech: Partial<Record<TechId, number>>; // gelen teknolojiler: geliş ayı
  pol: PolState;
  over: null | { m: number; reason: string };
}
