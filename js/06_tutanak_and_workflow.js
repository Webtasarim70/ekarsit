/* ------------------------- e-Berat özel okuyucu ------------------------- */
function xmlLocalName(node) { return (node && node.localName) || (node && node.nodeName ? node.nodeName.split(':').pop() : ''); }
function xmlFirst(root, names) {
  const wanted = new Set(names.map(x => x.toLowerCase()));
  const all = root.getElementsByTagName('*');
  for (let i=0;i<all.length;i++) if (wanted.has(xmlLocalName(all[i]).toLowerCase())) return all[i].textContent.trim();
  return '';
}
function xmlAll(root, name) {
  const out=[]; const all=root.getElementsByTagName('*'); const wanted=name.toLowerCase();
  for(let i=0;i<all.length;i++) if(xmlLocalName(all[i]).toLowerCase()===wanted) out.push(all[i].textContent.trim());
  return out;
}
function isoToTrDate(v){ const m=(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : (v||''); }
function isoRangeToTr(start,end){ return start&&end ? `${isoToTrDate(start)} - ${isoToTrDate(end)}` : ''; }
function donemFromIso(v){ const m=(v||'').match(/^(\d{4})-(\d{2})-/); return m ? `${m[2]}.${m[1]}` : ''; }
function normalizeCompare(v){ return String(v||'').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,'').replace(/İ/g,'I'); }
function eberatDocType(raw){
  const x=String(raw||'').toLocaleLowerCase('tr-TR').trim();
  if(x.includes('journal') || x.includes('yevmiye')) return 'Yevmiye Defteri';
  if(x.includes('ledger') || x.includes('general') || x.includes('kebir') || x.includes('büyük defter')) return 'Büyük Defter';
  return '';
}
function eberatDefterNevi(docType){
  return docType==='Yevmiye Defteri' ? 'YEVMİYE_DEFTERİ' : (docType==='Büyük Defter' ? 'DEFTERİ_KEBİR' : '');
}
function eberatClean(v){ return String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); }
function eberatDateText(v){
  const x=eberatClean(v).replace(/[.\-]/g,'/');
  const m=x.match(/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/);
  return m ? `${m[1]} / ${m[2]} / ${m[3]}` : '';
}
function eberatNormalizeRecord(r){
  const start=r.baslangicDonemi||'';
  const end=r.bitisDonemi||start;
  let docType=eberatDocType(r.dokumanTipi||'');
  if(!docType){
    const u=String(r.tekilNo||'').toUpperCase();
    if(u.startsWith('YEV')) docType='Yevmiye Defteri';
    else if(u.startsWith('KEB')) docType='Büyük Defter';
  }
  return {
    vkn:eberatClean(r.vkn),
    unvan:eberatClean(r.unvan),
    dokumanTipi:docType,
    donem:eberatClean(r.donem),
    baslangicDonemi:start,
    bitisDonemi:end,
    olusturmaTarihi:eberatClean(r.olusturmaTarihi),
    tekilNo:eberatClean(r.tekilNo),
    ettn:eberatClean(r.ettn),
    aciklama:eberatClean(r.aciklama),
    kaynak:r.kaynak||'',
    kaynakDosya:r.kaynakDosya||''
  };
}
function parseEberatXmlText(text){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('XML biçimi okunamadı.');
  const vkn=xmlFirst(doc,['identifier']);
  // Kurum unvanını özellikle entityInformation > organizationIdentifiers içindeki
  // "Kurum Unvanı" açıklamasıyla eşleştir; muhasebeci/YMM alanlarını alma.
  let unvan='';
  const all=doc.getElementsByTagName('*');
  for(let i=0;i<all.length;i++){
    if(xmlLocalName(all[i]).toLowerCase()!=='organizationidentifier') continue;
    const parent=all[i].parentElement;
    if(parent){
      const kids=Array.from(parent.children||[]);
      const desc=kids.find(x=>xmlLocalName(x).toLowerCase()==='organizationdescription');
      if(desc && /kurum\s*unvan/i.test(desc.textContent||'')){ unvan=all[i].textContent.trim(); break; }
    }
  }
  if(!unvan) unvan=xmlFirst(doc,['organizationIdentifier']);
  const rawType=xmlFirst(doc,['entriesType']);
  const start=xmlFirst(doc,['periodCoveredStart']);
  const end=xmlFirst(doc,['periodCoveredEnd']);
  const creation=xmlFirst(doc,['creationDate']);
  const ids=xmlAll(doc,'uniqueID');
  const uuid=ids.find(x=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(x)) || '';
  const unique=ids.find(x=>/^(YEV|KEB|GIB|DEF)/i.test(x)) || '';
  const docType=eberatDocType(rawType) || (unique.toUpperCase().startsWith('YEV')?'Yevmiye Defteri':unique.toUpperCase().startsWith('KEB')?'Büyük Defter':'');
  const aciklama=xmlFirst(doc,['entriesComment']);
  return eberatNormalizeRecord({
    vkn, unvan, dokumanTipi:docType,
    donem:isoRangeToTr(start,end),
    baslangicDonemi:donemFromIso(start), bitisDonemi:donemFromIso(end),
    olusturmaTarihi:isoToTrDate(creation), tekilNo:unique,
    ettn:uuid, aciklama, kaynak:'XML', kaynakDosya:''
  });
}
function parseEberatPdfText(text){
  const clean=String(text||'').replace(/\u00a0/g,' ');
  const lines=clean.split(/\r?\n/).map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
  const pick=(re)=>{const m=clean.match(re);return m?m[1].replace(/\s+/g,' ').trim():'';};
  const dateRe=/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/;

  // PDF iki sütunlu olduğundan aynı satırdaki sağ sütun metni sol sütunun
  // değerine karışabilir. Alanları mümkün olduğunca etiketin bulunduğu
  // satırdan, ilgili sağ sütun etiketini keserek okuyoruz.
  let vkn='', unvan='';
  const mi=lines.findIndex(x=>/MÜKELLEF BİLGİLERİ/i.test(x));
  if(mi>=0){
    const section=lines.slice(mi+1, Math.min(lines.length,mi+30));
    const vi=section.findIndex(x=>/\bVKN\s*:/i.test(x));
    if(vi>=0) vkn=(section[vi].match(/\bVKN\s*:\s*([0-9]{10,11})/i)||[])[1]||'';
    const ui=section.findIndex((x,j)=>j>vi && /\bUNVAN\s*:/i.test(x));
    if(ui>=0){
      let first=(section[ui].match(/\bUNVAN\s*:\s*(.*?)(?=\s+(?:UNVAN|TELEFON|FAX|E-POSTA)\s*:|$)/i)||[])[1]||'';
      const parts=[]; if(first) parts.push(first);
      for(let j=ui+1;j<section.length;j++){
        const z=section[j];
        if(/^(TELEFON|FAX|E-POSTA)\s*:/i.test(z) || /^DOKÜMAN BİLGİLERİ/i.test(z) || /^VKN\s*:/i.test(z)) break;
        // Sağ sütundaki sonraki UNVAN alanını mükellef unvanına katma.
        if(/^UNVAN\s*:/i.test(z)) break;
        if(z && !/^(OLUŞTURAN|DÖNEMİ|OLUŞTURMA|TARİHİ)\b/i.test(z)) parts.push(z);
      }
      unvan=parts.join(' ').replace(/\s+/g,' ').trim();
    }
  }
  if(!vkn) vkn=pick(/\bVKN\s*:\s*([0-9]{10,11})/i);
  if(!unvan){
    const um=clean.match(/MÜKELLEF BİLGİLERİ[\s\S]{0,900}?\bUNVAN\s*:\s*(.*?)(?=\s+UNVAN\s*:|\s+(?:TELEFON|FAX|E-POSTA)\s*:|\s+DOKÜMAN BİLGİLERİ|$)/i);
    if(um) unvan=um[1].replace(/\s+/g,' ').trim();
  }

  // Belge türü yalnızca iki standart değer olabilir.
  let rawDoc='';
  const di=lines.findIndex(x=>/^DOKÜMAN\s*TİPİ\s*:/i.test(x));
  if(di>=0) rawDoc=(lines[di].match(/^DOKÜMAN\s*TİPİ\s*:\s*(.*?)(?=\s+OLUŞTURAN\s*:|$)/i)||[])[1]||'';
  if(!rawDoc) rawDoc=pick(/DOKÜMAN\s*TİPİ\s*:\s*(.*?)(?=\s+OLUŞTURAN\s*:|\n|$)/i);
  const tekil=pick(/TEKİL\s*NO\s*:\s*([^\n]+)/i).split(/\s+(?:KAYNAK|OLUŞTURMA|ETTN)\s*:/i)[0].trim();
  const dokumanTipi=eberatDocType(rawDoc) || (String(tekil).toUpperCase().startsWith('YEV')?'Yevmiye Defteri':String(tekil).toUpperCase().startsWith('KEB')?'Büyük Defter':'');

  // DÖNEMİ satırı esas alınır; HESAP DÖNEMİ hiçbir şekilde kullanılmaz.
  let dm=null;
  const periodRe=/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})\s*-\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/;
  const pi=lines.findIndex(x=>/^DÖNEMİ\s*:/i.test(x));
  if(pi>=0) dm=lines[pi].match(periodRe);
  if(!dm) dm=clean.match(/DÖNEMİ\s*:\s*([\s\S]{0,120}?)/i)?.[1]?.match(periodRe)||null;
  const donem=dm ? `${dm[1]} / ${dm[2]} / ${dm[3]} - ${dm[4]} / ${dm[5]} / ${dm[6]}` : '';
  const baslangicDonemi=dm ? `${dm[2]}.${dm[3]}` : '';
  const bitisDonemi=dm ? `${dm[5]}.${dm[6]}` : '';

  // OLUŞTURMA TARİHİ, PDF'de bazen "OLUŞTURMA" ve "TARİHİ" olarak
  // iki ayrı satıra bölünür. Etiketten sonraki birkaç satırda ilk tarihi ara.
  let olusturmaTarihi='';
  const oi=lines.findIndex(x=>/\bOLUŞTURMA\b/i.test(x) && !/OLUŞTURAN/i.test(x));
  if(oi>=0){
    for(let j=oi;j<Math.min(lines.length,oi+5);j++){
      if(/\bHESAP\s*$/i.test(lines[j])) break;
      const m=lines[j].match(dateRe);
      if(m){olusturmaTarihi=eberatDateText(m[0]);break;}
    }
  }
  if(!olusturmaTarihi){
    const om=clean.match(/OLUŞTURMA(?:\s+TARİHİ)?\s*:?\s*(?:\n\s*)?(\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4})/i);
    if(om) olusturmaTarihi=eberatDateText(om[1]);
  }

  const ettn=pick(/ETTN\s*:\s*([0-9a-f]{8}-[0-9a-f-]{27,})/i);

  // Açıklama çok satırlı olabilir. "DEFTER : ... BOYUTU" sağ sütununu
  // açıklamaya katmamak için DEFTER etiketinde kesiyoruz.
  let aciklama='';
  const ai=lines.findIndex(x=>/^AÇIKLAMA\s*:/i.test(x));
  if(ai>=0){
    const first=(lines[ai].match(/^AÇIKLAMA\s*:\s*(.*)$/i)||[])[1]||'';
    const parts=[];
    if(first) parts.push(first.split(/\s+DEFTER\s*:/i)[0].trim());
    for(let j=ai+1;j<Math.min(lines.length,ai+6);j++){
      const z=lines[j];
      if(/^(YEVMİYE|HESAP|VERGİ DETAYI|İLGİLİ|DEFTER|BERAT'A)\b/i.test(z)) break;
      if(/^AÇIKLAMA\s*:/i.test(z)) break;
      if(z) parts.push(z);
    }
    aciklama=parts.join(' ').replace(/\s+/g,' ').trim();
  }
  if(!aciklama){
    const am=clean.match(/AÇIKLAMA\s*:\s*([\s\S]*?)(?=\s+(?:DEFTER\s*:|YEVMİYE\s+MADDESİ|VERGİ DETAYI|BERAT'A\s+KONU)|$)/i);
    if(am) aciklama=am[1].replace(/\s+/g,' ').trim();
  }
  return eberatNormalizeRecord({vkn,unvan,dokumanTipi,donem,baslangicDonemi,bitisDonemi,olusturmaTarihi,tekilNo:tekil,ettn,aciklama,kaynak:'PDF',kaynakDosya:''});
}

function eberatDeadlineInfo(period){
  const p=parseDonem(period); if(!p || !p.ay || !p.yil) return {known:false,expired:null,deadline:''};
  // Aylık yükleme için temel mevzuat kuralı: ilgili ayı takip eden üçüncü ayın son günü.
  // Resmi takvim/sirküler ile süre uzatımı olabileceğinden sonuç ekranda "temel kural" olarak belirtilir.
  const d=new Date(p.yil,p.ay+2,0,23,59,59,999); // takip eden üçüncü ayın son günü
  const today=new Date();
  return {known:true,expired:today>d,deadline:d.toLocaleDateString('tr-TR')};
}
function eberatKontroller(r){
  const issues=[];
  if(state.meta.cVkn && r.vkn && state.meta.cVkn.replace(/\D/g,'')!==r.vkn.replace(/\D/g,'')) issues.push(`VKN farklı: tespit edilen ${state.meta.cVkn}, e-Berat ${r.vkn}.`);
  if(state.meta.cUnvan && r.unvan && normalizeCompare(state.meta.cUnvan)!==normalizeCompare(r.unvan)) issues.push(`Ünvan farklı: tespit edilen "${state.meta.cUnvan}", e-Berat "${r.unvan}".`);
  const currentPeriods=state.donemler||[];
  if(currentPeriods.length && r.baslangicDonemi && !currentPeriods.includes(r.baslangicDonemi)) issues.push(`Dönem farklı: karşıt inceleme dönemleri ${currentPeriods.join(', ')}, e-Berat ${r.baslangicDonemi}.`);
  return issues;
}
function eberatRowFromParsed(r){
  const deadline=eberatDeadlineInfo(r.baslangicDonemi);
  let aciklama=r.aciklama||'';
  const notu='Mükellef e-Defter uygulamasına dahil olup ilgili döneme ilişkin e-Defter ve berat dosyasının oluşturulma ve imzalanması ile aynı sürede Gelir İdaresi Başkanlığı Bilgi İşlem Sistemine yüklenmesi için ilgili mevzuatta belirlenen süre iş bu yazı tarihi itibarıyla dolmadığından, GİB sistemine yüklenmemiştir.”';
  if(deadline.known && !deadline.expired) aciklama=(aciklama?aciklama+' ':'')+notu;
  return {
    nevi:eberatDefterNevi(r.dokumanTipi),
    baslangic:r.baslangicDonemi,
    bitis:r.bitisDonemi,
    tasdikMakami:'GİB',
    tasdikTarihi:r.olusturmaTarihi,
    tasdikNo:r.tekilNo,
    aciklama,
    defterTuruAciklama:'',
    _eberat:r, _deadline:deadline
  };
}
function renderEberatImport(c, rerender){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📘 e-Defter / e-Berat Dosyası Yükle'));
  wrap.appendChild(el('div',{class:'hint info'},'e-Berat XML veya PDF yükleyin. Birden fazla dosyayı aynı anda seçebilirsiniz. Dosya bilgileri önce ayrı ayrı kontrol ekranında gösterilir; yalnızca ilgili belgenin “Eşleşmeyi onayla ve tabloya ekle” butonuyla defter tablosuna aktarılır.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.xml,.pdf',hint:'e-Berat XML veya PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML='';
    state.eberatOnayBekleyenler=[];
    let okCount=0, failCount=0;
    const listHolder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});
    preview.appendChild(listHolder);
    for(const file of files){
      markFileChip(box,file.name,true);
      try{
        const name=file.name.toLowerCase();
        const parsed=name.endsWith('.xml') ? parseEberatXmlText(await file.text()) : parseEberatPdfText(await extractPdfText(file));
        parsed.kaynakDosya=file.name;
        const row=eberatRowFromParsed(parsed);
        const issues=eberatKontroller(parsed);
        const deadline=eberatDeadlineInfo(parsed.baslangicDonemi);
        const box2=el('div',{class:'card',style:'margin-top:4px;'});
        box2.appendChild(el('h4',{},`Kontrol edilen e-Berat bilgileri — ${file.name}`));
        const info=[['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DOKÜMAN TİPİ',parsed.dokumanTipi],['DÖNEMİ',parsed.donem],['OLUŞTURMA TARİHİ',parsed.olusturmaTarihi],['TEKİL NO',parsed.tekilNo],['ETTN',parsed.ettn],['AÇIKLAMA',parsed.aciklama]];
        const t=el('table',{class:'editable-table'});
        info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});
        box2.appendChild(t);
        if(issues.length) box2.appendChild(el('div',{class:'hint warn',style:'margin-top:10px;'},['⚠️ Kontrol uyarıları:',...issues.map(x=>'• '+x)].join('\n')));
        else box2.appendChild(el('div',{class:'hint ok',style:'margin-top:10px;'},'✓ VKN, ünvan ve dönem açısından mevcut karşıt inceleme bilgileriyle eşleşiyor.'));
        if(deadline.known) box2.appendChild(el('div',{class:'hint '+(deadline.expired?'info':'warn'),style:'margin-top:8px;'}, deadline.expired ? `e-Berat yükleme süresi temel mevzuat kuralına göre dolmuş görünüyor (hesaplanan son gün: ${deadline.deadline}).` : `e-Berat yükleme süresi temel mevzuat kuralına göre henüz dolmamış görünüyor (hesaplanan son gün: ${deadline.deadline}).`));
        box2.appendChild(el('div',{class:'hint info',style:'margin-top:10px;'},`Tablo eşleşmesi: Defterin Nev'i ← ${eberatDefterNevi(parsed.dokumanTipi) || '—'} (${parsed.dokumanTipi || '—'}) | Başlangıç/Bitiş ← ${parsed.baslangicDonemi||'—'} | Tasdik Makamı ← GİB | Tasdik Tarihi ← ${parsed.olusturmaTarihi||'—'} | Tasdik No / Berat No ← ${parsed.tekilNo||'—'} | Açıklama ← AÇIKLAMA`));
        const pendingIndex=state.eberatOnayBekleyenler.length;
        state.eberatOnayBekleyenler.push({row,parsed,deadline,approved:false});
        const actions=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;'});
        const approveBtn=el('button',{class:'btn btn-primary',onclick:()=>{
          const item=state.eberatOnayBekleyenler[pendingIndex];
          if(!item || item.approved) return;
          const r={...item.row}; delete r._eberat; delete r._deadline;
          if(!r.nevi||!r.baslangic||!r.bitis||!r.tasdikTarihi||!r.tasdikNo){
            box2.appendChild(el('div',{class:'hint warn'},'⚠️ Tabloya aktarmadan önce e-Berat belge türü, dönem, oluşturma tarihi ve tekil/berat numarası eksiksiz okunmalıdır.'));
            return;
          }
          if(!state.defterler.some(x=>x.nevi===r.nevi&&x.baslangic===r.baslangic&&x.bitis===r.bitis&&x.tasdikNo===r.tasdikNo)) state.defterler.push(r);
          item.approved=true;
          approveBtn.disabled=true;
          approveBtn.textContent='✓ Tabloya eklendi';
          if(rerender) rerender();
          box2.appendChild(el('div',{class:'hint ok'},'✓ e-Berat bilgileri onaylanarak defter tablosuna eklendi.'));
        }},'✓ Eşleşmeyi onayla ve tabloya ekle');
        actions.appendChild(approveBtn);
        actions.appendChild(el('button',{class:'btn btn-ghost',onclick:()=>{
          const item=state.eberatOnayBekleyenler[pendingIndex];
          if(item) item.approved=true;
          box2.remove();
        }},'İptal'));
        box2.appendChild(actions);
        listHolder.appendChild(box2);
        state.eberatOkunan=parsed;
        okCount++;
      }catch(err){
        failCount++;
        listHolder.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));
      }
    }
    const summary=el('div',{class:'hint '+(failCount?'warn':'ok'),style:'margin-bottom:8px;'},`e-Berat toplu işlem: ${okCount} dosya okundu${failCount?`, ${failCount} dosya okunamadı`:''}. Her belge için eşleşmeyi ayrı ayrı onaylayabilirsiniz.`);
    listHolder.insertBefore(summary,listHolder.firstChild);
    state.eberatOnayBekleyen=null;
  }});
  wrap.appendChild(preview); c.appendChild(wrap);
}



function normalizePdfTypeText(text){
  return String(text||'')
    .normalize('NFKC')
    .replace(/\u00a0/g,' ')
    .replace(/[\r\n\t]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLocaleUpperCase('tr-TR');
}

// Belge türünü yalnızca PDF'nin üzerinde yer alan açık başlığa göre belirleriz.
// Tahakkuk önceliklidir: PDF metninde "TAHAKKUK FİŞİ" geçiyorsa belge tahakkuktur.
function isKdvTahakkukPdfText(text){
  const t=normalizePdfTypeText(text);
  return /TAHAKKUK\s+FİŞİ/.test(t) || /TAHAKKUK\s+FISI/.test(t);
}

// KDV beyannamesi yalnızca PDF metninde açıkça "KATMA DEĞER VERGİSİ BEYANNAMESİ"
// ibaresi bulunuyorsa bu tür olarak kabul edilir.
function isKdvBeyannamePdfText(text){
  const t=normalizePdfTypeText(text);
  return /KATMA\s+DEĞER\s+VERGİSİ\s+BEYANNAMESİ/.test(t) ||
         /KATMA\s+DEGER\s+VERGISI\s+BEYANNAMESI/.test(t);
}

function renderKdvImport(container, rerender){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📎 KDV Beyannamesi PDF — Çoklu Dosya Kontrolü'));
  wrap.appendChild(el('div',{class:'hint info'},'Bu alan yalnızca KDV Beyannamesi içindir. Tahakkuk fişlerini aşağıdaki ayrı “KDV Tahakkuk Fişi” alanından yükleyin. Her beyanname ayrı okunur, VKN ve dönem kontrol edilir ve yalnızca onaylanan dosya Karşıt İnceleme Tablolarına aktarılır.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.pdf',hint:'KDV Beyannamesi PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML='';
    const listHolder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});
    preview.appendChild(listHolder);
    let okCount=0, failCount=0;
    for(const file of files){
      markFileChip(box,file.name,true);
      const card=el('div',{class:'card',style:'margin-top:4px;'});
      card.appendChild(el('h4',{},`Kontrol edilen KDV Beyannamesi — ${file.name}`));
      try{
        const text=await extractPdfText(file);
        if(isKdvTahakkukPdfText(text||'')){
          card.appendChild(el('div',{class:'hint warn'},'⚠️ PDF metninde “TAHAKKUK FİŞİ” ibaresi bulundu. Bu belge KDV Beyannamesi değildir; aşağıdaki ayrı “KDV Tahakkuk Fişi” yükleme alanına yükleyin.'));
          listHolder.appendChild(card); failCount++; continue;
        }
        const parsed=parseKdvBeyannamePdf(text||'');
        const issues=[];
        const vknOk=!!state.meta.cVkn && !!parsed.vkn && String(parsed.vkn).replace(/\D/g,'')===String(state.meta.cVkn).replace(/\D/g,'');
        const donemOk=!!parsed.donem && (state.kdvDonemleri||[]).includes(parsed.donem);
        if(!parsed.vkn) issues.push('Vergi kimlik numarası okunamadı');
        else if(!vknOk) issues.push(`VKN farklı: tespit edilen ${parsed.vkn}, karşıt inceleme ${state.meta.cVkn||'—'}`);
        if(!parsed.donem) issues.push('Dönem okunamadı');
        else if(!donemOk) issues.push(`Dönem farklı veya KDV için gereken dönemlerde yok: ${parsed.donem}`);
        const required=[['Teslim ve Hizmet Karşılığını Teşkil Eden Bedel','teslimBedel'],['KDV Matrahı','kdvMatrahi'],['Hesaplanan KDV','hesaplananKdv'],['İlave Edilecek KDV','ilaveKdv'],['Toplam KDV','toplamKdv'],['İndirimler Toplamı','indirimler'],['Ödenmesi Gereken KDV','odenecekKdv'],['Sonraki Döneme Devreden KDV','devredenKdv']];
        const missing=required.filter(([,k])=>!parsed[k]).map(([label])=>label);
        if(missing.length) issues.push('Okunamayan alanlar: '+missing.join(', '));

        const info=[
          ['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DÖNEM',parsed.donem],
          ['TESLİM VE HİZMET BEDELİ (AYLIK)',parsed.teslimBedel],
          ['ÖZEL MATRAH ŞEKLİNE TABİ İŞL. MATR. DAHİL OLM. BEDEL',parsed.ozelMatrah],
          ['KDV MATRAHI',parsed.kdvMatrahi],['HESAPLANAN KDV',parsed.hesaplananKdv],
          ['İLAVE EDİLECEK KDV',parsed.ilaveKdv],['TOPLAM KDV',parsed.toplamKdv],
          ['İNDİRİMLER TOPLAMI',parsed.indirimler],['ÖDENMESİ GEREKEN KDV',parsed.odenecekKdv],
          ['SONRAKİ DÖNEME DEVREDEN KDV',parsed.devredenKdv],['TAHAKKUK FİŞİNİN NUMARASI',parsed.tahakkukNo]
        ];
        const t=el('table',{class:'editable-table'});
        info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});
        card.appendChild(t);
        if(!parsed.ozelMatrah) card.appendChild(el('div',{class:'hint info',style:'margin-top:8px;'},'ℹ️ “Özel Matrah Şekline Tabi İşl. Matr. Dahil Olm. Bedel” bu beyannamenin metninde yer almıyor; alan boş bırakıldı.'));
        if(!parsed.tahakkukNo) card.appendChild(el('div',{class:'hint info',style:'margin-top:8px;'},'ℹ️ “Tahakkuk Fişinin Numarası” bu beyannamenin metninde yer almıyor; alan boş bırakıldı.'));
        card.appendChild(el('div',{class:'hint '+(issues.length?'warn':'ok'),style:'margin-top:10px;'},issues.length?['⚠️ Kontrol uyarıları:',...issues.map(x=>'• '+x)].join('\n'):'✓ VKN, dönem ve gerekli KDV alanları okunarak kontrol edildi.'));

        const rawDet=el('details',{class:'raw-details',style:'margin-top:8px;'});
        rawDet.appendChild(el('summary',{},'Beyanname ham metnini göster'));
        rawDet.appendChild(el('pre',{class:'raw-text'},text||'(okunamadı)'));
        card.appendChild(rawDet);

        const actions=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;'});
        const approveBtn=el('button',{class:'btn btn-primary'},'✓ Onayla ve Karşıt İnceleme Tablolarına ekle');
        approveBtn.disabled=issues.length>0;
        approveBtn.onclick=()=>{
          if(issues.length) return;
          const row={donem:parsed.donem,teslimBedel:parsed.teslimBedel,ozelMatrah:parsed.ozelMatrah,kdvMatrahi:parsed.kdvMatrahi,hesaplananKdv:parsed.hesaplananKdv,ilaveKdv:parsed.ilaveKdv,toplamKdv:parsed.toplamKdv,indirimler:parsed.indirimler,odenecekKdv:parsed.odenecekKdv,devredenKdv:parsed.devredenKdv,tahakkukNo:parsed.tahakkukNo};
          const existing=state.kdvBeyanlari.findIndex(x=>x.donem===parsed.donem);
          const pendingTahakkuk=state.kdvTahakkuklari.find(x=>x.donem===parsed.donem && x.approved);
          if(pendingTahakkuk) row.tahakkukNo=pendingTahakkuk.tahakkukNo;
          if(existing>=0) state.kdvBeyanlari[existing]={...state.kdvBeyanlari[existing],...row};
          else state.kdvBeyanlari.push(row);
          approveBtn.disabled=true; approveBtn.textContent='✓ Tabloya eklendi';
          card.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${parsed.donem} dönemi onaylandı ve Karşıt İnceleme Tablolarına aktarıldı.`));
          if(rerender) rerender();
        };
        actions.appendChild(approveBtn);
        const cancelBtn=el('button',{class:'btn btn-ghost',onclick:()=>card.remove()},'İptal');
        actions.appendChild(cancelBtn);
        card.appendChild(actions);
        listHolder.appendChild(card); okCount++;
      }catch(err){
        failCount++; card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`)); listHolder.appendChild(card);
      }
    }
    listHolder.insertBefore(el('div',{class:'hint '+(failCount?'warn':'ok'),style:'margin-bottom:8px;'},`KDV toplu işlem: ${okCount} dosya işlendi${failCount?`, ${failCount} dosya okunamadı`:''}. Her belge için onay ayrı verilir.`),listHolder.firstChild);
  }});
  wrap.appendChild(preview); container.appendChild(wrap);
}

function renderKdvTahakkukImport(container, rerender){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;margin-top:12px;'});
  wrap.appendChild(el('h3',{},'📎 KDV Tahakkuk Fişi — Çoklu Dosya Kontrolü'));
  wrap.appendChild(el('div',{class:'hint info'},'KDV beyannamesinden sonra yüklenen tahakkuk fişlerini çoklu seçebilirsiniz. Her dosyada VKN ve vergilendirme dönemi kontrol edilir. Onaylanan dosyanın uzun tahakkuk numarası ilgili Karşıt İnceleme Tablolarındaki ilgili döneme aktarılır.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.pdf',hint:'KDV Tahakkuk Fişi PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML='';
    const listHolder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});
    preview.appendChild(listHolder);
    let okCount=0, failCount=0;
    for(const file of files){
      markFileChip(box,file.name,true);
      const card=el('div',{class:'card',style:'margin-top:4px;'});
      card.appendChild(el('h4',{},`Kontrol edilen KDV Tahakkuk Fişi — ${file.name}`));
      try{
        const text=await extractPdfText(file);
        if(isKdvBeyannamePdfText(text||'') && !isKdvTahakkukPdfText(text||'')){
          card.appendChild(el('div',{class:'hint warn'},'⚠️ PDF metninde “KATMA DEĞER VERGİSİ BEYANNAMESİ” ibaresi bulundu. Bu belge KDV Tahakkuk Fişi değildir; yukarıdaki “KDV Beyannamesi PDF” alanına yükleyin.'));
          listHolder.appendChild(card); failCount++; continue;
        }
        const parsed=parseKdvTahakkukPdfText(text||'');
        const issues=[];
        const vknOk=!!state.meta.cVkn && !!parsed.vkn && String(parsed.vkn).replace(/\D/g,'')===String(state.meta.cVkn).replace(/\D/g,'');
        const donemOk=!!parsed.donem && (state.kdvDonemleri||[]).includes(parsed.donem);
        if(!parsed.vkn) issues.push('Vergi kimlik numarası okunamadı');
        else if(!vknOk) issues.push(`VKN farklı: tespit edilen ${parsed.vkn}, karşıt inceleme ${state.meta.cVkn||'—'}`);
        if(!parsed.donem) issues.push('Dönem okunamadı');
        else if(!donemOk) issues.push(`Dönem farklı veya KDV için gereken dönemlerde yok: ${parsed.donem}`);
        if(!parsed.tahakkukNo) issues.push('Tahakkuk fişi numarası okunamadı');

        const info=[['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DÖNEM',parsed.donem],['TAHAKKUK FİŞİNİN NUMARASI',parsed.tahakkukNo]];
        const t=el('table',{class:'editable-table'});
        info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});
        card.appendChild(t);
        card.appendChild(el('div',{class:'hint '+(issues.length?'warn':'ok'),style:'margin-top:10px;'},issues.length?['⚠️ Kontrol uyarıları:',...issues.map(x=>'• '+x)].join('\n'):'✓ VKN, dönem ve tahakkuk numarası okunarak kontrol edildi.'));
        const rawDet=el('details',{class:'raw-details',style:'margin-top:8px;'});
        rawDet.appendChild(el('summary',{},'Tahakkuk fişi ham metnini göster'));
        rawDet.appendChild(el('pre',{class:'raw-text'},text||'(okunamadı)'));
        card.appendChild(rawDet);

        const actions=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;'});
        const approveBtn=el('button',{class:'btn btn-primary'},'✓ Onayla ve Karşıt İnceleme Tablolarına aktar');
        approveBtn.disabled=issues.length>0;
        approveBtn.onclick=()=>{
          if(issues.length) return;
          const rowIndex=state.kdvBeyanlari.findIndex(x=>x.donem===parsed.donem);
          if(rowIndex>=0){
            state.kdvBeyanlari[rowIndex]={...state.kdvBeyanlari[rowIndex],tahakkukNo:parsed.tahakkukNo};
          }else{
            // Tahakkuk fişi beyannameden önce yüklenirse bekleyen kayıt olarak saklanır;
            // ilgili KDV beyannamesi sonradan onaylandığında otomatik uygulanır.
            const pi=state.kdvTahakkuklari.findIndex(x=>x.donem===parsed.donem);
            if(pi>=0) state.kdvTahakkuklari[pi]={...state.kdvTahakkuklari[pi],vkn:parsed.vkn,tahakkukNo:parsed.tahakkukNo};
            else state.kdvTahakkuklari.push({donem:parsed.donem,vkn:parsed.vkn,tahakkukNo:parsed.tahakkukNo});
          }
          const pi=state.kdvTahakkuklari.findIndex(x=>x.donem===parsed.donem);
          if(pi>=0) state.kdvTahakkuklari[pi]={...state.kdvTahakkuklari[pi],vkn:parsed.vkn,tahakkukNo:parsed.tahakkukNo,approved:true};
          approveBtn.disabled=true; approveBtn.textContent='✓ Tahakkuk numarası aktarıldı';
          card.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${parsed.donem} dönemi tahakkuk numarası onaylandı ve Karşıt İnceleme Tablolarına aktarıldı.`));
          if(rerender) rerender();
        };
        actions.appendChild(approveBtn);
        actions.appendChild(el('button',{class:'btn btn-ghost',onclick:()=>card.remove()},'İptal'));
        card.appendChild(actions);
        listHolder.appendChild(card); okCount++;
      }catch(err){
        failCount++; card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`)); listHolder.appendChild(card);
      }
    }
    listHolder.insertBefore(el('div',{class:'hint '+(failCount?'warn':'ok'),style:'margin-bottom:8px;'},`KDV tahakkuk toplu işlem: ${okCount} dosya işlendi${failCount?`, ${failCount} dosya okunamadı`:''}. Her belge için onay ayrı verilir.`),listHolder.firstChild);
  }});
  wrap.appendChild(preview); container.appendChild(wrap);
}

function renderMuhtasarImport(container, rerender) {
  const wrap = el('div', { class:'card', style:'background:#fbfdfd;' });
  wrap.appendChild(el('h3', {}, '📎 Muhtasar Beyanname — Çoklu Dosya Kontrolü'));
  wrap.appendChild(el('div', { class:'hint info' }, 'Birden fazla Muhtasar ve Prim Hizmet Beyannamesi PDF dosyasını aynı anda yükleyebilirsiniz. Her dosyada mükellef VKN ve dönem kontrol edilir. Vergi Bildirimi bölümündeki çalışan satırları aşağıda gösterilir; onaylanan dosyanın toplam çalışan sayısı ilgili döneme aktarılır.'));
  const list = el('div');
  fileUploadBox(wrap, {
    accept:'.pdf,.xlsx,.xlsm,.csv,.tsv,.txt', multiple:true,
    hint:'Muhtasar ve Prim Hizmet Beyannamesi PDF (çoklu seçim desteklenir)',
    onFiles: async (files, box) => {
      const old = box.querySelector('.file-chip-list'); if (old) old.remove();
      files.forEach(f=>markFileChip(box,f.name,true));
      list.innerHTML='';
      let ok=0, fail=0;
      for (const file of files) {
        const card=el('div',{class:'card',style:'margin-top:10px;border-left:4px solid var(--border);'});
        card.appendChild(el('h4',{},`📄 ${file.name}`));
        try {
          const name=file.name.toLowerCase();
          let text='';
          if(name.endsWith('.pdf')) text=await extractPdfText(file);
          else if(name.endsWith('.xlsx')||name.endsWith('.xlsm')||name.endsWith('.csv')||name.endsWith('.tsv')||name.endsWith('.txt')) {
            const r=await readTabularFile(file); text=(r.rows2D||[]).map(a=>a.join(' | ')).join('\\n');
          }
          const d=parseMuhtasarPdfDetailed(text);
          // Muhtasar'da vergi dairesini tekrar PDF'den okumuyoruz.
          // İlk adımda Karşıt İnceleme Tutanağından alınan mükellef vergi
          // dairesi burada doğrudan kullanılır.
          d.vergiDairesi = state.meta.cVergiDairesi || '';
          const vknOk=!!state.meta.cVkn && String(d.vkn).replace(/\\D/g,'')===String(state.meta.cVkn).replace(/\\D/g,'');
          const donemOk=!!d.donem && state.donemler.includes(d.donem);
          const hasRows=d.rows.length>0;
          const issues=[];
          if(!d.vkn) issues.push('Vergi kimlik numarası okunamadı');
          else if(!vknOk) issues.push(`VKN farklı: tespit edilen ${d.vkn}, karşıt inceleme ${state.meta.cVkn||'—'}`);
          if(!d.donem) issues.push('Dönem okunamadı');
          else if(!donemOk) issues.push(`Dönem farklı veya çalışma dönemlerinde yok: ${d.donem}`);
          if(!hasRows) issues.push('Vergi Bildirimi çalışan satırları okunamadı');

          const info=el('table',{class:'editable-table',style:'margin-top:8px;'});
          [['VKN',d.vkn||'—'],['UNVAN',d.unvan||'—'],['DÖNEM',d.donem||'—'],['VERGİ DAİRESİ',d.vergiDairesi||'—']].forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b));info.appendChild(tr);});
          card.appendChild(info);

          const status=el('div',{class:'hint '+(issues.length?'warn':'ok'),style:'margin-top:8px;'}, issues.length ? '⚠️ '+issues.join(' • ') : '✅ Mükellef VKN ve dönem kontrolü uygun. Vergi Bildirimi çalışan satırları bulundu.');
          card.appendChild(status);

          if(d.rows.length){
            card.appendChild(el('h4',{style:'margin-top:12px;'},'Vergi Bildirimi — Çalışan Bilgileri'));
            const t=el('table',{class:'editable-table'}); const hr=el('tr');
            ['Çalışan Bilgisi','Toplam Çalışan Sayısı','Gelir V. Muaf / İstisna Sayısı','SGK Muaf / İstisna Sayısı'].forEach(h=>hr.appendChild(el('th',{},h))); t.appendChild(el('thead',{},hr));
            const tb=el('tbody'); d.rows.forEach(r=>{const tr=el('tr'); [r.calisanBilgisi,r.toplamCalisanSayisi,r.gelirMuafIstisnaSayisi,r.sgkMuafIstisnaSayisi].forEach(v=>tr.appendChild(el('td',{},String(v)))); tb.appendChild(tr);}); t.appendChild(tb); card.appendChild(t);
            const sum=el('div',{class:'hint info',style:'margin-top:8px;'},`Toplam Çalışan: ${d.totalCount} • Gelir V. Muaf/İstisna: ${d.gelirMuafToplam} • SGK Muaf/İstisna: ${d.sgkMuafToplam}`); card.appendChild(sum);
          }

          const btn=el('button',{class:'btn btn-primary',style:'margin-top:10px;'},'✓ Kontrolü Onayla ve Döneme Aktar');
          btn.disabled=issues.length>0;
          btn.onclick=()=>{
            const existing=state.isciler.findIndex(x=>x.donem===d.donem);
            const row={donem:d.donem,sayi:String(d.totalCount),vergiDairesi:d.vergiDairesi||''};
            if(existing>=0) state.isciler[existing]={...state.isciler[existing],...row}; else state.isciler.push(row);
            const di=state.muhtasarDetaylari.findIndex(x=>x.donem===d.donem);
            const detail={...d,fileName:file.name}; if(di>=0) state.muhtasarDetaylari[di]=detail; else state.muhtasarDetaylari.push(detail);
            card.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${d.donem} dönemi onaylandı ve toplam ${d.totalCount} çalışan tabloya aktarıldı.`));
            btn.disabled=true; btn.textContent='✓ Aktarıldı'; if(rerender) rerender();
          };
          card.appendChild(btn); ok++;
        } catch(err){
          fail++; card.appendChild(el('div',{class:'hint warn'},'⚠️ Dosya okunamadı: '+err.message));
        }
        list.appendChild(card);
      }
      list.insertBefore(el('div',{class:'hint '+(fail?'warn':'ok'),style:'margin-top:10px;'},`Muhtasar toplu işlem: ${ok} dosya işlendi${fail?`, ${fail} dosya okunamadı`:''}.`),list.firstChild);
    }
  });
  wrap.appendChild(list); container.appendChild(wrap);
}

let archiveMenuOpen = true;
let doluTutanakMenuOpen = true;
let workflowMenuOpen = true;
let archiveViewParsed = null;
let archiveEditParsed = null;
let currentPage = 'workflow';

function formatDisplayValue(v){
  if(v===null||v===undefined||v==='') return '—';
  if(v instanceof Date) return fmtDate(v);
  return String(v);
}

function renderReadOnlyTable(container,colDef,rows,options={}){
  const outer=el('div',{style:'overflow:auto;max-width:100%;'});
  const table=el('table',{class:'editable-table'});
  const thead=el('thead'),trh=el('tr');
  colDef.forEach(c=>trh.appendChild(el('th',{style:`min-width:${c.w||140}px;`},c.label)));
  thead.appendChild(trh);table.appendChild(thead);
  const tbody=el('tbody');
  (rows||[]).forEach(row=>{const tr=el('tr');colDef.forEach(c=>tr.appendChild(el('td',{style:`min-width:${c.w||140}px;`},formatDisplayValue(row[c.key]))));tbody.appendChild(tr);});
  if(!(rows||[]).length){const tr=el('tr');tr.appendChild(el('td',{colSpan:colDef.length,style:'text-align:center;color:var(--muted);'},options.empty||'Kayıt bulunamadı.'));tbody.appendChild(tr);}
  table.appendChild(tbody);outer.appendChild(table);container.appendChild(outer);
}

function archiveYearFromValue(v){
  const s=String(v??'').trim();
  if(!s) return '';
  const m=s.match(/(?:^|[^0-9])(19|20)\d{2}(?:[^0-9]|$)/);
  return m ? s.match(/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/)?.[1] || '' : '';
}

function getArchiveViewYears(parsed){
  const years=new Set();
  const add=v=>{const y=archiveYearFromValue(v);if(y)years.add(y);};
  (parsed.defterler||[]).forEach(x=>add(x.baslangic));
  (parsed.faturalar||[]).forEach(x=>add(x.tarih));
  (parsed.isciler||[]).forEach(x=>add(x.donem));
  (parsed.kdvBeyanlari||[]).forEach(x=>add(x.donem));
  (parsed.tedarikciler||[]).forEach(x=>{add(x.donem);add(x.faturaTarihi);});
  (parsed.imalatcilar||[]).forEach(x=>add(x.belgeTarihi));
  return [...years].sort((a,b)=>Number(a)-Number(b));
}

function filterArchiveParsedByYear(parsed,year){
  if(!year || year==='TÜM YILLAR') return parsed;
  const has=(v)=>archiveYearFromValue(v)===year;
  return {
    mukellef: parsed.mukellef,
    ortaklar: parsed.ortaklar||[],
    defterler:(parsed.defterler||[]).filter(x=>has(x.baslangic)),
    faturalar:(parsed.faturalar||[]).filter(x=>has(x.tarih)),
    isciler:(parsed.isciler||[]).filter(x=>has(x.donem)),
    kdvBeyanlari:(parsed.kdvBeyanlari||[]).filter(x=>has(x.donem)),
    imalatcilar:(parsed.imalatcilar||[]).filter(x=>has(x.belgeTarihi)),
    tedarikciler:(parsed.tedarikciler||[]).filter(x=>has(x.donem)||has(x.faturaTarihi))
  };
}

function renderArchiveViewTables(content,parsed){
  const m=parsed.mukellef||{};
  const info=el('div',{class:'card'});info.appendChild(el('h3',{},'Mükellef Bilgileri'));
  const t=el('table',{class:'editable-table'});
  [['Ünvan',m.unvan],['Vergi/T.C. Kimlik Numarası',m.vkn],['Vergi Dairesi',m.vergiDairesi],['Adres',m.adres],['Telefon',m.telefon]].forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},formatDisplayValue(b)));t.appendChild(tr);});
  info.appendChild(t);content.appendChild(info);
  const sections=[['Ortak Bilgileri',COLS.ortak,parsed.ortaklar],['Defter Bilgileri',COLS.defter,parsed.defterler],['Fatura Bilgileri',COLS.fatura,parsed.faturalar],['Çalışan / Muhtasar',COLS.isci,parsed.isciler],['KDV Beyannamesi',COLS.kdv,parsed.kdvBeyanlari],['Üretici / İmalatçı',COLS.imalatci,parsed.imalatcilar],['Tedarikçi Firmalar',COLS.tedarikci,parsed.tedarikciler]];
  sections.forEach(([title,cols,rows])=>{const card=el('div',{class:'card',style:'margin-top:14px;'});card.appendChild(el('h3',{},`${title} — ${(rows||[]).length} kayıt`));renderReadOnlyTable(card,cols,rows,{empty:'Bu bölümde kayıt bulunamadı.'});content.appendChild(card);});
}

function parseDoluTutanak(text){
  const T=String(text||'').replace(/\r/g,'');
  const base=parseTutanak(T);
  const out={...base, sections:[]};
  const sectionDefs=[
    ['A',/A\)\s*KARŞIT İNCELEMEYİ YAPAN YEMİNLİ MALİ MÜŞAVİRİN BİLGİLERİ:/i,/B\)\s*TASDİK HİZMETİ/i],
    ['B',/B\)\s*TASDİK HİZMETİ VERİLEN MÜKELLEFİN BİLGİLERİ:/i,/Ç\)\s*NEZDİNDE/i],
    ['SÖZLEŞME',/TASDİK HİZMETİ VERİLEN MÜKELLEFİN KDV İADESİ TASDİK DÖNEMİ SÖZLEŞME BİLGİLERİ/i,/Ç\)\s*NEZDİNDE/i],
    ['Ç',/Ç\)\s*NEZDİNDE KARŞIT İNCELEME YAPILAN MÜKELLEFİN BİLGİLERİ:/i,/1-\s*Mükellefin ortaklık bilgileri/i],
    ['1',/1-\s*Mükellefin ortaklık bilgileri aşağıdaki gibidir\./i,/2-\s*Mükellefin yasal defterlere/i],
    ['2',/2-\s*Mükellefin yasal defterlere ilişkin bilgileri aşağıdaki gibidir\./i,/3-\s*Mükellefin Karşıt/i],
    ['3',/3-\s*Mükellefin Karşıt incelemeye konu olan faturalarına ilişkin bilgileri aşağıdaki gibidir\./i,/4-\s*Karşıt incelemeye konu/i],
    ['4',/4-\s*Karşıt incelemeye konu dönemde\/dönemlerde mükellefin muhtasar beyannamesinde yer alan çalışan kişi sayıları aşağıdaki gibidir\./i,/5-\s*Karşıt incelemeye konu/i],
    ['5',/5-\s*Karşıt incelemeye konu faturalara ilişkin KDV’lerin ilgili dönem beyannamesiyle beyan edildiği tespit edilmiş olup/i,/6-\s*Karşıt incelemeye konu faturada yer alan malın imalatçısı/i],
    ['6',/6-\s*Karşıt incelemeye konu faturada yer alan malın imalatçısı mükellef hakkında bilgi:/i,/7-\s*İlgili dönemde satılan/i],
    ['7',/7-\s*İlgili dönemde satılan malların tedarik edildiği firmalar\(\*\) hakkında bilgi:/i,/\(\*\)\s*Mal, hizmet veya hammadde/i]
  ];
  for(const [key,re,endRe] of sectionDefs){
    const m=T.match(re); if(!m) continue;
    let end=T.length; const em=T.match(endRe); if(em && em.index>m.index) end=em.index;
    out.sections.push({key,title:re.source.replace(/\\/g,''),text:T.slice(m.index,end).trim()});
  }

  // Sözleşme satırları
  out.contractRows=[];
  const soz=out.sections.find(x=>x.key==='SÖZLEŞME')?.text||'';
  const cm=[...soz.matchAll(/(\d{2}\.\d{4})\s+(\d{2}\.\d{4})\s+(\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})\s+(\S+)\s+(\d{2}\.\d{2}\.\d{4})/g)];
  cm.forEach(m=>out.contractRows.push({baslangic:m[1],bitis:m[2],talep:m[3],tasdikTarihi:m[4],seriSira:m[5],sistemeGiris:m[6]}));

  // 1) Ortaklık: VKN'yi sabit ankraj kabul edip aynı satırdaki kolonları ayır.
  out.ortakRows=[];
  const one=out.sections.find(x=>x.key==='1')?.text||'';
  const oneLines=one.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  for(const line of oneLines){
    const m=line.match(/^(.+?)\s+(\d{8,11})\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .\-']*?)\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .\-']*?)\s+(\d+(?:[\.,]\d+)?)\s*(.*)$/i);
    if(m && !/Adı Soyadı|Vergi\/T\.C\.|Bağlı Olduğu|Pay Oranı/i.test(m[1])){
      out.ortakRows.push({adSoyad:m[1].trim(),vkn:m[2],il:m[3].trim(),vergiDairesi:m[4].trim(),payOrani:m[5].trim(),aciklama:m[6].trim()});
    }
  }
  if(!out.ortakRows.length){
    const flat=one.replace(/\s+/g,' ').trim();
    const m=flat.match(/([^0-9]{2,80}?)\s+(\d{8,11})\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .\-']*?)\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .\-']*?)\s+(\d+(?:[\.,]\d+)?)(?:\s+(.*))?$/i);
    if(m && !/Adı Soyadı|Vergi\/T\.C\.|Bağlı Olduğu/i.test(m[1])) out.ortakRows.push({adSoyad:m[1].trim(),vkn:m[2],il:m[3].trim(),vergiDairesi:m[4].trim(),payOrani:m[5].trim(),aciklama:(m[6]||'').trim()});
  }

  // 2) Yasal defterler. PDF metin sırası görsel sütun sırasını değiştirebildiği
  // için Envanter ve e-Defter kayıtları ayrı yakalanır.
  out.defterRows=[];
  const two=out.sections.find(x=>x.key==='2')?.text||'';
  const flatTwo=two.replace(/\s+/g,' ').trim();
  for(const m of flatTwo.matchAll(/Envanter Defteri\s+(\d{2}\.\d{2}\.\d{4})\s+(\S+)\s+(.+?)\s+(\d{2}\.\d{4})\s+(\d{2}\.\d{4})/gi)){
    out.defterRows.push({nevi:'ENVANTER DEFTERİ',baslangic:m[4],bitis:m[5],tasdikMakami:m[3].trim(),tasdikTarihi:m[1],tasdikNo:m[2].trim()});
  }
  for(const m of flatTwo.matchAll(/e-Defter\s+Yevmiye Defteri([\s\S]*?)(?=e-Defter\s+Yevmiye Defteri|e-Defter\s+Büyük Defter|e-Defter\s+Defteri Kebir|$)/gi)){
    const chunk=m[1].trim();
    const dates=chunk.match(/\d{2}\.\d{2}\.\d{4}/g)||[];
    const periods=chunk.match(/\d{2}\.\d{4}/g)||[];
    if(dates.length){
      const p=periods.slice(-2);
      const uuid=(chunk.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{8}/i)||[])[0] || (chunk.match(/[0-9a-f]{20,}/i)||[])[0] || '';
      out.defterRows.push({nevi:'e-Defter Yevmiye Defteri',baslangic:p[0]||'',bitis:p[1]||'',tasdikMakami:'E-DEFTER',tasdikTarihi:dates[0],tasdikNo:uuid});
    }
  }
  for(const m of flatTwo.matchAll(/e-Defter\s+(?:Büyük Defter|Defteri Kebir)([\s\S]*?)(?=e-Defter\s+Yevmiye Defteri|e-Defter\s+Büyük Defter|e-Defter\s+Defteri Kebir|$)/gi)){
    const chunk=m[1].trim(); const dates=chunk.match(/\d{2}\.\d{2}\.\d{4}/g)||[]; const periods=chunk.match(/\d{2}\.\d{4}/g)||[];
    if(dates.length){ const p=periods.slice(-2); const uuid=(chunk.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{8}/i)||[])[0] || (chunk.match(/[0-9a-f]{20,}/i)||[])[0] || ''; out.defterRows.push({nevi:'e-Defter Defteri Kebir',baslangic:p[0]||'',bitis:p[1]||'',tasdikMakami:'E-DEFTER',tasdikTarihi:dates[0],tasdikNo:uuid}); }
  }

  out.invoiceRows=base.faturalar||[];
  out.workerRows=[];
  const four=out.sections.find(x=>x.key==='4')?.text||'';
  for(const m of four.matchAll(/(\d{2}\.\d{4})\s+(\d+)\s+([A-ZÇĞİÖŞÜ ]+?)(?=\s+\d{2}\.\d{4}|\s*$)/g)) out.workerRows.push({donem:m[1],calisan:m[2],vergiDairesi:m[3].trim()});
  out.kdvRows=[];
  const five=out.sections.find(x=>x.key==='5')?.text||''; const money=/\d{1,3}(?:\.\d{3})*,\d{2}/g;
  for(const m of five.matchAll(/(^|\n)\s*(\d{2}\.\d{4})\s+([\s\S]*?)(?=\n\s*\d{2}\.\d{4}\s+|$)/gm)){ const vals=(m[3].match(money)||[]); out.kdvRows.push({donem:m[2],values:vals}); }
  out.supplierRows=[];
  const seven=out.sections.find(x=>x.key==='7')?.text||'';
  for(const m of seven.matchAll(/([A-ZÇĞİÖŞÜ0-9 .&'’\-]+?)\s+(\d{8,11})\s+([A-ZÇĞİÖŞÜ ]+?)\s+(\d{2}\.\d{2}\.\d{4})\s+([A-Z0-9]+)\s+(\d{10,20})\s+([\d.]+,\d{2})/g)) out.supplierRows.push({adSoyad:m[1].trim(),vkn:m[2],vergiDairesi:m[3].trim(),faturaTarihi:m[4],seri:m[5],no:m[6],tutar:m[7]});
  return out;
}

function TutanakTailText(text){
  const T=String(text||''); const i=T.indexOf('(*) Mal, hizmet veya hammadde'); return i>=0?T.slice(i):'';
}

function renderDoluTutanakUploadPage(){
  currentPage='dolu-tutanak-upload'; currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Dolu Karşıt Kontrol — Tutanak Yükle'));
  content.appendChild(el('p',{class:'step-desc'},'Doldurulmuş Karşıt İnceleme Tutanağı PDF dosyasını bir kez yükleyin. Dosya tamamen okunur ve Tutanak Görüntüle ile Tutanak Eksiklik Tespit ekranlarında aynı kayıt kullanılır.'));
  const card=el('div',{class:'card'}); card.appendChild(el('h3',{},'📄 Doldurulmuş Karşıt İnceleme Tutanağı'));
  const status=el('div',{style:'margin-top:10px;'});
  fileUploadBox(card,{accept:'.pdf',multiple:false,hint:'Doldurulmuş Karşıt İnceleme Tutanağı PDF',onFiles:async(files,box)=>{
    const file=files[0]; if(!file)return; markFileChip(box,file.name,true); status.innerHTML='';
    try{
      const text=await extractPdfText(file); const parsed=parseDoluTutanak(text);
      state.doluTutanakRawText=text; state.doluTutanakFileName=file.name; state.doluTutanakParsed=parsed;
      status.appendChild(el('div',{class:'hint ok'},`✓ Tutanak yüklendi ve ${text.split('\n').filter(Boolean).length} kaynak satırı okundu.`));
      status.appendChild(el('div',{class:'hint info',style:'margin-top:8px;'},`Dosya: ${file.name} | Sayfa içeriği tamamen tarandı. Tutanak Görüntüle ekranı yalnızca görüntüleme amaçlıdır.`));
      renderNav();
    }catch(err){status.appendChild(el('div',{class:'hint warn'},`⚠️ Tutanak okunamadı: ${err.message}`));}
  }}); card.appendChild(status); content.appendChild(card);
  if(state.doluTutanakParsed) content.appendChild(el('div',{class:'hint ok',style:'margin-top:12px;'},`✓ Kullanılan tutanak: ${state.doluTutanakFileName||'—'}`));
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Dolu Karşıt Kontrol — Tutanak Yükle';renderNav();
}

function renderWelcomePage(){
  currentPage='welcome'; archiveViewParsed=null; currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Hoş Geldiniz'));
  content.appendChild(el('p',{class:'step-desc'},'KDV İade · Karşıt İnceleme Arşiv Sihirbazı kullanım rehberi ve genel çalışma mantığı.'));

  const intro=el('div',{class:'card'});
  intro.appendChild(el('h3',{},'📖 Bu uygulama ne yapar?'));
  intro.appendChild(el('p',{},'Bu uygulama, karşıt inceleme çalışmasında kullanılan bilgi ve belgeleri tek bir çalışma akışı içinde toplamak, yüklenen belgelerden ilgili alanları otomatik doldurmak, mevcut arşiv kayıtlarını görüntülemek/düzenlemek ve sonunda kullanılan gerçek tablo formatlarına uygun çıktılar oluşturmak için tasarlanmıştır.'));
  intro.appendChild(el('p',{},'Dosyalar tarayıcı içinde işlenir. Çalışma mantığı, yüklediğiniz belgelerden veri okuyup bunları ilgili tablo ve arşiv kayıtlarına aktarmaya dayanır.'));
  content.appendChild(intro);

  const workflow=el('div',{class:'card'});
  workflow.appendChild(el('h3',{},'🧭 Çalışma sırası'));
  const ul=el('ul',{style:'margin:8px 0 0 20px;line-height:1.8;'});
  [
    'Gelen Karşıt: Karşıt İnceleme Tutanağı yüklenir; mükellef, firma kimlik numarası, dönem ve fatura bilgileri çıkarılır.',
    'Ortaklık Bilgileri: Ortak kayıtları kontrol edilir ve eksik bilgiler tamamlanır.',
    'Yasal Defter / e-Defter / e-Berat: Defter kayıtları ile e-Berat belgeleri kontrol edilip tabloya aktarılır.',
    'Karşıt İncelemeye Konu Faturalar: Çalışmaya ait fatura kayıtları ayrı tutulur; ana arşivin kalıcı fatura bölümü olarak kullanılmaz.',
    'Çalışan / Muhtasar: Muhtasar ve Prim Hizmet Beyannamesi bilgileri kontrol edilerek çalışan kayıtları oluşturulur.',
    'KDV Beyannamesi: KDV beyannameleri ve ayrı tahakkuk belgeleri kontrol edilerek KDV kayıtlarına aktarılır.',
    'Üretici / İmalatçı: İmalatçı firma ve belge bilgileri tutulur.',
    'Tedarikçi Firmalar: İndirilecek KDV listesinden dönem bazında en yüksek matrahlı faturalar belirlenerek tedarikçi kayıtları oluşturulur.',
    'Kontrol ve Çıktılar: Karşıt inceleme tabloları ile güncel arşiv dosyası oluşturulur.'
  ].forEach(x=>ul.appendChild(el('li',{},x)));
  workflow.appendChild(ul); content.appendChild(workflow);

  const archive=el('div',{class:'card'});
  archive.appendChild(el('h3',{},'🗄️ Arşiv'));
  archive.appendChild(el('p',{},'Arşiv bölümü iki ayrı amaç için kullanılır: “Arşiv Dosyası Yükle” ile arşiv bir kez yüklenir; ardından “Arşiv Görüntüle”, “Arşiv Düzenle” ve “Dosyadan Veri Al” aynı dosyadaki verileri otomatik kullanır. Yeni e-Berat, KDV, tahakkuk ve İndirilecek KDV listesi kayıtları “Dosyadan Veri Al” bölümünden arşive işlenebilir.'));
  archive.appendChild(el('div',{class:'hint info'},'Arşiv Düzenle yükleme kontrollerinde dönem eşleşmesi aranmaz. Firma kimlik numarası kontrolleri korunur.'));
  content.appendChild(archive);

  const notes=el('div',{class:'card'});
  notes.appendChild(el('h3',{},'ℹ️ Kullanım notları'));
  const n=el('ul',{style:'margin:8px 0 0 20px;line-height:1.8;'});
  ['Belgeleri mümkün olduğunca kendi gerçek formatlarında yükleyin.','Bir belge için kontrol/uyarı çıktığında onay vermeden önce bilgileri inceleyin.','Eksik bilgiler ilgili tablolarda elle tamamlanabilir.','İndirilecek KDV listesi birden fazla dönemi içerebilir; sistem her ay için ayrı en yüksek 10 faturayı belirler.','Arşivde yapılan düzenlemeler, “Güncel Arşiv Dosyası İndir” ile yeni dosya olarak dışarı alınır.'].forEach(x=>n.appendChild(el('li',{},x)));
  notes.appendChild(n); content.appendChild(notes);

  document.getElementById('btn-prev').disabled=true;
  document.getElementById('btn-next').disabled=true;
  document.getElementById('btn-next').textContent='Gelen Karşıt →';
  document.getElementById('btn-next').title='Karşıt inceleme çalışma ekranına geçmek için soldaki “Gelen Karşıt” bağlantısını kullanın.';
  document.getElementById('footer-msg').textContent='Hoş Geldiniz';
  renderNav();
}

const STEPS = [
  { id:'baslangic', title:'1. Gelen Karşıt', desc:'İlk ekran tamamlanmadan sonraki adım açılmaz. Tutanak ve varsa arşiv yüklenir; bilgiler aynı ekranda ilgili alanlara aktarılır.', render(c){ renderFirstScreen(c); } },
  { id:'ortak', title:'2. Ortaklık Bilgileri', desc:'Dosyalardan gelen ortaklık kayıtlarını kontrol edin; eksik veya yeni kayıtları tabloya ekleyin.', render(c){
    const card=el('div',{class:'card'}); const w=el('div'); renderEditableTable(w,COLS.ortak,state.ortaklar); card.appendChild(w); c.appendChild(card); addGenericImportButton(c,COLS.ortak,state.ortaklar,{rerender:()=>renderEditableTable(w,COLS.ortak,state.ortaklar)});
  }},
  { id:'defter', title:'3. Yasal Defter / e-Defter / e-Berat', desc:'Arşivden yalnızca tespit edilen dönemlerin ait olduğu yıllardaki defter kayıtları alınır. Tablodaki tüm kayıtlar temizlenebilir ve arşiv yeniden taranabilir.', render(c){
    renderDetectedPeriodWarning(c,'defter');
    const card=el('div',{class:'card'}),w=el('div'); const rr=()=>{w.innerHTML='';renderEditableTable(w,COLS.defter,state.defterler,{onChange:rr});}; rr(); card.appendChild(w); c.appendChild(card);
    renderScopedTableActions(c,{templateFn:()=>addDefterTemplates(rr),clearFn:()=>clearScopedTable('defter',rr),rescanFn:()=>rescanArchiveTable('defter',rr)});
    renderEberatImport(c,rr); addGenericImportButton(c,COLS.defter,state.defterler,{rerender:rr});
  }},
  { id:'fatura', title:'4. Karşıt İncelemeye Konu Faturalar', desc:'Bu tablo yalnızca mevcut karşıt inceleme çalışmasına aittir. Eski arşiv faturaları buraya otomatik taşınmaz.', render(c){
    renderDetectedPeriodWarning(c,'fatura');
    const card=el('div',{class:'card'}),w=el('div'); const rr=()=>{w.innerHTML='';renderEditableTable(w,COLS.fatura,state.faturalar);}; rr(); card.appendChild(w); c.appendChild(card);
    renderScopedTableActions(c,{templateFn:()=>restoreFaturalarFromTutanak(rr),templateLabel:'↻ Faturaları tekrar al',clearFn:()=>clearScopedTable('fatura',rr),rescanFn:()=>alert('Karşıt inceleme faturaları arşivden alınmaz. Bu tablo yalnızca Gelen Karşıt tutanağından oluşturulur.')});
    addGenericImportButton(c,COLS.fatura,state.faturalar,{rerender:rr}); renderMuavinKontrol(c,rr);
  }},
  { id:'isci', title:'5. Çalışan / Muhtasar', desc:'Muhtasar kayıtlarında arşivden yalnızca tutanaktan tespit edilen dönemler alınır.', render(c){
    renderDetectedPeriodWarning(c,'isci');
    syncIsciVergiDairesi(); const card=el('div',{class:'card'}),w=el('div'); const rr=()=>{syncIsciVergiDairesi();w.innerHTML='';renderEditableTable(w,COLS.isci,state.isciler,{onChange:rr});}; rr(); card.appendChild(w); c.appendChild(card);
    renderScopedTableActions(c,{templateFn:()=>{syncDonemRows(state.isciler,state.donemler,COLS.isci);rr();},clearFn:()=>clearScopedTable('isci',rr),rescanFn:()=>rescanArchiveTable('isci',rr)});
    renderMuhtasarImport(c,rr);
  }},
  { id:'kdv', title:'6. KDV Beyannamesi', desc:'KDV kayıtlarında tespit edilen dönemlere ek olarak her dönemin bir önceki KDV dönemi de mükerrer olmadan kontrol edilir ve arşivden alınır.', render(c){
    renderDetectedPeriodWarning(c,'kdv');
    state.kdvDonemleri=computeKdvDonemleri(state.donemler); const card=el('div',{class:'card'}),w=el('div'); const rr=()=>{w.innerHTML='';renderEditableTable(w,COLS.kdv,state.kdvBeyanlari,{onChange:rr});}; rr(); card.appendChild(w); c.appendChild(card);
    renderScopedTableActions(c,{templateFn:()=>{syncDonemRows(state.kdvBeyanlari,state.kdvDonemleri,COLS.kdv);rr();},clearFn:()=>clearScopedTable('kdv',rr),rescanFn:()=>rescanArchiveTable('kdv',rr)});
    if(state.kdvDonemleri.length){ renderKdvImport(c,rr); renderKdvTahakkukImport(c,rr); }
  }},
  { id:'imalatci', title:'7. Üretici / İmalatçı', desc:'Arşivde bulunan ilgili üretici/imalatçı kayıtları dönem sınırlaması olmadan tabloya alınır; eksik alanlar elle tamamlanabilir.', render(c){
    renderDetectedPeriodWarning(c,'imalatci');
    const card=el('div',{class:'card'}),w=el('div'); const rr=()=>{w.innerHTML='';renderEditableTable(w,COLS.imalatci,state.imalatcilar);}; rr(); card.appendChild(w); c.appendChild(card);
    renderScopedTableActions(c,{templateFn:()=>{if(!state.imalatcilar.length) state.imalatcilar.push(emptyRow(COLS.imalatci));rr();},clearFn:()=>clearScopedTable('imalatci',rr),rescanFn:()=>rescanArchiveTable('imalatci',rr)});
    addGenericImportButton(c,COLS.imalatci,state.imalatcilar,{rerender:rr});
  }},
  { id:'tedarikci', title:'8. Tedarikçi Firmalar', desc:'Tespit edilen her dönem ayrı ayrı arşivde taranır ve o döneme ait bulunan tüm tedarikçi faturaları tabloya getirilir. Bir dönemde 10’dan az veya fazla kayıt olabilir; sabit 10 sınırı yalnızca İndirilecek KDV Listesi yüklemesinde geçerlidir.', render(c){
    renderDetectedPeriodWarning(c,'tedarikciler');
    const card=el('div',{class:'card'}),w=el('div'); const rr=()=>{w.innerHTML='';renderEditableTable(w,COLS.tedarikci,state.tedarikciler,{onChange:rr});}; rr(); card.appendChild(w); c.appendChild(card);
    c.appendChild(el('div',{class:'hint info'},`Şablon dönemleri: ${state.donemler.join(', ')||'—'}`));
    c.appendChild(el('div',{class:'hint info'},'Arşiv taramasında her tespit edilen dönem ayrı ayrı eşleştirilir. Örneğin 06.2026 döneminde 5, 07.2026 döneminde 6 arşiv faturası varsa tabloya toplam 11 kayıt gelir; 10 kayıt sınırı yalnızca İndirilecek KDV Listesi yüklemesinde geçerlidir.'));
    renderScopedTableActions(c,{templateFn:()=>addPeriodTemplateRows(state.tedarikciler,COLS.tedarikci,state.donemler,rr),clearFn:()=>clearScopedTable('tedarikciler',rr),rescanFn:()=>rescanArchiveTable('tedarikciler',rr)});
    const arsivVergiBtn=el('button',{class:'btn btn-secondary',style:'margin:0 0 14px 0;',onclick:()=>{const arsiv=(state.existingArchiveParsed&&state.existingArchiveParsed.tedarikciler)||[];if(!arsiv.length){alert('Yüklenen arşivde tedarikçi firma kaydı bulunamadı.');return;}const normVkn=v=>String(v??'').replace(/\D/g,'');const lookup=new Map();arsiv.forEach(a=>{const v=normVkn(a.vkn);const vd=String(a.vergiDairesi??'').trim();if(v&&vd&&!lookup.has(v))lookup.set(v,vd);});let updated=0;let matched=0;state.tedarikciler.forEach(row=>{const v=normVkn(row.vkn);if(!v)return;const vd=lookup.get(v);if(!vd)return;matched++;if(!String(row.vergiDairesi??'').trim()){row.vergiDairesi=vd;updated++;}});rr();alert(updated?`Arşiv taraması tamamlandı. ${updated} tedarikçinin Bağlı Olduğu Vergi Dairesi bilgisi tabloya aktarıldı.`:`Arşiv taraması tamamlandı. Eşleşen ${matched} kayıt bulundu ancak boş vergi dairesi alanı bulunmadı veya aktarılacak bilgi yok.`);}},'🔎 Arşivden Vergi Dairelerini Doldur'); c.appendChild(arsivVergiBtn);
    renderTedarikciExcelImport(c,rr); addGenericImportButton(c,COLS.tedarikci,state.tedarikciler,{rerender:rr});
  }},
  { id:'sonuc', title:'9. Kontrol ve Çıktılar', desc:'Sonuçta 7 ayrı Excel çalışma kitabı ve faturalardan arındırılmış yıllık arşiv oluşturulur. Çıktılar yüklediğiniz gerçek Excel şablonlarının kolon yapısını esas alır.', render(c){
    const sum=el('div',{class:'two-col'}),left=el('div'),right=el('div'),block=(t,v)=>el('div',{class:'summary-block'},[el('h4',{},t),el('div',{},String(v))]);
    left.appendChild(block('Ç Mükellefi',state.meta.cUnvan||'—'));left.appendChild(block('VKN',state.meta.cVkn||'—'));left.appendChild(block('Fatura Dönemleri',state.donemler.join(', ')||'—'));left.appendChild(block('KDV Dönemleri',state.kdvDonemleri.join(', ')||'—'));
    right.appendChild(block('Ortak',state.ortaklar.length));right.appendChild(block('Defter',state.defterler.length));right.appendChild(block('Fatura',state.faturalar.length));right.appendChild(block('Çalışan dönemi',state.isciler.length));right.appendChild(block('KDV dönemi',state.kdvBeyanlari.length));right.appendChild(block('İmalatçı',state.imalatcilar.length));right.appendChild(block('Tedarikçi',state.tedarikciler.length));sum.appendChild(left);sum.appendChild(right);c.appendChild(sum);
    const b=el('button',{class:'btn btn-primary'},'⬇ Karşıt İnceleme Tablolarını İndir');b.onclick=async()=>{try{b.disabled=true;b.textContent='⏳ Karşıt İnceleme Tabloları hazırlanıyor...';const files=await buildOutputFiles(state);for(const f of files){await downloadBlob(f.blob,f.name);await new Promise(r=>setTimeout(r,250));}b.textContent='✓ Karşıt İnceleme Tabloları İndirildi';setTimeout(()=>{b.disabled=false;b.textContent='⬇ Karşıt İnceleme Tablolarını İndir';},1500);}catch(e){b.disabled=false;b.textContent='⬇ Karşıt İnceleme Tablolarını İndir';alert('Çıktı oluşturulamadı: '+e.message);}};c.appendChild(el('div',{class:'table-actions',style:'margin-top:18px;'},[b]));
    const a=el('button',{class:'btn btn-secondary',style:'margin-top:10px;'},'Güncel Arşiv Dosyası İndir');a.onclick=async()=>{try{const merged=mergeArchive(state.existingArchiveParsed,state);const wb=buildArchiveWorkbook(merged);const safe=(merged.mukellef.unvan||'mukellef').replace(/[^\wğüşöçıİĞÜŞÖÇ ]/g,'').slice(0,40).trim();await downloadWorkbook(wb,`ARSIV_${safe}.xlsx`);}catch(e){alert('Arşiv oluşturulamadı: '+e.message);}};c.appendChild(a);
  }}
];


