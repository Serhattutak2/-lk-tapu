# İlk Tapu — Devir Notu (Faz 0)

Bu dosya projeyi başka bir yapay zekâ ya da geliştiriciyle sürdürmek için yazıldı. Kod TypeScript; `tools/build.mjs` esbuild ile her şeyi tek dosyalık `dist/index.html`'e paketler. Oyun metinleri Türkçe.

## Altın kurallar
1. `World` (oyun durumu) **düz JSON'dur**. İçine fonksiyon, sınıf, `Date` koyma. Kartlar `{id, opts:[{t,k}]}` olarak durur; seçenekleri `cards.ts` içindeki `RESOLVE` tablosundan çözülür. Testler ve kayıt `isPlainJSON` ile denetler.
2. Rastgelelik yalnızca `core/rng.ts` üzerinden ve `World.rng` durumuyla. `Math.random()` çekirdekte yasak (yalnızca yeni oyun tohumu için). Aynı tohum aynı tarihi üretmeli; test bunu denetler.
3. Çekirdek (`src/core`) arayüzü bilmez; DOM'a dokunmaz. Arayüz (`src/ui`) kuralları bilmez; yalnızca `sim.ts` eylemlerini çağırır.
4. `confirm/alert` kullanma; Claude artifact'ında çalışmaz. Onayı arayüz içinde iste.
5. TestFlight'a yükleme yalnızca Serhat açıkça "ver" dediğinde yapılır.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `core/types.ts` | Veri modeli: `World`, `Person`, `Household`, `Card`, kronik |
| `core/world.ts` | Yeni kampanya: Mart 1965, nine, baba, anne, oyuncu (16) ve iki kardeş; ağaya borç |
| `core/people.ts` | Kişi oluşturma (kalıtım), yaş, akrabalık adı (`relationTo`), kronik `log` |
| `core/jobs.ts` | Meslekler (`JOBS`), ücret (`wage`, mevsim ve enflasyon `infl`), varsayılan iş |
| `core/life.ts` | Ölüm olasılığı, `die` → `succeed` (veraset), `setPlayer`, evlilik, doğum, aile kolu ayrılması (`splitBranch`), yakın çevre sınırı `isNear` |
| `core/cards.ts` | Olay kartları: üretim (`generateCards`), çözüm (`RESOLVE`), tapu fiyatı, gurbet dönüşleri, mevsim notları |
| `core/sim.ts` | Aylık adım `advance`: ekonomi, beceri ve sağlık, yaşam, kartlar. Oyuncu eylemleri: `setJob`, `setHeir`, `payDebt`, `resolveCard`. Test botu `botTurn` |
| `ui/app.ts` | Açılış, oyun ekranı, Aile/Hane/Kronik panelleri, olay kartı (evrak görünümü), ilk tapu töreni, son ekranı. Kayıt anahtarı `ilktapu_v1` |
| `ui/map.ts` | İzometrik piksel köy; 320×196 tampona çizilir, ekrana büyütülür. `SLOTS` oyuncunun parselleri |
| `ui/styles.css` | Renk belirteçleri: toprak, buğday, kökboya, çini |

## Denge (Faz 0 hedefleri)
- Bot ile ilk tapu çoğunlukla 1968–1975 arasında. İnsan oyuncu daha geç almalı.
- Enflasyon yılda %4,5 (`infl`); ücret, gider ve toprak fiyatı birlikte artar.
- Toprak sahipliğinin ötesinde yatırım yok; geç oyunda para birikir. Faz 2'de işletmeler bu parayı emecek.

## Sıradaki (Faz 1)
- Capacitor ile iOS sarmalayıcı ve GitHub Actions derlemesi (Miras FC'deki `ios.yml` örnek alınacak).
- Aile ağacı ekranı, varis adaylarının karşılaştırılması.
- Köyde yer değiştirme (ilçeye/şehre göç), kahvehane ve bağlantı ağı, lisanslı haşhaş üretimi.
