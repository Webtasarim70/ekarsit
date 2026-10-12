# e-Karşıt Projesi — Yapılacaklar Listesi

> Bu dosya proje çalışma defteridir. Yeni istekler buraya eklenir; tamamlanan işler işaretlenir. Geliştirmeler öncelikle `develop` dalında yapılır. `main` dalına aktarım yalnızca açıkça istendiğinde yapılır.

## Sıradaki işler

### Kullanıcı kişiselleştirme ayarları
- [ ] **Dashboard bildirimlerini kişiselleştirme:** Kullanıcı bildirim kartlarının yerini değiştirebilsin ve istemediği bildirimleri kapatabilsin.
- [ ] **Sidebar menüsünü kişiselleştirme:** Kullanıcı bağlantıları pasif hâle getirip görünmez yapabilsin ve menü öğelerinin sırasını değiştirebilsin.

### e-Karşıt Takip Kayıtları
- [ ] **Hazır kaydedilmiş filtreler:** e-Karşıt Takip Kayıtları tablosuna, sık kullanılan filtreleri kaydedip daha sonra tek seçimle uygulama fonksiyonu ekle.

### Dashboard ve bildirimler
- [x] **Süresi gelen yazılar bildirimini durum bilgisine göre güncelle**
  - [x] Durumu “Cevaplandı” olan yazılar “Süresi Gelen Yazılar” dashboard filtresinde yer almasın.
  - [x] Sidebar bildirim rozeti, durumu “Cevaplandı” olan yazıları saymasın.
  - [x] Test: Kullanıcı, cevaplandı durumu için dashboard bildirimi ve sidebar rozetini doğruladı.
- [x] **Dashboard “Pasife Çekilmiş” kutucuğu** tıklanınca e-Karşıt tablosunu “Pasife Çekilmiş” durumuyla filtreleyerek açsın.
  - [ ] Test: Karttan açılan tabloda yalnızca “Pasife Çekilmiş” kayıtların gösterildiğini ve sidebar ile yeniden girişte filtrenin kalıcı olmadığını doğrula.
- [x] **Dashboard arşiv dosyaları bildirimi:** Sayacın tüm Excel dosyalarını firma arşivi olarak sayması düzeltildi; yalnızca `ARSIV_...` adlı arşiv çalışma kitapları sayılıyor.
  - [x] Test: Kullanıcı, dashboard sayısını kullanıcı klasöründeki arşiv dosyalarıyla karşılaştırıp olumlu sonuç bildirdi.

### GİB ve tarayıcı eklentisi
- [ ] **GİB Tebligat Takip modülü:** Ayrı menü, yerel JSON kayıt dosyası, tablo/arama/Excel dışa aktarımı ve e-Tebligat sayfasından eklentiyle çok sayfalı aktarım eklendi.
  - [x] Test: 67 kaydın tamamı tabloda görünüyor; ikinci aktarımda mükerrer kayıt oluşmuyor; Excel çıktısı açılıyor ve tarihler doğru. Kullanıcı tarafından doğrulandı.
- [ ] **Eksiklik yazısını GİB e-Tebligat sayfasından alma:** PDF belgesini alma/ilişkilendirme akışını ayrıca araştır ve uygula.
- [ ] **GİB e-Karşıt aktarımı:** Daha önce “Pasife Çekilmiş” durumunda olup sonradan onaylanan kayıtların durumlarını doğru şekilde güncelle.
- [ ] **“GİB İadem Nerede” menüsünü yakalama** akışını ekle.
- [ ] **YMM Yazıları menüsünü** tamamlama.
- [ ] **e-Karşıt Takip modülünü mükellefe uyarlama:** Takip ekranı ve iş akışlarını mükellef bazında çalışacak şekilde düzenle.
- [ ] **GİB sayfasındaki eklenti butonlarını kaldırma:** Eklentinin GİB sayfasına enjekte ettiği butonlar yerine, işlemleri uygulamanın kendi sayfası içerisinden başlatılabilecek butonlar oluştur.

### Firma arşivi
- [ ] **Firma arşiv düzenleme:** Düzenleme bölümünde girilen bilgileri kaydetme fonksiyonunu tamamla.
- [ ] **Firma arşiv işlemleri → Dosyadan Veri Al:** Sayfasındaki kaydetme fonksiyonunu tamamla.

### Excel, tutanak ve KDV listeleri
- [ ] **Beyanname bilgileri:** Excel içeriğinde ilgili alanları sayı biçiminde biçimlendir.
- [ ] **Tutanak cevabı inceleme:** PDF ile yüklenen Excel dosyalarında vergi numarası ve fatura kontrolünü yap.
- [ ] **Tutanak cevabı inceleme:** Tedarik faturaları toplamı ile tutanak içindeki faturaların toplamını ve dönemini kontrol et.
- [ ] **XML'den KDV listesi oluştur:** Oluşturulan listelerdeki eksiklikleri tamamla.

### Önceden planlanan kontroller
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
- [x] e-Karşıt dashboard filtresinin değişken kapsamı hatası düzeltildi; filtreleme testinde sorun olmadığı kullanıcı tarafından doğrulandı.

## Çalışma notları

- Aktif geliştirme dalı: `develop`
- `main` dalına kendiliğinden birleştirme yapılmaz.
- Yeni istekler önce “Sıradaki işler” bölümüne eklenir; tamamlanınca işaretlenip gerekiyorsa “Tamamlananlar” bölümüne taşınır.
