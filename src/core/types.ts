// İlk Tapu — oyun durumunun veri modeli.
// ALTIN KURAL: World yalnızca düz JSON'dur. İçine asla fonksiyon, sınıf ya da Date koyma.
// Kayıt sistemi ve otomatik testler bunu denetler.

export type Sex = 'E' | 'K';
export type SkillId = 'tarim' | 'insaat' | 'zanaat' | 'ticaret';
export type JobId = 'tarla' | 'coban' | 'insaat' | 'cirak' | 'usta' | 'tuccar' | 'ev' | 'okul' | 'yok';

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
  away?: 'gurbet';
  awayUntil?: number;
  hp: number;           // sağlık 0-100
  sick?: number;        // kalan hastalık ayı
  tr: Traits;
  sk: Record<SkillId, number>; // 0-100
  job: JobId;
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

export interface Household {
  cash: number;
  debt: number;
  rent: number;
  land: number;         // sahip olunan dönüm
  members: string[];
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
  over: null | { m: number; reason: string };
}
