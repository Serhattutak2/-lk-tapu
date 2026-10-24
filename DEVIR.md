# İlk Tapu — Devir Notu (Faz 0)

0.8: Karakol komutanı sistemi, aile içi küsme/barışma/düğünler, rakip aileye karşı kansız hamleler (`rivalMoves`/`doRivalMove`) ve çatışmalar (`scuffle`), köyde ikinci ev (`buildEkEv`), son varis ölünce uzak akraba devralır. Tarla satışı yeniden zorlaştırıldı, hız yavaşlatıldı.

0.9: Yıl niyeti, sürü, tütün/ayçiçeği, ağanın sonu, Kara Rıza'nın veda zinciri ve oğlu Selim (`ce_*` kartları baron.ts'te), çete dağılınca mahalleler ve `crewGone`, yeni çete `flags.nextCrew`, unvan Çukurkent'in Babası, soy kütüğü.
0.7: Oyun Mart 1925'te başlar. Ekim planı (`Parcel.plan`, `autoSow`), ambar (`hh.ambar`), değişen fiyatlar, çağa göre sağlık. Ağa kirası `RENT_CAP` ile sınırlı.

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
| `core/fields.ts` | Kendi tarlalarımız: ekinler (`CROPS`), parsel, ekim (`sow`), işçi atama (`assignWorker`, iş `kendi`), ırgat, aylık iş gücü ve bakım, hasat; haşhaş hasadı kartı ve devlet/kaçak/zula seçimi, `sellStash` |
| `core/crime.ts` | Karanlık taraf: Isı (`w.heat`), ruhsat (Ağustos), 1972–1974 yasağı, Kara Rıza, jandarma baskını ve hapis, ağanın kira ve kız istemesi, dolu |
| `core/plots.ts` | Köyün toprak piyasası: haritadaki 25 tarla (`PLOTS`: konum, sahip, verim), `w.plots` sahiplik ve satış durumu, fiyat, teklif kabul ihtimali, her Ocak piyasa |
| `core/assets.ts` | Ev (4 kademe), taşıtlar (eşek, at arabası, traktör, otomobil, kamyon), köy işletmeleri (bakkal, kahvehane, değirmen), nam ve unvan, toprak alımı `buyPlot` |
| `core/home.ts` | Ev içi: odalar (`ROOMS`), kapasite, kalabalık evde huzursuzluk, ayrılmak isteyen oğul kartı (`ayri_ev`). Aile kolları artık kendiliğinden ayrılmaz |
| `core/lab.ts` | Gizli atölye: SOYUT üretim zinciri (ham mal → paket → hap), yer seçimi (bodrum/değirmen/ağıl), Kimyager Cevdet, kaza, ihanet. Gerçek kimya ya da yöntem yok ve eklenmeyecek |
| `core/feud.ts` (0.8 ekleri: `rivalMoves`, `doRivalMove`, `scuffle`, `rivalCards`/`resolveRivalCard` — su/hayvan/iftira/dünür) |
| ~feud~ | Köydeki rakip aile (`w.rival`; Kocabaş, sonra Sarıkaya, Bozbey, Gümüşdere). Erkekleri tükenen aile silinir (`checkGone`), yerine yenisi gelir. Adamlarla baskın (`attackRival`). toprak kapma, sınır kavgası, kız kaçırma, pusu, intikam/diyet/sabır, barış sofrası, erkekleri eve kapatma |
| `core/baron.ts` | Kara para (`w.dirty`) ve aklama, maaşlı adamlar (`w.gang`), Kara Rıza'nın şebekesi, Çukurkent: fabrikalar (`FACS`), şehir evi, taşınma, mahalleler, rakip çete (`w.crew`), yeraltı unvanı (Baron) |
| `core/era.ts` | Çağlar (`ERAS`: 1965 Toprak Yılları → 2020 Yeni Dünya) ve teknoloji (`TECHS`: kendiliğinden gelenler ve satın alınanlar), `buyTech`, `monthlyEra`, devletin gözetim çarpanı `policeFactor` |
| `core/events.ts` | ~40 olay kartı (`ev:<id>`): askerlik, üniversite, sel, deprem, kriz, seçimler (muhtar/belediye/vekil), muhbir, rehine, kurşunlama, soygun, düğün, imece... `monthlyStories` (terhis, mezuniyet, kredi taksidi, koltuk süresi), `monthlyHostility` (rakip ve çete kendiliğinden saldırganlaşır) |
| `core/district.ts` | Çukurkent'in 6 mahallesi (`DISTS`), mahalle yatırımları (`INVS`), mahalle alma `takeDistrict`, aylık kara gelir ve aklama kapasitesi, mahalle kartları |
| `core/goals.ts` | Sonsuz oyun için 29 hanedan hedefi (`GOALS`) ve hanedan puanı (`flags.puan`) |
| `core/calendar.ts` | Takvim tabanı `World.y0` (yeni oyun 1925, eski kayıt 1965); `setBase` advance/newWorld/migrate içinde çağrılır. `kurbanMonth` kameri takvime göre bayram ayı |
| `core/market.ts` | Yıllık ürün ve hayvan fiyat çarpanları (`w.mk`), tarihî şoklar (`SHOCKS`: buhran, savaş, kriz), `mk()` |
| `core/health.ts` | Çağa göre hastalık adları ve tedavi seçenekleri (`cures`): ev, hoca, sağlıkçı/sağlık ocağı, hekim, hastane, özel hastane; rastgele fiyat; `eraMortality` |
| `core/jandarma.ts` | Karakol komutanı: tayin, huy (rüşvetçi/dürüst/hırslı), baskın çarpanı `kmtFactor`; baskın seçenekleri `raidOpts`/`resolveRaidSpecial` (zarf, nüfuz, avukat) |
| `core/family.ts` | Aile içi: küslük ve barışma, aile büyüğünün öğüdü, bayram harçlığı, gençlerin istekleri, kardeş kavgası, düğün kararı `weddingCard`; `rel` artık küslük (`Person.kus`) yaratır |
| `core/history.ts` | 1925 sonrası tarihî olaylar (`hi:<id>`): harf devrimi, soyadı, eşkıya, kaçak tütün, buhran tarlası, seferberlik, karne, köy enstitüsü (öğretmen mesleği), topraklandırma, 1950 seçimi, ağanın traktörü, 1960, Almanya; hac, kurt, yangın, piyango, muhtarın tarla haberi |
| `core/yil.ts` | Yıl defteri (her Ocak özet kartı) ve yılın niyeti (`niyetIs`): toprak, ticaret, aile, yeraltı, hayır |
| `core/suru.ts` | Koyun sürüsü (`hh.suru`): ahır 12, ağıl 40 yer; kuzu, süt, yün, kış yemi |
| `core/aga.ts` | Bozbey Ağa'nın ölümü, miras (konak, borç defteri, toprak satışı), köyün yeni ağası |
| `core/family.ts` | Küslük/barışma, bayram, büyüğün öğüdü, gençlerin istekleri, kardeş kavgası, düğün kartı |
| `core/jandarma.ts` | Karakol komutanı (huy, dostluk, sır), baskın seçenekleri |
| `core/sim.ts` | Aylık adım `advance`: ekonomi, beceri ve sağlık, yaşam, kartlar. Oyuncu eylemleri: `setJob`, `setHeir`, `payDebt`, `resolveCard`. Test botu `botTurn` |
| `ui/app.ts` | Açılış, oyun ekranı, Aile/Hane/Kronik panelleri, olay kartı (evrak görünümü), ilk tapu töreni, son ekranı. Kayıt anahtarı `ilktapu_v1` |
| `ui/map.ts` | İzometrik piksel köy; 320×196 tampona çizilir, ekrana büyütülür. `SLOTS` oyuncunun parselleri |
| `ui/styles.css` | Renk belirteçleri: toprak, buğday, kökboya, çini |

## Denge
- İlk tapu için borcun sıfır olması ve ağanın engel koymaması gerekir (`landBlockers`). Bot ortalaması 1973–1974; insan oyuncu biraz daha geç.
- Kaçak satış Isıyı artırır; Isı 12'yi geçince baskın olasılığı başlar. Zula durdukça Isı üretir.
- Haşhaş tamamen soyut: çuval, devlet fiyatı, kaçak fiyatı. Gerçek üretim ya da işleme yöntemi oyunda yoktur ve eklenmeyecek.
- Enflasyon yılda %4,5 (`infl`); ücret, gider ve toprak fiyatı birlikte artar.
- Toprak sahipliğinin ötesinde yatırım yok; geç oyunda para birikir. Faz 2'de işletmeler bu parayı emecek.

## Arayüz notları
- Sürüm notları `ui/app.ts` içindeki `NEWS`; sürüm değişince oyuncuya bir kez gösterilir. Her güncellemede güncelle.
- Haritada köyün çevresinde bozkır halkası, dağlar, dere ve dağdaki ağıl (`agil`) çizilir.
- Haritaya dokunulunca `VillageMap.onPick` tarla ya da bina döndürür; `App.renderSheet` alttan açılan kartı çizer.
- Tarla sekmesinde toplu yönetim: boş parsellere toplu ekim, gündelikçileri dağıtma, ırgat, yarıcıya verme.
- Aynı ay biten haşhaş hasatları tek kartta birleşir.

## Sıradaki (Faz 1)
- Capacitor ile iOS sarmalayıcı ve GitHub Actions derlemesi (Miras FC'deki `ios.yml` örnek alınacak).
- Aile ağacı ekranı, varis adaylarının karşılaştırılması.
- Köyde yer değiştirme (ilçeye/şehre göç), kahvehane ve bağlantı ağı, lisanslı haşhaş üretimi.
