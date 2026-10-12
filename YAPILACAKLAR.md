# e-Karşıt Projesi — Yapılacaklar Listesi

> Bu dosya proje çalışma defteridir. Yeni istekler buraya eklenir; tamamlanan işler işaretlenir. Geliştirmeler öncelikle `develop` dalında yapılır. `main` dalına aktarım yalnızca açıkça istendiğinde yapılır.

## Sıradaki işler

- [ ] **Dashboard bildirim filtrelerini test et**
  - [x] Dashboard filtresinin başka sayfalara taşınıp tabloyu kalıcı olarak daraltması düzeltildi; filtre artık yalnızca dashboard kartından açılan sayfa görünümüne uygulanıyor.
  - [ ] “Süresi Gelen Yazılar” kartı yalnızca son tarihi bugün ile sonraki 5 gün arasında olan kayıtları açıyor mu?
  - [ ] “Cevap Bekliyor” ve pasif/iptal onay talepleri ilgili durum filtresi seçili olarak açılıyor mu?
  - [ ] Filtre uygulanmış tablodan başka bir dashboard kartına geçince eski filtre temizleniyor mu?
- [ ] **GİB Chrome/Edge eklentisinin son sürümünü doğrula**
  - [ ] Eklentiyi tarayıcıda yeniden yükle.
  - [ ] “e-Karşıt Takip’e Aktar” ve “Excel’e Aktar” işlemlerini ayrı ayrı dene; birbirini tetiklemediklerini doğrula.
  - [ ] Excel dışa aktarımının kaydetme penceresini açtığını ve dosyanın açılabildiğini doğrula.
- [ ] **e-Karşıt kayıt birleştirmesini kontrol et**
  - [ ] Aynı İşlem ID tekrar aktarılınca kayıt güncelleniyor mu?
  - [ ] Var olan “Not” alanı GİB aktarımı veya Excel içe aktarımı sırasında korunuyor mu?
  - [ ] Yeni kayıt ve güncellenen kayıt sayıları doğru raporlanıyor mu?
- [ ] **Değişiklikler sonrası genel kontrol**
  - [ ] İlgili JavaScript dosyalarında sözdizimi kontrolü yap.
  - [ ] Filtreler, Excel içe/dışa aktarma ve kayıt düzenleme akışlarında geriye dönük hata olmadığını kontrol et.

## Tamamlananlar

- [x] e-Karşıt kayıtlarını GİB kaynak sayfasındaki eklenti üzerinden uygulamaya aktarma akışı kuruldu.
- [x] GİB listesinin sayfaları tek işlemde çekilip İşlem ID üzerinden birleştirilmesi sağlandı.
- [x] e-Karşıt takip tablosuna “Not” alanı eklendi; mevcut Not değerinin içe aktarmada korunması sağlandı.
- [x] GİB kaynak sayfasına bağımsız “e-Karşıt Takip’e Aktar” ve “Excel’e Aktar” butonları eklendi.
- [x] e-Karşıt takip sayfasındaki ayrı senkronizasyon butonu kaldırıldı.
- [x] Takip tablolarına filtrelenmiş görünümü Excel’e aktarma özelliği eklendi.
- [x] Dashboard kartlarına tıklanınca hedef tabloda ilgili filtreyi uygulama çalışması yapıldı; uçtan uca test bekliyor.

## Çalışma notları

- Aktif geliştirme dalı: `develop`
- `main` dalına kendiliğinden birleştirme yapılmaz.
- Yeni istekler önce “Sıradaki işler” bölümüne eklenir; tamamlanınca işaretlenip gerekiyorsa “Tamamlananlar” bölümüne taşınır.
