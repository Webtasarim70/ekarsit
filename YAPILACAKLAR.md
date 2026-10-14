# e-Karşıt Projesi — Yapılacaklar Listesi

> Bu dosya proje çalışma defteridir. Yeni istekler buraya eklenir; tamamlanan işler işaretlenir. Geliştirmeler öncelikle `develop` dalında yapılır. `main` dalına aktarım yalnızca açıkça istendiğinde yapılır.

## Sıradaki işler

### Sayfa ve GitHub açıklamaları
- [x] **Sayfa başlığı ve açıklamasını güncelle:** HTML `title` ve meta açıklaması güncellendi.
- [x] **GitHub açıklamalarını güncelle:** Depo açıklaması ve konuları güncellendi.

### Kullanıcı kişiselleştirme ayarları
- [x] **Dashboard bildirimlerini kişiselleştirme:** Kartları yukarı/aşağı taşıma, sürükle-bırak ile sıralama, kartları gizleme/gösterme ve varsayılan düzene dönme kontrolleri eklendi; tercihler kullanıcı anahtarıyla tarayıcıda saklanıyor.
  - [x] Test: Kullanıcı, dişli simgesini ve kartları sürükleyerek sıralamayı başarıyla test etti.
  - [ ] Mobil test: Telefon/tablet ekranlarında görünüm, dokunmatik sürükleme, ok düğmeleri ve tercihlerin korunması kontrol edilecek.
- [x] **Sidebar menüsünü kişiselleştirme:** Menü bölümlerini gizleme/gösterme ve sıralarını değiştirme; görünür alt bağlantıları tek tek gizleme/gösterme ayarları eklendi. Tarayıcıda kullanıcı klasörüne göre saklanır.
  - [x] Test: Kullanıcı bölüm sıralama, gizleme/gösterme, tercihlerin korunması ve sayfa bağlantılarını test etti; sorun bildirmedi.
  - [x] Tasarım kararı: “Karşıt İnceleme Doldur” adımları birbirine bağlı olduğundan alt menüde ayrıca listelenmeyecek.
  - [ ] Mobil test: Menü görünümü ve dokunmatik etkileşimler daha sonra kontrol edilecek.

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

### Canlı GitHub Pages test kaydı — 14.10.2026
- [x] **e-Karşıt güncelleme — uygulama sayfası:** Canlı GitHub Pages üzerinden kullanıcı tarafından test edildi; başarılı.
- [x] **e-Karşıt güncelleme — tarayıcı eklentisi:** Canlı GİB sayfası ve eklenti üzerinden kullanıcı tarafından test edildi; başarılı.
- [x] **Tebligat güncelleme — uygulama sayfası:** Canlı GitHub Pages üzerinden kullanıcı tarafından test edildi; başarılı.
- [x] **Tebligat güncelleme — tarayıcı eklentisi:** Canlı GİB e-Tebligat sayfası ve eklenti üzerinden kullanıcı tarafından test edildi; başarılı.
- [x] **Canlı test sonucu:** Kullanıcı dört akışın tamamında hata almadığını bildirdi. Bu testler localhost üzerinde değil, yayınlanan GitHub Pages ve canlı GİB/eklenti akışları üzerinden yapıldı.

### GİB ve tarayıcı eklentisi
- [x] **GİB Tebligat Takip modülü:** Ayrı menü, yerel JSON kayıt dosyası, tablo/arama/Excel dışa aktarımı ve e-Tebligat sayfasından eklentiyle çok sayfalı aktarım eklendi.
  - [x] Test: 67 kaydın tamamı tabloda görünüyor; ikinci aktarımda mükerrer kayıt oluşmuyor; Excel çıktısı açılıyor ve tarihler doğru. Kullanıcı tarafından doğrulandı.
- [x] **İPTAL — Eksiklik yazısını GİB e-Tebligat sayfasından alma ve kayda bağlama:** Daha önce canlı GİB ekranında her tebligatın zarfı açılarak `İşlem Yap → Zarf içeriğini gör → Belge görüntüle` akışı denendi. Hedef belgeler yetki kısıtı nedeniyle alınamadı. Bu nedenle PDF’yi eklentiyle alma, kayda bağlama ve yeniden açma geliştirmesi şimdilik iptal edildi; yetki sorunu giderilmedikçe yeniden başlatılmayacak.
- [x] **GİB e-Karşıt aktarımı:** Daha önce “Pasife Çekilmiş” durumunda olup sonradan onaylanan kayıtların durumlarını doğru şekilde güncelle. Kullanıcı, bu görevin daha önce tamamlandığını teyit etti.
- [ ] **ERTELENDİ — “GİB İadem Nerede” modülü:** Menü yakalama ve vergi dairesi üzerinden toplu dönem sorgulama/güncelleme çalışması sonraya bırakıldı; mevcut görev sırası değiştirilerek e-Karşıt Takip’in mükellef uyarlamasına geçildi.
- [ ] **YMM Yazıları menüsünü** tamamlama.
- [ ] **e-Karşıt Takip modülünü mükellefe uyarlama:** Takip ekranı ve iş akışlarını mükellef bazında çalışacak şekilde düzenle.
  - [x] İnceleme notu: mükellef hesabında `POST /apigateway/ymm/karsit-cevap-yazisi/gelen-ve-cevap-verilen-listele` isteği 200 OK dönüyor; liste alanı `gelenVeCevapVerilenDtoList`, sayfalama bilgisi `pageDetail` içinde.
  - [x] 403 bulgusu: mükellef hesabında `POST /apigateway/ymm/karsit-isteme-yazisi/gonderilen-listele` isteği `403 Forbidden` ve `Servise erişim yetkiniz bulunmamaktadır.` yanıtı veriyor.
  - [x] İlk uyarlama `develop` dalında: mevcut YMM listeleme isteği korunuyor; yalnızca 403 dönerse doğrulanmış mükellef listeleme servisine geçiliyor. Mükellef isteğine `toBeReported:false` ve `sortType:DESC` ekleniyor; iki servisin farklı yanıt liste alanları ayrı işleniyor.
  - [ ] Test: YMM hesabında eski aktarımın değişmediğini, mükellef hesabında ise 403 sonrası kayıtların tüm sayfalarıyla alınıp İşlem ID üzerinden birleştirildiğini canlı GİB oturumlarında doğrula.
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
- **Birleştirme ön kontrolü (14.10.2026):** GitHub karşılaştırmasında `main` ve `develop` dalları ayrışmış görünüyor (`develop`, `main` üzerinde 30 commit önde ve 40 commit geride). Bu nedenle doğrudan `develop → main` PR açılmamalı; birleştirme öncesinde dal farkları ve özellikle önceki GİB/eklenti değişiklikleri incelenerek kontrollü bir uzlaştırma yapılmalı.
- Yeni istekler önce “Sıradaki işler” bölümüne eklenir; tamamlanınca işaretlenip gerekiyorsa “Tamamlananlar” bölümüne taşınır.
