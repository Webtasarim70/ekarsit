/* ============================================================
   KDV beyannamesi / muhtasar beyannamesi PDF metninden
   alan çıkarma (best-effort; her zaman kullanıcı kontrolüne açık)
   ============================================================ */

function parseKdvBeyannamePdf(text) {
  const raw = String(text || '').replace(/\r/g, '');
  const flat = raw.replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = raw.split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const result = {
    vkn:'', unvan:'', vergiDairesi:'', donem:'',
    teslimBedel:'', ozelMatrah:'', kdvMatrahi:'', hesaplananKdv:'',
    ilaveKdv:'', toplamKdv:'', indirimler:'', odenecekKdv:'',
    devredenKdv:'', tahakkukNo:''
  };

  const money = String.raw`(?:-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+(?:,\d{2})?)`;
  const clean = v => String(v || '').replace(/\s+/g,' ').trim();
  const firstMoney = line => {
    const hits = String(line || '').match(new RegExp('(' + money + ')','g')) || [];
    return hits[0] || '';
  };
  const lastMoney = line => {
    const hits = String(line || '').match(new RegExp('(' + money + ')','g')) || [];
    return hits[hits.length-1] || '';
  };
  const isOldFormat = /Matrah\s+Toplamı/i.test(flat) || /Vergi\s+Kimlik\s+Numarası/i.test(flat);

  const moneyNearLine = (labelRegex, maxLines=5) => {
    const re = new RegExp(labelRegex, 'i');
    const idx = lines.findIndex(l => re.test(l));
    if (idx < 0) return '';
    for (let j=idx; j<Math.min(lines.length,idx+maxLines); j++) {
      const hit=firstMoney(lines[j]);
      if(hit) return hit;
    }
    return '';
  };
  const moneyAfter = (label, window=220) => {
    const re = new RegExp(label + `.{0,${window}}?(` + money + `)`, 'i');
    const hit=flat.match(re);
    return hit ? hit[1].trim() : '';
  };
  const moneyBeforeLine = (labelRegex, maxLines=8) => {
    const re=new RegExp(labelRegex,'i');
    const idx=lines.findIndex(l=>re.test(l));
    if(idx<0) return '';
    for(let j=idx-1;j>=Math.max(0,idx-maxLines);j--){
      const hit=lastMoney(lines[j]);
      if(hit) return hit;
    }
    return '';
  };
  const moneyOnOrAfterExactLabel = (labelRegex, stopRegexes=[], maxLines=12) => {
    const re=new RegExp(labelRegex,'i');
    const idx=lines.findIndex(l=>re.test(l));
    if(idx<0) return '';
    const same=firstMoney(lines[idx]);
    if(same) return same;
    for(let j=idx+1;j<Math.min(lines.length,idx+1+maxLines);j++){
      if(stopRegexes.some(rx=>new RegExp(rx,'i').test(lines[j]))) break;
      const hit=firstMoney(lines[j]);
      if(hit) return hit;
    }
    return '';
  };
  const moneyForTotalLabel = (labelRegex, nextSectionRegexes=[], maxLines=16) => {
    const re=new RegExp(labelRegex,'i');
    const idx=lines.findIndex(l=>re.test(l));
    if(idx<0) return '';
    const same=lastMoney(lines[idx]);
    if(same) return same;
    for(let j=idx+1;j<Math.min(lines.length,idx+1+maxLines);j++){
      if(nextSectionRegexes.some(rx=>new RegExp(rx,'i').test(lines[j]))) break;
      const hit=firstMoney(lines[j]);
      if(hit) return hit;
    }
    return '';
  };

  // ---------------- Mükellef bilgileri ----------------
  // Eski formda etiket, VKN'den sonra geldiği için "etiketten sonraki sayı"
  // yöntemi yanlışlıkla beyannameyi düzenleyenin TC/VKN'sini seçebilir.
  // Formun başındaki ilk 10/11 haneli kimlik numarası mükellefin VKN'sidir.
  const vknCandidates = [...flat.matchAll(/\b(\d{10,11})\b/g)].map(m=>m[1]);
  if(vknCandidates.length) result.vkn=vknCandidates[0];
  if(!result.vkn){
    const m = flat.match(/Vergi\s+Kimlik\s+(?:No|Numarası)\s*:?\s*(\d{8,11})/i);
    if(m) result.vkn=m[1];
  }

  m=flat.match(/Adı\s+Soyadı\/Ünvanı\s+(.+?)\s+E-Posta\s+Adresi/i);
  if(m) result.unvan=clean(m[1]);
  if(!result.unvan){
    const u1=lines.find(x=>/Soyadı\s*\(Unvanı\)/i.test(x));
    const u2=lines.find(x=>/Adı\s*\(Unvanın Devamı\)/i.test(x));
    result.unvan=clean([
      u1 ? u1.replace(/^.*?Soyadı\s*\(Unvanı\)\s*/i,'') : '',
      u2 ? u2.replace(/^.*?Adı\s*\(Unvanın Devamı\)\s*/i,'') : ''
    ].filter(Boolean).join(' '));
  }

  // ---------------- Dönem ----------------
  const aylar={'Ocak':'01','Şubat':'02','Mart':'03','Nisan':'04','Mayıs':'05','Haziran':'06','Temmuz':'07','Ağustos':'08','Eylül':'09','Ekim':'10','Kasım':'11','Aralık':'12'};
  const ayKey=x=>Object.keys(aylar).find(k=>k.toLocaleLowerCase('tr-TR')===String(x||'').toLocaleLowerCase('tr-TR'))||'';

  // ÖNEMLİ: Eski beyannamede dönem, Onay Zamanı'ndan değil açıkça yazan Yıl + Ay bilgisinden alınır.
  // Örn. "Yıl 2023 / Ay Ocak" => 01.2023; "Ay Şubat" => 02.2023.
  let yil='';
  const yMatch=flat.match(/\bYıl\s*:??\s*(20\d{2})/i);
  if(yMatch) yil=yMatch[1];
  let ay='';
  const aMatch=flat.match(/\bAy(?:lık)?\s*:?\s*((?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık))\b/i);
  if(aMatch) ay=aMatch[1];
  const ak=ayKey(ay);
  if(yil && ak) result.donem=`${aylar[ak]}.${yil}`;

  if(!result.donem){
    // Satır tabanlı fallback; yine yalnızca Ay alanını kullanır.
    const yi=lines.findIndex(l=>/\bYıl\b/i.test(l));
    if(yi>=0){
      for(let j=yi;j<Math.min(lines.length,yi+4);j++){
        const ym=lines[j].match(/\b(20\d{2})\b/); if(ym){yil=ym[1];break;}
      }
    }
    const ai=lines.findIndex(l=>/^.*\bAy(?:lık)?\b.*$/i.test(l));
    if(ai>=0){
      for(let j=ai;j<Math.min(lines.length,ai+5);j++){
        // Eski PDF'de "Ay" ve "Ocak/Şubat/..." ayrı metin satırları olabilir.
        const am=lines[j].match(/\bAy(?:lık)?\s*:?\s*((?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık))\b/i);
        if(am){ay=am[1];break;}
        const standalone=lines[j].match(/^(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)$/i);
        if(standalone){ay=standalone[1];break;}
      }
    }
    const k=ayKey(ay); if(yil&&k) result.donem=`${aylar[k]}.${yil}`;
  }

  // ---------------- KDV alanları ----------------
  result.teslimBedel = moneyNearLine(String.raw`^Teslim\s+ve\s+Hizmetlerin\s+Karşılığını\s+Teşkil\s+Eden\s+Bedel\s+\(aylık\)`,4)
    || moneyNearLine(String.raw`^Teslim\s+ve\s+Hizmetlerin\b`,4)
    || moneyAfter(String.raw`Teslim\s+ve\s+Hizmetlerin`,220);

  if(isOldFormat){
    // ESKİ KDV BEYANNAMESİ
    // PDF.js bazı eski beyanname PDF'lerinde hücreleri ters sırada verir:
    // "33.454,94 Toplam Katma Değer Vergisi" gibi. Bu nedenle eski formatta
    // artık "etiketin altında ilk rakam" veya toplu blok sırası kullanılmaz.
    // Her değer kendi etiketine bağlanır; aynı satırdaki rakam önceliklidir,
    // ardından yalnızca hemen komşu satırlar kontrol edilir.
    // Eski beyannamelerde PDF.js metin sırası güvenilir değildir:
    // bazı PDF'lerde aynı satır "33.454,94 Toplam Katma Değer Vergisi",
    // bazılarında "Toplam Katma Değer Vergisi 33.454,94" olarak gelir.
    // Bu nedenle eski formatta artık etiketin satır başında olmasını
    // şart koşmuyoruz. Önce koordinatlarla oluşturulmuş mantıksal satırı
    // buluyor, sonra o satırdaki tutarı etiketten bağımsız olarak alıyoruz.
    const moneyOnSameLogicalLine = (labelRegex, opts={}) => {
      const re = new RegExp(labelRegex,'i');
      const idx = lines.findIndex(l => re.test(l));
      if(idx < 0) return '';

      // Aynı mantıksal satırda birden fazla para varsa, kullanıcıya ait
      // beyannamenin bu özet satırlarında genellikle tek tutar bulunur.
      const hits = String(lines[idx] || '').match(new RegExp('(' + money + ')','g')) || [];
      if(hits.length) return hits[hits.length-1];

      // PDF.js satır kırılması nedeniyle etiket ve tutar ayrı satıra düşerse
      // yalnızca çok yakın komşu satırlara bak. Geniş arama yapmıyoruz; böylece
      // başka bir KDV satırının tutarını yanlışlıkla alma riski azalıyor.
      const max = opts.maxLines || 1;
      for(let d=1; d<=max; d++){
        const next = lines[idx+d];
        if(next){
          const n = String(next).match(new RegExp('(' + money + ')','g')) || [];
          if(n.length) return n[0];
        }
        const prev = lines[idx-d];
        if(prev){
          const n = String(prev).match(new RegExp('(' + money + ')','g')) || [];
          if(n.length) return n[n.length-1];
        }
      }
      return '';
    };

    // Eski PDF'de bazı etiketler ve tutarlar PDF.js tarafından farklı
    // metin parçalarına ayrılabildiğinden, yalnızca aynı JS satırına güvenmiyoruz.
    // Etiketin hem SONRASINDA hem ÖNCESİNDE bulunan en yakın tutarı da kontrol ediyoruz.
    const moneyAroundLabel = (labelRegex, maxChars=180) => {
      const lr = String(labelRegex);
      const forward = new RegExp(lr + `\\s*` + `.{0,${maxChars}}?` + `(` + money + `)`, 'i').exec(flat);
      const backward = new RegExp(`(` + money + `)` + `.{0,${maxChars}}?` + lr, 'i').exec(flat);
      if (forward && backward) {
        // Etikete daha yakın olan eşleşmeyi tercih et.
        const fi = forward.index + forward[0].indexOf(forward[1]);
        const bi = backward.index + backward[0].indexOf(backward[1]);
        const liF = forward.index + forward[0].indexOf(forward[0].match(new RegExp(lr,'i'))[0]);
        const liB = backward.index + backward[0].indexOf(backward[0].match(new RegExp(lr,'i'))[0]);
        return Math.abs(fi-liF) <= Math.abs(bi-liB) ? forward[1] : backward[1];
      }
      return (forward && forward[1]) || (backward && backward[1]) || '';
    };

    // Eski beyannamede KDV MATRAHI, doğrudan "Matrah Toplamı" satırındaki
    // tutardır. PDF.js metni ters sırada verse dahi etiketi ve tutarı aynı
    // mantıksal satırdan / doğrudan komşu metin parçasından eşleştiriyoruz.
    const matrahToplamiDirect = new RegExp(
      String.raw`Matrah\s+Toplamı\s*(` + money + `)`, 'i'
    ).exec(flat);
    const matrahToplamiReverse = new RegExp(
      String.raw`(` + money + `)\s*Matrah\s+Toplamı`, 'i'
    ).exec(flat);
    result.kdvMatrahi = (matrahToplamiDirect && matrahToplamiDirect[1])
      || (matrahToplamiReverse && matrahToplamiReverse[1])
      || moneyOnSameLogicalLine(String.raw`Matrah\s+Toplamı\b`, {maxLines:2})
      || moneyAroundLabel(String.raw`Matrah\s+Toplamı\b`);

    // Eski formda bu üç alan birbirine çok yakındır. Her biri artık kendi
    // başlığıyla eşleştiriliyor; böylece değerlerin PDF.js tarafından ters
    // sırada dönmesi sonucu alanlar birbirine kaymıyor.
    result.hesaplananKdv = moneyOnSameLogicalLine(String.raw`Hesaplanan\s+Katma\s+Değer\s+Vergisi\b`, {maxLines:1});
    result.ilaveKdv = moneyOnSameLogicalLine(String.raw`Daha\s+Önce\s+İndirim\s+Konusu\s+Yapılan\s+KDV(?:’|')?nin\s+İlavesi\b`, {maxLines:2})
      || moneyOnSameLogicalLine(String.raw`Daha\s+Önce\s+İndirim\s+Konusu`, {maxLines:2})
      || moneyAroundLabel(String.raw`Daha\s+Önce\s+İndirim\s+Konusu\s+Yapılan\s+KDV(?:’|')?nin\s+İlavesi\b`);
    result.toplamKdv = moneyOnSameLogicalLine(String.raw`Toplam\s+Katma\s+Değer\s+Vergisi\b`, {maxLines:2})
      || moneyAroundLabel(String.raw`Toplam\s+Katma\s+Değer\s+Vergisi\b`);

    // İndirimler Toplamı: aynı satırdaki 975.079,98 alınır. Böylece
    // "Önceki Dönemden Devreden İndirilecek KDV" tutarı (9.972,17)
    // kesinlikle bu alana taşınmaz.
    result.indirimler = moneyOnSameLogicalLine(String.raw`İndirimler\s+Toplamı`, {maxLines:2})
      || moneyAroundLabel(String.raw`İndirimler\s+Toplamı`);

    // Sonuç bölümü de etiket bazında okunur. Böylece aradaki iade/tecil
    // tutarları yanlışlıkla Ödenecek veya Devreden KDV alanına girmez.
    result.odenecekKdv = moneyOnSameLogicalLine(String.raw`Ödenmesi\s+Gereken\s+Katma\s+Değer\s+Vergisi\b`, {maxLines:2})
      || moneyAroundLabel(String.raw`Ödenmesi\s+Gereken\s+Katma\s+Değer\s+Vergisi\b`);
    result.devredenKdv = moneyOnSameLogicalLine(String.raw`Sonraki\s+Döneme\s+Devreden\s+Katma\s+Değer\s+Vergisi\b`, {maxLines:2})
      || moneyAroundLabel(String.raw`Sonraki\s+Döneme\s+Devreden\s+Katma\s+Değer\s+Vergisi\b`);

    // Özel Matrah alanı, aylık teslim/hizmet bedeli DEĞİLDİR.
    // Eski beyannamede "Özel Matrah Şekline Tabi İşlemlerde Matraha Dahil
    // Olmayan Bedel" satırı doğrudan alınır. Örnekte değer 0,00'dır.
    result.ozelMatrah = moneyOnSameLogicalLine(
      String.raw`Özel\s+Matrah\s+Şekline\s+Tabi\s+İşlemlerde\s+Matraha\s+Dahil\s+Olmayan\s+Bedel`, {maxLines:2}
    ) || moneyAroundLabel(
      String.raw`Özel\s+Matrah\s+Şekline\s+Tabi\s+İşlemlerde\s+Matraha\s+Dahil\s+Olmayan\s+Bedel`
    ) || '0,00';
  }else{
    result.kdvMatrahi = moneyNearLine(String.raw`^Toplam\s+Matrah\b`,4) || moneyAfter(String.raw`Toplam\s+Matrah`,140);
    result.hesaplananKdv = moneyNearLine(String.raw`^Hesaplanan\s+KDV\b`,4) || moneyAfter(String.raw`Hesaplanan\s+KDV`,140);
    result.ilaveKdv = moneyNearLine(String.raw`^Daha\s+Önce\s+İndirim\s+Konusu`,5) || moneyAfter(String.raw`Daha\s+Önce\s+İndirim\s+Konusu`,180);
    result.toplamKdv = moneyNearLine(String.raw`^Toplam\s+KDV\b`,4) || moneyAfter(String.raw`Toplam\s+KDV`,140);
    result.indirimler = moneyNearLine(String.raw`^İndirimler\s+Toplamı\b`,4) || moneyAfter(String.raw`İndirimler\s+Toplamı`,140);
    result.odenecekKdv = moneyNearLine(String.raw`^Ödenmesi\s+Gereken\s+KDV\b`,4) || moneyAfter(String.raw`Ödenmesi\s+Gereken\s+KDV`,160);
    result.devredenKdv = moneyNearLine(String.raw`^Sonraki\s+Döneme\s+Devreden\b`,4) || moneyAfter(String.raw`Sonraki\s+Döneme\s+Devreden`,180);
    result.ozelMatrah = '';
  }

  result.tahakkukNo='';
  Object.keys(result).forEach(k=>result[k]=clean(result[k]));
  return result;
}

function parseKdvTahakkukPdfText(text) {
  const raw = String(text || '').replace(/\r/g, '');
  const flat = raw.replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = raw.split('\n').map(x => x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const result = { vkn:'', unvan:'', donem:'', tahakkukNo:'' };

  // Tahakkuk fişlerindeki uzun belge numarası; yeni ve eski formatlarda
  // rakam + harf kodu + rakam yapısındadır. Örn:
  // 2025112201Gen0000013 / 2026082401OY90000082
  const noMatches = flat.match(/\b\d{10}[A-Za-z]{2,4}\d{7,9}\b/g) || [];
  if(noMatches.length) result.tahakkukNo = noMatches[0];

  // VKN: iki formatta da açık etiket mevcut.
  let m = flat.match(/VERGİ\s+KİMLİK(?:\s+NUMARASI|\s+NO)?\s*:?\s*(\d{8,11})/i);
  if(m) result.vkn = m[1];
  if(!result.vkn){
    const idx = lines.findIndex(l => /VERGİ\s+KİMLİK/i.test(l));
    if(idx >= 0){
      for(let j=idx;j<Math.min(lines.length,idx+3);j++){
        const vm=lines[j].match(/\b(\d{8,11})\b/);
        if(vm){result.vkn=vm[1];break;}
      }
    }
  }

  // Vergilendirme dönemi iki tahakkuk formatında da farklı dizilebilir:
  // eski: "Vergilendirme Dönemi" başlığının altında 10/2025-10/2025
  // yeni: "VERGİLENDİRME 2026/07 - 2026/07 DÖNEMİ"
  // Bu nedenle etikete bitişik olmasını şart koşmadan dönem çiftini arıyoruz.
  m = flat.match(/\b(0?[1-9]|1[0-2])\s*[\/.]\s*(20\d{2})\s*[-–]\s*\1\s*[\/.]\s*20\d{2}\b/);
  if(m){
    result.donem = `${String(m[1]).padStart(2,'0')}.${m[2]}`;
  }
  if(!result.donem){
    m = flat.match(/\b(20\d{2})\s*[\/.]\s*(0?[1-9]|1[0-2])\s*[-–]\s*20\d{2}\s*[\/.]\s*\2\b/);
    if(m) result.donem = `${String(m[2]).padStart(2,'0')}.${m[1]}`;
  }
  if(!result.donem){
    // Etiket satırları PDF.js tarafından bölünürse yalnızca vergilendirme
    // dönemi bölümünün yakınındaki ilk geçerli ay/yıl çiftini kullan.
    const di=lines.findIndex(l=>/VERGİLENDİRME\s+DÖNEMİ|Vergilendirme\s+Dönemi/i.test(l));
    if(di>=0){
      for(let j=di;j<Math.min(lines.length,di+5);j++){
        let dm=lines[j].match(/\b(0?[1-9]|1[0-2])\s*[\/.]\s*(20\d{2})\s*[-–]\s*\1\b/);
        if(dm){ result.donem=`${String(dm[1]).padStart(2,'0')}.${dm[2]}`; break; }
        dm=lines[j].match(/\b(20\d{2})\s*[\/.]\s*(0?[1-9]|1[0-2])\s*[-–]\s*20\d{2}\s*[\/.]\s*\2\b/);
        if(dm){ result.donem=`${String(dm[2]).padStart(2,'0')}.${dm[1]}`; break; }
      }
    }
  }

  // Ünvan/isim bilgi amaçlıdır; tabloya yalnızca tahakkuk numarası aktarılır.
  m = flat.match(/SOYADI\s*\(UNVANI\)\s+(.+?)\s+(?:ANA\s+VERGİ\s+KODU|ADRES|MAKİNA\s+NO)/i);
  if(m) result.unvan = m[1].trim();
  if(!result.unvan){
    const si=lines.findIndex(l=>/SOYADI\s*\(UNVANI\)/i.test(l));
    if(si>=0) result.unvan=lines[si].replace(/^.*?SOYADI\s*\(UNVANI\)\s*/i,'').trim();
  }

  Object.keys(result).forEach(k=>result[k]=String(result[k]||'').replace(/\s+/g,' ').trim());
  return result;
}

function normalizeMuhtasarText(text) {
  return String(text || '').replace(/\r/g, '');
}

function parseMuhtasarPdfDetailed(text) {
  const raw = normalizeMuhtasarText(text);
  const T = raw.replace(/[ \t]+/g, ' ');
  const result = { vkn:'', unvan:'', vergiDairesi:'', donem:'', yil:'', ay:'', rows:[], totalCount:0, gelirMuafToplam:0, sgkMuafToplam:0 };
  const lines = raw.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);

  // VKN
  const v = T.match(/Vergi\s+Kimlik\s+Numarası\s+(\d{8,11})/i);
  if (v) result.vkn = v[1];

  // Mükellef unvanı: PDF'de alan iki ayrı satıra bölünebilir.
  const u1Line = lines.find(x => /Soyadı\s*\(Unvanı\)/i.test(x));
  const u2Line = lines.find(x => /Adı\s*\(Unvanın Devamı\)/i.test(x));
  if (u1Line) result.unvan = u1Line.replace(/^.*?Soyadı\s*\(Unvanı\)\s*/i,'').trim();
  if (u2Line) result.unvan = [result.unvan, u2Line.replace(/^.*?Adı\s*\(Unvanın Devamı\)\s*/i,'').trim()].filter(Boolean).join(' ');
  result.unvan = result.unvan
    .replace(/(^|\s)L\s+ŞİRKETİ(?=\s|$)/gi, '$1LTD.ŞTİ.')
    .replace(/\bLTD\s*\.?\s*ŞTİ\.?/gi, 'LTD.ŞTİ.')
    .replace(/\s+/g,' ').trim();

  // Vergi dairesi: Muhtasar PDF'sinde bu alan PDF.js tarafından farklı
  // satırlara bölünebilir. Örneğin kaynakta "KARAMAN DÖNEM TİPİ ..." ile
  // "Vergi Dairesi Müdürlüğü" ayrı metin öğeleri olarak gelebilir.
  // Bu uygulamada tabloya yalnızca vergi dairesi adı yeterlidir; bu nedenle
  // hedef değer özellikle "KARAMAN" gibi DÖNEM TİPİ öncesindeki ada indirgenir.
  // Vergi dairesi: gerçek PDF metninde ilk satır açıkça
  // "KARAMAN DÖNEM TİPİ Yıl 2026" şeklindedir. PDF.js bunu bazen tek satır,
  // bazen de ayrı metin parçaları halinde verir. Bu yüzden önce DÖNEM TİPİ
  // ifadesinin hemen önündeki metni doğrudan alıyoruz. Sonuç yalnızca adıdır:
  // örn. "KARAMAN"; "Vergi Dairesi Müdürlüğü" eklenmez.
  const vdDirect = T.match(/(?:^|\s)([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .'-]{1,60}?)\s+DÖNEM\s*TİPİ\b/i);
  if (vdDirect) {
    const name = vdDirect[1].replace(/\s+/g,' ').trim();
    if (name && !/^(MUHTASAR|VE|PRİM|HİZMET|BEYANNAME)$/i.test(name)) result.vergiDairesi = name;
  }

  // PDF.js başlık parçalarını ayırmışsa, "Vergi Dairesi Müdürlüğü" metninin
  // hemen öncesindeki satırı/öğeyi ara. Özellikle kaynak PDF'deki
  // "KARAMAN" parçasını yakalamayı hedefler.
  if (!result.vergiDairesi) {
    for (let i=0; i<lines.length; i++) {
      if (!/Vergi\s+Dairesi\s+Müdürlüğü/i.test(lines[i])) continue;
      for (let j=Math.max(0,i-5); j<i; j++) {
        const x = lines[j].replace(/DÖNEM\s*TİPİ.*$/i,'').trim();
        const mvd = x.match(/^([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9.\- ]{1,40})$/);
        if (mvd && !/VERGİ|DAİRESİ|MÜDÜRLÜĞÜ|YIL|AY|DÖNEM|TİPİ|MUHTASAR|PRİM|HİZMET|BEYANNAME/i.test(mvd[1])) {
          result.vergiDairesi = mvd[1].replace(/\s+/g,' ').trim();
          break;
        }
      }
      if (result.vergiDairesi) break;
    }
  }

  // Son güvenlik ağı: ham metinde "KARAMAN DÖNEM TİPİ" gibi ayrışmamış
  // başlığı ara. Bu örnekte beklenen sonuç tam olarak KARAMAN'dır.
  if (!result.vergiDairesi) {
    const vdLoose = T.match(/\b([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .'-]{1,40})\s+DÖNEM\s*TİPİ/i);
    if (vdLoose) result.vergiDairesi = vdLoose[1].replace(/\s+/g,' ').trim();
  }

  // Dönem: öncelik Yıl + Ay alanları; HESAP DÖNEMİ gibi başka tarihler kullanılmaz.
  const y = T.match(/\bYıl\s+(20\d{2})\b/i);
  if (y) result.yil = y[1];
  const ayMap = {ocak:'01',şubat:'02',mart:'03',nisan:'04',mayıs:'05',haziran:'06',temmuz:'07',ağustos:'08',eylül:'09',ekim:'10',kasım:'11',aralık:'12'};
  const am = T.match(/\bAy\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\b/i);
  if (am) result.ay = ayMap[am[1].toLocaleLowerCase('tr-TR')] || '';
  if ((!result.ay || !result.yil)) {
    const nm = T.match(/\b(0?[1-9]|1[0-2])\s*[\/.\-]\s*(20\d{2})\b/);
    if (nm) { result.ay = String(nm[1]).padStart(2,'0'); result.yil = nm[2]; }
  }
  if (result.ay && result.yil) result.donem = `${result.ay}.${result.yil}`;

  // Vergi Bildirimi çalışan satırları.
  // ÖNEMLİ: Muhtasar PDF'nin bu örneğinde PDF.js metin öğeleri görsel satıra
  // göre değil, küçük Y farklarıyla dönebiliyor. Örneğin:
  //   "1. Ay - Asgari"
  //   "Ücretli"
  //   "9 0 0 137.239,65 ..."
  // veya "1. Ay - Asgari 9 0 0" + "Ücretli" şeklinde gelebiliyor.
  // Bu nedenle yalnızca tek satırlık regex yerine etiket satırının çevresindeki
  // birkaç metin satırını birlikte değerlendiriyoruz.
  const workerPrefix = /^(\d+)\.?\s*Ay\s*-\s*(Asgari|Diğer)\b/i;
  const seenWorker = new Set();

  const pushWorker = (labelRaw, nums) => {
    if (!nums || nums.length < 3) return;
    const labelBase = labelRaw.replace(/\s+/g,' ').trim();
    const label = /\bÜcretli$/i.test(labelBase) ? labelBase : `${labelBase} Ücretli`;
    const key = `${label}|${nums[0]}|${nums[1]}|${nums[2]}`;
    if (seenWorker.has(key)) return;
    seenWorker.add(key);
    result.rows.push({
      calisanBilgisi: label,
      toplamCalisanSayisi: Number(nums[0]),
      gelirMuafIstisnaSayisi: Number(nums[1]),
      sgkMuafIstisnaSayisi: Number(nums[2])
    });
  };

  for (let i=0; i<lines.length; i++) {
    const line = lines[i];
    const m = line.match(workerPrefix);
    if (!m) continue;

    // Etiket + takip eden 3 satırı birleştir. Böylece "Ücretli" ve sayılar
    // ayrı PDF.js satırlarında olsa bile ilk üç çalışan sayısı alınır.
    const windowLines = [line];
    for (let j=1; j<=3 && i+j<lines.length; j++) windowLines.push(lines[i+j]);
    const windowText = windowLines.join(' ');

    // Önce etiketin kendisinden sonraki bölümdeki ilk üç tam sayıyı ara.
    const afterLabel = windowText.slice(m[0].length);
    const nums = [];
    const reNum = /(?:^|\s)(\d{1,5})(?=\s|$)/g;
    let nm;
    while ((nm = reNum.exec(afterLabel)) !== null && nums.length < 3) {
      nums.push(nm[1]);
    }
    pushWorker(m[0].replace(/\s+/g,' ').trim(), nums);
  }

  // Son çare: bazı PDF çıkarımlarında "Ücretli" etiketi ile sayılar daha
  // uzakta olabilir. Düzleştirilmiş metin üzerinde de yalnızca çalışan
  // etiketinden sonraki kısa pencerede ilk üç sayıyı ara.
  if (!result.rows.length) {
    const flat = raw.replace(/\s+/g, ' ').trim();
    const reWorker = /(\d+\.?\s*Ay\s*-\s*(?:Asgari|Diğer))(?:\s+Ücretli)?\s+([0-9]{1,5})\s+([0-9]{1,5})\s+([0-9]{1,5})\b/gi;
    let wm;
    while ((wm = reWorker.exec(flat)) !== null) {
      pushWorker(wm[1].replace(/\s+/g,' ').trim(), [wm[2],wm[3],wm[4]]);
    }
  }

  result.totalCount = result.rows.reduce((a,r)=>a+r.toplamCalisanSayisi,0);
  result.gelirMuafToplam = result.rows.reduce((a,r)=>a+r.gelirMuafIstisnaSayisi,0);
  result.sgkMuafToplam = result.rows.reduce((a,r)=>a+r.sgkMuafIstisnaSayisi,0);
  return result;
}

function parseMuhtasarPdf(text) {
  const d = parseMuhtasarPdfDetailed(text);
  return { sayi: d.totalCount ? String(d.totalCount) : '', vergiDairesi: d.vergiDairesi, donem: d.donem };
}

