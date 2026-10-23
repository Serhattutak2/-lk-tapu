// İlk Tapu — oyun durumunun veri modeli.
// ALTIN KURAL: World yalnızca düz JSON'dur. İçine asla fonksiyon, sınıf ya da Date koyma.
// Kayıt sistemi ve otomatik testler bunu denetler.

export type Sex = 'E' | 'K';
export type SkillId = 'tarim' | 'insaat' | 'zanaat' | 'ticaret';
export type JobId = 'tarla' | 'kendi' | 'isletme' | 'sofor' | 'coban' | 'insaat' | 'cirak' | 'usta' | 'tuccar' | 'ev' | 'okul' | 'yok';
export type VehicleId = 'esek' | 'araba' | 'traktor' | 'otomobil' | 'kamyon';
export type BizId = 'bakkal' | 'kahve' | 'degirmen';
export type CropId = 'bugday' | 'arpa' | 'nohut' | 'pancar' | 'hashas';

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
  b: number;            // doğum ayı (1965 Ocak = 0)
  d?: number;           // ölüm ayı
  cause?: string;       // ölüm nedeni
  fa?: string;          // baba
  mo?: string;          // anne
  sp?: string;          // eş (ölse de kalır)
  kids: string[];
  blood: boolean;       // hanedanın kan bağı
  inHH: boolean;        // oyuncunun hanesinde mi yaşıyor
  away?: 'gurbet' | 'hapis';
  awayUntil?: number;
  hp: number;           // sağlık 0-100
  sick?: number;        // kalan hastalık ayı
  tr: Traits;
  sk: Record<SkillId, number>; // 0-100
  job: JobId;
  parcel?: string;      // job === 'kendi' ise çalıştığı parsel
  biz?: BizId;          // job === 'isletme' ise başında durduğu işletme
  rel: number;          // oyuncuya bağlılık -100..100
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
}

export interface PlotState {
  o: 'aga' | 'koy' | 'biz';
  pid?: string;         // bizimse parsel kimliği
  ask: number;          // sahibinin fiyat çarpanı
  sale: boolean;        // satışta mı
  mad: number;          // bu yıla kadar teklif dinlemez
}

export interface LedgerLine {
  t: string;
  v: number;
}

export interface World {
  v: number;
  seed: number;
  rng: number;          // rastgele sayı üretecinin durumu
  m: number;            // şu anki ay (1965 Ocak = 0)
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
  over: null | { m: number; reason: string };
}
