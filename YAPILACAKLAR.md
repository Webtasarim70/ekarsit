# e-Karşıt Projesi — Yapılacaklar Listesi

> Bu dosya proje çalışma defteridir. Yeni istekler buraya eklenir; tamamlanan işler işaretlenir. Geliştirmeler öncelikle `develop` dalında yapılır. `main` dalına aktarım yalnızca açıkça istendiğinde yapılır.

## Sıradaki işler

### Sayfa ve GitHub açıklamaları
- [x] **Sayfa başlığı ve açıklamasını güncelle:** HTML `title` ve meta açıklaması güncellendi.
- [x] **GitHub açıklamalarını güncelle:** Depo açıklaması ve konuları güncellendi.

### Kullanıcı kişiselleştirme ayarları
- [x] **Dashboard bildirimlerini kişiselleştirme:** Kartları yukarı/aşağı taşıma, kartları gizleme/gösterme ve varsayılan düzene dönme kontrolleri eklendi; tercihler kullanıcı anahtarıyla tarayıcıda saklanıyor.
  - [ ] Test: Kart sırasının ve gizleme tercihlerinin sayfa yenilendiğinde korunduğunu; kart bağlantıları ve sayaçların değişmediğini kullanıcı doğrulasın.
- [ ] **Sidebar menüsünü kişiselleştirme:** Kullanıcı bağlantıları pasif hâle getirip görünmez yapabilsin ve menü öğelerinin sırasını değiştirebilsin.

### e-Karşıt Takip Kayıtları
- [x] **Hazır kaydedilmiş filtreler:** e-Karşıt Takip Kayıtları tablosuna arama ve sütun filtrelerini adlandırarak kaydetme, yeniden uygulama ve silme fonksiyonları eklendi. Kayıtlar seçili kullanıcı klasörü adına göre tarayıcıda saklanır.
  - [x] Test: Kullanıcı, sayfa yenilendiğinde ve kullanıcı çıkış-giriş yaptığında kayıtlı filtrenin kullanılabildiğini doğruladı.
  - [x] Test: Aynı adla kaydetmenin mevcut filtreyi güncellediği ve kayıtlı filtrenin silinebildiği kullanıcı tarafından doğrulandı.

### Dashboard ve bildirimler
- [x] **Süresi gelen yazılar bildirimini durum bilgisine göre güncelle**
  - [x] Durumu “Cevaplandı” olan yazılar “Süresi Gelen Yazılar” dashboard filtresinde yer almasın.
  - [x] Sidebar bildirim rozeti, durumu “Cevaplandı” olan yazıları saymasın.
  - [x] Test: Kullanıcı, cevaplandı durumu için dashboard bildirimi ve sidebar rozetini doğruladı.
- [x] **Dashboard “Pasife Çekilmiş” kutucuğu** tıklanınca e-Karşıt tablosunu “Pasife Çekilmiş” durumuyla filtreleyerek açsın.
  - [x] Test: Kullanıcı, karttan açılan tabloda yalnızca “Pasife Çekilmiş” kayıtların gösterildiğini; sayfalar arası geçişte ve yenileme/yeniden giriş sonrasında filtrenin kalıcı olmadığını doğruladı.
- [x] **Dashboard arşiv dosyaları bildirimi:** Sayacın tüm Excel dosyalarını firma arşivi olarak sayması düzeltildi; yalnızca `ARSIV_...` adlı arşiv çalışma kitapları sayılıyor.
  - [x] Test: Kullanıcı, dashboard sayısını kullanıcı klasöründeki arşiv dosyalarıyla karşılaştırıp olumlu sonuç bildirdi.

### GİB ve tarayıcı eklentisi
- [ ] **GİB Tebligat Takip modülü:** Ayrı menü, yerel JSON kayıt dosyası, tablo/arama/Excel dışa aktarımı ve e-Tebligat sayfasından eklentiyle çok sayfalı aktarım eklendi.
  - [x] Test: 67 kaydın tamamı tabloda görünüyor; ikinci aktarımda mükerrer kayıt oluşmuyor; Excel çıktısı açılıyor ve tarihler doğru. Kullanıcı tarafından doğrulandı.
- [ ] **Eksiklik yazısını GİB e-Tebligat sayfasından alma:** İsteğe bağlı “PDF Kaydet” ve kayıtlı PDF’yi açma akışı eklendi; gerçek GİB oturumuyla uçtan uca test bekliyor.
- [ ] **GİB e-Karşıt aktarımı:** Daha önce “Pasife Çekilmiş” durumunda olup sonradan onaylanan kayıtların durumlarını doğru şekilde güncelle.
- [ ] **“GİB İadem Nerede” modülü:** Menüyü yakalama akışını ekle ve vergi dairesi üzerinden toplu dönem sorgulama/güncelleme işlevini geliştir.
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
  - [x] Test: Kullanıcı, “Süresi Gelen Yazılar” kartının yalnızca son tarihi bugün ile sonraki 5 gün arasında olan kayıtları gösterdiğini doğruladı.
  - [x] Test: Kullanıcı, “Cevap Bekliyor” ve pasif/iptal onay taleplerinin ilgili durum filtresi seçili olarak açıldığını doğruladı.
  - [x] Test: Kullanıcı, filtre uygulanmış tablodan başka bir dashboard kartına geçildiğinde eski filtrenin temizlenip yeni kartın filtresinin doğru uygulandığını doğruladı.
- [x] **GİB Chrome/Edge eklentisinin son sürümünü doğrula**
  - [x] Eklenti yeniden yüklenerek test edildi.
  - [x] “e-Karşıt Takip’e Aktar” ve “Excel’e Aktar” işlemleri ayrı ayrı denendi; kullanıcı ikisinin de sorunsuz çalıştığını doğruladı.
  - [x] Excel dışa aktarımı ve dosyanın açılması kullanıcı tarafından doğrulandı.
- [ ] **e-Karşıt kayıt birleştirmesini kontrol et**
  - [x] Test: Aynı İşlem ID tekrar GİB üzerinden aktarılınca mevcut kayıt güncelleniyor ve mükerrer kayıt oluşmuyor.
  - [x] Test: Aynı İşlem ID tekrar GİB üzerinden aktarıldığında mevcut “Not” alanının korunduğu kullanıcı tarafından doğrulandı.
  - [x] Test: Mevcut kayıtların tekrar aktarımında sayaçlar doğrulandı; 114 kayıt alındı, 0 yeni ve 114 güncellenen olarak raporlandı.
  - [ ] Test: Yeni kayıt sayısının doğru raporlanmasını doğrula (yeni kayıt oluşturulamadığı için beklemede).
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
