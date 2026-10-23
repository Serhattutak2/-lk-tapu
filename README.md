# İlk Tapu

Mart 1965'te, kendine ait bir karış toprağı olmayan fakir bir köylü ailesinde başlayan; nesiller boyu süren bir hayat, işletme ve hanedan simülasyonu. Hedef platform iOS (iPhone ve iPad).

Fikir ve oynanış: Serhat Tutak. Geliştirme: Claude.

## Durum: Faz 0

- Simülasyon çekirdeği: takvim, kişiler, aile ağacı, meslekler, hane ekonomisi, ağa borcu ve faizi, sağlık, ölüm, evlilik, doğum, aile kollarının ayrılması.
- Veraset: varis belirlenmişse kontrol ona geçer; belirlenmemişse veraset krizi kartı çıkar, mirasın bir kısmı dağılır. Kan bağı kalmazsa oyun kesin olarak biter.
- Olay kartları: görücü, hastalık, Almanya'ya gurbet, tüccarla tanışma, ilk tapu.
- İzometrik piksel köy (Karaçam): mevsimler, haşhaş çiçekleri, tarlada çalışanlar, satın alınan parseller haritada çitle ve bayrakla görünür.
- Ekransız testler: bot 24 farklı kampanyayı 100 yıl oynar; her ay tutarlılık kuralları denetlenir.

## Komutlar

```
npm install
npm test                 # otomatik kampanya testleri
npm run build            # dist/index.html (tek dosyalık oyun)
npm run build:artifact   # dist/artifact.html (Claude'da test için)
node tools/sim.mjs 40 100        # denge raporu: 40 kampanya, 100 yıl
node tools/sim.mjs probe 5       # tek kampanyanın yıl yıl dökümü
```

Ayrıntılı geliştirici notları: [DEVIR.md](DEVIR.md)
