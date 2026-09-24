/* v1.3.35 restored missing function definitions from v1.3.30 */



function getSharedArchiveParsed(){
  return state.existingArchiveParsed||null;
}

function requireSharedArchive(pageTitle){
  const parsed=getSharedArchiveParsed();
  if(!parsed){
    alert(`Önce Arşiv → Arşiv Dosyası Yükle / Oluştur bağlantısından arşiv dosyasını yükleyin.`);
    renderArchiveUploadPage();
    return null;
  }
  return parsed;
}

function syncSharedArchiveRefs(parsed){
  archiveViewParsed=parsed||null;
  archiveEditParsed=parsed||null;
}


function renderArchiveUploadPage(){
  currentPage='archive-upload';archiveMenuOpen=true;currentStep=-1;
  const content=document.getElementById('step-content');content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Arşiv Dosyası Yükle / Oluştur'));
  content.appendChild(el('p',{class:'step-desc'},'Mevcut arşiv dosyanızı yükleyebilir veya yeni, boş ve doldurulabilir bir arşiv dosyası oluşturabilirsiniz. Arşiv bir kez yüklendikten/oluşturulduktan sonra Arşiv Görüntüle, Arşiv Düzenle ve Dosyadan Veri Al bağlantıları aynı arşiv verisini otomatik kullanır.'));
  const card=el('div',{class:'card'});
  card.appendChild(el('h3',{},'📂 Mevcut Arşiv Dosyası'));
  card.appendChild(el('div',{class:'hint info'},'Gerçek arşiv Excel dosyanızı veya arşiv ZIP dosyanızı yükleyin. Yeni bir dosya yüklerseniz mevcut ortak arşiv verisi yeni dosyayla değiştirilir.'));
  const status=el('div',{style:'margin-top:10px;'});
  fileUploadBox(card,{accept:'.xlsx,.xlsm,.zip',multiple:false,hint:'Yıllık arşiv (.xlsx/.xlsm) veya arşiv ZIP (.zip)',onFiles:async(files,box)=>{
    const file=files[0];if(!file)return;
    markFileChip(box,file.name,true);status.innerHTML='';
    try{
      const parsed=await readArchiveUpload(file);
      state.existingArchiveParsed=parsed;
      state.existingArchiveFile={name:file.name};
      syncSharedArchiveRefs(parsed);
      archiveToState(parsed);
      const m=parsed.mukellef||{};
      status.appendChild(el('div',{class:'hint ok'},`✓ Arşiv yüklendi: ${file.name}`));
      status.appendChild(el('div',{class:'hint info',style:'margin-top:6px;'},`Mükellef: ${m.unvan||'—'} | Firma kimlik numarası: ${m.vkn||'—'}`));
      status.appendChild(el('div',{class:'hint ok',style:'margin-top:6px;'},'✓ Aynı arşiv artık Arşiv Görüntüle, Arşiv Düzenle ve Dosyadan Veri Al bağlantılarında otomatik kullanılacaktır.'));
      renderNav();
    }catch(err){
      status.appendChild(el('div',{class:'hint warn'},`⚠️ Arşiv okunamadı: ${err.message}`));
    }
  }});
  if(state.existingArchiveParsed){
    const m=state.existingArchiveParsed.mukellef||{};
    status.appendChild(el('div',{class:'hint ok'},`✓ Kullanılan arşiv: ${state.existingArchiveFile?.name||'—'} — ${m.unvan||'Ünvan bulunamadı'}`));
  }
  card.appendChild(status);content.appendChild(card);

  const createCard=el('div',{class:'card',style:'margin-top:14px;'});
  createCard.appendChild(el('h3',{},'🆕 Yeni Arşiv Dosyası Oluştur'));
  createCard.appendChild(el('div',{class:'hint info'},'Yeni mükellef için boş arşiv oluşturmak üzere aşağıdaki genel bilgileri girin. Oluşturulan Excel, gerekli arşiv bölümlerini boş ve doldurulabilir şekilde içerir.'));
  const createGrid=el('div',{class:'archive-create-grid',style:'margin-top:12px;'});
  const newVkn=el('input',{class:'input',placeholder:'Vergi/T.C. Kimlik Numarası'});
  const newUnvan=el('input',{class:'input',placeholder:'Adı ve Soyadı / Ünvanı'});
  const newVD=el('input',{class:'input',placeholder:'Vergi Dairesi'});
  const newAdres=el('input',{class:'input',placeholder:'Adres'});
  const newTel=el('input',{class:'input',placeholder:'Telefon Numarası'});
  [['Vergi/T.C. Kimlik Numarası',newVkn],['Adı ve Soyadı / Ünvanı',newUnvan],['Vergi Dairesi',newVD],['Adres',newAdres],['Telefon Numarası',newTel]].forEach(([label,input])=>{const f=el('div',{class:'field'});f.appendChild(el('label',{},label));f.appendChild(input);createGrid.appendChild(f);});
  createCard.appendChild(createGrid);
  const createStatus=el('div',{style:'margin-top:10px;'});
  createCard.appendChild(el('button',{class:'btn btn-primary',style:'margin-top:12px;',onclick:async()=>{
    createStatus.innerHTML='';
    const vkn=String(newVkn.value||'').trim(), unvan=String(newUnvan.value||'').trim();
    if(!vkn || !unvan){createStatus.appendChild(el('div',{class:'hint warn'},'⚠️ Vergi/T.C. Kimlik Numarası ile Adı ve Soyadı / Ünvanı zorunludur.'));return;}
    const parsed={mukellef:{unvan,vkn,vergiDairesi:String(newVD.value||'').trim(),adres:String(newAdres.value||'').trim(),telefon:String(newTel.value||'').trim()},ortaklar:[],defterler:[],faturalar:[],isciler:[],kdvBeyanlari:[],imalatcilar:[],tedarikciler:[]};
    try{
      const wb=buildArchiveWorkbook(parsed);
      const safe=unvan.replace(/[^\p{L}\p{N}]+/gu,'_').slice(0,80)||'MUKELLEF';
      const filename=`Yeni_Arşiv_${safe}.xlsx`;
      await downloadWorkbook(wb,filename);
      state.existingArchiveParsed=parsed; state.existingArchiveFile={name:filename}; syncSharedArchiveRefs(parsed); archiveToState(parsed);
      createStatus.appendChild(el('div',{class:'hint ok'},`✓ Yeni arşiv oluşturuldu: ${filename}`));
      renderNav();
      setTimeout(()=>renderArchiveViewPage(),80);
    }catch(err){createStatus.appendChild(el('div',{class:'hint warn'},`⚠️ Yeni arşiv oluşturulamadı: ${err.message}`));}
  }},'➕ Yeni Arşiv Dosyası Oluştur ve Devam Et'));
  createCard.appendChild(createStatus);content.appendChild(createCard);
  const next=el('div',{class:'card',style:'margin-top:14px;'});
  next.appendChild(el('h3',{},'Arşiv bağlantıları'));next.appendChild(el('div',{class:'hint info'},'Dosyayı tekrar yüklemeden aşağıdaki bağlantılardan aynı arşiv üzerinde çalışabilirsiniz.'));
  [['archive-view','Arşiv Görüntüle'],['archive-edit','Arşiv Düzenle'],['archive-data-import','Dosyadan Veri Al']].forEach(([id,label])=>next.appendChild(el('button',{class:'btn btn-secondary',style:'margin:4px 6px 4px 0;',onclick:()=>id==='archive-view'?renderArchiveViewPage():id==='archive-edit'?renderArchiveEditPage():renderArchiveDataImportPage()},label)));
  content.appendChild(next);
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='Arşiv Dosyası Yükle / Oluştur';document.getElementById('footer-msg').textContent='Arşiv Dosyası Yükle / Oluştur';renderNav();
}


function renderArchiveViewPage(){
  const parsed=requireSharedArchive('Arşiv Görüntüle'); if(!parsed)return;
  currentPage='archive-view';archiveMenuOpen=true;currentStep=-1;syncSharedArchiveRefs(parsed);
  const content=document.getElementById('step-content');content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Arşiv Görüntüle'));
  content.appendChild(el('p',{class:'step-desc'},`Yüklenen arşiv: ${state.existingArchiveFile?.name||'—'}. Bu sayfa aynı arşiv verisini kullanır; yeniden dosya yüklenmez. Kayıtlar yalnızca görüntülenir.`));
  const card=el('div',{class:'card'});card.appendChild(el('h3',{},'📂 Kullanılan Arşiv'));card.appendChild(el('div',{class:'hint ok'},`✓ ${state.existingArchiveFile?.name||'Arşiv dosyası'} otomatik kullanılıyor.`));
  const yearWrap=el('div',{style:'margin-top:14px;'});const tablesHolder=el('div');
  const renderSelected=()=>{tablesHolder.innerHTML='';const year=yearWrap.querySelector('select')?.value||'TÜM YILLAR';renderArchiveViewTables(tablesHolder,filterArchiveParsedByYear(parsed,year));};
  const years=getArchiveViewYears(parsed);
  if(years.length){
    const lab=el('label',{style:'display:block;font-weight:600;margin-bottom:6px;'},'Arşiv Yılı');
    const sel=el('select',{class:'input',style:'max-width:260px;'});sel.appendChild(el('option',{value:'TÜM YILLAR'},'Tüm Yıllar'));years.forEach(y=>sel.appendChild(el('option',{value:y},y)));sel.onchange=renderSelected;
    yearWrap.appendChild(lab);yearWrap.appendChild(sel);yearWrap.appendChild(el('div',{class:'hint info',style:'margin-top:8px;'},`Arşivde tespit edilen yıllar: ${years.join(', ')}`));
  } else yearWrap.appendChild(el('div',{class:'hint warn'},'Arşivde dönem/tarih üzerinden yıl tespit edilemedi; tüm kayıtlar gösteriliyor.'));
  card.appendChild(yearWrap);content.appendChild(card);content.appendChild(tablesHolder);renderSelected();
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='Arşiv Görüntüle';document.getElementById('footer-msg').textContent='Arşiv Görüntüle';renderNav();
}


function archiveVknDigits(v){ return String(v||'').replace(/\D/g,''); }

function archiveEditVknCheck(parsedVkn){
  const expected=archiveVknDigits(archiveEditParsed?.mukellef?.vkn);
  const actual=archiveVknDigits(parsedVkn);
  if(!expected) return {ok:false,message:'Arşiv mükellef VKN/T.C. Kimlik Numarası bulunamadı.'};
  if(!actual) return {ok:false,message:'Yüklenen belgede firma kimlik numarası okunamadı.'};
  return actual===expected ? {ok:true,message:'✓ Firma kimlik numarası arşivdeki mükellef ile eşleşiyor.'} : {ok:false,message:`⚠️ Firma kimlik numarası farklı: belge ${parsedVkn}, arşiv ${archiveEditParsed.mukellef.vkn}.`};
}

function archiveEditMergeRow(arr, incoming, keyFn){
  const k=keyFn(incoming); const i=arr.findIndex(x=>keyFn(x)===k);
  if(i>=0) arr[i]={...arr[i],...incoming}; else arr.push({...incoming});
}

function archiveGroupKey(value, mode){
  const s=String(value??'').trim();
  if(!s) return mode==='year' ? 'Yıl Belirtilmemiş' : 'Dönem Belirtilmemiş';
  if(mode==='year'){
    const m=s.match(/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/);
    return m ? m[1] : 'Yıl Belirtilmemiş';
  }
  const m=s.match(/(?:^|[^0-9])((?:0?[1-9]|1[0-2])[.\/-](?:19|20)\d{2})(?:[^0-9]|$)/);
  if(m){
    const parts=m[1].split(/[.\/-]/); return `${String(parts[0]).padStart(2,'0')}.${parts[1]}`;
  }
  const d=s.match(/(?:^|[^0-9])(?:\d{1,2}[.\/-]\d{1,2}[.\/-])((?:19|20)\d{2})(?:[^0-9]|$)/);
  return d ? `Dönem ${d[1]}` : 'Dönem Belirtilmemiş';
}

function archiveGroupedRows(rows, valueFn, mode){
  const map=new Map();
  (rows||[]).forEach(row=>{const key=archiveGroupKey(valueFn(row),mode);if(!map.has(key))map.set(key,[]);map.get(key).push(row);});
  const entries=[...map.entries()];
  entries.sort((a,b)=>{
    const na=parseInt(a[0],10), nb=parseInt(b[0],10);
    if(Number.isFinite(na)&&Number.isFinite(nb)) return na-nb;
    if(Number.isFinite(na)) return -1;
    if(Number.isFinite(nb)) return 1;
    return a[0].localeCompare(b[0],'tr');
  });
  return entries;
}

function renderArchiveAccordionGroups(container, rows, cols, valueFn, mode){
  const entries=archiveGroupedRows(rows,valueFn,mode);
  if(!entries.length){
    renderEditableTable(container,cols,[],{onChange:()=>{}});
    return;
  }
  entries.forEach(([label,groupRows],idx)=>{
    const details=document.createElement('details');
    details.style.cssText='margin:8px 0;border:1px solid #dbe5e9;border-radius:10px;background:#fff;overflow:hidden;';
    const summary=document.createElement('summary');
    summary.style.cssText='cursor:pointer;padding:11px 14px;font-weight:700;background:#f4f8f9;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;';
    const left=el('span',{},label);
    const badge=el('span',{style:'font-size:12px;font-weight:600;color:#54717c;background:#e7f0f2;border-radius:999px;padding:3px 9px;'},`${groupRows.length} kayıt`);
    summary.appendChild(left);summary.appendChild(badge);details.appendChild(summary);
    const body=el('div',{style:'padding:10px;overflow:auto;'});
    renderEditableTable(body,cols,groupRows,{onChange:()=>{}});
    details.appendChild(body);container.appendChild(details);
    if(idx===0) details.open=false;
  });
}

function renderArchiveEditRefresh(holder){
  holder.innerHTML='';
  if(!archiveEditParsed) return;
  const m=archiveEditParsed.mukellef||{};
  const info=el('div',{class:'card'});
  info.appendChild(el('h3',{},'Arşiv Mükellefi'));
  const t=el('table',{class:'editable-table'});
  [['Ünvan',m.unvan],['Vergi/T.C. Kimlik Numarası',m.vkn],['Vergi Dairesi',m.vergiDairesi],['Adres',m.adres],['Telefon',m.telefon]].forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});
  info.appendChild(t);holder.appendChild(info);

  const addSection=(title,cols,key,groupMode,valueFn)=>{
    const card=el('div',{class:'card',style:'margin-top:14px;'});
    card.appendChild(el('h3',{},`${title} — ${archiveEditParsed[key]?.length||0} kayıt`));
    const w=el('div');
    if(groupMode) renderArchiveAccordionGroups(w,archiveEditParsed[key]||[],cols,valueFn,groupMode);
    else renderEditableTable(w,cols,archiveEditParsed[key]||[],{onChange:()=>{}});
    card.appendChild(w);holder.appendChild(card);
  };
  addSection('Ortak Bilgileri',COLS.ortak,'ortaklar',null,()=>'' );
  addSection('Defter Bilgileri',COLS.defter,'defterler','year',x=>x.baslangic||x.bitis||x.tasdikTarihi);
  addSection('Çalışan / Muhtasar',COLS.isci,'isciler','year',x=>x.donem);
  addSection('KDV Beyannamesi',COLS.kdv,'kdvBeyanlari','year',x=>x.donem);
  addSection('Üretici / İmalatçı',COLS.imalatci,'imalatcilar',null,()=>'' );
  addSection('Tedarikçi Firmalar',COLS.tedarikci,'tedarikciler','period',x=>x.donem||x.faturaTarihi);
}

function renderArchiveEditEberat(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📘 e-Defter / e-Berat — Arşive Aktar'));
  wrap.appendChild(el('div',{class:'hint info'},'e-Berat XML/PDF dosyalarını çoklu yükleyebilirsiniz. Bu sayfada dönem uygunluğu aranmaz; yalnızca firma kimlik numarası kontrol edilir. Onaylanan belge arşivdeki Defter Bilgileri bölümüne eklenir veya aynı kayıt güncellenir.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.xml,.pdf',hint:'e-Berat XML veya PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML=''; let ok=0,fail=0; const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});preview.appendChild(holder);
    for(const file of files){ markFileChip(box,file.name,true); const card=el('div',{class:'card',style:'margin-top:4px;'});card.appendChild(el('h4',{},`Kontrol edilen e-Berat — ${file.name}`));
      try{ const parsed=file.name.toLowerCase().endsWith('.xml')?parseEberatXmlText(await file.text()):parseEberatPdfText(await extractPdfText(file)); const chk=archiveEditVknCheck(parsed.vkn); const row=eberatRowFromParsed(parsed); const info=[['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DOKÜMAN TİPİ',parsed.dokumanTipi],['DÖNEMİ',parsed.donem],['OLUŞTURMA TARİHİ',parsed.olusturmaTarihi],['TEKİL NO',parsed.tekilNo],['ETTN',parsed.ettn],['AÇIKLAMA',parsed.aciklama]]; const t=el('table',{class:'editable-table'});info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});card.appendChild(t);card.appendChild(el('div',{class:'hint '+(chk.ok?'ok':'warn'),style:'margin-top:10px;'},chk.message));
        const btn=el('button',{class:'btn btn-primary',disabled:!chk.ok||!row.nevi||!row.baslangic||!row.bitis||!row.tasdikNo||!row.tasdikTarihi},'✓ Onayla ve arşive ekle');btn.onclick=()=>{if(!chk.ok)return;const clean={...row};delete clean._eberat;delete clean._deadline;archiveEditMergeRow(archiveEditParsed.defterler,clean,x=>(x.nevi||'')+'|'+(x.baslangic||'')+'|'+(x.bitis||'')+'|'+(x.tasdikNo||''));btn.disabled=true;btn.textContent='✓ Arşive eklendi';refresh();card.appendChild(el('div',{class:'hint ok'},'✓ e-Berat kaydı arşive aktarıldı.'));};
        card.appendChild(el('div',{style:'margin-top:10px;'},[btn]));holder.appendChild(card);ok++;
      }catch(err){fail++;card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}
    }
    holder.insertBefore(el('div',{class:'hint '+(fail?'warn':'ok'),style:'margin-bottom:8px;'},`e-Berat toplu işlem: ${ok} dosya okundu${fail?`, ${fail} dosya okunamadı`:''}.`),holder.firstChild);
  }});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditKdv(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});wrap.appendChild(el('h3',{},'📊 KDV Beyannamesi — Arşive Aktar'));wrap.appendChild(el('div',{class:'hint info'},'KDV beyannamelerini çoklu yükleyin. Dönem kontrolü yapılmaz; yalnızca firma kimlik numarası kontrol edilir. Belgedeki dönem, arşivdeki aynı dönem kaydını günceller veya yeni kayıt oluşturur.'));
  const preview=el('div');fileUploadBox(wrap,{accept:'.pdf',hint:'KDV Beyannamesi PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{preview.innerHTML='';const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});preview.appendChild(holder);let ok=0,fail=0;for(const file of files){markFileChip(box,file.name,true);const card=el('div',{class:'card'});card.appendChild(el('h4',{},`Kontrol edilen KDV Beyannamesi — ${file.name}`));try{const text=await extractPdfText(file);if(isKdvTahakkukPdfText(text||'')){card.appendChild(el('div',{class:'hint warn'},'⚠️ PDF metninde “TAHAKKUK FİŞİ” ibaresi bulundu. Bu belge KDV Beyannamesi değildir; aşağıdaki tahakkuk alanına yükleyin.'));holder.appendChild(card);fail++;continue;}const parsed=parseKdvBeyannamePdf(text||'');const chk=archiveEditVknCheck(parsed.vkn);const required=[['Teslim ve Hizmet Karşılığını Teşkil Eden Bedel','teslimBedel'],['KDV Matrahı','kdvMatrahi'],['Hesaplanan KDV','hesaplananKdv'],['İlave Edilecek KDV','ilaveKdv'],['Toplam KDV','toplamKdv'],['İndirimler Toplamı','indirimler'],['Ödenmesi Gereken KDV','odenecekKdv'],['Sonraki Döneme Devreden KDV','devredenKdv']];const missing=required.filter(([,k])=>!parsed[k]).map(x=>x[0]);if(missing.length) card.appendChild(el('div',{class:'hint warn'},'Okunamayan alanlar: '+missing.join(', ')));const info=[['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DÖNEM',parsed.donem],...required.map(([l,k])=>[l,parsed[k]]),['TAHAKKUK FİŞİNİN NUMARASI',parsed.tahakkukNo]];const t=el('table',{class:'editable-table'});info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});card.appendChild(t);card.appendChild(el('div',{class:'hint '+(chk.ok?'ok':'warn'),style:'margin-top:10px;'},chk.message));const btn=el('button',{class:'btn btn-primary',disabled:!chk.ok||!parsed.donem},'✓ Onayla ve arşive ekle');btn.onclick=()=>{if(!chk.ok)return;const row={donem:parsed.donem,teslimBedel:parsed.teslimBedel,ozelMatrah:parsed.ozelMatrah,kdvMatrahi:parsed.kdvMatrahi,hesaplananKdv:parsed.hesaplananKdv,ilaveKdv:parsed.ilaveKdv,toplamKdv:parsed.toplamKdv,indirimler:parsed.indirimler,odenecekKdv:parsed.odenecekKdv,devredenKdv:parsed.devredenKdv,tahakkukNo:parsed.tahakkukNo};archiveEditMergeRow(archiveEditParsed.kdvBeyanlari,row,x=>(x.donem||''));btn.disabled=true;btn.textContent='✓ Arşive eklendi';refresh();card.appendChild(el('div',{class:'hint ok'},`✓ ${parsed.donem} KDV kaydı arşive aktarıldı.`));};card.appendChild(el('div',{style:'margin-top:10px;'},[btn]));holder.appendChild(card);ok++;}catch(err){fail++;card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}}holder.insertBefore(el('div',{class:'hint '+(fail?'warn':'ok'),style:'margin-bottom:8px;'},`KDV toplu işlem: ${ok} dosya işlendi${fail?`, ${fail} dosya okunamadı`:''}.`),holder.firstChild);}});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditTahakkuk(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});wrap.appendChild(el('h3',{},'📎 KDV Tahakkuk Fişi — Arşive Aktar'));wrap.appendChild(el('div',{class:'hint info'},'Tahakkuk fişlerini çoklu yükleyin. Dönem kontrolü yapılmaz; yalnızca firma kimlik numarası kontrol edilir. Tahakkuk numarası, aynı dönem KDV kaydı varsa ona işlenir; yoksa dönem ve tahakkuk numarasıyla yeni KDV arşiv kaydı oluşturulur.'));
  const preview=el('div');fileUploadBox(wrap,{accept:'.pdf',hint:'KDV Tahakkuk Fişi PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{preview.innerHTML='';const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});preview.appendChild(holder);let ok=0,fail=0;for(const file of files){markFileChip(box,file.name,true);const card=el('div',{class:'card'});card.appendChild(el('h4',{},`Kontrol edilen KDV Tahakkuk Fişi — ${file.name}`));try{const text=await extractPdfText(file);if(isKdvBeyannamePdfText(text||'')&&!isKdvTahakkukPdfText(text||'')){card.appendChild(el('div',{class:'hint warn'},'⚠️ PDF metninde “KATMA DEĞER VERGİSİ BEYANNAMESİ” ibaresi bulundu. Bu belge tahakkuk fişi değildir; KDV Beyannamesi alanına yükleyin.'));holder.appendChild(card);fail++;continue;}const parsed=parseKdvTahakkukPdfText(text||'');const chk=archiveEditVknCheck(parsed.vkn);const info=[['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DÖNEM',parsed.donem],['TAHAKKUK FİŞİNİN NUMARASI',parsed.tahakkukNo]];const t=el('table',{class:'editable-table'});info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});card.appendChild(t);card.appendChild(el('div',{class:'hint '+(chk.ok?'ok':'warn'),style:'margin-top:10px;'},chk.message));const btn=el('button',{class:'btn btn-primary',disabled:!chk.ok||!parsed.tahakkukNo||!parsed.donem},'✓ Onayla ve arşive aktar');btn.onclick=()=>{if(!chk.ok)return;const i=archiveEditParsed.kdvBeyanlari.findIndex(x=>x.donem===parsed.donem);if(i>=0)archiveEditParsed.kdvBeyanlari[i]={...archiveEditParsed.kdvBeyanlari[i],tahakkukNo:parsed.tahakkukNo};else archiveEditParsed.kdvBeyanlari.push({donem:parsed.donem,teslimBedel:'',ozelMatrah:'',kdvMatrahi:'',hesaplananKdv:'',ilaveKdv:'',toplamKdv:'',indirimler:'',odenecekKdv:'',devredenKdv:'',tahakkukNo:parsed.tahakkukNo});btn.disabled=true;btn.textContent='✓ Arşive aktarıldı';refresh();card.appendChild(el('div',{class:'hint ok'},`✓ ${parsed.donem} tahakkuk numarası arşive aktarıldı.`));};card.appendChild(el('div',{style:'margin-top:10px;'},[btn]));holder.appendChild(card);ok++;}catch(err){fail++;card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}}holder.insertBefore(el('div',{class:'hint '+(fail?'warn':'ok'),style:'margin-bottom:8px;'},`Tahakkuk toplu işlem: ${ok} dosya işlendi${fail?`, ${fail} dosya okunamadı`:''}.`),holder.firstChild);}});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditMuavin(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});wrap.appendChild(el('h3',{},'📑 Muavin Defter — Arşiv Tedarikçi Faturalarıyla Kontrol'));wrap.appendChild(el('div',{class:'hint info'},'Muavin PDF çoklu yüklenebilir. Muavin belgesinin kendi yapısında VKN bulunmadığı için burada firma kimlik numarası kontrolü uygulanamaz. Fatura numarası ve tarih üzerinden arşivdeki tedarikçi kayıtlarıyla eşleştirme yapılır; yalnızca eşleşen kayıtlarda eksik fatura tarihi/numarası doldurulabilir.'));
  const preview=el('div');fileUploadBox(wrap,{accept:'.pdf',hint:'Muavin Defter PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{preview.innerHTML='';const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});preview.appendChild(holder);let total=0,matched=0;for(const file of files){markFileChip(box,file.name,true);const card=el('div',{class:'card'});card.appendChild(el('h4',{},`Kontrol edilen Muavin — ${file.name}`));try{const rows=await parseMuavinPdfText(await extractPdfText(file));total+=rows.length;const found=[];rows.forEach(m=>{const desc=muavinNormalizeNo(m.aciklama||'');const candidates=(archiveEditParsed.tedarikciler||[]).filter(t=>{const no=muavinNormalizeNo(t.faturaNo||'');return no&&desc.includes(no);});if(candidates.length===1){const t=candidates[0];if(!t.faturaTarihi&&m.tarih)t.faturaTarihi=m.tarih;found.push({no:t.faturaNo,date:m.tarih});matched++;}});card.appendChild(el('div',{class:'hint '+(found.length?'ok':'info')},`${rows.length} muavin satırı okundu; ${found.length} tedarikçi kaydı eşleşti.`));if(found.length)card.appendChild(el('pre',{class:'raw-text'},found.map(x=>`${x.no} — ${x.date}`).join('\n')));holder.appendChild(card);refresh();}catch(err){card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}}holder.insertBefore(el('div',{class:'hint info'},`Muavin toplamı: ${total} satır okundu, ${matched} arşiv tedarikçi kaydı eşleşti.`),holder.firstChild);}});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditTedarikciKdvList(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📎 İndirilecek KDV Listesi — Her Dönem İçin En Yüksek Matrahlı 10 Fatura'));
  wrap.appendChild(el('div',{class:'hint info'},'Yüklenen Excel birden fazla dönemi içerebilir. Sistem her ayı ayrı değerlendirir ve her ay için KDV hariç matrahı en yüksek 10 faturayı tespit eder. Dönem kontrolü yapılmaz; bu bölümde ana mükellef için belge dönemi kontrolü uygulanmaz.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.xlsx,.xlsm,.xls',hint:'İndirilecek KDV listesi Excel — .xlsx / .xlsm / .xls',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML='';
    const allRows=[]; const errors=[];
    for(const file of files){
      markFileChip(box,file.name);
      try{ allRows.push(...await parseTedarikciExcel(file)); }
      catch(e){ errors.push(`${file.name}: ${e.message}`); }
    }
    errors.forEach(msg=>preview.appendChild(el('div',{class:'hint warn',style:'margin-top:8px;'},`⚠️ ${msg}`)));
    if(!allRows.length)return;
    const monthGroups=new Map();
    allRows.forEach(item=>{const key=invoiceMonthKey(item.faturaTarihi)||`__BELIRSIZ__${item.faturaTarihi||''}`;if(!monthGroups.has(key))monthGroups.set(key,[]);monthGroups.get(key).push(item);});
    const topRows=[]; const monthSummaries=[];
    [...monthGroups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([key,items])=>{
      items.sort((a,b)=>parseMoneyNumber(b.faturaMatrahi)-parseMoneyNumber(a.faturaMatrahi));
      const top=items.slice(0,10); topRows.push(...top); monthSummaries.push(`${invoiceMonthLabel(key.replace(/^__BELIRSIZ__.*/,''))}: ${top.length} fatura`);
    });
    const existing=archiveEditParsed.tedarikciler||[];
    const norm=v=>String(v??'').replace(/\D/g,'');
    const keyOf=x=>`${norm(x.vkn)}|${String(x.faturaTarihi||'').trim()}|${String(x.faturaNo||'').trim()}`;
    const seen=new Set(existing.map(keyOf)); let added=0,dupes=0;
    topRows.forEach(x=>{const k=keyOf(x);if(seen.has(k)){dupes++;return;}seen.add(k);archiveEditParsed.tedarikciler.push(x);added++;});
    refresh();
    preview.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${files.length} dosya işlendi. ${monthSummaries.join(' • ')}. Toplam ${topRows.length} dönemsel yüksek matrah faturası tespit edildi, ${added} yeni kayıt arşiv düzenleme alanına aktarıldı.`));
    preview.appendChild(el('div',{class:'hint warn',style:'margin-top:8px;'},'⚠️ Yüklediğiniz dosyanın ve bilgilerin doğruluğunu teyit edin'));
    preview.appendChild(el('div',{class:dupes?'hint warn':'hint ok',style:'margin-top:8px;'},dupes?`⚠️ Mükerrer kontrolü: ${dupes} kayıt mevcut arşivde bulunduğu için tekrar eklenmedi.`:'✓ Mükerrer kontrolü: mevcut arşivde aynı fatura bulunmadı.'));
  }});
  wrap.appendChild(preview); container.appendChild(wrap);
}


function renderArchiveEditTools(content,refresh){
  const toolsCard=el('div',{class:'card',style:'margin-top:14px;'});
  toolsCard.appendChild(el('h3',{},'2. Arşive Veri Yükleme Araçları'));
  toolsCard.appendChild(el('div',{class:'hint info'},'Her belge ayrı kontrol edilir ve yalnızca onay verdiğiniz kayıt arşive yazılır. Dönemler serbesttir; farklı bir dönem geldiğinde kayıt engellenmez. Firma kimlik numarası kontrolleri korunur.'));
  content.appendChild(toolsCard);
  renderArchiveEditEberat(content,refresh);
  renderArchiveEditKdv(content,refresh);
  renderArchiveEditTahakkuk(content,refresh);
  renderArchiveEditTedarikciKdvList(content,refresh);
}


function renderArchiveEditPage(){
  const parsed=requireSharedArchive('Arşiv Düzenle'); if(!parsed)return;
  currentPage='archive-edit';archiveMenuOpen=true;currentStep=-1;syncSharedArchiveRefs(parsed);
  const content=document.getElementById('step-content');content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Arşiv Düzenle'));
  content.appendChild(el('p',{class:'step-desc'},`Yüklenen arşiv: ${state.existingArchiveFile?.name||'—'}. Aynı arşiv verileri üzerinde düzenleme yapın. Arşiv dosyası bu sayfada tekrar yüklenmez.`));
  const work=el('div');renderArchiveEditRefresh(work);content.appendChild(work);
  const save=el('div',{class:'card',style:'margin-top:14px;'});
  save.appendChild(el('h3',{},'Güncel Arşivi İndir'));
  save.appendChild(el('div',{class:'hint info'},'Yaptığınız düzenlemeler ortak arşiv çalışma alanında tutulur. İndirme sırasında mevcut fatura bölümü ana arşive eklenmez; arşiv yapısı yıllık sekmeler halinde yeniden oluşturulur.'));
  save.appendChild(el('button',{class:'btn btn-primary',onclick:async()=>{try{const wb=buildArchiveWorkbook(parsed);const unvan=String(parsed.mukellef?.unvan||'MUKELLEF').replace(/[^\p{L}\p{N}]+/gu,'_').slice(0,80);await downloadWorkbook(wb,`Güncel_Arşiv_${unvan||'MUKELLEF'}.xlsx`);save.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},'✓ Güncel arşiv oluşturuldu ve indirilmeye başlandı.'));}catch(err){save.appendChild(el('div',{class:'hint warn',style:'margin-top:8px;'},`⚠️ Arşiv oluşturulamadı: ${err.message}`));}}},'⬇ Güncel Arşiv Dosyası İndir'));
  content.appendChild(save);
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='Arşiv Düzenle';document.getElementById('footer-msg').textContent='Arşiv Düzenle';renderNav();
}


function renderArchiveDataImportPage(){
  const parsed=requireSharedArchive('Dosyadan Veri Al'); if(!parsed)return;
  currentPage='archive-data-import';archiveMenuOpen=true;currentStep=-1;syncSharedArchiveRefs(parsed);
  const content=document.getElementById('step-content');content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Dosyadan Veri Al'));
  content.appendChild(el('p',{class:'step-desc'},`Yüklenen arşiv: ${state.existingArchiveFile?.name||'—'}. Aşağıdaki araçlar Arşiv Düzenle bölümündeki “2. Arşive Veri Yükleme Araçları” alanından alınmıştır. Arşiv dosyası burada tekrar yüklenmez; onaylanan kayıtlar aynı ortak arşive aktarılır.`));
  const host=el('div');
  const refresh=()=>{host.innerHTML='';if(state.existingArchiveParsed){syncSharedArchiveRefs(state.existingArchiveParsed);renderArchiveEditTools(host,refresh);}};
  refresh();content.appendChild(host);
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='Dosyadan Veri Al';document.getElementById('footer-msg').textContent='Dosyadan Veri Al';renderNav();
}


function normalizeExcelHeader(v){
  return String(v ?? '').replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR');
}


function excelCellText(v){
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return fmtDate(v);
  if (typeof v === 'object' && v.result !== undefined) return String(v.result ?? '').trim();
  return String(v).trim();
}


function parseMoneyNumber(v){
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const raw=String(v ?? '').trim().replace(/\s/g,'');
  if(!raw) return NaN;
  // Excel'den gelen Türkçe biçim (10.271,78) veya ham ondalık biçim (10271.78).
  let t=raw;
  if(/^-?\d+\.\d{1,2}$/.test(t) && !t.includes(',')){
    // Nokta ondalık ayırıcı olarak kullanılmışsa doğrudan sayıya çevir.
    const n=Number(t);
    if(Number.isFinite(n)) return n;
  }
  t=t.replace(/\./g,'').replace(',', '.');
  const n=Number(t);
  return Number.isFinite(n) ? n : NaN;
}


function formatMoneyTR(v){
  const n=parseMoneyNumber(v);
  if(!Number.isFinite(n)) return String(v ?? '').trim();
  return n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
}


function invoiceMonthKey(value){
  const raw=String(value??'').trim();
  if(!raw) return '';
  let m=raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}`;
  m=raw.match(/^(\d{4})[.\/-](\d{1,2})(?:[.\/-]\d{1,2})?/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}`;
  return '';
}


function invoiceMonthLabel(key){
  const m=String(key||'').match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}.${m[1]}` : (key||'Dönem Belirtilmemiş');
}


async function parseTedarikciExcel(file){
  const name=file.name.toLowerCase();
  if(name.endsWith('.xls')){
    throw new Error('Bu liste eski .xls formatında. Tarayıcıdaki mevcut Excel okuyucu .xls dosyasını doğrudan açamıyor. Aynı dosyayı Excel/LibreOffice ile .xlsx olarak kaydedip tekrar yükleyin.');
  }
  const buf=await file.arrayBuffer();
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  let best=wb.worksheets[0];
  wb.worksheets.forEach(ws=>{if(ws.rowCount>(best?.rowCount||0))best=ws;});
  if(!best) throw new Error('Excel çalışma sayfası bulunamadı.');
  const rows=[];
  for(let r=1;r<=best.rowCount;r++){
    const arr=[];
    const row=best.getRow(r);
    for(let c=1;c<=18;c++) arr.push(excelCellText(row.getCell(c).value));
    rows.push(arr);
  }
  const headerIdx=rows.findIndex(r=>r.some(x=>/Alış Faturasının Tarihi/i.test(x)) && r.some(x=>/KDV Hariç Tutar/i.test(x)));
  if(headerIdx<0) throw new Error('İndirilecek KDV listesi başlık satırı bulunamadı.');
  const headers=rows[headerIdx].map(normalizeExcelHeader);
  const idx={
    tarih:headers.findIndex(x=>x.includes('ALIŞ FATURASININ TARİHİ')),
    seri:headers.findIndex(x=>x.includes('ALIŞ FATURASININ SERİSİ')),
    no:headers.findIndex(x=>x.includes("ALIŞ FATURASININ SIRA NO")),
    ad:headers.findIndex(x=>x.includes('SATICININ ADI-SOYADI')||x.includes('SATICININ ADI SOYADI')),
    vkn:headers.findIndex(x=>x.includes('SATICININ VERGİ KİMLİK NUMARASI')||x.includes('SATICININ VERGİ KİMLİK NUMARASI / TC')),
    matrah:headers.findIndex(x=>x.includes('KDV HARİÇ TUTAR')),
    kdv:headers.findIndex(x=>x === "KDV'Sİ" || x.includes("KDV'Sİ"))
  };
  if(idx.tarih<0||idx.no<0||idx.ad<0||idx.vkn<0||idx.matrah<0||idx.kdv<0) throw new Error('Gerekli fatura sütunlarından biri bulunamadı.');
  const data=[];
  for(let i=headerIdx+1;i<rows.length;i++){
    const r=rows[i];
    const mat=parseMoneyNumber(r[idx.matrah]);
    const no=String(r[idx.no]||'').trim();
    const ad=String(r[idx.ad]||'').trim();
    if(!no && !ad) continue;
    if(!Number.isFinite(mat)) continue;
    const faturaTarihi=String(r[idx.tarih]||'').trim();
    data.push({
      _matrah:mat,
      _donem:invoiceMonthKey(faturaTarihi),
      adSoyad:ad, vkn:String(r[idx.vkn]||'').trim(), vergiDairesi:'',
      faturaTarihi,
      faturaSeri:idx.seri>=0?String(r[idx.seri]||'').trim():'',
      faturaNo:no,
      faturaMatrahi:formatMoneyTR(r[idx.matrah]),
      faturaKdv:formatMoneyTR(r[idx.kdv]),
      gumrukTarihi:'', gumrukTescilNo:''
    });
  }
  // Liste birden fazla dönemi içerebilir. Her ay için o ayın matrahı en yüksek 10 faturası alınır.
  const byMonth=new Map();
  data.forEach(item=>{
    const key=item._donem||`__BELIRSIZ__${item.faturaTarihi||''}`;
    if(!byMonth.has(key)) byMonth.set(key,[]);
    byMonth.get(key).push(item);
  });
  const selected=[];
  [...byMonth.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([key,items])=>{
    items.sort((a,b)=>b._matrah-a._matrah);
    selected.push(...items.slice(0,10));
  });
  return selected.map(({_matrah,_donem,...x})=>x);
}


function renderTedarikciExcelImport(container, rerender){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📎 İndirilecek KDV Listesi — Her Dönem İçin En Yüksek Matrahlı 10 Fatura'));
  wrap.appendChild(el('div',{class:'hint info'},'Yüklediğiniz Excel birden fazla dönemi içerebilir. Sistem fatura tarihinin ayını esas alarak her ayı ayrı değerlendirir ve her ay için KDV hariç matrahı en yüksek 10 faturayı tespit eder. Aynı ay birden fazla yüklenen dosyada bulunuyorsa, dosyalar birlikte değerlendirilir.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.xlsx,.xlsm,.xls',hint:'İndirilecek KDV listesi Excel — .xlsx / .xlsm',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML='';
    const allRows=[];
    const errors=[];
    for(const file of files){
      markFileChip(box,file.name);
      try{
        const rows=await parseTedarikciExcel(file);
        allRows.push(...rows);
      }catch(e){
        errors.push(`${file.name}: ${e.message}`);
      }
    }
    if(errors.length){
      errors.forEach(msg=>preview.appendChild(el('div',{class:'hint warn',style:'margin-top:8px;'},`⚠️ ${msg}`)));
    }
    if(!allRows.length) return;

    // Birden fazla dosya yüklenirse aynı aylar tek havuzda birleştirilir ve
    // her ay için nihai en yüksek 10 kayıt burada belirlenir.
    const monthGroups=new Map();
    allRows.forEach(item=>{
      const key=invoiceMonthKey(item.faturaTarihi)||`__BELIRSIZ__${item.faturaTarihi||''}`;
      if(!monthGroups.has(key)) monthGroups.set(key,[]);
      monthGroups.get(key).push(item);
    });
    const topRows=[];
    const monthSummaries=[];
    [...monthGroups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([key,items])=>{
      items.sort((a,b)=>parseMoneyNumber(b.faturaMatrahi)-parseMoneyNumber(a.faturaMatrahi));
      const top=items.slice(0,10);
      topRows.push(...top);
      monthSummaries.push(`${invoiceMonthLabel(key.replace(/^__BELIRSIZ__.*/,''))}: ${top.length} fatura`);
    });

    const duplicates=checkTedarikciDuplicates(topRows);
    const duplicateKeys=new Set(duplicates.map(d=>tedarikciInvoiceKey(d.item)));
    let added=0;
    topRows.forEach(x=>{
      const key=tedarikciInvoiceKey(x);
      if(duplicateKeys.has(key)) return;
      state.tedarikciler.push(x); added++;
    });
    rerender();
    preview.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${files.length} dosya işlendi. ${monthSummaries.join(' • ')}. Toplam ${topRows.length} dönemsel yüksek matrah faturası tespit edildi, ${added} yeni kayıt tabloya aktarıldı.`));
    preview.appendChild(el('div',{class:'hint warn',style:'margin-top:8px;'},'⚠️ Yüklediğiniz dosyanın ve bilgilerin doğruluğunu teyit edin'));
    if(duplicates.length){
      const lines=duplicates.slice(0,10).map(d=>`• ${d.item.faturaNo||'Fatura no yok'} — ${d.item.adSoyad||'Tedarikçi adı yok'} (${d.reason})`).join('<br>');
      preview.appendChild(el('div',{class:'hint warn',style:'margin-top:8px;'},`⚠️ Mükerrer fatura kontrolü: ${duplicates.length} kayıt zaten mevcut veya aynı yüklemede tekrar ediyor. Bu kayıtlar tekrar eklenmedi.<br>${lines}`));
    } else {
      preview.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},'✓ Mükerrer fatura kontrolü: mükerrer kayıt bulunmadı.'));
    }
  }});
  wrap.appendChild(preview);
  const archiveBtn=el('button',{class:'btn btn-secondary',style:'margin-top:10px;',onclick:async()=>{
    if(!state.tedarikciler.length){alert('Arşive aktarılacak tedarikçi kaydı bulunmuyor.');return;}
    try{const f=await buildTedarikciArchiveWorkbook(state);await downloadBlob(f.blob,f.name);}catch(e){alert('Tedarikçi arşiv çalışma kitabı oluşturulamadı: '+e.message);}
  }},'⬇ Tedarikçi Arşiv Çalışma Kitabını Oluştur');
  wrap.appendChild(archiveBtn);
  container.appendChild(wrap);
}


