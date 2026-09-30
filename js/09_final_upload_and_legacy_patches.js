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
  if(parsed) state.existingArchiveParsed=parsed;
}

// Arşiv Düzenle / Dosyadan Veri Al ekranlarında yapılan onayları tek ortak
// çalışma alanına yazar. Böylece buton sonrası yeniden çizim veya sayfa
// değişimi olsa bile kayıt kaybolmaz.
function commitArchiveEditState(){
  if(!archiveEditParsed) return false;
  state.existingArchiveParsed=archiveEditParsed;
  archiveViewParsed=archiveEditParsed;
  syncSharedArchiveRefs(archiveEditParsed);
  return true;
}


function renderArchiveUploadPage(){
  currentPage='archive-upload';archiveMenuOpen=true;currentStep=-1;
  const content=document.getElementById('step-content');content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Arşiv Dosyası Yükle / Oluştur'));
  content.appendChild(el('p',{class:'step-desc'},'Mevcut arşiv dosyanızı yükleyebilir veya yeni, boş ve doldurulabilir bir arşiv dosyası oluşturabilirsiniz. Arşiv bir kez yüklendikten/oluşturulduktan sonra Arşiv Görüntüle, Arşiv Düzenle ve Dosyadan Veri Al bağlantıları aynı arşiv verisini otomatik kullanır.'));
  const userCard=el('div',{class:'card'});
  userCard.appendChild(el('h3',{},'👤 Kullanıcı Klasöründen Arşiv Al'));
  userCard.appendChild(el('div',{class:'hint info'},'Kullanıcı İşlemleri bölümünde seçilmiş klasör varsa, klasörde taranan arşiv Excel dosyalarını burada seçerek mevcut arşiv olarak yükleyebilirsiniz.'));
  const userArchiveList=el('div',{style:'margin-top:10px;'});
  const renderUserArchiveChoices=()=>{
    userArchiveList.innerHTML='';
    if(!userStore.directoryHandle){
      userArchiveList.appendChild(el('div',{class:'hint info'},'Önce Kullanıcı İşlemleri → Kullanıcı / Kullanıcı Dosyası Oluştur bölümünden bir kullanıcı klasörü seçin.'));
      return;
    }
    const knownArchivePaths=new Set((userStore.firms||[]).flatMap(f=>f.files||[]));
    const archiveFiles=(userStore.files||[]).filter(x=>knownArchivePaths.has(x.relativePath)&&/\.(xlsx|xlsm)$/i.test(String(x.name||'')));
    if(!archiveFiles.length){
      userArchiveList.appendChild(el('div',{class:'hint warn'},'Seçili kullanıcı klasöründe tanınan Excel arşiv dosyası bulunamadı.'));
      return;
    }
    archiveFiles.forEach(item=>{
      const row=el('div',{style:'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);'});
      row.appendChild(el('div',{style:'min-width:0;'},[
        el('div',{style:'font-weight:600;word-break:break-word;'},item.relativePath||item.name),
        el('div',{class:'hint',style:'margin-top:2px;'},'Kullanıcı klasöründeki arşiv Excel’i')
      ]));
      row.appendChild(el('button',{class:'btn btn-secondary',onclick:async()=>{
        try{
          const file=await userLoadArchiveFromPath(item.relativePath);
          const parsed=await readArchiveUpload(file);
          state.existingArchiveParsed=parsed;
          state.existingArchiveFile={name:file.name,source:'user-folder',relativePath:item.relativePath};
          syncSharedArchiveRefs(parsed);
          archiveToState(parsed);
          status.innerHTML='';
          markFileChip(box,file.name,true);
          const m=parsed.mukellef||{};
          status.appendChild(el('div',{class:'hint ok'},`✓ Kullanıcı klasöründen arşiv yüklendi: ${item.relativePath}`));
          status.appendChild(el('div',{class:'hint info',style:'margin-top:6px;'},`Mükellef: ${m.unvan||'—'} | Firma kimlik numarası: ${m.vkn||'—'}`));
          status.appendChild(el('div',{class:'hint ok',style:'margin-top:6px;'},'✓ Bu arşiv artık Arşiv Görüntüle, Arşiv Düzenle ve Dosyadan Veri Al bağlantılarında kullanılacaktır.'));
          renderNav();
        }catch(err){
          status.appendChild(el('div',{class:'hint warn',style:'margin-top:6px;'},`⚠️ Kullanıcı klasöründeki arşiv okunamadı: ${err.message}`));
        }
      }},'📂 Arşivi Al'));
      userArchiveList.appendChild(row);
    });
  };
  const refreshUserArchives=el('button',{class:'btn btn-secondary',onclick:async()=>{
    try{await userScanCurrentFolder();renderUserArchiveChoices();}catch(e){alert('Kullanıcı klasörü taranamadı: '+e.message);}
  }},'↻ Kullanıcı Klasörünü Yenile');
  userCard.appendChild(refreshUserArchives);
  userCard.appendChild(userArchiveList);
  content.appendChild(userCard);
  renderUserArchiveChoices();

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
        const btn=el('button',{class:'btn btn-primary',disabled:!chk.ok||!row.nevi||!row.baslangic||!row.bitis||!row.tasdikNo||!row.tasdikTarihi},'✓ Onayla ve arşive ekle');btn.onclick=()=>{if(!chk.ok)return;const clean={...row};delete clean._eberat;delete clean._deadline;archiveEditMergeRow(archiveEditParsed.defterler,clean,x=>(x.nevi||'')+'|'+(x.baslangic||'')+'|'+(x.bitis||'')+'|'+(x.tasdikNo||''));commitArchiveEditState();btn.disabled=true;btn.textContent='✓ Arşive eklendi';card.appendChild(el('div',{class:'hint ok'},'✓ e-Berat kaydı arşive aktarıldı ve ortak arşiv çalışma alanına kaydedildi.'));};
        card.appendChild(el('div',{style:'margin-top:10px;'},[btn]));holder.appendChild(card);ok++;
      }catch(err){fail++;card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}
    }
    holder.insertBefore(el('div',{class:'hint '+(fail?'warn':'ok'),style:'margin-bottom:8px;'},`e-Berat toplu işlem: ${ok} dosya okundu${fail?`, ${fail} dosya okunamadı`:''}.`),holder.firstChild);
  }});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditKdv(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});wrap.appendChild(el('h3',{},'📊 KDV Beyannamesi — Arşive Aktar'));wrap.appendChild(el('div',{class:'hint info'},'KDV beyannamelerini çoklu yükleyin. Dönem kontrolü yapılmaz; yalnızca firma kimlik numarası kontrol edilir. Belgedeki dönem, arşivdeki aynı dönem kaydını günceller veya yeni kayıt oluşturur.'));
  const preview=el('div');fileUploadBox(wrap,{accept:'.pdf',hint:'KDV Beyannamesi PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{preview.innerHTML='';const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});preview.appendChild(holder);let ok=0,fail=0;for(const file of files){markFileChip(box,file.name,true);const card=el('div',{class:'card'});card.appendChild(el('h4',{},`Kontrol edilen KDV Beyannamesi — ${file.name}`));try{const text=await extractPdfText(file);if(isKdvTahakkukPdfText(text||'')){card.appendChild(el('div',{class:'hint warn'},'⚠️ PDF metninde “TAHAKKUK FİŞİ” ibaresi bulundu. Bu belge KDV Beyannamesi değildir; aşağıdaki tahakkuk alanına yükleyin.'));holder.appendChild(card);fail++;continue;}const parsed=parseKdvBeyannamePdf(text||'');const chk=archiveEditVknCheck(parsed.vkn);const required=[['Teslim ve Hizmet Karşılığını Teşkil Eden Bedel','teslimBedel'],['KDV Matrahı','kdvMatrahi'],['Hesaplanan KDV','hesaplananKdv'],['İlave Edilecek KDV','ilaveKdv'],['Toplam KDV','toplamKdv'],['İndirimler Toplamı','indirimler'],['Ödenmesi Gereken KDV','odenecekKdv'],['Sonraki Döneme Devreden KDV','devredenKdv']];const missing=required.filter(([,k])=>!parsed[k]).map(x=>x[0]);if(missing.length) card.appendChild(el('div',{class:'hint warn'},'Okunamayan alanlar: '+missing.join(', ')));const info=[['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DÖNEM',parsed.donem],...required.map(([l,k])=>[l,parsed[k]]),['TAHAKKUK FİŞİNİN NUMARASI',parsed.tahakkukNo]];const t=el('table',{class:'editable-table'});info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});card.appendChild(t);card.appendChild(el('div',{class:'hint '+(chk.ok?'ok':'warn'),style:'margin-top:10px;'},chk.message));const btn=el('button',{class:'btn btn-primary',disabled:!chk.ok||!parsed.donem},'✓ Onayla ve arşive ekle');btn.onclick=()=>{if(!chk.ok)return;const row={donem:parsed.donem,teslimBedel:parsed.teslimBedel,ozelMatrah:parsed.ozelMatrah,kdvMatrahi:parsed.kdvMatrahi,hesaplananKdv:parsed.hesaplananKdv,ilaveKdv:parsed.ilaveKdv,toplamKdv:parsed.toplamKdv,indirimler:parsed.indirimler,odenecekKdv:parsed.odenecekKdv,devredenKdv:parsed.devredenKdv,tahakkukNo:parsed.tahakkukNo};archiveEditMergeRow(archiveEditParsed.kdvBeyanlari,row,x=>(x.donem||''));commitArchiveEditState();btn.disabled=true;btn.textContent='✓ Arşive eklendi';card.appendChild(el('div',{class:'hint ok'},`✓ \${parsed.donem} KDV kaydı arşive aktarıldı ve ortak arşiv çalışma alanına kaydedildi.`));};card.appendChild(el('div',{style:'margin-top:10px;'},[btn]));holder.appendChild(card);ok++;}catch(err){fail++;card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}}holder.insertBefore(el('div',{class:'hint '+(fail?'warn':'ok'),style:'margin-bottom:8px;'},`KDV toplu işlem: ${ok} dosya işlendi${fail?`, ${fail} dosya okunamadı`:''}.`),holder.firstChild);}});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditTahakkuk(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});wrap.appendChild(el('h3',{},'📎 KDV Tahakkuk Fişi — Arşive Aktar'));wrap.appendChild(el('div',{class:'hint info'},'Tahakkuk fişlerini çoklu yükleyin. Dönem kontrolü yapılmaz; yalnızca firma kimlik numarası kontrol edilir. Tahakkuk numarası, aynı dönem KDV kaydı varsa ona işlenir; yoksa dönem ve tahakkuk numarasıyla yeni KDV arşiv kaydı oluşturulur.'));
  const preview=el('div');fileUploadBox(wrap,{accept:'.pdf',hint:'KDV Tahakkuk Fişi PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{preview.innerHTML='';const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});preview.appendChild(holder);let ok=0,fail=0;for(const file of files){markFileChip(box,file.name,true);const card=el('div',{class:'card'});card.appendChild(el('h4',{},`Kontrol edilen KDV Tahakkuk Fişi — ${file.name}`));try{const text=await extractPdfText(file);if(isKdvBeyannamePdfText(text||'')&&!isKdvTahakkukPdfText(text||'')){card.appendChild(el('div',{class:'hint warn'},'⚠️ PDF metninde “KATMA DEĞER VERGİSİ BEYANNAMESİ” ibaresi bulundu. Bu belge tahakkuk fişi değildir; KDV Beyannamesi alanına yükleyin.'));holder.appendChild(card);fail++;continue;}const parsed=parseKdvTahakkukPdfText(text||'');const chk=archiveEditVknCheck(parsed.vkn);const info=[['VKN',parsed.vkn],['UNVAN',parsed.unvan],['DÖNEM',parsed.donem],['TAHAKKUK FİŞİNİN NUMARASI',parsed.tahakkukNo]];const t=el('table',{class:'editable-table'});info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},b||'—'));t.appendChild(tr);});card.appendChild(t);card.appendChild(el('div',{class:'hint '+(chk.ok?'ok':'warn'),style:'margin-top:10px;'},chk.message));const btn=el('button',{class:'btn btn-primary',disabled:!chk.ok||!parsed.tahakkukNo||!parsed.donem},'✓ Onayla ve arşive aktar');btn.onclick=()=>{if(!chk.ok)return;const i=archiveEditParsed.kdvBeyanlari.findIndex(x=>x.donem===parsed.donem);if(i>=0)archiveEditParsed.kdvBeyanlari[i]={...archiveEditParsed.kdvBeyanlari[i],tahakkukNo:parsed.tahakkukNo};else archiveEditParsed.kdvBeyanlari.push({donem:parsed.donem,teslimBedel:'',ozelMatrah:'',kdvMatrahi:'',hesaplananKdv:'',ilaveKdv:'',toplamKdv:'',indirimler:'',odenecekKdv:'',devredenKdv:'',tahakkukNo:parsed.tahakkukNo});commitArchiveEditState();btn.disabled=true;btn.textContent='✓ Arşive aktarıldı';card.appendChild(el('div',{class:'hint ok'},`✓ \${parsed.donem} tahakkuk numarası arşive aktarıldı ve ortak arşiv çalışma alanına kaydedildi.`));};card.appendChild(el('div',{style:'margin-top:10px;'},[btn]));holder.appendChild(card);ok++;}catch(err){fail++;card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}}holder.insertBefore(el('div',{class:'hint '+(fail?'warn':'ok'),style:'margin-bottom:8px;'},`Tahakkuk toplu işlem: ${ok} dosya işlendi${fail?`, ${fail} dosya okunamadı`:''}.`),holder.firstChild);}});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditMuavin(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});wrap.appendChild(el('h3',{},'📑 Muavin Defter — Arşiv Tedarikçi Faturalarıyla Kontrol'));wrap.appendChild(el('div',{class:'hint info'},'Muavin PDF çoklu yüklenebilir. Muavin belgesinin kendi yapısında VKN bulunmadığı için burada firma kimlik numarası kontrolü uygulanamaz. Fatura numarası ve tarih üzerinden arşivdeki tedarikçi kayıtlarıyla eşleştirme yapılır; yalnızca eşleşen kayıtlarda eksik fatura tarihi/numarası doldurulabilir.'));
  const preview=el('div');fileUploadBox(wrap,{accept:'.pdf',hint:'Muavin Defter PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{preview.innerHTML='';const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'});preview.appendChild(holder);let total=0,matched=0;for(const file of files){markFileChip(box,file.name,true);const card=el('div',{class:'card'});card.appendChild(el('h4',{},`Kontrol edilen Muavin — ${file.name}`));try{const rows=await parseMuavinPdfText(await extractPdfText(file));total+=rows.length;const found=[];rows.forEach(m=>{const desc=muavinNormalizeNo(m.aciklama||'');const candidates=(archiveEditParsed.tedarikciler||[]).filter(t=>{const no=muavinNormalizeNo(t.faturaNo||'');return no&&desc.includes(no);});if(candidates.length===1){const t=candidates[0];if(!t.faturaTarihi&&m.tarih)t.faturaTarihi=m.tarih;found.push({no:t.faturaNo,date:m.tarih});matched++;}});card.appendChild(el('div',{class:'hint '+(found.length?'ok':'info')},`${rows.length} muavin satırı okundu; ${found.length} tedarikçi kaydı eşleşti.`));if(found.length)card.appendChild(el('pre',{class:'raw-text'},found.map(x=>`${x.no} — ${x.date}`).join('\n')));holder.appendChild(card);refresh();}catch(err){card.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name} okunamadı: ${err.message}`));holder.appendChild(card);}}holder.insertBefore(el('div',{class:'hint info'},`Muavin toplamı: ${total} satır okundu, ${matched} arşiv tedarikçi kaydı eşleşti.`),holder.firstChild);}});wrap.appendChild(preview);container.appendChild(wrap);
}

function renderArchiveEditTedarikciKdvList(container,refresh){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📎 İndirilecek KDV Listesi — Her Dönem İçin En Yüksek Matrahlı 10 Fatura'));
  wrap.appendChild(el('div',{class:'hint info'},'Yüklenen Excel birden fazla dönemi içerebilir. Sistem her dönemi ayrı değerlendirir ve her dönem için KDV hariç matrahı en yüksek 10 faturayı, Arşivdeki 8. Tedarikçi Firmalar kayıtlarıyla VKN + fatura tarihi + fatura numarası üzerinden karşılaştırır. Tutar kontrolünde KDV hariç matrah + KDV ile arşivdeki kayıt tutarı karşılaştırılır.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.xlsx,.xlsm,.xls',hint:'İndirilecek KDV listesi Excel — .xlsx / .xlsm / .xls',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML='';
    const allRows=[];const errors=[];
    for(const file of files){markFileChip(box,file.name);try{allRows.push(...await parseTedarikciExcel(file));}catch(e){errors.push(`${file.name}: ${e.message}`);}}
    errors.forEach(msg=>preview.appendChild(el('div',{class:'hint warn',style:'margin-top:8px;'},`⚠️ ${msg}`)));
    if(!allRows.length)return;
    const monthGroups=new Map();
    allRows.forEach(item=>{const key=invoiceMonthKey(item.faturaTarihi)||`__BELIRSIZ__${item.faturaTarihi||''}`;if(!monthGroups.has(key))monthGroups.set(key,[]);monthGroups.get(key).push(item);});
    const topRows=[];const monthSummaries=[];
    [...monthGroups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([key,items])=>{items.sort((a,b)=>parseMoneyNumber(b.faturaMatrahi)-parseMoneyNumber(a.faturaMatrahi));const top=items.slice(0,10);topRows.push(...top);monthSummaries.push(`${invoiceMonthLabel(key.replace(/^__BELIRSIZ__.*/,''))}: ${top.length} fatura`);});
    const archiveRows=archiveEditParsed.tedarikciler||[];
    const comparisons=topRows.map(item=>({item,result:compareTedarikciKdvRow(item,archiveRows)}));
    const matched=comparisons.filter(x=>x.result.status==='matched');
    const amountDiff=comparisons.filter(x=>x.result.status==='amountdiff');
    const datediff=comparisons.filter(x=>x.result.status==='datediff');
    const nodiff=comparisons.filter(x=>x.result.status==='nodiff');
    const missing=comparisons.filter(x=>x.result.status==='missing');

    const table=el('table',{class:'editable-table'});
    const hr=el('tr');['Dönem','Tedarikçi','VKN','Fatura Tarihi','Fatura No','KDV Hariç','KDV','KDV Dahil','8. Tedarikçi Firmalar','Kontrol'].forEach(h=>hr.appendChild(el('th',{},h)));table.appendChild(hr);
    comparisons.forEach(({item,result})=>{
      const archive=result.archive;
      const statusText={matched:'✓ Eşleşti',amountdiff:'⚠️ Tutar farklı',datediff:'⚠️ Tarih farklı',nodiff:'⚠️ Fatura numarası farklı',missing:'＋ Arşivde yok'}[result.status]||result.status;
      const statusClass=result.status==='matched'?'hint ok':result.status==='missing'?'hint info':'hint warn';
      const vals=[invoiceMonthLabel(invoiceMonthKey(item.faturaTarihi)),item.adSoyad||'—',item.vkn||'—',item.faturaTarihi||'—',item.faturaNo||'—',item.faturaMatrahi||'—',item.faturaKdv||'—',item.kdvDahilTutar||'—',archive?(archive.adSoyad||'—')+' / '+(archive.faturaNo||'—'):'—'];
      const tr=el('tr');
      vals.forEach(v=>tr.appendChild(el('td',{},v)));
      tr.appendChild(el('td',{},[el('span',{class:statusClass},statusText)]));
      table.appendChild(tr);
    });
    const problemCount=missing.length+amountDiff.length+datediff.length+nodiff.length;
    preview.appendChild(el('div',{class:problemCount?'hint warn':'hint ok',style:'margin-top:8px;'},`✓ ${files.length} dosya işlendi. ${monthSummaries.join(' • ')}. Toplam ${topRows.length} yüksek matrah faturası karşılaştırıldı: ${matched.length} tam eşleşme, ${missing.length} arşivde yok, ${amountDiff.length} tutar farklı, ${datediff.length} tarih farklı, ${nodiff.length} fatura numarası farklı.`));
    preview.appendChild(table);

    const actions=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;'});
    if(missing.length){
      const addBtn=el('button',{class:'btn btn-primary'},`＋ Arşivde Olmayan ${missing.length} Faturayı 8. Tedarikçi Firmalara Ekle`);
      addBtn.onclick=()=>{
        let added=0;
        missing.forEach(({item})=>{const key=tedarikciInvoiceKey(item);if(archiveEditParsed.tedarikciler.some(x=>tedarikciInvoiceKey(x)===key))return;archiveEditParsed.tedarikciler.push({...item});added++;});
        commitArchiveEditState();refresh();addBtn.disabled=true;addBtn.textContent=`✓ ${added} fatura 8. Tedarikçi Firmalar'a eklendi`;
        preview.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${added} eksik fatura arşivdeki 8. Tedarikçi Firmalar bölümüne eklendi.`));
      };
      actions.appendChild(addBtn);
    }
    if(amountDiff.length) actions.appendChild(el('div',{class:'hint warn',style:'flex:1;min-width:280px;'},'⚠️ VKN, tarih ve fatura numarası eşleştiği halde tutarı farklı olan kayıtlar otomatik değiştirilmez; mevcut arşiv kaydı korunur.'));
    if(!missing.length) actions.appendChild(el('div',{class:'hint ok'},'✓ Top 10 listesindeki tüm faturalar 8. Tedarikçi Firmalar içinde karşılık buldu.'));
    preview.appendChild(actions);
  }});
  wrap.appendChild(preview);container.appendChild(wrap);
}


function renderArchiveEditMuhtasarControl(container){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📋 Muhtasar Beyanname — Çoklu Dosya Kontrolü'));
  wrap.appendChild(el('div',{class:'hint info'},'Birden fazla Muhtasar ve Prim Hizmet Beyannamesi PDF dosyasını aynı anda yükleyin. Sistem her belgeyi ayrı okur; VKN, dönem, vergi dairesi ve çalışan sayılarını gösterir. VKN arşiv mükellefiyle eşleşen ve gerekli alanları okunan belgelerde kontrolün altında “Arşive Ekle / Güncelle” düğmesi bulunur. Dönemin arşivde önceden bulunması şart değildir; yeni dönem eklenir, aynı dönem varsa işçi sayısı güncellenir.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.pdf',hint:'Muhtasar ve Prim Hizmet Beyannamesi PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{
    preview.innerHTML='';
    const holder=el('div',{style:'display:flex;flex-direction:column;gap:10px;'}); preview.appendChild(holder);
    const parsedFiles=[]; let ok=0,fail=0;
    for(const file of files){
      markFileChip(box,file.name,true);
      const card=el('div',{class:'card',style:'margin-top:4px;'});
      card.appendChild(el('h4',{},'Kontrol edilen Muhtasar Beyannamesi — '+file.name));
      try{
        const text=await extractPdfText(file); const raw=String(text||'');
        if(!/MUHTASAR\s+VE\s+PRİM\s+HİZMET\s+BEYANNAMESİ/i.test(raw)){ fail++; card.appendChild(el('div',{class:'hint warn'},'⚠️ Bu PDF Muhtasar ve Prim Hizmet Beyannamesi olarak tanınmadı.')); holder.appendChild(card); continue; }
        const parsed=parseMuhtasarPdfDetailed(raw); const chk=archiveEditVknCheck(parsed.vkn);
        parsedFiles.push({fileName:file.name,parsed,chk});
        const archiveRows=(archiveEditParsed.isciler||[]).filter(x=>String(x.donem||'').trim()===String(parsed.donem||'').trim());
        const archiveCounts=archiveRows.map(x=>Number(String(x.sayi??'').replace(/[^0-9-]/g,''))).filter(Number.isFinite);
        const archiveCount=archiveCounts.length?archiveCounts[archiveCounts.length-1]:null;
        const employeeOk=archiveCount!==null && archiveCount===Number(parsed.totalCount);
        const info=[['VKN',parsed.vkn],['ÜNVAN',parsed.unvan],['VERGİ DAİRESİ',parsed.vergiDairesi],['DÖNEM',parsed.donem],['ÇALIŞAN SAYISI',parsed.totalCount],['Gelir Vergisi Muaf/İstisna Sayısı',parsed.gelirMuafToplam],['SGK Muaf/İstisna Sayısı',parsed.sgkMuafToplam],['Okunan çalışan satırı',parsed.rows.length]];
        const t=el('table',{class:'editable-table'});
        info.forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},(b===0||b)?String(b):'—'));t.appendChild(tr);});
        card.appendChild(t);
        const checks=el('div',{style:'display:flex;flex-direction:column;gap:6px;margin-top:10px;'});
        checks.appendChild(el('div',{class:chk.ok?'hint ok':'hint warn'},chk.message));
        if(!parsed.donem) checks.appendChild(el('div',{class:'hint warn'},'⚠️ Beyanname dönemi okunamadı.'));
        if(!parsed.totalCount) checks.appendChild(el('div',{class:'hint warn'},'⚠️ Çalışan sayısı okunamadı.'));
        if(archiveCount===null) checks.appendChild(el('div',{class:'hint info'},'ℹ️ Bu dönem için arşivde Muhtasar/Çalışan kaydı bulunamadı.'));
        else checks.appendChild(el('div',{class:employeeOk?'hint ok':'hint warn'},employeeOk?'✓ Arşiv çalışan sayısı ile beyanname çalışan sayısı eşleşiyor: '+archiveCount:'⚠️ Arşiv çalışan sayısı: '+archiveCount+' — Beyanname çalışan sayısı: '+parsed.totalCount));
        card.appendChild(checks);

        const canArchiveAdd=chk.ok && !!String(parsed.donem||'').trim() && Number.isFinite(Number(parsed.totalCount)) && Number(parsed.totalCount)>0;
        const addBox=el('div',{style:'margin-top:12px;padding-top:10px;border-top:1px solid var(--border);'});
        const addButton=el('button',{class:'btn btn-primary',disabled:!canArchiveAdd},'➕ Arşive Ekle / Güncelle');
        const addStatus=el('div',{style:'margin-top:8px;'});
        addButton.onclick=()=>{
          if(!chk.ok){addStatus.innerHTML='';addStatus.appendChild(el('div',{class:'hint warn'},'⚠️ Firma kimlik numarası arşiv mükellefi ile eşleşmediği için kayıt eklenemez.'));return;}
          const donem=String(parsed.donem||'').trim();
          const sayi=Number(parsed.totalCount);
          if(!donem || !Number.isFinite(sayi) || sayi<=0){addStatus.innerHTML='';addStatus.appendChild(el('div',{class:'hint warn'},'⚠️ Arşive eklemek için beyanname dönemi ve çalışan sayısı okunmuş olmalıdır.'));return;}
          if(!Array.isArray(archiveEditParsed.isciler)) archiveEditParsed.isciler=[];
          const before=archiveEditParsed.isciler.find(x=>String(x.donem||'').trim()===donem);
          archiveEditMergeRow(archiveEditParsed.isciler,{donem,sayi:String(sayi),vergiDairesi:String(parsed.vergiDairesi||'').trim()},x=>String(x.donem||'').trim());
          commitArchiveEditState();
          addButton.disabled=true;
          addButton.textContent=before?'✓ Arşivdeki dönem güncellendi':'✓ Arşive eklendi';
          addStatus.innerHTML='';
          addStatus.appendChild(el('div',{class:'hint ok'},before
            ? `✓ ${donem} dönemi arşivdeki işçi sayısı ${sayi} olarak güncellendi.`
            : `✓ ${donem} dönemi için toplam ${sayi} işçi arşive eklendi.`));
        };
        addBox.appendChild(addButton);
        addBox.appendChild(addStatus);
        if(!chk.ok) addStatus.appendChild(el('div',{class:'hint warn'},'Firma kimlik numarası arşivle eşleşmeden arşive ekleme yapılamaz.'));
        else if(!String(parsed.donem||'').trim() || !Number(parsed.totalCount)) addStatus.appendChild(el('div',{class:'hint warn'},'Arşive eklemek için dönem ve çalışan sayısının okunması gerekir.'));
        else addStatus.appendChild(el('div',{class:'hint info'},'Bu işlemde dönem karşılaştırması yapılmaz. Beyannamedeki dönem, arşive doğrudan eklenir; aynı dönem varsa işçi sayısı güncellenir.'));
        card.appendChild(addBox);

        if(parsed.rows.length){
          const detail=el('details',{style:'margin-top:10px;'}); detail.appendChild(el('summary',{},'Çalışan grupları'));
          const rows=parsed.rows.map(r=>el('tr',{},[el('td',{},r.calisanBilgisi||'—'),el('td',{style:'text-align:right;'},String(r.toplamCalisanSayisi)),el('td',{style:'text-align:right;'},String(r.gelirMuafIstisnaSayisi)),el('td',{style:'text-align:right;'},String(r.sgkMuafIstisnaSayisi))]));
          detail.appendChild(controlTableShell(['Çalışan Bilgisi','Toplam Çalışan','GV Muaf/İstisna','SGK Muaf/İstisna'],rows)); card.appendChild(detail);
        }
        holder.appendChild(card); ok++;
      }catch(err){ fail++; card.appendChild(el('div',{class:'hint warn'},'⚠️ '+file.name+' okunamadı: '+err.message)); holder.appendChild(card); }
    }
    const byPeriod=new Map(); parsedFiles.forEach(x=>{const p=x.parsed.donem||'Dönem okunamadı';if(!byPeriod.has(p))byPeriod.set(p,[]);byPeriod.get(p).push(x);});
    const duplicatePeriods=[...byPeriod.entries()].filter(([,items])=>items.length>1).map(([p,items])=>p+': '+items.length+' dosya');
    holder.insertBefore(el('div',{class:duplicatePeriods.length?'hint warn':'hint ok',style:'margin-bottom:8px;'},'Muhtasar toplu kontrol: '+ok+' dosya okundu'+(fail?', '+fail+' dosya kontrol dışı bırakıldı':'')+'.'+(duplicatePeriods.length?' Aynı dönem için birden fazla dosya bulundu.':' Her dönem tek dosya olarak görünüyor.')),holder.firstChild);
    if(duplicatePeriods.length) holder.insertBefore(el('div',{class:'hint warn',style:'margin-bottom:8px;'},'⚠️ Mükerrer dönemler: '+duplicatePeriods.join(' • ')),holder.children[1]||null);
    if(parsedFiles.length){
      const rows=parsedFiles.map(x=>{const p=x.parsed;const ar=(archiveEditParsed.isciler||[]).find(r=>String(r.donem||'').trim()===String(p.donem||'').trim());const arCount=ar?Number(String(ar.sayi??'').replace(/[^0-9-]/g,'')):null;const same=arCount!==null&&arCount===Number(p.totalCount);return el('tr',{},[el('td',{},p.donem||'—'),el('td',{},p.vkn||'—'),el('td',{},p.vergiDairesi||'—'),el('td',{style:'text-align:right;'},p.totalCount?String(p.totalCount):'—'),el('td',{style:'text-align:right;'},arCount===null?'—':String(arCount)),el('td',{style:'text-align:center;font-weight:800;color:'+(arCount===null?'#6b7280':same?'#15803d':'#b91c1c')},arCount===null?'—':same?'✓':'✕')]);});
      const compare=controlCard('Toplu Kontrol Özeti','Beyanname çalışan sayısı ile arşivde aynı dönem için kayıtlı çalışan sayısı karşılaştırılır.');
      compare.appendChild(controlTableShell(['Dönem','VKN','Vergi Dairesi','Beyanname Çalışan','Arşiv Çalışan','Eşleşme'],rows)); holder.appendChild(compare);
    }
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
  renderArchiveEditMuhtasarControl(content);
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


function normalizeTedarikciVkn(value){
  const digits=String(value??'').replace(/\D/g,'');
  return digits ? digits.padStart(10,'0') : '';
}
function normalizeTedarikciInvoiceNo(value){
  return String(value??'').trim().replace(/\s+/g,'').toLocaleUpperCase('tr-TR');
}
function normalizeTedarikciDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  const raw=String(value??'').trim();
  let m=raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  m=raw.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  return raw;
}
function tedarikciInvoiceKey(x){
  return [normalizeTedarikciVkn(x.vkn),normalizeTedarikciDate(x.faturaTarihi),normalizeTedarikciInvoiceNo(x.faturaNo)].join('|');
}
function tedarikciArchiveTotal(x){
  const direct=parseMoneyNumber(x.kdvDahilTutar);
  if(Number.isFinite(direct)) return direct;
  const mat=parseMoneyNumber(x.faturaMatrahi);
  const kdv=parseMoneyNumber(x.faturaKdv);
  return Number.isFinite(mat)&&Number.isFinite(kdv) ? mat+kdv : NaN;
}
function compareTedarikciKdvRow(item,archiveRows){
  const exact=archiveRows.find(x=>tedarikciInvoiceKey(x)===tedarikciInvoiceKey(item));
  const expected=parseMoneyNumber(item.faturaMatrahi)+parseMoneyNumber(item.faturaKdv);
  if(exact){
    const archived=tedarikciArchiveTotal(exact);
    if(Number.isFinite(expected)&&Number.isFinite(archived)){
      const diff=Math.abs(expected-archived);
      return diff<0.01?{status:'matched',archive:exact,expected,archived,diff}:{status:'amountdiff',archive:exact,expected,archived,diff};
    }
    return {status:'matched',archive:exact,expected,archived:NaN,diff:NaN};
  }
  const sameNo=archiveRows.find(x=>normalizeTedarikciVkn(x.vkn)===normalizeTedarikciVkn(item.vkn)&&normalizeTedarikciInvoiceNo(x.faturaNo)===normalizeTedarikciInvoiceNo(item.faturaNo));
  if(sameNo) return {status:'datediff',archive:sameNo,expected,archived:tedarikciArchiveTotal(sameNo),diff:NaN};
  const sameDate=archiveRows.find(x=>normalizeTedarikciVkn(x.vkn)===normalizeTedarikciVkn(item.vkn)&&normalizeTedarikciDate(x.faturaTarihi)===normalizeTedarikciDate(item.faturaTarihi));
  if(sameDate) return {status:'nodiff',archive:sameDate,expected,archived:tedarikciArchiveTotal(sameDate),diff:NaN};
  return {status:'missing',archive:null,expected,archived:NaN,diff:NaN};
}
async function parseTedarikciExcel(file){
  const name=String(file.name||'').toLowerCase();
  let rows=[];
  if(name.endsWith('.xls')){
    if(typeof XLSX==='undefined') throw new Error('Eski .xls dosyaları için Excel okuyucu yüklenemedi.');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const sheet=wb.Sheets[wb.SheetNames[0]];
    if(!sheet) throw new Error('Excel çalışma sayfası bulunamadı.');
    rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
  }else{
    const buf=await file.arrayBuffer();
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    let best=wb.worksheets[0];
    wb.worksheets.forEach(ws=>{if(ws.rowCount>(best?.rowCount||0))best=ws;});
    if(!best) throw new Error('Excel çalışma sayfası bulunamadı.');
    for(let r=1;r<=best.rowCount;r++){
      const arr=[];const row=best.getRow(r);
      for(let c=1;c<=18;c++) arr.push(row.getCell(c).value instanceof Date?row.getCell(c).value:excelCellText(row.getCell(c).value));
      rows.push(arr);
    }
  }
  const headerIdx=rows.findIndex(r=>r.some(x=>/Alış Faturasının Tarihi/i.test(String(x??'')))&&r.some(x=>/KDV Hariç Tutar/i.test(String(x??''))));
  if(headerIdx<0) throw new Error('İndirilecek KDV listesi başlık satırı bulunamadı.');
  const headers=rows[headerIdx].map(normalizeExcelHeader);
  const idx={
    tarih:headers.findIndex(x=>x.includes('ALIŞ FATURASININ TARİHİ')),
    seri:headers.findIndex(x=>x.includes('ALIŞ FATURASININ SERİSİ')),
    no:headers.findIndex(x=>x.includes("ALIŞ FATURASININ SIRA NO")),
    ad:headers.findIndex(x=>x.includes('SATICININ ADI-SOYADI')||x.includes('SATICININ ADI SOYADI')),
    vkn:headers.findIndex(x=>x.includes('SATICININ VERGİ KİMLİK NUMARASI')||x.includes('SATICININ VERGİ KİMLİK NUMARASI / TC')),
    matrah:headers.findIndex(x=>x.includes('KDV HARİÇ TUTAR')),
    kdv:headers.findIndex(x=>x==="KDV'Sİ"||x.includes("KDV'Sİ"))
  };
  if(idx.tarih<0||idx.no<0||idx.ad<0||idx.vkn<0||idx.matrah<0||idx.kdv<0) throw new Error('Gerekli fatura sütunlarından biri bulunamadı.');
  const data=[];
  for(let i=headerIdx+1;i<rows.length;i++){
    const r=rows[i],mat=parseMoneyNumber(r[idx.matrah]),kdv=parseMoneyNumber(r[idx.kdv]),no=String(r[idx.no]??'').trim(),ad=String(r[idx.ad]??'').trim();
    if(!no&&!ad) continue;
    if(!Number.isFinite(mat)||!Number.isFinite(kdv)) continue;
    const faturaTarihi=r[idx.tarih] instanceof Date?fmtDate(r[idx.tarih]):String(r[idx.tarih]??'').trim();
    data.push({_matrah:mat,_kdv:kdv,_donem:invoiceMonthKey(faturaTarihi),adSoyad:ad,vkn:String(r[idx.vkn]??'').trim(),vergiDairesi:'',faturaTarihi,faturaSeri:idx.seri>=0?String(r[idx.seri]??'').trim():'',faturaNo:no,faturaMatrahi:formatMoneyTR(mat),faturaKdv:formatMoneyTR(kdv),kdvDahilTutar:formatMoneyTR(mat+kdv),gumrukTarihi:'',gumrukTescilNo:''});
  }
  const byMonth=new Map();
  data.forEach(item=>{const key=item._donem||`__BELIRSIZ__${item.faturaTarihi||''}`;if(!byMonth.has(key))byMonth.set(key,[]);byMonth.get(key).push(item);});
  const selected=[];
  [...byMonth.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([key,items])=>{items.sort((a,b)=>b._matrah-a._matrah);selected.push(...items.slice(0,10));});
  return selected.map(({_matrah,_kdv,_donem,...x})=>x);
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


