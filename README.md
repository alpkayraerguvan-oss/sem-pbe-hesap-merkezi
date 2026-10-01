# SEM PBE Hesap Merkezi

Shell Eco-marathon **Prototype / Battery Electric** takımları için tasarım ve yarış hesaplarını tek sayfada toplayan, derleme gerektirmeyen statik web uygulaması.

## Araçlar

| Sekme | Ne hesaplar |
|---|---|
| Araç & enerji | Ortak araç parametreleri (3 ön ayar), sabit hızda kuvvet/güç/verim (km/kWh), hıza göre güç grafiği |
| Strateji simülasyonu | Zaman adımlı tur simülasyonu: sabit hız ve pulse & glide (optimum arama veya elle), kayıp dağılımı, hız profili |
| Duyarlılık analizi | Crr, CdA, kütle, motor kayıpları, boşta tüketim ve viraj sertliğinin verime etkisi (tornado) |
| Tur / süre planı | Minimum ve hedef ortalama hız, tur sonu hedef zamanları (pano tahtası) |
| Direksiyon & dönüş | Ackermann açıları, dış teker dönüş yarıçapı (Madde 42: ≤ 8 m), teker süpürmesi |
| Fren (%20 eğim) | Her fren sisteminin %20 eğimde tutması için gereken tork, basınç ve pedal/kol kuvveti |
| Roll bar (700 N) | Boru eğilme gerilmesi, güvenlik katsayısı, sehim, kask üstü pay (≥ 50 mm) |
| Batarya | Seri/paralel düzen, 60 V ve 1000 Wh sınırları, akım, şarj başına deneme sayısı |
| Boyut uyumu | Madde 39 sınırlarının kontrolü |
| Ağırlık merkezi | Düzenlenebilir kütle tablosu, aks yükleri, statik devrilme eşiği |
| Coast-down analizi | Test verisinden Crr ve CdA çıkarımı (analitik modele Nelder–Mead uydurma) |
| Aerodinamik tahmin | Hoerner bağıntısıyla gövde Cd ön tahmini, CdA, sürükleme gücü |

Varsayılan parkur SEM Polonya biçimidir: 11 tur × 1327 m = 14,6 km, en fazla 35 dakika. Viraj listesi temsilidir; gerçek parkur verisi için SEM Data & Telemetry Portal kullanılmalıdır.

## Yerelde çalıştırma

```bash
npm start          # http://localhost:5173 (npx serve)
npm test           # hesap çekirdeği testleri (Node 18+)
```

Herhangi bir statik sunucu da yeterlidir (ör. `python -m http.server`). ES modülleri kullanıldığı için dosyayı doğrudan `file://` ile açmak yerine bir sunucu üzerinden açın.

## Yapı

```
index.html          sayfa iskeleti
assets/calc.js      saf hesap fonksiyonları (tarayıcı + Node)
assets/charts.js    SVG grafikler (ipucu, tablo görünümü)
assets/app.js       arayüz, formlar, sekmeler
assets/style.css    açık/koyu tema
tests/calc.test.mjs Python referans modeliyle tutarlılık testleri
```

## Model notları

- Direnç: yuvarlanma (Crr·m·g), aerodinamik (½ρCdAv²), rulman, viraj kayma kaybı (F_yanal²/Cα), direkt tahrikte motor sürüklenmesi (b·ω + c·ω²).
- Elektrik gücü (joulemetre): P_mek/η + a·T² + P_boşta + P_yardımcı. Korna ve acil stop röle bobini kurallar gereği ölçüm dışıdır.
- Sonuçlar karşılaştırma amaçlıdır; mutlak değerleri coast-down ve pist testleriyle kalibre edin.

Resmî bir Shell Eco-marathon ürünü değildir. Kurallar için daima en güncel resmî belgeleri esas alın.

## Lisans

MIT
