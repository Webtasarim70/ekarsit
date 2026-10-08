/* e-Karşıt Takip — kullanıcı klasöründe ayrı JSON */
const EKARSIT_TAKIP_FILE='E_KARSIT_TAKIP.json';

const EKARSIT_TAKIP_HEADERS=[
  'İşlem ID',
  'Son Düzenleme Tarihi',
  'Onay Tarihi',
  'Durum',
  'Karşıt İnceleme Talep Eden YMM VKN/TCKN',
  'Karşıt İnceleme Talep Eden YMM Adı Soyadı/Ünvanı',
  'Tasdik Hizmeti Verilen Mükellef VKN/TCKN',
  'Tasdik Hizmeti Verilen Mükellef Adı Soyadı/Ünvanı',
  'Sözleşme Başlangıç Dönemi',
  'Sözleşme Bitiş Dönemi',
  'Nezdinde Karşıt İnceleme Yapılan Mükellef Adı Soyadı/Ünvanı',
  'Nezdinde Karşıt İnceleme Yapılan Mükellef VKN/TCKN',
  'Son Düzenleme Yapan Kullanıcı T.C. Kimlik Numarası',
  'Son Düzenleme Yapan Kullanıcı Adı Soyadı/Ünvanı',
  'İptal/Pasif Açıklama',
  'Not'
];

function eKarsitTakipDefaultData(){
  return {schemaVersion:1,headers:[...EKARSIT_TAKIP_HEADERS],records:[]};
}
async function eKarsitTakipRead(){
  if(!userStore?.directoryHandle) return eKarsitTakipDefaultData();
  try{
    const h=await userStore.directoryHandle.getFileHandle(EKARSIT_TAKIP_FILE);
    const d=JSON.parse(await (await h.getFile()).text());
    const headers=Array.isArray(d?.headers)&&d.headers.length?d.headers:[...EKARSIT_TAKIP_HEADERS];
    const records=Array.isArray(d?.records)?d.records:[];
    return {schemaVersion:1,headers,records};
  }catch(e){
    if(e?.name==='NotFoundError') return eKarsitTakipDefaultData();
    throw e;
  }
}
async function eKarsitTakipWrite(data){
  if(!userStore?.directoryHandle) throw new Error('Önce Kullanıcı bölümünden bir kullanıcı klasörü seçin.');
  const h=await userStore.directoryHandle.getFileHandle(EKARSIT_TAKIP_FILE,{create:true});
  const w=await h.createWritable();
  await w.write(JSON.stringify(data,null,2));
  await w.close();
  await userScanCurrentFolder();
}
function eKarsitTakipExcelValue(v){
  if(v==null||v==='') return '';
  if(v instanceof Date){
    const dd=String(v.getDate()).padStart(2,'0');
    const mm=String(v.getMonth()+1).padStart(2,'0');
    return dd+'.'+mm+'.'+v.getFullYear();
  }
  if(typeof v==='object'){
    if(v.result!=null) return eKarsitTakipExcelValue(v.result);
    if(v.text!=null) return String(v.text);
    if(v.richText) return v.richText.map(x=>x.text||'').join('');
    if(v.formula!=null) return v.result!=null?eKarsitTakipExcelValue(v.result):String(v.formula);
  }
  if(typeof v==='number') return String(v);
  return String(v).trim();
}
function eKarsitTakipNorm(v){
  return String(v??'')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g,'')
    .replace(/[İIıi]/g,'i').replace(/[Üü]/g,'u').replace(/[Öö]/g,'o')
    .replace(/[Şş]/g,'s').replace(/[Ğğ]/g,'g').replace(/[Çç]/g,'c')
    .replace(/[^a-z0-9]/g,'');
}
function eKarsitTakipHeaderIndex(headers,name){
  const target=eKarsitTakipNorm(name);
  return headers.findIndex(h=>eKarsitTakipNorm(h)===target);
}
async function eKarsitTakipExcelImport(file){
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws=wb.worksheets[0];
  if(!ws) throw new Error('Excel çalışma sayfası bulunamadı.');

  const sourceHeaders=[];
  ws.getRow(1).eachCell({includeEmpty:true},(cell,i)=>{
    sourceHeaders[i-1]=eKarsitTakipExcelValue(cell.value);
  });
  while(sourceHeaders.length && !String(sourceHeaders[sourceHeaders.length-1]||'').trim()) sourceHeaders.pop();
  if(!sourceHeaders.length) throw new Error('Excel başlık satırı bulunamadı.');

  const required=['İşlem ID','Durum','Tasdik Hizmeti Verilen Mükellef VKN/TCKN'];
  const missing=required.filter(x=>eKarsitTakipHeaderIndex(sourceHeaders,x)<0);
  if(missing.length) throw new Error('Excel başlıkları örnek şablonla uyuşmuyor. Eksik: '+missing.join(', '));

  const records=[];
  ws.eachRow((row,ri)=>{
    if(ri===1)return;
    const values={};
    sourceHeaders.forEach((header,i)=>{
      if(header) values[header]=eKarsitTakipExcelValue(row.getCell(i+1).value);
    });
    const hasData=Object.values(values).some(v=>String(v??'').trim()!=='');
    if(!hasData)return;
    const id=String(values['İşlem ID']||'').trim() || (crypto.randomUUID?crypto.randomUUID():String(Date.now()+ri));
    values['İşlem ID']=id;
    EKARSIT_TAKIP_HEADERS.forEach(h=>{if(values[h]===undefined) values[h]='';});
    records.push(values);
  });
  return {headers:[...EKARSIT_TAKIP_HEADERS],records};
}
async function eKarsitTakipExcelYedekle(){
  const data=await eKarsitTakipRead();
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('e-Karşıt Takip');
  ws.columns=data.headers.map(h=>({header:h,key:h,width:Math.min(55,Math.max(14,h.length+2))}));
  data.records.forEach(r=>ws.addRow(data.headers.map(h=>r[h]??'')));
  ws.getRow(1).font={bold:true};
  ws.views=[{state:'frozen',ySplit:1}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='E_KARSIT_TAKIP_YEDEK.xlsx';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function eKarsitTakipRenderTable(host,data,onRowClick){
  host.innerHTML='';
  const card=el('div',{class:'card',style:'margin-top:14px;'});
  const titleRow=el('div',{style:'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;'});
  titleRow.appendChild(el('h3',{},'e-Karşıt Takip Kayıtları'));
  const globalSearch=el('input',{class:'input',placeholder:'Gelişmiş arama: ID, YMM, mükellef, durum…',style:'max-width:420px;'});
  titleRow.appendChild(globalSearch);card.appendChild(titleRow);
  const filtersWrap=el('div',{class:'table-column-filters',style:'margin-top:10px;'});
  const filters=data.headers.map(h=>{
    const box=el('div',{class:'field'});box.appendChild(el('label',{},h));
    if(h==='Durum'){
      const select=el('select',{class:'input'});
      select.appendChild(el('option',{value:''},'Tüm Durumlar'));
      const statuses=[...new Set(data.records.map(r=>String(r[h]??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr',{sensitivity:'base'}));
      statuses.forEach(status=>select.appendChild(el('option',{value:status},status)));
      box.appendChild(select);filtersWrap.appendChild(box);return select;
    }
    const input=el('input',{class:'input',placeholder:h+' filtrele…'});
    box.appendChild(input);filtersWrap.appendChild(box);return input;
  });
  card.appendChild(filtersWrap);
  const reset=el('button',{class:'btn btn-secondary',type:'button',style:'margin-top:8px;',onclick:()=>{globalSearch.value='';filters.forEach(x=>x.value='');sortIndex=-1;sortDirection=1;draw();}},'Filtreleri Temizle');card.appendChild(reset);
  let visibleRows=[];
  const exportBtn=el('button',{class:'btn btn-primary',type:'button',style:'margin:8px 0 0 8px;',onclick:async()=>{try{const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Görünen e-Karşıt');ws.columns=data.headers.map((h,i)=>({header:h,key:'c'+i,width:Math.min(55,Math.max(14,h.length+2))}));visibleRows.forEach(r=>ws.addRow(data.headers.map(h=>r[h]??'')));ws.getRow(1).font={bold:true};ws.views=[{state:'frozen',ySplit:1}];const buf=await wb.xlsx.writeBuffer();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download='E_KARSIT_TAKIP_FILTRELENMIS.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){alert('Filtrelenmiş tablo Excel’e aktarılamadı: '+e.message);}}},'⬇ Görünen Tabloyu Excel’e Aktar');card.appendChild(exportBtn);

  const wrap=el('div',{class:'table-scroll',style:'margin-top:10px;max-height:65vh;overflow:auto;'});
  const table=el('table',{class:'editable-table'});const thead=el('thead');const trh=el('tr');let sortIndex=-1,sortDirection=1;const sortHeads=[];
  data.headers.forEach((h,i)=>{const th=el('th',{class:'sortable-th',style:'min-width:170px;white-space:nowrap;cursor:pointer;',title:'Sıralamak için tıklayın','aria-sort':'none'},h+' ↕');th.addEventListener('click',()=>{sortDirection=sortIndex===i?-sortDirection:1;sortIndex=i;draw();});sortHeads.push(th);trh.appendChild(th);});
  thead.appendChild(trh);table.appendChild(thead);const tbody=el('tbody');table.appendChild(tbody);wrap.appendChild(table);card.appendChild(wrap);
  const draw=()=>{
    tbody.innerHTML='';
    const q=String(globalSearch.value||'').trim().toLocaleLowerCase('tr-TR');
    let rows=data.records.filter(r=>{
      const vals=data.headers.map(h=>String(r[h]??''));
      return (!q||vals.some(v=>v.toLocaleLowerCase('tr-TR').includes(q)))&&filters.every((input,i)=>!input.value.trim()||data.headers[i]==='Durum'?(!input.value.trim()||vals[i].toLocaleLowerCase('tr-TR')===input.value.trim().toLocaleLowerCase('tr-TR')):(!input.value.trim()||vals[i].toLocaleLowerCase('tr-TR').includes(input.value.trim().toLocaleLowerCase('tr-TR'))));
    });
    if(sortIndex>=0)rows.sort((a,b)=>String(a[data.headers[sortIndex]]??'').localeCompare(String(b[data.headers[sortIndex]]??''),'tr',{numeric:true,sensitivity:'base'})*sortDirection);
    visibleRows=rows.slice();
    sortHeads.forEach((th,i)=>{th.textContent=data.headers[i]+' '+(sortIndex===i?(sortDirection===1?'▲':'▼'):'↕');th.setAttribute('aria-sort',sortIndex===i?(sortDirection===1?'ascending':'descending'):'none');});
    titleRow.querySelector('h3').textContent='e-Karşıt Takip Kayıtları ('+rows.length+' / '+data.records.length+')';
    rows.forEach(r=>{
      const tr=el('tr',{style:'cursor:pointer;',title:'Düzenlemek için tıklayın'});
      tr.addEventListener('click',()=>onRowClick?.(r));
      data.headers.forEach(h=>tr.appendChild(el('td',{},String(r[h]??''))));
      tbody.appendChild(tr);
    });
    if(!rows.length)tbody.appendChild(el('tr',{},[el('td',{colSpan:String(data.headers.length),style:'text-align:center;padding:18px;color:var(--muted);'},'Filtreye uygun kayıt bulunamadı.')]));
  };
  globalSearch.addEventListener('input',draw);filters.forEach(input=>input.addEventListener(input.tagName==='SELECT'?'change':'input',draw));draw();host.appendChild(card);
}

function eKarsitTakipGibNormalizeRecord(source){
  const r=source||{};
  const record={};
  record['İşlem ID']=String(r.islemId??'').trim();
  record['Son Düzenleme Tarihi']=String(r.sonDuzenlemeTarihi??'').trim();
  record['Onay Tarihi']=String(r.onayTarihi??'').trim();
  record['Durum']=r.isPasif===true||r.pasif===true?'Pasife Çekilmiş':String(r.durum??'').trim();
  record['Karşıt İnceleme Talep Eden YMM VKN/TCKN']=String(r.karsitIsteyenYmmVkn??'').trim();
  record['Karşıt İnceleme Talep Eden YMM Adı Soyadı/Ünvanı']=String(r.karsitIsteyenYmmAdSoyad??'').trim();
  record['Tasdik Hizmeti Verilen Mükellef VKN/TCKN']=String(r.karsitIsteyenMukellefVknTckn??'').trim();
  record['Tasdik Hizmeti Verilen Mükellef Adı Soyadı/Ünvanı']=String(r.karsitIsteyenMukellefAdSoyad??'').trim();
  record['Sözleşme Başlangıç Dönemi']=String(r.sozlesmeBaslangicDonemi??'').trim();
  record['Sözleşme Bitiş Dönemi']=String(r.sozlesmeBitisDonemi??'').trim();
  record['Nezdinde Karşıt İnceleme Yapılan Mükellef Adı Soyadı/Ünvanı']=String(r.nezdindeIncelemeYapilanMukellefAdSoyad??'').trim();
  record['Nezdinde Karşıt İnceleme Yapılan Mükellef VKN/TCKN']=String(r.nezdindeIncelemeYapilanMukellefVknTckn??'').trim();
  record['Son Düzenleme Yapan Kullanıcı T.C. Kimlik Numarası']=String(r.yaziyiOlusturanTckn??'').trim();
  record['Son Düzenleme Yapan Kullanıcı Adı Soyadı/Ünvanı']=String(r.yaziyiOlusturanAdSoyad??'').trim();
  record['İptal/Pasif Açıklama']=String(r.iptalPasifAciklama??'').trim();
  record['Not']='';
  return record;
}

async function eKarsitTakipApplyGibData(payload){
  if(!payload||!Array.isArray(payload.records)) throw new Error('GİB aktarım verisi bulunamadı.');
  if(!userStore?.directoryHandle) throw new Error('Önce Kullanıcı bölümünden bir kullanıcı klasörü seçin.');

  const data=await eKarsitTakipRead();
  const byId=new Map(data.records.map(r=>[String(r['İşlem ID']||''),r]));
  let added=0,updated=0;
  const incomingIds=new Set();

  payload.records.forEach(source=>{
    const record=eKarsitTakipGibNormalizeRecord(source);
    const id=record['İşlem ID'];
    if(!id||incomingIds.has(id)) return;
    incomingIds.add(id);

    if(byId.has(id)){
      const existing=byId.get(id);
      const notValue=existing['Not']??'';
      Object.assign(existing,record);
      existing['Not']=notValue;
      updated++;
    }else{
      data.records.unshift(record);
      byId.set(id,record);
      added++;
    }
  });

  data.headers=[...EKARSIT_TAKIP_HEADERS];
  await eKarsitTakipWrite(data);
  const fresh=await eKarsitTakipRead();

  if(typeof renderEKarsitTakipPage==='function' && currentPage==='e-karsit-takip'){
    await renderEKarsitTakipPage();
  }

  return {added,updated,total:fresh.records.length,received:payload.records.length,pages:payload.fetchedPages||0};
}

window.addEventListener('message',async event=>{
  if(event.source!==window || event.data?.source!=='ekarsit-gib-extension' || event.data.type!=='EKARSIT_GIB_DATA') return;
  try{
    const result=await eKarsitTakipApplyGibData(event.data.payload);
    window.postMessage({source:'ekarsit-app',type:'EKARSIT_GIB_APPLY_RESULT',result},'*');
  }catch(error){
    window.postMessage({source:'ekarsit-app',type:'EKARSIT_GIB_APPLY_ERROR',message:error?.message||String(error)},'*');
  }
});

function eKarsitTakipDateForInput(value){
  const m=String(value||'').trim().match(/^(\\d{2})\\.(\\d{2})\\.(\\d{4})$/);
  return m?m[3]+'-'+m[2]+'-'+m[1]:'';
}
function eKarsitTakipDateFromInput(value){
  const m=String(value||'').trim().match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  return m?m[3]+'.'+m[2]+'.'+m[1]:'';
}
function eKarsitTakipEditor(host,data,record,onSaved){
  host.innerHTML='';
  const editing=!!record;
  const card=el('div',{class:'card',style:'margin-top:14px;'});
  card.appendChild(el('h3',{},editing?'e-Karşıt Kaydını Düzenle':'e-Karşıt Kaydı Ekle'));
  card.appendChild(el('div',{class:'hint info',style:'margin-bottom:12px;'},editing?'Kaydı düzenleyip kaydetmek için alanları değiştirin.':'Exceldeki 15 sütunla aynı alanları elle doldurarak yeni kayıt ekleyebilirsiniz.'));
  const form=el('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;'});
  const controls={};
  const dateFields=new Set(['Son Düzenleme Tarihi','Onay Tarihi']);
  EKARSIT_TAKIP_HEADERS.forEach(h=>{
    const box=el('div');
    box.appendChild(el('label',{style:'display:block;font-weight:600;margin-bottom:4px;'},h));
    const input=h==='Not'?el('textarea',{class:'input',style:'width:100%;box-sizing:border-box;min-height:90px;resize:vertical;',placeholder:h}):el('input',{class:'input',style:'width:100%;box-sizing:border-box;',placeholder:h});
    if(dateFields.has(h)){input.type='date';input.value=eKarsitTakipDateForInput(record?.[h]);}
    else{input.type='text';input.value=String(record?.[h]??'');}
    if(h==='İşlem ID'&&editing) input.readOnly=true;
    controls[h]=input;box.appendChild(input);form.appendChild(box);
  });
  card.appendChild(form);
  const actions=el('div',{style:'margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;'});
  const saveBtn=el('button',{class:'btn btn-primary'},editing?'💾 Değişiklikleri Kaydet':'➕ Kaydı Ekle');
  const cancelBtn=el('button',{class:'btn btn-secondary'},'Vazgeç');
  actions.appendChild(saveBtn);actions.appendChild(cancelBtn);card.appendChild(actions);
  const status=el('div',{class:'hint',style:'margin-top:10px;display:none;'});card.appendChild(status);host.appendChild(card);
  cancelBtn.addEventListener('click',()=>{host.innerHTML='';onSaved?.(false);});
  saveBtn.addEventListener('click',async()=>{
    try{
      const values={};
      EKARSIT_TAKIP_HEADERS.forEach(h=>values[h]=dateFields.has(h)?eKarsitTakipDateFromInput(controls[h].value):String(controls[h].value||'').trim());
      if(!values['İşlem ID']) throw new Error('İşlem ID boş bırakılamaz.');
      if(!values['Durum']) throw new Error('Durum boş bırakılamaz.');
      if(!values['Tasdik Hizmeti Verilen Mükellef VKN/TCKN']) throw new Error('Tasdik Hizmeti Verilen Mükellef VKN/TCKN boş bırakılamaz.');
      if(editing) Object.assign(record,values);
      else{
        if(data.records.some(r=>String(r['İşlem ID']||'')===values['İşlem ID'])) throw new Error('Bu İşlem ID zaten kayıtlı. Mevcut kaydı düzenleyin.');
        data.records.unshift(values);
      }
      data.headers=[...EKARSIT_TAKIP_HEADERS];
      await eKarsitTakipWrite(data);
      const fresh=await eKarsitTakipRead();
      status.style.display='block';status.className='hint ok';status.textContent=editing?'✓ Kayıt güncellendi.':'✓ Kayıt eklendi.';
      setTimeout(()=>onSaved?.(true,fresh),200);
    }catch(e){status.style.display='block';status.className='hint warn';status.textContent='⚠️ Kaydedilemedi: '+e.message;}
  });
}

async function renderEKarsitTakipPage(){
  currentPage='e-karsit-takip'; archiveViewParsed=null; currentStep=-1;
  const content=document.getElementById('step-content');
  content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'e-Karşıt Takip'));
  content.appendChild(el('p',{class:'step-desc'},'e-Karşıt sisteminden alınan Excel listesini kullanıcı klasörünüze kaydedin ve tablo halinde görüntüleyin.'));
  const host=el('div'); content.appendChild(host);

  if(!userStore?.directoryHandle){
    host.appendChild(el('div',{class:'card'},[el('div',{class:'hint warn'},'Önce Kullanıcı → Kullanıcı bölümünden bir kullanıcı klasörü seçin.')]));
    document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;
    document.getElementById('footer-msg').textContent='e-Karşıt Takip';renderNav();return;
  }

  let data;
  try{data=await eKarsitTakipRead();}catch(e){
    host.appendChild(el('div',{class:'card'},[el('div',{class:'hint warn'},'⚠️ Takip dosyası okunamadı: '+e.message)]));return;
  }

  const editorHost=el('div');const tableHost=el('div');
  const openEditor=record=>{
    eKarsitTakipEditor(editorHost,data,record,async(saved,fresh)=>{
      editorHost.innerHTML='';
      if(saved) data=fresh||await eKarsitTakipRead();
      eKarsitTakipRenderTable(tableHost,data,openEditor);
    });
  };

  const card=el('div',{class:'card'});
  card.appendChild(el('h3',{},'Excel Listesi'));
  card.appendChild(el('div',{class:'hint info',style:'margin-bottom:10px;'},'Örnek Excel şablonundaki alanlar okunur. Aynı İşlem ID daha önce aktarılmışsa mevcut kayıt güncellenir; yeni İşlem ID kayıtları eklenir. Not alanı Excel aktarımında mevcut kayıtlar için korunur.'));
  const input=el('input',{type:'file',accept:'.xlsx,.xlsm',style:'display:none;'});
  const importBtn=el('button',{class:'btn btn-primary',onclick:()=>input.click()},'⬆ Excel Yükle');
  const backupBtn=el('button',{class:'btn btn-secondary',style:'margin-left:8px;',onclick:async()=>{try{await eKarsitTakipExcelYedekle();}catch(e){alert('Excel yedeği oluşturulamadı: '+e.message);}}},'⬇ Excel’e Aktar');
  const addBtn=el('button',{class:'btn btn-primary',style:'margin-left:8px;',onclick:()=>openEditor(null)},'➕ Elle Kayıt Ekle');
  const status=el('div',{class:'hint info',style:'margin-top:10px;display:none;'});
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    try{
      const imported=await eKarsitTakipExcelImport(file);
      const byId=new Map(data.records.map(r=>[String(r['İşlem ID']||''),r]));let added=0,updated=0;
      imported.records.forEach(r=>{const id=String(r['İşlem ID']||'');if(byId.has(id)){const existing=byId.get(id);const notValue=existing['Not']??'';Object.assign(existing,r);existing['Not']=notValue;updated++;}else{data.records.unshift(r);byId.set(id,r);added++;}});
      data.headers=[...EKARSIT_TAKIP_HEADERS];await eKarsitTakipWrite(data);data=await eKarsitTakipRead();
      status.style.display='block';status.className='hint ok';status.textContent='✓ Excel aktarıldı. '+added+' yeni kayıt, '+updated+' güncellenen kayıt.';
      eKarsitTakipRenderTable(tableHost,data,openEditor);
    }catch(e){status.style.display='block';status.className='hint warn';status.textContent='⚠️ Excel aktarılamadı: '+e.message;}
    input.value='';
  });
  card.appendChild(importBtn);card.appendChild(backupBtn);card.appendChild(addBtn);card.appendChild(input);card.appendChild(status);
  host.appendChild(card);host.appendChild(editorHost);host.appendChild(tableHost);
  eKarsitTakipRenderTable(tableHost,data,openEditor);

  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;
  document.getElementById('footer-msg').textContent='e-Karşıt Takip';renderNav();
}
