/* ============================================================
   Navigasyon / uygulama başlatma
   ============================================================ */

let currentStep = 0;

/* ============================================================
   v1.3.30 — Tutanak ve Tablo Ekle: doldurulmuş Excel tablolarını
   doğrudan okuyup görüntüleme.
   ============================================================ */
const DOLU_TABLO_CONFIGS = [
  {key:'ortak', title:'1) Ortaklık Bilgileri', match:['MUKELLEFIN_ORTAKLIK','ADISOYADI/ÜNVANI','PAYORANI']},
  {key:'defter', title:'2) Yasal Defter Bilgileri', match:['YASAL_DEFTER','DEFTERINNEVİ','BAŞLANGIÇDÖNEMİ']},
  {key:'fatura', title:'3) Karşıt İncelemeye Konu Faturalar', match:['KARSITINCELEMEYEKONU','FATURANINTARIHI','FATURANINNUMARASI']},
  {key:'muhtasar', title:'4) Muhtasar Çalışan Kişi Sayıları', match:['MUHTASAR','ÇALIŞANİŞÇİSAYISI','BEYANNAMENİNV...']},
  {key:'kdv', title:'5) Önceki Dönem ve İlgili Dönem KDV Beyan Bilgileri', match:['KDVBEYAN','KDVMATRAHI','TOPLAMKDV']},
  {key:'imalatci', title:'6) Malın İmalatçısı Olan Mükellef Hakkında Bilgi', match:['IMALATCISI','SANAYİODASI','BELGETÜRÜ']},
  {key:'tedarikci', title:'7) Tedarik Edilen Firmalar', match:['TEDARIK','KDVDAHİLTOPLAMBEDELİ','FATURANINMATRAHI']}
];
function doluNorm(v){return String(v??'').toLocaleUpperCase('tr-TR').replace(/\s+/g,'').replace(/[İIıi]/g,'I').replace(/[Üü]/g,'U').replace(/[Öö]/g,'O').replace(/[Şş]/g,'S').replace(/[Ğğ]/g,'G').replace(/[Çç]/g,'C').replace(/[^A-Z0-9]/g,'');}
function doluExcelValue(v){
  if(v==null) return '';
  if(v instanceof Date){
    const dd=String(v.getDate()).padStart(2,'0'), mm=String(v.getMonth()+1).padStart(2,'0'), yy=v.getFullYear(); return `${dd}.${mm}.${yy}`;
  }
  if(typeof v==='object'){
    if(v.result!=null) return doluExcelValue(v.result);
    if(v.text!=null) return String(v.text);
    if(v.formula!=null) return v.result!=null?doluExcelValue(v.result):String(v.formula);
    if(v.richText) return v.richText.map(x=>x.text||'').join('');
    if(v.hyperlink) return String(v.text||v.hyperlink);
  }
  return String(v);
}
function doluGuessTableKey(fileName,headers){
  const f=doluNorm(fileName); const h=headers.map(doluNorm).join('|');
  if(f.includes('KARSITINCELEMEYEKONUOLANFATURALAR') || (h.includes('FATURANINTARIHI')&&h.includes('KDVTL'))) return 'fatura';
  if(f.includes('YASALDEFTER') || h.includes('DEFTERINNEVI')) return 'defter';
  if(f.includes('ORTAKLIK') || h.includes('PAYORANI')) return 'ortak';
  if(f.includes('MUHTASAR') || h.includes('CALISANISCISAYISI')) return 'muhtasar';
  if(f.includes('KDVBEYAN') || (h.includes('KDVMATRAHI')&&h.includes('TOPLAMKDV'))) return 'kdv';
  if(f.includes('IMALATCISI') || h.includes('SANAYIODASI')) return 'imalatci';
  if(f.includes('TEDARIKEDILDIGIFIRMALAR') || h.includes('KDVDAHILTOPLAMBEDEL')) return 'tedarikci';
  return null;
}
async function readDoluTableExcel(file){
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
  let ws=wb.getWorksheet('Veriler')||wb.worksheets[0];
  if(!ws) throw new Error('Excel içinde çalışma sayfası bulunamadı.');
  const rows=[];
  ws.eachRow({includeEmpty:false},row=>{
    const vals=[]; for(let c=1;c<=ws.columnCount;c++) vals.push(doluExcelValue(row.getCell(c).value));
    if(vals.some(x=>String(x).trim()!=='')) rows.push(vals);
  });
  if(!rows.length) throw new Error('Excel tablosu boş.');
  const headers=rows[0].map(x=>String(x||'').trim());
  const key=doluGuessTableKey(file.name,headers);
  if(!key) throw new Error('Excel tablosunun türü otomatik belirlenemedi.');
  const config=DOLU_TABLO_CONFIGS.find(x=>x.key===key);
  const data=rows.slice(1).filter(r=>r.some(x=>String(x||'').trim()!==''));
  return {key,title:config.title,fileName:file.name,sheet:ws.name,headers,rows:data};
}
function doluTableLabel(key){return DOLU_TABLO_CONFIGS.find(x=>x.key===key)?.title||key;}

/* ZIP içinden Excel tablolarını tarama: yalnızca tarayıcının yerleşik
   DecompressionStream API'si kullanılır; dışarıdan ek bir kütüphane gerekmez. */
function zipU16(a,o){return a[o]|(a[o+1]<<8);}
function zipU32(a,o){return (a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24))>>>0;}
async function inflateRawBytes(bytes){
  if(typeof DecompressionStream==='undefined') throw new Error('Bu tarayıcı ZIP içindeki sıkıştırılmış dosyaları açmayı desteklemiyor.');
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function zipDecodeName(bytes,utf8=true){
  try{return new TextDecoder(utf8?'utf-8':'windows-1254').decode(bytes);}catch(e){return new TextDecoder('utf-8').decode(bytes);}
}
async function readZipEntries(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  // EOCD imzasını son 65,557 bayt içinde ara.
  const min=Math.max(0,bytes.length-65557); let eocd=-1;
  for(let i=bytes.length-22;i>=min;i--){if(zipU32(bytes,i)===0x06054b50){eocd=i;break;}}
  if(eocd<0) throw new Error('Geçerli bir ZIP dosyası bulunamadı.');
  const count=zipU16(bytes,eocd+10); const cdSize=zipU32(bytes,eocd+12); const cdOffset=zipU32(bytes,eocd+16);
  if(cdOffset+cdSize>bytes.length) throw new Error('ZIP merkezi dizini okunamadı.');
  const entries=[]; let p=cdOffset;
  for(let n=0;n<count && p+46<=bytes.length;n++){
    if(zipU32(bytes,p)!==0x02014b50) break;
    const flags=zipU16(bytes,p+8), method=zipU16(bytes,p+10), compSize=zipU32(bytes,p+20), uncompSize=zipU32(bytes,p+24);
    const nameLen=zipU16(bytes,p+28), extraLen=zipU16(bytes,p+30), commentLen=zipU16(bytes,p+32), localOffset=zipU32(bytes,p+42);
    const nameBytes=bytes.slice(p+46,p+46+nameLen);
    const name=zipDecodeName(nameBytes,!!(flags&0x800));
    entries.push({name,method,compSize,uncompSize,localOffset,flags});
    p+=46+nameLen+extraLen+commentLen;
  }
  return {bytes,entries};
}
async function extractZipEntry(zip,entry){
  const {bytes}=zip, p=entry.localOffset;
  if(zipU32(bytes,p)!==0x04034b50) throw new Error(`ZIP girdisi okunamadı: ${entry.name}`);
  const nameLen=zipU16(bytes,p+26), extraLen=zipU16(bytes,p+28);
  const start=p+30+nameLen+extraLen, end=start+entry.compSize;
  if(end>bytes.length) throw new Error(`ZIP girdisi eksik: ${entry.name}`);
  const raw=bytes.slice(start,end);
  if(entry.method===0) return raw;
  if(entry.method===8) return await inflateRawBytes(raw);
  throw new Error(`Desteklenmeyen ZIP sıkıştırma yöntemi (${entry.method}): ${entry.name}`);
}
async function readDoluTableZip(file){
  const zip=await readZipEntries(file);
  const excelEntries=zip.entries.filter(e=>!e.name.endsWith('/') && /\.(xlsx|xlsm)$/i.test(e.name));
  if(!excelEntries.length) throw new Error('ZIP içinde .xlsx veya .xlsm Excel tablosu bulunamadı.');
  const results=[];
  for(const entry of excelEntries){
    const data=await extractZipEntry(zip,entry);
    const base=entry.name.split('/').pop()||entry.name;
    const f=new File([data],base,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    try{results.push(await readDoluTableExcel(f));}
    catch(err){results.push({__error:true,fileName:base,message:err.message});}
  }
  return results;
}

function renderDoluTablolarUploadPage(){
  currentPage='dolu-tablolar-upload'; currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Tutanak ve Tablo Ekle — Tabloları Yükle'));
  content.appendChild(el('p',{class:'step-desc'},'Doldurulmuş karşıt inceleme için hazırlanmış 7 Excel tablosunu yükleyin. Bu Excel dosyalarında bulunan 1–7. bölüm bilgileri Tutanak Görüntüle ekranında doğrudan Excel’den okunur; aynı bilgiler PDF metninden tekrar çıkarılmaz.'));
  const card=el('div',{class:'card'}); card.appendChild(el('h3',{},'📊 Doldurulmuş Karşıt İnceleme Excel Tabloları'));
  card.appendChild(el('div',{class:'hint info'},'7 tablo: Ortaklık, Yasal Defter, Karşıt İnceleme Faturaları, Muhtasar Çalışan, KDV, İmalatçı ve Tedarikçi. Birden fazla dosyayı aynı anda seçebilirsiniz.'));
  const status=el('div',{style:'margin-top:10px;'});
  fileUploadBox(card,{accept:'.xlsx,.xlsm,.zip',multiple:true,hint:'Doldurulmuş Excel tablolarını tek tek veya ZIP dosyası halinde yükleyin. ZIP içindeki tüm .xlsx/.xlsm dosyaları otomatik taranır.',onFiles:async(files,box)=>{
    status.innerHTML=''; let ok=0;
    for(const file of files){
      try{
        if(/\.zip$/i.test(file.name)){
          const parsedList=await readDoluTableZip(file);
          let zipOk=0;
          for(const result of parsedList){
            if(result.__error){status.appendChild(el('div',{class:'hint warn',style:'margin-top:6px;'},`⚠️ ${result.fileName}: ${result.message}`));continue;}
            state.doluTablolar[result.key]=result; state.doluTabloDosyalari[result.key]=`${file.name} → ${result.fileName}`; zipOk++; ok++;
            status.appendChild(el('div',{class:'hint ok',style:'margin-top:6px;'},`✓ ${result.fileName} → ${result.title} (${result.rows.length} kayıt)`));
          }
          markFileChip(box,`${file.name} (${zipOk} Excel)`,zipOk>0);
        }else{
          const parsed=await readDoluTableExcel(file); state.doluTablolar[parsed.key]=parsed; state.doluTabloDosyalari[parsed.key]=file.name; markFileChip(box,file.name,true); ok++;
        }
      }
      catch(err){ status.appendChild(el('div',{class:'hint warn',style:'margin-top:6px;'},`⚠️ ${file.name}: ${err.message}`)); }
    }
    const loaded=Object.keys(state.doluTablolar).length;
    status.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${ok} dosya okundu. Toplam ${loaded}/7 tablo hazır.`));
    const ul=el('ul',{style:'margin:8px 0 0 20px;line-height:1.7;'});
    DOLU_TABLO_CONFIGS.forEach(c=>ul.appendChild(el('li',{},`${c.title}: ${state.doluTablolar[c.key]?state.doluTablolar[c.key].rows.length+' kayıt':'yüklenmedi'}`)));
    status.appendChild(ul); renderNav();
  }}); card.appendChild(status); content.appendChild(card);
  if(Object.keys(state.doluTablolar).length){
    const info=el('div',{class:'card',style:'margin-top:14px;'}); info.appendChild(el('h3',{},'Yüklenen tablolar'));
    DOLU_TABLO_CONFIGS.forEach(c=>{const d=state.doluTablolar[c.key]; info.appendChild(el('div',{class:'hint '+(d?'ok':'info'),style:'margin-top:6px;'},d?`✓ ${c.title} — ${d.rows.length} kayıt — ${d.fileName}`:`○ ${c.title} — henüz yüklenmedi`));});
    content.appendChild(info);
  }
  document.getElementById('btn-prev').disabled=true; document.getElementById('btn-next').disabled=true; document.getElementById('footer-msg').textContent='Tutanak ve Tablo Ekle — Tabloları Yükle'; renderNav();
}
function requireDoluTutanak(title){
  if(!state.doluTutanakParsed){
    alert('Önce Tutanak ve Tablo Ekle → Tutanak Yükle bölümünden doldurulmuş tutanak PDF’sini yükleyin.');
    renderDoluTutanakUploadPage();
    return null;
  }
  return state.doluTutanakParsed;
}

function appendSimpleTable(container,title,headers,rows){
  const card=el('div',{class:'card',style:'margin-top:14px;'}); card.appendChild(el('h3',{},title));
  const table=el('table',{class:'editable-table'}); const thead=el('thead'); const trh=el('tr'); headers.forEach(h=>trh.appendChild(el('th',{},h))); thead.appendChild(trh); table.appendChild(thead);
  const tb=el('tbody'); (rows&&rows.length?rows:[headers.map(()=> '—')]).forEach(r=>{const tr=el('tr');r.forEach(v=>tr.appendChild(el('td',{},v??'')));tb.appendChild(tr);}); table.appendChild(tb);
  const scroll=el('div',{class:'table-scroll'});scroll.appendChild(table);card.appendChild(scroll);container.appendChild(card);
}

function tutanakRowsFromLines(block){
  return String(block||'').split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x && !/^Belge ID\s*:/.test(x) && !/^Versiyon No:/.test(x) && !/^\d+\/\d+$/.test(x));
}

function appendSourceTextTable(container,title,text){
  const rows=tutanakRowsFromLines(text).map(x=>[x]);
  appendSimpleTable(container,title,['Kaynak PDF içeriği'],rows);
}

function renderDoluTutanakViewPage(){
  const p=requireDoluTutanak('Tutanak Görüntüle'); if(!p)return;
  currentPage='dolu-tutanak-view'; currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Tutanak ve Tablo Ekle — Tutanak Görüntüle'));
  content.appendChild(el('p',{class:'step-desc'},`Tutanak: ${state.doluTutanakFileName||'—'} | 1–7. bölümler varsa yüklenen Excel tablolarından, diğer alanlar tutanak PDF'sinden gösterilir. Bu ekran salt okunurdur.`));
  appendSimpleTable(content,'A) Karşıt İncelemeyi Yapan YMM Bilgileri',['Alan','Değer'],[
    ['Adı ve Soyadı',p.ymmAdSoyad],['Vergi/T.C. Kimlik Numarası',p.ymmVkn],['Vergi Dairesi',p.ymmVergiDairesi],['Mühür Numarası',p.ymmMuhur],['Sicil Numarası',p.ymmSicil],['Bağlı Olduğu Oda',p.ymmOda],['Adresi',p.ymmAdres],['Telefon Numarası',p.ymmTelefon]
  ]);
  appendSimpleTable(content,'B) Tasdik Hizmeti Verilen Mükellef Bilgileri',['Alan','Değer'],[
    ['Adı Soyadı / Ünvanı',p.tasdikMukellefUnvan],['Vergi/T.C. Kimlik Numarası',p.tasdikMukellefVkn],['Vergi Dairesi',p.tasdikMukellefVergiDairesi],['Adres',p.tasdikMukellefAdres],['Telefon Numarası',p.tasdikMukellefTelefon]
  ]);
  appendSimpleTable(content,'Tasdik Dönemi Sözleşme Bilgileri',['İadeye Esas Başlangıç','İadeye Esas Bitiş','İade Talep Edilen Dönem','Tasdik Tarihi','Seri-Sıra','Sisteme Giriş'],(p.contractRows||[]).map(x=>[x.baslangic,x.bitis,x.talep,x.tasdikTarihi,x.seriSira,x.sistemeGiris]));
  appendSimpleTable(content,'Ç) Nezdinde Karşıt İnceleme Yapılan Mükellef',['Alan','Değer'],[['Adı Soyadı / Ünvanı',p.cUnvan],['Vergi/T.C. Kimlik Numarası',p.cVkn],['Vergi Dairesi',p.cVergiDairesi],['Adres',p.cAdres],['Telefon Numarası',p.cTelefon]]);
  DOLU_TABLO_CONFIGS.forEach(c=>{
    const d=state.doluTablolar[c.key];
    if(d) appendSimpleTable(content,c.title,d.headers,d.rows);
    else appendSimpleTable(content,c.title,['Durum'],[['Excel tablosu yüklenmedi. PDF’den bu bölüm okunmuyor.']]);
  });
  appendSourceTextTable(content,'Belgenin Son Kısmı / İmzalar ve Açıklamalar',TutanakTailText(state.doluTutanakRawText));
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Tutanak Görüntüle';renderNav();
}
function renderDoluTutanakMissingPage(){
  const p=requireDoluTutanak('Tutanak Eksiklik Tespit'); if(!p)return;
  currentPage='dolu-tutanak-missing'; currentStep=-1; const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Tutanak ve Tablo Ekle — Tutanak Eksiklik Tespit'));
  content.appendChild(el('p',{class:'step-desc'},'Eksiklik tespiti artık PDF’deki 1–7. bölüm metinlerini yeniden yorumlamak yerine, yüklenen doldurulmuş Excel tablolarının durumunu da kontrol eder.'));
  const issues=[];
  [['YMM adı ve soyadı',p.ymmAdSoyad],['YMM vergi/T.C. kimlik numarası',p.ymmVkn],['Tasdik hizmeti verilen mükellef ünvanı',p.tasdikMukellefUnvan],['Tasdik hizmeti verilen mükellef VKN',p.tasdikMukellefVkn],['Nezdinde karşıt inceleme yapılan mükellef ünvanı',p.cUnvan],['Nezdinde karşıt inceleme yapılan mükellef VKN',p.cVkn]].forEach(([l,v])=>{if(!String(v||'').trim())issues.push(l+' okunamadı/boş.');});
  DOLU_TABLO_CONFIGS.forEach(c=>{const d=state.doluTablolar[c.key];if(!d)issues.push(`${c.title} için doldurulmuş Excel yüklenmedi.`);else if(!d.rows.length)issues.push(`${c.title} Excel tablosu boş.`);});
  const card=el('div',{class:'card'}); if(issues.length){card.appendChild(el('div',{class:'hint warn'},`⚠️ ${issues.length} eksiklik/uyarı tespit edildi.`));const ul=el('ul',{style:'line-height:1.8;margin:10px 0 0 20px;'});issues.forEach(x=>ul.appendChild(el('li',{},x)));card.appendChild(ul);}else card.appendChild(el('div',{class:'hint ok'},'✓ Tutanak ana alanları ve 7 doldurulmuş Excel tablosu hazır.')); content.appendChild(card);
  appendSimpleTable(content,'Tablo Yükleme Özeti',['Bölüm','Dosya','Kayıt'],DOLU_TABLO_CONFIGS.map(c=>{const d=state.doluTablolar[c.key];return [c.title,d?.fileName||'Yüklenmedi',d?String(d.rows.length):'0'];}));
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Tutanak Eksiklik Tespit';renderNav();
}


function renderNav() {
  const nav=document.getElementById('step-nav'); nav.innerHTML='';

  const archiveGroup=el('div',{style:'margin-top:0;border-bottom:1px solid var(--border);padding-bottom:8px;'});
  archiveGroup.appendChild(el('div',{class:'nav-item',style:'font-weight:700;color:var(--text);',onclick:()=>{archiveMenuOpen=!archiveMenuOpen;renderNav();}},[
    el('div',{class:'num'},archiveMenuOpen?'▾':'▸'), el('div',{},'Arşiv İşlemleri')
  ]));
  if(archiveMenuOpen){
    archiveGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='archive-upload'?' active':''),style:'padding-left:50px;',onclick:()=>renderArchiveUploadPage()},[el('div',{},'Arşiv Dosyası Yükle / Oluştur')]));
    archiveGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='archive-view'?' active':''),style:'padding-left:50px;',onclick:()=>renderArchiveViewPage()},[el('div',{},'Arşiv Görüntüle')]));
    archiveGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='archive-edit'?' active':''),style:'padding-left:50px;',onclick:()=>renderArchiveEditPage()},[el('div',{},'Arşiv Düzenle')]));
    archiveGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='archive-data-import'?' active':''),style:'padding-left:50px;',onclick:()=>renderArchiveDataImportPage()},[el('div',{},'Dosyadan Veri Al')]));
  }
  nav.appendChild(archiveGroup);

  const workflowGroup=el('div',{style:'margin-top:8px;border-bottom:1px solid var(--border);padding-bottom:8px;'});
  workflowGroup.appendChild(el('div',{class:'nav-item',style:'font-weight:700;color:var(--text);',onclick:()=>{workflowMenuOpen=!workflowMenuOpen;renderNav();}},[
    el('div',{class:'num'},workflowMenuOpen?'▾':'▸'), el('div',{},'Karşıt İnceleme Doldur')
  ]));
  if(workflowMenuOpen){
    STEPS.forEach((st,i)=>{
      const item=el('div',{class:'nav-item'+(currentPage==='workflow'&&i===currentStep?' active':'')+(currentPage==='workflow'&&i<currentStep?' done':''),style:'padding-left:38px;',onclick:()=>{
        currentPage='workflow'; archiveViewParsed=null; currentStep=i; renderStep(i);
      }},[
        el('div',{class:'num'},currentPage==='workflow'&&i<currentStep?'✓':String(i+1)),
        el('div',{},st.title.replace(/^\d+\.\s*/,''))
      ]);
      workflowGroup.appendChild(item);
    });
  }
  nav.appendChild(workflowGroup);

  const doluGroup=el('div',{style:'margin-top:8px;border-bottom:1px solid var(--border);padding-bottom:8px;'});
  doluGroup.appendChild(el('div',{class:'nav-item',style:'font-weight:700;color:var(--text);',onclick:()=>{doluTutanakMenuOpen=!doluTutanakMenuOpen;renderNav();}},[
    el('div',{class:'num'},doluTutanakMenuOpen?'▾':'▸'), el('div',{},'Tutanak Cevabı İnceleme')
  ]));
  if(doluTutanakMenuOpen){
    doluGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='dolu-tutanak-upload'?' active':''),style:'padding-left:50px;',onclick:()=>renderDoluTutanakUploadPage()},[el('div',{},'Tutanak Yükle')]));
    doluGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='dolu-tablolar-upload'?' active':''),style:'padding-left:50px;',onclick:()=>renderDoluTablolarUploadPage()},[el('div',{},'Tabloları Yükle')]));
    const locked=!state.doluTutanakParsed;
    doluGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='dolu-tutanak-view'?' active':'')+(locked?' disabled':''),style:'padding-left:50px;',onclick:()=>{if(locked){alert('Önce Tutanak Yükle bölümünden PDF yükleyin.');return;}renderDoluTutanakViewPage();}},[el('div',{},'Tutanak Görüntüle')]));
    doluGroup.appendChild(el('div',{class:'nav-item'+(currentPage==='dolu-tutanak-missing'?' active':'')+(locked?' disabled':''),style:'padding-left:50px;',onclick:()=>{if(locked){alert('Önce Tutanak Yükle bölümünden PDF yükleyin.');return;}renderDoluTutanakMissingPage();}},[el('div',{},'Eksik Bilgi Kontrolü')]));
  }
  nav.appendChild(doluGroup);

  const welcome=el('div',{style:'margin-top:8px;'},[el('div',{class:'nav-item'+(currentPage==='welcome'?' active':''),onclick:()=>renderWelcomePage()},[
    el('div',{class:'num'},'⌂'), el('div',{},'Hoş Geldiniz')
  ])]);
  nav.appendChild(welcome);
}

function renderStep(i) {
  currentPage='workflow';
  if(i>0&&firstScreenMissing().length)i=0;currentStep=i;archiveViewParsed=null;
  const step=STEPS[i],content=document.getElementById('step-content');content.innerHTML='';content.appendChild(el('h2',{class:'step-title'},step.title));content.appendChild(el('p',{class:'step-desc'},step.desc));step.render(content);
  document.getElementById('btn-prev').disabled=(i===0);const blocked=i===0&&firstScreenMissing().length>0;document.getElementById('btn-next').disabled=blocked;document.getElementById('btn-next').title=blocked?'Önce başlangıç ekranındaki eksikleri tamamlayın.':'';document.getElementById('btn-next').textContent=(i===STEPS.length-1)?'Bitti ✓':'İleri →';document.getElementById('footer-msg').textContent=`Adım ${i+1} / ${STEPS.length}`;renderNav();
}

document.getElementById('btn-prev').addEventListener('click', () => {
  if (currentStep > 0) renderStep(currentStep - 1);
});
document.getElementById('btn-next').addEventListener('click', () => {
  if (currentStep === 0 && firstScreenMissing().length) { renderStep(0); return; }
  if (currentStep < STEPS.length - 1) renderStep(currentStep + 1);
  else window.scrollTo({ top: 0, behavior: 'smooth' });
});

renderWelcomePage();


