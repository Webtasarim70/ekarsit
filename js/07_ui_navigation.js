/* ============================================================
   8. Tedarikçi firmalar — İndirilecek KDV listesinden en yüksek
   matrahlı 10 faturayı kontrol kartında gösterme
   ============================================================ */
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

