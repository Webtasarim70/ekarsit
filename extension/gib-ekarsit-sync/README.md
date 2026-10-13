# e-Karşıt GİB Senkronizasyon Eklentisi

GİB e-Karşıt gönderilen kayıtlarını tüm API sayfalarıyla alıp GitHub Pages üzerindeki e-Karşıt Takip ekranına aktarır.

## Kullanım
1. GİB'e normal şekilde giriş yapın.
2. e-Karşıt sayfasını açın.
3. Eklentiyi Chrome veya Edge'e geliştirici modu ile yükleyin.
4. GİB sayfasını yenileyin.
5. Sağ alttaki e-Karşıt Takip'e Aktar düğmesine basın.
6. Son 1 yıllık tarih aralığındaki tüm sayfalar otomatik alınır.
7. e-Karşıt Takip uygulaması açılır ve kayıtlar İşlem ID üzerinden birleştirilir.

## Güvenlik
Kullanıcı adı ve parola istenmez. Oturum bilgisi kalıcı olarak saklanmaz. API çağrısı kullanıcının açık GİB oturumu içinde yapılır.

## GİB e-Tebligat Takip
1. Chrome/Edge eklentisini güncel dosyalarla yeniden yükleyin.
2. GİB'e giriş yapıp `https://dijital.gib.gov.tr/portal/e-tebligat` sayfasını açın.
3. Ekrandaki tebligat tablosu yüklendikten sonra sağ alttaki **Tebligat Takip'e Aktar / Güncelle** düğmesine basın.
4. Eklenti, sayfadaki liste isteğinin yapısını kullanarak tüm API sayfalarını alır ve kayıtları e-Karşıt uygulamasına gönderir.
5. Uygulamada **Kullanıcı → GİB Tebligat Takip** menüsünü açın. Kayıtlar kullanıcı klasöründeki `GIB_TEBLIGAT_TAKIP.json` dosyasında tutulur; yeniden aktarımlar tebligat kimliği üzerinden birleştirilir.

PDF indirme ve açma işlemleri eklenti ve uygulama akışından kaldırılmıştır. Test sırasında API sayfalamasının GİB yanıtıyla uyumlu olduğunu ve tekrar aktarımın mükerrer kayıt oluşturmadığını doğrulayın.
