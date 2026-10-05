/* YMM Cevap Yazısı — arşivden düzenlenebilir cevap metni ve DOCX üretimi. */
function ymmCevapXmlEscape(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function ymmCevapDocParagraph(text,bold=false,align='left'){const a=align==='center'?'<w:jc w:val="center"/>':align==='right'?'<w:jc w:val="right"/>':'';return '<w:p>'+a+'<w:r><w:rPr>'+ (bold?'<w:b/>':'') +'</w:rPr><w:t xml:space="preserve">'+ymmCevapXmlEscape(text).replace(/\r?\n/g,'</w:t></w:r></w:p><w:p><w:r><w:t>')+'</w:t></w:r></w:p>';}
function ymmCevapCrc32(data){let crc=0xffffffff;for(let i=0;i<data.length;i++){crc^=data[i];for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function ymmCevapU16(n){return new Uint8Array([n&255,n>>>8&255]);} function ymmCevapU32(n){return new Uint8Array([n&255,n>>>8&255,n>>>16&255,n>>>24&255]);}
function ymmCevapCat(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;parts.forEach(p=>{out.set(p,o);o+=p.length;});return out;}
function ymmCevapZip(files){const enc=new TextEncoder(),local=[],central=[];let offset=0;files.forEach(f=>{const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=ymmCevapCrc32(data);const h=ymmCevapCat([new Uint8Array([80,75,3,4]),ymmCevapU16(20),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU32(crc),ymmCevapU32(data.length),ymmCevapU32(data.length),ymmCevapU16(name.length),ymmCevapU16(0),name]);local.push(h,data);central.push(ymmCevapCat([new Uint8Array([80,75,1,2]),ymmCevapU16(20),ymmCevapU16(20),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU32(crc),ymmCevapU32(data.length),ymmCevapU32(data.length),ymmCevapU16(name.length),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU32(0),ymmCevapU32(offset),name]));offset+=h.length+data.length;});const body=ymmCevapCat(local),cen=ymmCevapCat(central);return new Blob([body,cen,ymmCevapCat([new Uint8Array([80,75,5,6]),ymmCevapU16(0),ymmCevapU16(0),ymmCevapU16(files.length),ymmCevapU16(files.length),ymmCevapU32(cen.length),ymmCevapU32(body.length),ymmCevapU16(0)])],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
function ymmCevapDocTable(headers,rows){
  const all=[headers,...rows];return '<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>'+all.map((row,ri)=>'<w:tr>'+row.map(v=>'<w:tc><w:p><w:r>'+(ri===0?'<w:rPr><w:b/></w:rPr>':'')+'<w:t xml:space="preserve">'+ymmCevapXmlEscape(v)+'</w:t></w:r></w:p></w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>';
}
function ymmCevapBuildDocx(d){
  const ct='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const rel='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const dr='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const st='<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr></w:style></w:styles>';
  const p=d.archive||{},m=p.mukellef||{},lines=[];
  lines.push(ymmCevapDocParagraph(d.baslik||'YMM CEVAP YAZISI',true,'center'),ymmCevapDocParagraph(''));
  if(d.sayi)lines.push(ymmCevapDocParagraph('Sayı: '+d.sayi));if(d.tarih)lines.push(ymmCevapDocParagraph('Tarih: '+d.tarih));
  if(d.aliciYmm?.adSoyad)lines.push(ymmCevapDocParagraph('Sayın; '+d.aliciYmm.adSoyad,true));
  if(d.aliciYmm?.adres)lines.push(ymmCevapDocParagraph('Adres: '+d.aliciYmm.adres));
  lines.push(ymmCevapDocParagraph(''));
  if(d.konu)lines.push(ymmCevapDocParagraph('İlgi / Konu: '+d.konu,true),ymmCevapDocParagraph(''));
  lines.push(ymmCevapDocParagraph('A. BİLGİ VEREN YEMİNLİ MALİ MÜŞAVİRİN',true));
  lines.push(ymmCevapDocTable(['Alan','Bilgi'],[
    ['Adı Soyadı',d.bilgiVerenYmm?.adSoyad||''],['Bağlı Olduğu Oda',d.bilgiVerenYmm?.oda||''],['Sicil ve Mühür No',d.bilgiVerenYmm?.sicil||''],['Vergi Dairesi ve VKN/T.C. No',d.bilgiVerenYmm?.vergiDairesi||''],['Adres',d.bilgiVerenYmm?.adres||''],['Telefon / Faks',d.bilgiVerenYmm?.telefon||'']
  ]));
  lines.push(ymmCevapDocParagraph('B. HAKKINDA BİLGİ VERİLEN FİRMA',true));
  lines.push(ymmCevapDocTable(['Alan','Bilgi'],[
    ['Unvanı',m.unvan||d.hedefFirma?.unvan||''],['Vergi Dairesi ve VKN/T.C. No',((m.vergiDairesi||d.hedefFirma?.vergiDairesi||'')+' / '+(m.vkn||d.hedefFirma?.vkn||''))],['Adres',m.adres||d.hedefFirma?.adres||''],['Telefon / Faks',m.telefon||d.hedefFirma?.telefon||''],['Bağlı Olduğu Oda',d.hedefFirma?.oda||''],['Oda Sicil No',d.hedefFirma?.sicil||'']
  ]));
  lines.push(ymmCevapDocParagraph('C. KDV İADE / TASDİK SÖZLEŞMESİ',true));
  lines.push(ymmCevapDocTable(['Bilgi','Değer'],[['Sözleşme / İlgi',d.sayi||''],['Tarih',d.tarih||'']]));
  lines.push(ymmCevapDocParagraph('D. YASAL DEFTERLERİN ONAYINA İLİŞKİN BİLGİLER',true));
  lines.push(ymmCevapDocTable(['Defterin Cinsi','Başlangıç','Bitiş'],(p.defterler||[]).map(x=>[x.nevi||'',x.baslangic||'',x.bitis||''])));
  lines.push(ymmCevapDocParagraph('E. FATURA VE YEVMİYE KAYIT BİLGİLERİ',true));
  lines.push(ymmCevapDocTable(['Fatura Tarihi','Fatura No','Matrah','KDV','Yevmiye'],(p.faturalar||[]).map(x=>[x.tarih||'',x.no||'',x.matrah||x.tutar||'',x.kdv||'',x.yevmiye||x.yevmiyeNo||'']).slice(0,200)));
  lines.push(ymmCevapDocParagraph('F. FATURALARIN DÜZENLENDİĞİ DÖNEMLERE İLİŞKİN KDV BEYANNAME BİLGİLERİ',true));
  lines.push(ymmCevapDocTable(['Dönem','Teslim/Hizmet','KDV Matrahı','Hesaplanan KDV','İndirilecek KDV','Ödenecek KDV','İade KDV'],(p.kdvBeyanlari||[]).map(x=>[x.donem||'',x.teslimHizmet||x.teslim||'',x.matrah||x.kdvMatrah||'',x.hesaplananKdv||x.hesaplanan||'',x.indirilecekKdv||x.indirilecek||'',x.odenecekKdv||x.odenecek||'',x.iadeKdv||x.iade||''])));
  lines.push(ymmCevapDocParagraph('G. TEDARİKÇİ FİRMALAR',true));
  lines.push(ymmCevapDocTable(['Firma','VKN','Fatura Tarih/No','KDV Dahil Tutar'],(p.tedarikciler||[]).map(x=>[x.adSoyad||'',x.vkn||'',(x.faturaTarihi||'')+' / '+(x.faturaSeri||'')+' '+(x.faturaNo||''),x.kdvDahilTutar||'']).slice(0,200)));
  lines.push(ymmCevapDocParagraph('H. ÇALIŞAN SAYILARI',true));
  lines.push(ymmCevapDocTable(['Dönem','İşçi Sayısı'],(p.isciler||[]).map(x=>[x.donem||'',x.sayi||x.isciSayisi||x.adet||''])));
  lines.push(ymmCevapDocParagraph(''),ymmCevapDocParagraph('AÇIKLAMA / CEVAP',true));
  String(d.metin||'').split(/\r?\n/).forEach(x=>lines.push(ymmCevapDocParagraph(x)));
  lines.push(ymmCevapDocParagraph(''),ymmCevapDocParagraph('Saygılarımızla,'),ymmCevapDocParagraph(d.bilgiVerenYmm?.adSoyad||'',true),ymmCevapDocParagraph('Yeminli Mali Müşavir',true));
  const doc='<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+lines.join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1000" w:bottom="1200" w:left="1000"/></w:sectPr></w:body></w:document>';
  return ymmCevapZip([{name:'[Content_Types].xml',data:ct},{name:'_rels/.rels',data:rel},{name:'word/document.xml',data:doc},{name:'word/_rels/document.xml.rels',data:dr},{name:'word/styles.xml',data:st}]);
}
function ymmCevapCount(p,k){return Array.isArray(p?.[k])?p[k].length:0;}
function ymmCevapDefaultText(p){const m=p?.mukellef||{};return 'İlgi yazınız kapsamında talep edilen bilgi ve belgeler, karşıt inceleme çalışmaları kapsamında incelenen firma arşiv kayıtları esas alınarak değerlendirilmiştir.\n\nİncelemeye konu mükellef '+(m.unvan||'ilgili mükellef')+' olup, Vergi/T.C. Kimlik Numarası '+(m.vkn||'—')+'’dir. Mevcut firma arşivinde '+ymmCevapCount(p,'faturalar')+' karşıt inceleme faturası, '+ymmCevapCount(p,'defterler')+' defter kaydı ve '+ymmCevapCount(p,'kdvBeyanlari')+' KDV beyan kaydı bulunmaktadır.\n\nArşivde yer alan bilgi ve belgeler çerçevesinde gerekli açıklamalar aşağıda sunulmuş olup, ilgili kayıtların asılları ve/veya dayanak belgeleri gerektiğinde ibraz edilebilecektir.\n\nBilgilerinize arz ederim.';}
async function renderYmmAyarlarPage(){
  await renderYmmCevapPage();
  currentPage='ymm-ayarlar';
  renderNav();
}
async function renderYmmCevapPage(){
  currentPage='ymm-cevap'; currentStep=-1;
  const c=document.getElementById('step-content'); c.innerHTML='';
  c.appendChild(el('h2',{class:'step-title'},'YMM Cevap Yazısı'));
  c.appendChild(el('p',{class:'step-desc'},'Firma arşivindeki kayıtları ve YMM/Firma Rehberlerini kullanarak modern, düzenlenebilir bir cevap yazısı hazırlayın.'));
  const p=state.existingArchiveParsed;
  if(!p){const box=el('div',{class:'card'});box.appendChild(el('h3',{},'📂 Firma Arşivi Gerekli'));box.appendChild(el('div',{class:'hint warn'},'Cevap yazısının otomatik hazırlanabilmesi için önce Firma Arşiv İşlemleri → Firma Arşiv Dosyası Yükle / Oluştur bölümünden arşivi yükleyin.'));box.appendChild(el('button',{class:'btn btn-primary',onclick:()=>renderArchiveUploadPage()},'Firma Arşivine Git'));c.appendChild(box);document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='YMM Cevap Yazısı';renderNav();return;}
  const yr=await ymmGuideRead(YMM_REHBER_FILE,{kayitlar:[]}), fr=await ymmGuideRead(FIRMA_REHBER_FILE,{kayitlar:[]});
  const ymmKayitlari=Array.isArray(yr.kayitlar)?yr.kayitlar:([yr.bilgiVeren,yr.bilgiIstenen].filter(x=>x&&Object.keys(x).length));
  const firmaKayitlari=Array.isArray(fr.kayitlar)?fr.kayitlar:([fr.kendiFirmam,fr.cevapFirmasi].filter(x=>x&&Object.keys(x).length));
  const pref=userStore.info?.tercihler||{};
  const ymmPick=(v, fallback)=>Number.isInteger(Number(v))&&ymmKayitlari[Number(v)]?ymmKayitlari[Number(v)]:fallback;
  const yi=ymmPick(pref.bilgiIstenenYmm,ymmKayitlari[1]||ymmKayitlari[0]||{});
  const yv=ymmPick(pref.bilgiVerenYmm,ymmKayitlari[0]||{});
  const firmaPref=String(pref.bilgiVerilenFirma||'');
  const hedef=firmaKayitlari.find(x=>(userVkn(x.vkn)||x.unvan)===firmaPref)||firmaKayitlari[1]||firmaKayitlari[0]||{};
  const kendi=firmaKayitlari[0]||{};
  const m=p.mukellef||{};
  const quickCard=el('div',{class:'card',style:'margin-bottom:14px;'});
  quickCard.appendChild(el('h3',{},'⚡ Hızlı YMM / Firma Seçimi'));
  quickCard.appendChild(el('p',{class:'step-desc',style:'margin-bottom:12px;'},'Cevap yazılarında kullanılacak bilgi veren YMM, bilgi isteyen YMM ve bilgi verilen firma arşivini buradan seçin.'));
  const quickFields=[
    ['bilgiVerenYmm','Bilgi Veren YMM'],
    ['bilgiIstenenYmm','Bilgi İsteyen YMM'],
    ['bilgiVerilenFirma','Bilgi Verilen Firma (Arşiv)']
  ];
  const quickSelects={};
  const yrQuick=await ymmGuideRead(YMM_REHBER_FILE,{kayitlar:[]});
  const frQuick=await ymmGuideRead(FIRMA_REHBER_FILE,{kayitlar:[]});
  const ymmQuick=ymmGuideNormalizeYmm(yrQuick);
  const firmaQuick=[...(userStore.firms||[])];
  ymmGuideNormalizeFirma(frQuick).forEach(x=>{
    const key=userVkn(x.vkn)||x.unvan;
    if(key&&!firmaQuick.some(f=>(userVkn(f.vkn)||f.unvan)===key))firmaQuick.push({...x,recordCount:0,files:[]});
  });
  const addQuick=(key,label,items,textFn,valueFn)=>{
    const row=el('div',{style:'display:grid;grid-template-columns:240px 1fr;gap:10px;align-items:center;margin:9px 0;'});
    row.appendChild(el('label',{},label));
    const sel=el('select',{class:'input'});
    sel.appendChild(el('option',{value:''},'Seçiniz'));
    items.forEach((x,i)=>sel.appendChild(el('option',{value:valueFn(x,i)},textFn(x))));
    sel.value=String(pref[key]||''); quickSelects[key]=sel; row.appendChild(sel); quickCard.appendChild(row);
  };
  addQuick('bilgiVerenYmm','Bilgi Veren YMM',ymmQuick,x=>x.adSoyad||'İsimsiz YMM',(x,i)=>String(i));
  addQuick('bilgiIstenenYmm','Bilgi İsteyen YMM',ymmQuick,x=>x.adSoyad||'İsimsiz YMM',(x,i)=>String(i));
  addQuick('bilgiVerilenFirma','Bilgi Verilen Firma (Arşiv)',firmaQuick,x=>(x.unvan||'İsimsiz Firma')+' — '+(x.vkn||'VKN yok'),x=>userVkn(x.vkn)||x.unvan);
  const saveQuick=el('button',{class:'btn btn-primary',style:'margin-top:10px;',onclick:async()=>{
    try{
      const current=userStore.info||userCurrentInfo();
      current.tercihler={
        bilgiVerenYmm:quickSelects.bilgiVerenYmm.value,
        bilgiIstenenYmm:quickSelects.bilgiIstenenYmm.value,
        bilgiVerilenFirma:quickSelects.bilgiVerilenFirma.value
      };
      await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',current);
      await userScanCurrentFolder();
      alert('Hızlı seçimler kaydedildi.');
    }catch(e){alert('Hızlı seçimler kaydedilemedi: '+e.message);}
  }},'✓ Hızlı Seçimleri Kaydet');
  quickCard.appendChild(saveQuick); c.appendChild(quickCard);

  const card=el('div',{class:'card'});card.appendChild(el('h3',{},'📊 Arşiv ve Rehber Özeti'));
  card.appendChild(el('div',{class:'hint ok'},'✓ '+(m.unvan||hedef.unvan||'—')+' | VKN/T.C.: '+(m.vkn||hedef.vkn||'—')+' | Fatura: '+ymmCevapCount(p,'faturalar')+' | Defter: '+ymmCevapCount(p,'defterler')+' | KDV: '+ymmCevapCount(p,'kdvBeyanlari')+' | Tedarikçi: '+ymmCevapCount(p,'tedarikciler')+' | Çalışan dönemleri: '+ymmCevapCount(p,'isciler')));
  if(ymmKayitlari.length<2)card.appendChild(el('div',{class:'hint warn',style:'margin-top:10px;'},'YMM Rehberinde bilgi veren ve bilgi isteyen YMM bilgilerini tamamlamanız önerilir.'));
  if(firmaKayitlari.length<2)card.appendChild(el('div',{class:'hint warn',style:'margin-top:10px;'},'Firma Rehberinde cevap yazılacak firma bilgileri bulunmuyor; arşiv bilgileri otomatik kullanılacaktır.'));
  c.appendChild(card);
  const form=el('div',{class:'card',style:'margin-top:14px;'});form.appendChild(el('h3',{},'✍ Yazı Bilgileri'));const inputs={};
  [['baslik','Başlık','YMM CEVAP YAZISI'],['sayi','Sayı','YMM- /20'],['tarih','Tarih',new Date().toLocaleDateString('tr-TR')],['makam','Bilgi İsteyen YMM',yi.adSoyad||''+''],['konu','İlgi / Konu','Bilgi İsteme Yazınıza cevap']].forEach(a=>{const row=el('div',{class:'field',style:'margin-top:10px;'});row.appendChild(el('label',{},a[1]));const i=el('input',{class:'input',value:a[2]||''});inputs[a[0]]=i;row.appendChild(i);form.appendChild(row);});
  const intro='İlgi yazınız kapsamında talep edilen bilgi ve belgeler, karşıt inceleme çalışmaları kapsamında incelenen firma arşiv kayıtları esas alınarak değerlendirilmiştir.';
  const meta='Hakkında bilgi verilen firma: '+(m.unvan||hedef.unvan||'—')+' | Vergi/T.C. Kimlik No: '+(m.vkn||hedef.vkn||'—')+' | Vergi Dairesi: '+(m.vergiDairesi||hedef.vergiDairesi||'—');
  const metin=ymmCevapDefaultText(p).replace(/^İlgi yazınız[^\n]*/i,intro+'\n\n'+meta);
  const mf=el('div',{class:'field',style:'margin-top:14px;'});mf.appendChild(el('label',{},'Cevap Metni'));const ta=el('textarea',{class:'input',style:'min-height:360px;line-height:1.7;resize:vertical;'},metin);inputs.metin=ta;mf.appendChild(ta);form.appendChild(mf);
  form.appendChild(el('div',{class:'hint info',style:'margin-top:12px;'},'İmza: '+(yv.adSoyad||'—')+' — '+(yv.oda||'')+' — Sicil/Mühür: '+(yv.sicil||'—')));
  const actions=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;'});const status=el('div',{style:'margin-top:12px;'});actions.appendChild(el('button',{class:'btn btn-primary',onclick:async()=>{const d={};Object.keys(inputs).forEach(k=>d[k]=inputs[k].value);d.ymmAdSoyad=yv.adSoyad||'';d.ymmVkn=yv.vergiDairesi||'';d.ymmTelefon=yv.telefon||'';d.ymmUnvan=yv.oda||'Yeminli Mali Müşavir';d.aliciYmm=yi;d.bilgiVerenYmm=yv;d.kendiFirma=kendi;d.hedefFirma=hedef;try{const blob=ymmCevapBuildDocx(d),filename='YMM_Cevap_Yazisi_'+userFileSafeName(m.unvan||m.vkn||'Firma')+'.docx';downloadBlob(blob,filename);if(userStore?.directoryHandle){const h=await userStore.directoryHandle.getFileHandle(filename,{create:true});const w=await h.createWritable();await w.write(blob);await w.close();status.innerHTML='';status.appendChild(el('div',{class:'hint ok'},'✓ Word belgesi oluşturuldu ve kullanıcı klasörüne kaydedildi: '+filename));}else{status.innerHTML='';status.appendChild(el('div',{class:'hint ok'},'✓ Word belgesi oluşturuldu: '+filename));}}catch(e){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ Word belgesi oluşturulamadı: '+e.message));}}},'⬇ Word Belgesi Oluştur (.docx)'));
  actions.appendChild(el('button',{class:'btn btn-secondary',onclick:()=>renderYmmRehberPage()},'YMM Rehberini Düzenle'));actions.appendChild(el('button',{class:'btn btn-secondary',onclick:()=>renderFirmaRehberPage()},'Firma Rehberini Düzenle'));form.appendChild(actions);form.appendChild(status);c.appendChild(form);
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='YMM Cevap Yazısı';renderNav();
}
