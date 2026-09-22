/* ============================================================
   Adım (step) tanımları
   ============================================================ */


/* ============================================================
   V4 İŞ AKIŞI — tek ekranda başlangıç + gerçek şablon çıktıları
   ============================================================ */

function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }

function archivePeriodFromValue(v){
  const s=String(v??'').trim();
  if(!s) return '';
  // Önce tam tarihleri ele al: fatura tarihi dönem eşleştirmesinde esas alınır.
  // Desteklenen biçimler: GG.AA.YYYY, GG/AA/YYYY, GG-AA-YYYY ve YYYY-MM-GG.
  let m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s|$)/);
  if(m) return fmtDonem(parseInt(m[2],10),parseInt(m[3],10));
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/);
  if(m) return fmtDonem(parseInt(m[2],10),parseInt(m[1],10));
  // Ay.Yıl / Ay-Yıl / Ay/Yıl gibi dönem değerleri.
  m=s.match(/^(\d{1,2})[.\/-](\d{4})$/);
  if(m) return fmtDonem(parseInt(m[1],10),parseInt(m[2],10));
  // Metin içinde geçen bir dönem ifadesini de yakala.
  m=s.match(/(?:^|[^0-9])(\d{1,2})[.\/-](\d{4})(?:[^0-9]|$)/);
  return m ? fmtDonem(parseInt(m[1],10),parseInt(m[2],10)) : '';
}
function archiveYearFromRow(row,valueFn){
  const d=archivePeriodFromValue(valueFn(row));
  return d ? d.slice(3) : archiveYearFromValue(valueFn(row));
}
function archiveRowsForPeriods(rows,periods,valueFn){
  const wanted=new Set((periods||[]).filter(Boolean));
  return (rows||[]).filter(row=>wanted.has(archivePeriodFromValue(valueFn(row))));
}
function defterPeriodMatchesDetected(defterRow, periods){
  const wanted=new Set((periods||[]).filter(Boolean).map(String));
  if(!wanted.size) return false;
  const bas=archivePeriodFromValue(defterRow.baslangic);
  const bit=archivePeriodFromValue(defterRow.bitis||defterRow.baslangic);
  if(!bas) return false;
  const [bm,by]=bas.split('.').map(Number);
  const [em,ey]=(bit||bas).split('.').map(Number);
  return [...wanted].some(d=>{
    const [m,y]=String(d).split('.').map(Number);
    const n=y*12+m, a=by*12+bm, b=ey*12+em;
    return n>=a && n<=b;
  });
}
function archiveRowsForYears(rows,years,valueFn){
  const wanted=new Set((years||[]).filter(Boolean).map(String));
  return (rows||[]).filter(row=>wanted.has(String(archiveYearFromRow(row,valueFn)||'')));
}
function mergeScopedArchiveRows(target,incoming,keyFn){
  const added=[];
  (incoming||[]).forEach(x=>{
    const k=keyFn(x); const hit=target.findIndex(y=>keyFn(y)===k);
    if(hit>=0) target[hit]={...target[hit],...x};
    else { target.push({...x}); added.push(x); }
  });
  return added.length;
}
function clearTableAndRender(rows,rerender){
  rows.splice(0,rows.length); rerender();
}
function detectedYearsFromPeriods(periods){
  return [...new Set((periods||[]).map(d=>String(d).match(/(?:^|\.)((?:19|20)\d{2})$/)?.[1]).filter(Boolean))].sort();
}
function archiveScopedRows(key){
  const p=state.existingArchiveParsed||{};
  if(key==='defter') return (p.defterler||[]).filter(x=>defterPeriodMatchesDetected(x,state.donemler));
  if(key==='isci') return archiveRowsForPeriods(p.isciler||[],state.donemler,x=>x.donem);
  if(key==='kdv') return archiveRowsForPeriods(p.kdvBeyanlari||[],state.kdvDonemleri,x=>x.donem);
  // Üretici/İmalatçı arşiv kaydı dönem bilgisi taşımaz; bu nedenle Gelen Karşıt'ta
  // tespit edilen dönemlerle sınırlandırılmaz. Arşivdeki ilgili imalatçı kayıtları
  // olduğu gibi çalışma tablosuna alınır.
  if(key==='imalatci') return (p.imalatcilar||[]).map(x=>({...x}));
  if(key==='tedarikciler') {
    // Tedarikçide dönem EŞLEŞTİRMESİ SADECE FATURA TARİHİNDEN yapılır.
    // Arşivde varsa donem alanı yardımcı olabilir ancak yanlış/eksik dönem başlıkları
    // fatura tarihinin önüne geçemez. Her tespit edilen dönem için arşivdeki TÜM
    // faturalar alınır; burada 10 kayıt sınırı kesinlikle uygulanmaz.
    const wanted=new Set((state.donemler||[]).filter(Boolean));
    return (p.tedarikciler||[]).map(x=>{
      const faturaDonemi=archivePeriodFromValue(x.faturaTarihi);
      return {...x,donem:faturaDonemi||x.donem||''};
    }).filter(x=>{
      const d=archivePeriodFromValue(x.faturaTarihi);
      return d && wanted.has(d);
    });
  }
  return [];
}
function rescanArchiveTable(key,rerender){
  if(!state.existingArchiveParsed){ alert('Önce Gelen Karşıt ekranında arşiv dosyasını yükleyin.'); return; }
  const incoming=archiveScopedRows(key);
  if(key==='tedarikciler' && state.donemler?.length){
    // Eski hatalı dönem sonuçlarının tabloda kalmaması için önce yalnızca tespit
    // edilen dönemlere ait mevcut tedarikçi satırlarını koruyup, arşiv kayıtlarını
    // normalize ederek yeniden birleştiriyoruz.
  }
  const targets={defter:state.defterler,isci:state.isciler,kdv:state.kdvBeyanlari,imalatci:state.imalatcilar,tedarikciler:state.tedarikciler};
  const target=targets[key];
  if(!target) return;
  const keyFns={
    defter:x=>(x.nevi||'')+'|'+(x.baslangic||'')+'|'+(x.bitis||''),
    isci:x=>x.donem||'',
    kdv:x=>x.donem||'',
    imalatci:x=>(x.adSoyad||'')+'|'+(x.vkn||'')+'|'+(x.belgeNo||''),
    tedarikciler:x=>(archivePeriodFromValue(x.faturaTarihi)||x.donem||'')+'|'+(x.faturaNo||'')+'|'+(x.adSoyad||'')
  };
  const count=mergeScopedArchiveRows(target,incoming,keyFns[key]);
  rerender();
  let detail='';
  if(key==='tedarikciler'){
    const groups=new Map();
    incoming.forEach(x=>{const d=archivePeriodFromValue(x.donem||x.faturaTarihi)||'Dönem Belirlenemedi';groups.set(d,(groups.get(d)||0)+1);});
    detail=[...(state.donemler||[])].map(d=>`${d}: ${groups.get(d)||0} kayıt`).join(' • ');
  }
  alert(`Arşiv taraması tamamlandı. Tespit edilen dönemlerle eşleşen ${incoming.length} arşiv kaydı bulundu; ${count} kayıt tabloya eklendi/güncellendi.${detail?`\n\nTedarikçi dönem dağılımı: ${detail}`:''}`);
}
function archiveToState(parsed) {
  if (!parsed) return;
  const m = parsed.mukellef || {};
  if (m.unvan) state.meta.cUnvan = m.unvan;
  if (m.vkn) state.meta.cVkn = m.vkn;
  if (m.vergiDairesi && !state.tutanakFileName) state.meta.cVergiDairesi = m.vergiDairesi;
  if (m.adres) state.meta.cAdres = m.adres;
  if (m.telefon) state.meta.cTelefon = m.telefon;
  const mergeRows = (target, incoming, keyFn) => { (incoming || []).forEach(x => { const k=keyFn(x); const hit=target.findIndex(y=>keyFn(y)===k); if(hit>=0) target[hit]={...target[hit],...x}; else target.push({...x}); }); };
  // Ortaklık bilgileri dönemden bağımsızdır; diğer çalışma tabloları yalnızca
  // tutanaktan tespit edilen dönemlerle eşleşen arşiv kayıtlarını alır.
  mergeRows(state.ortaklar, parsed.ortaklar, x => (x.adSoyad||'')+'|'+(x.vkn||''));
  mergeRows(state.defterler, archiveScopedRows('defter'), x => (x.nevi||'')+'|'+(x.baslangic||'')+'|'+(x.bitis||''));
  mergeRows(state.isciler, archiveScopedRows('isci'), x => x.donem||'');
  mergeRows(state.kdvBeyanlari, archiveScopedRows('kdv'), x => x.donem||'');
  mergeRows(state.imalatcilar, archiveScopedRows('imalatci'), x => (x.adSoyad||'')+'|'+(x.vkn||'')+'|'+(x.belgeNo||''));
  mergeRows(state.tedarikciler, archiveScopedRows('tedarikciler'), x => (archivePeriodFromValue(x.faturaTarihi)||x.donem||'')+'|'+(x.faturaNo||'')+'|'+(x.adSoyad||''));
  // Karşıt inceleme faturaları arşivden hiçbir şekilde taşınmaz.
  // state.donemler yalnızca tutanaktaki faturalardan gelir.
}

function renderDetectedPeriodWarning(container, type){
  if(type==='imalatci') return;
  const periods=[...(state.donemler||[])].filter(Boolean).sort(donemCompare);
  const pText=periods.length?periods.join(', '):'Henüz dönem tespit edilmedi';
  const rules={
    defter:`Tespit edilen karşıt inceleme dönemleri: ${pText}. Tabloda yalnızca bu dönemleri kapsayan defter kayıtları bulunmalıdır. Yıllık defter kayıtları ilgili dönemi kapsıyorsa alınır; diğer yıllara/dönemlere ait arşiv kayıtları alınmaz.`,
    fatura:`Tespit edilen karşıt inceleme dönemleri: ${pText}. Bu tabloda yalnızca gelen karşıt inceleme çalışmasına ait fatura bilgileri bulunmalıdır. Arşivdeki eski karşıt inceleme faturaları bu tabloya alınmaz.`,
    isci:`Tespit edilen karşıt inceleme dönemleri: ${pText}. Tabloda bu dönemlere ait Muhtasar/çalışan kayıtları bulunmalıdır; diğer dönemlerin arşiv kayıtları alınmaz. Her dönem için çalışan işçi sayısı ve ilgili vergi dairesi bilgisi esas alınır.`,
    kdv:`Karşıt incelemeden tespit edilen dönemler: ${pText}. KDV beyannamesinde ayrıca bu dönemlerin bir önceki dönemleri de kontrol edilir ve mükerrer olmadan tabloya dahil edilir. Tabloda bu nedenle gereken KDV dönemleri: ${(state.kdvDonemleri||[]).join(', ')||'Henüz hesaplanmadı'}. KDV dönemi, matrah, hesaplanan KDV, ilave KDV, toplam KDV, indirimler, ödenecek/devreden KDV ve tahakkuk bilgileri ilgili dönem için doldurulmalıdır.`,
    imalatci:'',
    tedarikciler:`Tespit edilen karşıt inceleme dönemleri: ${pText}. Tabloda bu dönemlerin her biri için arşivde bulunan tüm ilgili tedarikçi faturaları bulunmalıdır. Dönem başına 10 kayıt sınırı yoktur; fatura tarihi, VKN, fatura numarası, matrah ve KDV gibi bilgiler ilgili kayıtla birlikte gelmelidir.`
  };
  const box=el('div',{class:'hint',style:'margin:0 0 10px 0;background:#fff1f1;border:1px solid #e05a5a;color:#b00000;font-weight:600;line-height:1.55;'},`⚠️ ${rules[type]||`Tespit edilen karşıt inceleme dönemleri: ${pText}.`}`);
  container.appendChild(box);
}

function renderScopedTableActions(container,opts){
  const bar=el('div',{class:'table-actions',style:'margin-top:10px;flex-wrap:wrap;'});
  if(opts.templateFn) bar.appendChild(el('button',{class:'btn btn-ghost',onclick:opts.templateFn},opts.templateLabel||'＋ Tespit edilen dönemlere göre şablon satır ekle'));
  if(opts.clearFn) bar.appendChild(el('button',{class:'btn btn-secondary',onclick:opts.clearFn},'🗑 Tabloyu temizle'));
  if(opts.rescanFn) bar.appendChild(el('button',{class:'btn btn-secondary',onclick:opts.rescanFn},'🔎 Arşivi tekrar tara'));
  container.appendChild(bar);
}
function addPeriodTemplateRows(target,cols,periods,rerender){
  const list=[...(periods||[])].filter(Boolean).sort(donemCompare);
  list.forEach(d=>{
    const exists=target.some(r=>r._donem===d && Object.keys(r).filter(k=>k!=='_donem').every(k=>!String(r[k]??'').trim()));
    if(!exists){ const r=emptyRow(cols); r._donem=d; target.push(r); }
  });
  rerender();
}
function addDefterTemplates(rerender){
  const years=detectedYearsFromPeriods(state.donemler);
  state.donemler.forEach(d=>['e-Defter Yevmiye Defteri','e-Defter Defteri Kebir'].forEach(nevi=>{
    if(!state.defterler.some(x=>x.nevi===nevi && x.baslangic===d && x.bitis===d)) state.defterler.push({nevi,baslangic:d,bitis:d,tasdikMakami:'',tasdikTarihi:'',tasdikNo:'',aciklama:'',defterTuruAciklama:''});
  }));
  years.forEach(y=>{const bas=`01.${y}`,bit=`12.${y}`;if(!state.defterler.some(x=>x.nevi==='ENVANTER DEFTERİ'&&x.baslangic===bas&&x.bitis===bit))state.defterler.push({nevi:'ENVANTER DEFTERİ',baslangic:bas,bitis:bit,tasdikMakami:'',tasdikTarihi:'',tasdikNo:'',aciklama:'',defterTuruAciklama:''});});
  rerender();
}
function clearScopedTable(key,rerender){
  const targets={defter:state.defterler,fatura:state.faturalar,isci:state.isciler,kdv:state.kdvBeyanlari,imalatci:state.imalatcilar,tedarikciler:state.tedarikciler};
  const target=targets[key]; if(target) target.splice(0,target.length); rerender();
}

// 4. adımda tablo yanlışlıkla temizlenirse, ilk ekranda yüklenen
// Karşıt İnceleme Tutanağı PDF'sinin saklanan ham metninden fatura listesini
// yeniden oluşturur. Böylece PDF'nin tekrar seçilmesine gerek kalmaz.
function restoreFaturalarFromTutanak(rerender){
  if(!state.tutanakRawText){
    alert("Karşıt İnceleme Tutanağı PDF metni bulunamadı. Önce Gelen Karşıt bölümünden tutanak PDF'sini yükleyin.");
    return;
  }
  try{
    const parsed=parseTutanak(state.tutanakRawText);
    const rows=(parsed.faturalar||[]).map(x=>({...x}));
    if(!rows.length){
      alert("Yüklü tutanak PDF'sinden karşıt incelemeye konu fatura listesi okunamadı.");
      return;
    }
    state.faturalar=rows;
    recomputeDonemlerFromTutanak();
    if(rerender) rerender();
  }catch(err){
    alert("Fatura listesi tutanak PDF'sinden tekrar alınamadı: "+err.message);
  }
}

function dedupePeriods(arr) {
  return [...new Set((arr||[]).map(x=>String(x||'').trim()).filter(Boolean))].sort(donemCompare);
}

async function readArchiveUpload(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const buf = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return parseArchiveWorkbook(wb);
  }
  if (name.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const candidates = Object.keys(zip.files).filter(n => /\.xlsx$/i.test(n) && !zip.files[n].dir);
    if (!candidates.length) throw new Error('ZIP içinde .xlsx arşiv dosyası bulunamadı.');
    const preferred = candidates.find(n => /ARSIV|ARŞİV/i.test(n)) || candidates[0];
    const buf = await zip.files[preferred].async('arraybuffer');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return parseArchiveWorkbook(wb);
  }
  throw new Error('Arşiv için .xlsx veya .zip yükleyin.');
}

function firstScreenMissing() {
  const missing = [];
  if (isBlank(state.tutanakFileName)) missing.push('Karşıt İnceleme Tutanağı PDF');
  if (isBlank(state.meta.cUnvan)) missing.push('Karşıt inceleme yapılan mükellef ünvanı');
  if (isBlank(state.meta.cVkn)) missing.push('Karşıt inceleme yapılan mükellef VKN/T.C. Kimlik No');
  if (!state.donemler.length && !state.faturalar.length) missing.push('Fatura dönemi / fatura tarihi');
  return missing;
}

function renderMissingPanel(container) {
  const missing = firstScreenMissing();
  const card = el('div', { class: 'card' });
  card.appendChild(el('h3', {}, missing.length ? 'Sizin tamamlamanız gereken bilgiler' : 'Başlangıç bilgileri tamamlandı ✓'));
  if (missing.length) {
    card.className += ' missing-panel';
    const ul = el('ul', { style:'margin:8px 0 0 18px;' });
    missing.forEach(x => ul.appendChild(el('li', {}, x)));
    card.appendChild(ul);
    card.appendChild(el('div', { class:'hint warn', style:'margin-top:10px;' }, 'İleri butonu, bu ekrandaki zorunlu başlangıç bilgileri tamamlanmadan açılmaz.'));
  } else {
    card.appendChild(el('div', { class:'hint ok' }, 'Tutanak, mükellef ve en az bir fatura dönemi tespit edildi. Sonraki bölüme geçebilirsiniz.'));
  }
  container.appendChild(card);
}

function renderFirstScreen(c) {
  const intro = el('div', { class:'card' });
  intro.appendChild(el('h3', {}, 'Gelen Karşıt'));
  intro.appendChild(el('p', {}, 'Önce Karşıt İnceleme Tutanağı PDF dosyasını yükleyin. Ardından varsa mevcut yıllık arşivinizi yükleyin. Dosyalar okunur okunmaz bulunan bilgiler aşağıdaki tablolara aktarılır; eksik alanları aynı ekranda tamamlayabilirsiniz.'));
  c.appendChild(intro);

  const tutanakCard = el('div',{class:'card'});
  tutanakCard.appendChild(el('h3',{},'1. Karşıt İnceleme Tutanağı PDF'));
  fileUploadBox(tutanakCard,{
    accept:'.pdf', hint:'Karşıt İnceleme Tutanağı (.pdf)',
    onFile:async(file,box)=>{
      markFileChip(box,file.name); state.tutanakFileName=file.name;
      const status=el('div',{class:'hint info'},'⏳ Tutanak okunuyor ve bilgiler ilgili tablolara aktarılıyor...');
      box.parentElement.appendChild(status);
      try{
        const text=await extractPdfText(file); state.tutanakRawText=text;
        const parsed=parseTutanak(text); Object.assign(state.meta,parsed); syncIsciVergiDairesi(); if (!parsed.cVergiDairesi) { const mm=text.match(/Ç\)\s*NEZDİNDE[\s\S]*?VERGİ\s*DAİRESİ\s*:?\s*([^\n]{1,120})/i); if (mm) { parsed.cVergiDairesi=(mm[1]||'').replace(/\s+VERGİ\s+DAİRESİ\s+(?:MÜD\.?|MÜDÜRLÜĞÜ)\.?\s*$/i,'').trim(); state.meta.cVergiDairesi=parsed.cVergiDairesi; } }
        syncIsciVergiDairesi();
        if(parsed.faturalar?.length) state.faturalar=parsed.faturalar;
        recomputeDonemlerFromTutanak();
        status.className='hint ok'; status.textContent=`✓ Tutanak okundu. ${state.faturalar.length} fatura satırı ve ${state.donemler.length} dönem tespit edildi.`;
        renderStep(currentStep);
      }catch(err){ status.className='hint warn'; status.textContent='⚠️ PDF otomatik okunamadı: '+err.message+' — aşağıdaki alanları elle tamamlayabilirsiniz.'; renderStep(currentStep); }
    }
  });
  if(state.tutanakFileName) tutanakCard.appendChild(el('div',{class:'hint ok'},`Yüklü tutanak: ${state.tutanakFileName}`));
  c.appendChild(tutanakCard);

  const archInfo=el('div',{class:'hint info'}, state.existingArchiveParsed
    ? `✓ Arşiv dosyası Arşiv bölümünden yüklenmiş durumda: ${state.existingArchiveFile?.name||'—'}. Aynı arşiv; Arşiv Görüntüle, Arşiv Düzenle ve Dosyadan Veri Al bağlantılarında otomatik kullanılır.`
    : 'Arşiv dosyası bu ekranda tekrar yüklenmez. Sol menüde Arşiv → Arşiv Dosyası Yükle bağlantısından bir kez yükleyin; sonraki arşiv bağlantıları aynı dosyayı otomatik kullanır.');
  c.appendChild(archInfo);

  const metaCard=el('div',{class:'card'});
  metaCard.appendChild(el('h3',{},'3. Tutanaktan / Arşivden Gelen Mükellef Bilgileri'));
  metaCard.appendChild(el('div',{class:'hint info'},'Bu bilgiler dosyalardan otomatik gelir. Hücreleri değiştirerek eksikleri tamamlayabilirsiniz.'));
  const grid=el('div',{class:'field-grid'});
  [['cUnvan','Ünvan'],['cVkn','Vergi/T.C. Kimlik No'],['cVergiDairesi','Vergi Dairesi'],['cAdres','Adres'],['cTelefon','Telefon'],['tutanakSayi','Tutanak Sayısı'],['tutanakTarih','Tutanak Tarihi']].forEach(([k,l])=>metaField(grid,state.meta,k,l));
  metaCard.appendChild(grid); c.appendChild(metaCard);

  const periodCard=el('div',{class:'card'});
  periodCard.appendChild(el('h3',{},'4. Tespit Edilen Dönemler'));
  const pwrap=el('div'); renderDonemListEditor(pwrap,state.donemler); periodCard.appendChild(pwrap);
  periodCard.appendChild(el('div',{class:'hint info',style:'margin-top:10px;'},`KDV için gerekli dönemler otomatik hesaplanır: ${(state.kdvDonemleri||[]).join(', ')||'—'}`));
  periodCard.appendChild(el('button',{class:'btn btn-secondary',style:'margin-top:8px;',onclick:()=>{recomputeDonemlerFromTutanak();renderStep(currentStep);}},'↻ Faturalardan dönemleri yeniden tespit et'));
  c.appendChild(periodCard);

  renderMissingPanel(c);
}

function buildTemplateWorkbook(cols, rows, sheetName='Veriler') {
  const wb=new ExcelJS.Workbook(); wb.creator='KDV Karşıt İnceleme Arşiv Sihirbazı'; wb.created=new Date();
  const ws=wb.addWorksheet(sheetName);
  ws.columns=cols.map(c=>({header:c.label,width:Math.max(16,Math.round((c.w||120)/7))}));
  rows.forEach(item=>ws.addRow(cols.map(c=>item[c.key] ?? '')));
  return wb;
}

function buildTasdikInfoSheet(wb,s){
  const ws=wb.addWorksheet('Tasdik Hizmeti Verilen Mükellef');
  ws.columns=[{width:42},{width:60}];
  [['Ünvan',s.meta.tasdikMukellefUnvan],['Vergi/T.C. Kimlik No',s.meta.tasdikMukellefVkn],['Vergi Dairesi',s.meta.tasdikMukellefVergiDairesi],['Adres',s.meta.tasdikMukellefAdres],['Telefon',s.meta.tasdikMukellefTelefon],['Sözleşme Başlangıç Dönemi',s.meta.sozBaslangic],['Sözleşme Bitiş Dönemi',s.meta.sozBitis],['Sözleşme Tarihi',s.meta.sozTarihi],['Sözleşme Seri-Sıra No',s.meta.sozSeriSira],['Sisteme Giriş Tarihi',s.meta.sozSistemeGiris]].forEach(([a,b])=>{const r=ws.addRow([a,b]);r.getCell(1).font={bold:true};});
}

async function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}

async function buildTedarikciArchiveWorkbook(s){
  const wb=new ExcelJS.Workbook();
  wb.creator='KDV Karşıt İnceleme Arşiv Sihirbazı';
  wb.created=new Date();
  const ws=wb.addWorksheet('TEDARİKÇİ ARŞİV');
  ws.columns=COLS.tedarikci.map(c=>({header:c.label,width:Math.max(16,Math.round((c.w||120)/7))}));
  ws.getRow(1).eachCell(cell=>{cell.font={bold:true,size:10.5,color:{argb:'FF0E4A5C'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE6EDEE'}};cell.alignment={vertical:'middle',wrapText:true};});
  s.tedarikciler.forEach(t=>ws.addRow(COLS.tedarikci.map(c=>t[c.key]??'')));
  ws.views=[{state:'frozen',ySplit:1}];
  const buf=await wb.xlsx.writeBuffer();
  return {name:`${(s.meta.cVkn||'mukellef').replace(/\\D/g,'')||'mukellef'}_TEDARIKCI_ARSIV.xlsx`,blob:new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};
}

function tedarikciInvoiceKey(x){
  return [String(x.faturaNo||'').trim().toLocaleUpperCase('tr-TR'),String(x.vkn||'').replace(/\\D/g,''),String(x.faturaTarihi||'').trim()].join('|');
}

function checkTedarikciDuplicates(incoming){
  const seen=new Map(); const duplicates=[];
  const existing=new Set(state.tedarikciler.map(tedarikciInvoiceKey));
  incoming.forEach((x,idx)=>{
    const key=tedarikciInvoiceKey(x);
    if(!key.replace(/\\|/g,'')) return;
    if(existing.has(key) || seen.has(key)) duplicates.push({row:idx+1,item:x,reason:existing.has(key)?'Arşivde/tabloda zaten kayıtlı':'Aynı dosyada mükerrer'});
    seen.set(key,true);
  });
  return duplicates;
}

async function buildOutputFiles(s){
  const files=[
    ['MUKELLEFIN_ORTAKLIK_BILGILERI','ortak',COLS.ortak,s.ortaklar],
    ['MUKELLEFIN_YASAL_DEFTERLERE_ILISKIN_BILGILERI','defter',COLS.defter,s.defterler],
    ['MUKELLEFIN_KARSIT_INCELEMEYE_KONU_OLAN_FATURALARINA_ILISKIN_BILGILERI','fatura',COLS.fatura,s.faturalar],
    ['MUKELLEFIN_MUHTASAR_BEYANNAMESINDE_YER_ALAN_CALISAN_KISI_SAYILARI','isci',COLS.isci,s.isciler],
    ['ONCEKI_DONEM_VE_ILGILI_DONEM_KDV_BEYAN_BILGILERI','kdv',COLS.kdv,s.kdvBeyanlari],
    ['MALIN_IMALATCISI_OLAN_MUKELLEF_HAKKINDA_BILGILER','imalatci',COLS.imalatci,s.imalatcilar],
    ['ILGILI_DONEMDE_SATILAN_MALLARIN_TEDARIK_EDILDIGI_FIRMALAR_HAKKINDA_BILGILER','tedarikci',COLS.tedarikci,s.tedarikciler]
  ];
  const vkn=(s.meta.cVkn||'mukellef').replace(/\D/g,'')||'mukellef';
  const today=new Date();
  const date=[String(today.getDate()).padStart(2,'0'),String(today.getMonth()+1).padStart(2,'0'),today.getFullYear()].join('_');
  const out=[];
  for(const [base,templateKey,cols,rows] of files){
    const wb=await buildOutputWorkbookFromRealTemplate(templateKey,cols,rows);
    const buf=await wb.xlsx.writeBuffer();
    out.push({
      name:`${vkn}_${base}_${date}.xlsx`,
      blob:new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    });
  }
  return out;
}


/* ------------------------- Muavin / fatura çapraz kontrolü ------------------------- */
function muavinNormalizeNo(v){ return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function muavinParseAmount(v){
  const x=String(v||'').trim().replace(/\./g,'').replace(',','.');
  const n=Number(x); return Number.isFinite(n)?n:null;
}
function muavinDate(v){ const m=String(v||'').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m?`${m[1]}.${m[2]}.${m[3]}`:''; }
function muavinAmountsFromLine(line){
  const re=/-?\d{1,3}(?:\.\d{3})*,\d{2}/g, a=[]; let m;
  while((m=re.exec(line))) a.push({text:m[0],index:m.index,value:muavinParseAmount(m[0])});
  return a;
}
function parseMuavinPdfText(text){
  const lines=String(text||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
  const rows=[];
  for(const line of lines){
    const head=line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\S+)\s+(.*)$/);
    if(!head) continue;
    const amounts=muavinAmountsFromLine(line);
    if(amounts.length<2) continue;
    const firstAmt=amounts[0].index;
    const desc=head[4].slice(0, Math.max(0, firstAmt-(line.indexOf(head[4])))).trim();
    // Layout: BORÇ, ALACAK, BAKİYE. The first two are the transaction amounts.
    rows.push({tarih:muavinDate(head[1]),yevmiyeNo:head[2],fisNo:head[3],aciklama:desc,borc:amounts[0].value,alacak:amounts[1].value,bakiye:amounts[2]?.value??null,kaynak:'PDF'});
  }
  return rows;
}
function faturaToplamNumber(v){ return muavinParseAmount(String(v||'')); }
function faturaNoCandidates(f){
  const out=[]; const full=muavinNormalizeNo(f.no); if(full) out.push(full);
  const seri=muavinNormalizeNo(f.seri); const no=muavinNormalizeNo(f.no);
  if(seri && no && !full.includes(seri+no)) out.push(seri+no);
  return [...new Set(out)];
}
// Karşıt inceleme fatura tablosunda ilk tutar matrah, ikinci tutar KDV'dir.
// Muavin kontrolünde esas alınan fatura toplamı = MATRAH + KDV'dir.
function getFaturaMuavinKontrolTutari(f){
  const matrah = faturaToplamNumber(f.matrah !== undefined ? f.matrah : f.tutar);
  const kdv = faturaToplamNumber(f.kdv);
  const hasMatrah = f.matrah !== undefined ? String(f.matrah).trim() !== '' : String(f.tutar||'').trim() !== '';
  const hasKdv = String(f.kdv||'').trim() !== '';
  if(!hasMatrah && !hasKdv) return {matrah:0,kdv:0,toplam:null};
  return {matrah,kdv,toplam:matrah+kdv};
}
function muavinAmountCandidates(m){
  return [
    {side:'BORÇ',value:m.borc},
    {side:'ALACAK',value:m.alacak}
  ].filter(x=>typeof x.value==='number');
}
function muavinMatchFatura(f, rows){
  const candidates=faturaNoCandidates(f);
  const matches=rows.filter(r=>{ const a=muavinNormalizeNo(r.aciklama); return candidates.some(n=>n && a.includes(n)); });
  const ftInfo=getFaturaMuavinKontrolTutari(f);
  if(!matches.length) return {status:'notfound',message:'Muavinde fatura bulunamadı.',matches:[],faturaMatrah:ftInfo.matrah,faturaKdv:ftInfo.kdv,faturaTutar:ftInfo.toplam};
  if(matches.length>1) return {status:'multiple',message:'Birden fazla muavin kaydı bulundu — manuel kontrol gerekli.',matches,faturaMatrah:ftInfo.matrah,faturaKdv:ftInfo.kdv,faturaTutar:ftInfo.toplam};
  const m=matches[0];
  const diffs=muavinAmountCandidates(m).map(x=>({side:x.side,diff:Math.abs((ftInfo.toplam??NaN)-x.value),value:x.value})).filter(x=>Number.isFinite(x.diff));
  const exact=diffs.find(x=>x.diff<=0.01);
  if(ftInfo.toplam!==null && !exact){
    const best=diffs.sort((a,b)=>a.diff-b.diff)[0];
    return {status:'amountdiff',message:'Fatura toplamları farklı.',matches:[m],amountSide:best?.side||'',muavinTutar:best?.value??'',fark:best?.diff??'',faturaMatrah:ftInfo.matrah,faturaKdv:ftInfo.kdv,faturaTutar:ftInfo.toplam};
  }
  if(!m.yevmiyeNo) return {status:'emptyyev',message:'Yevmiye numarası boş.',matches:[m],amountSide:exact?.side||'',muavinTutar:exact?.value??'',faturaMatrah:ftInfo.matrah,faturaKdv:ftInfo.kdv,faturaTutar:ftInfo.toplam};
  return {status:'matched',message:'Eşleşti.',matches:[m],amountSide:exact?.side||'',muavinTutar:exact?.value??'',faturaMatrah:ftInfo.matrah,faturaKdv:ftInfo.kdv,faturaTutar:ftInfo.toplam};
}
function runMuavinFaturaKontrol(){
  const rows=state.muavinRows||[];
  state.faturaMuavinKontroller=state.faturalar.map((f,i)=>({faturaIndex:i,result:muavinMatchFatura(f,rows)}));
  return state.faturaMuavinKontroller;
}

function renderMuavinKontrol(c, rerender){
  const wrap=el('div',{class:'card',style:'background:#fbfdfd;'});
  wrap.appendChild(el('h3',{},'📑 Muavin Defter ile Fatura Kontrolü'));
  wrap.appendChild(el('div',{class:'hint info'},'Muavin PDF yüklendiğinde karşıt inceleme tablosundaki her faturanın MATRAH + KDV toplamı, muavin kaydındaki BORÇ/ALACAK tutarı ile çapraz kontrol edilir. Başarılı eşleşmelerde muavin tarihi ve yevmiye numarası, onaydan sonra fatura tablosuna aktarılır.'));
  const preview=el('div');
  fileUploadBox(wrap,{accept:'.pdf',hint:'Muavin Defter PDF — çoklu seçim desteklenir',multiple:true,onFiles:async(files,box)=>{
    const all=[]; let failed=0;
    for(const file of files){
      try{ markFileChip(box,file.name,true); all.push(...parseMuavinPdfText(await extractPdfText(file))); }
      catch(e){ failed++; markFileChip(box,file.name,false); }
    }
    state.muavinRows=all; runMuavinFaturaKontrol(); preview.innerHTML='';
    const counts={matched:0,notfound:0,amountdiff:0,emptyyev:0,multiple:0};
    state.faturaMuavinKontroller.forEach(x=>counts[x.result.status]=(counts[x.result.status]||0)+1);
    preview.appendChild(el('div',{class:'hint '+(failed?'warn':'ok')},`Muavin kontrolü: ${all.length} muavin satırı okundu; ${counts.matched||0} eşleşti, ${counts.notfound||0} bulunamadı, ${counts.amountdiff||0} tutar farklı, ${counts.emptyyev||0} yevmiye no boş, ${counts.multiple||0} birden fazla aday.${failed?' '+failed+' dosya okunamadı.':''}`));
    const totalExpected=state.faturaMuavinKontroller.reduce((sum,item)=>sum+(item.result.faturaTutar||0),0);
    const totalMatchedMuavin=state.faturaMuavinKontroller.reduce((sum,item)=>sum+(item.result.status==='matched' ? Number(item.result.muavinTutar||0) : 0),0);
    const totalMatrah=state.faturaMuavinKontroller.reduce((sum,item)=>sum+(item.result.faturaMatrah||0),0);
    const totalKdv=state.faturaMuavinKontroller.reduce((sum,item)=>sum+(item.result.faturaKdv||0),0);
    const totalDiff=Math.abs(totalExpected-totalMatchedMuavin);
    preview.appendChild(el('div',{class:'hint info',style:'margin-top:8px'},`Fatura toplam kontrolü: Matrah toplamı ${totalMatrah.toLocaleString('tr-TR',{minimumFractionDigits:2})} TL + KDV toplamı ${totalKdv.toLocaleString('tr-TR',{minimumFractionDigits:2})} TL = ${totalExpected.toLocaleString('tr-TR',{minimumFractionDigits:2})} TL. Başarılı eşleşen muavin tutarı: ${totalMatchedMuavin.toLocaleString('tr-TR',{minimumFractionDigits:2})} TL. Fark: ${totalDiff.toLocaleString('tr-TR',{minimumFractionDigits:2})} TL.`));
    const table=el('table',{class:'editable-table'}); const hr=el('tr'); ['Fatura No','Fatura Tarihi','Matrah','KDV','Fatura Toplamı (Matrah+KDV)','Muavin Tarihi','Yev. No','Muavin Tutarı','Durum'].forEach(h=>hr.appendChild(el('th',{},h))); table.appendChild(hr);
    state.faturaMuavinKontroller.forEach((item,idx)=>{
      const f=state.faturalar[item.faturaIndex], r=item.result, m=r.matches[0]; const tr=el('tr');
      const muavinTutar=m ? (m.borc!==0?m.borc:m.alacak) : null;
      const vals=[f.no||'—',f.tarih||'—',r.faturaMatrah!=null?r.faturaMatrah.toLocaleString('tr-TR',{minimumFractionDigits:2}):'—',r.faturaKdv!=null?r.faturaKdv.toLocaleString('tr-TR',{minimumFractionDigits:2}):'—',r.faturaTutar!=null?r.faturaTutar.toLocaleString('tr-TR',{minimumFractionDigits:2}):'—',m?.tarih||'—',m?.yevmiyeNo||'—',muavinTutar!=null?muavinTutar.toLocaleString('tr-TR',{minimumFractionDigits:2}):'—',r.message];
      vals.forEach(v=>tr.appendChild(el('td',{},String(v)))); table.appendChild(tr);
    });
    preview.appendChild(table);
    const ok=el('button',{class:'btn btn-primary',style:'margin-top:10px;',onclick:()=>{
      let n=0; state.faturaMuavinKontroller.forEach(item=>{ if(item.result.status!=='matched') return; const f=state.faturalar[item.faturaIndex],m=item.result.matches[0]; f.defterKayitTarihi=m.tarih; f.yevmiyeNo=m.yevmiyeNo; n++; });
      alert(`${n} fatura için muavin tarihi ve yevmiye numarası fatura tablosuna aktarıldı.`); if(rerender) rerender();
    }},'✓ Eşleşenleri onayla ve fatura tablosuna aktar');
    preview.appendChild(ok);
  }});
  wrap.appendChild(preview); c.appendChild(wrap);
}

