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
  'İptal/Pasif Açıklama'
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
  titleRow.appendChild(el('h3',{},'e-Karşıt Takip Kayıtları ('+data.records.length+')'));
  const filter=el('input',{class:'input',placeholder:'Tabloda ara…',style:'max-width:280px;'});
  titleRow.appendChild(filter);card.appendChild(titleRow);
  const wrap=el('div',{class:'table-scroll',style:'margin-top:10px;max-height:65vh;overflow:auto;'});
  const table=el('table',{class:'editable-table'});const thead=el('thead');const trh=el('tr');
  data.headers.forEach(h=>trh.appendChild(el('th',{style:'min-width:170px;white-space:nowrap;'},h)));
  thead.appendChild(trh);table.appendChild(thead);
  const tbody=el('tbody');table.appendChild(tbody);wrap.appendChild(table);card.appendChild(wrap);
  const draw=()=>{
    tbody.innerHTML='';
    const q=String(filter.value||'').trim().toLocaleLowerCase('tr-TR');
    const rows=data.records.filter(r=>!q||data.headers.some(h=>String(r[h]??'').toLocaleLowerCase('tr-TR').includes(q)));
    rows.forEach(r=>{
      const tr=el('tr',{style:'cursor:pointer;',title:'Düzenlemek için tıklayın'});
      tr.addEventListener('click',()=>onRowClick?.(r));
      data.headers.forEach(h=>tr.appendChild(el('td',{},String(r[h]??''))));
      tbody.appendChild(tr);
    });
    if(!rows.length) tbody.appendChild(el('tr',{},[el('td',{colSpan:String(data.headers.length),style:'text-align:center;padding:18px;color:var(--muted);'},q?'Arama sonucunda kayıt bulunamadı.':'Henüz kayıt yok.')]));
  };
  filter.addEventListener('input',draw);draw();host.appendChild(card);
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
  card.appendChild(el('div',{class:'hint info',style:'margin-bottom:10px;'},'Örnek Excel şablonundaki 15 sütun okunur. Aynı İşlem ID daha önce aktarılmışsa mevcut kayıt güncellenir; yeni İşlem ID kayıtları eklenir.'));
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
      imported.records.forEach(r=>{const id=String(r['İşlem ID']||'');if(byId.has(id)){Object.assign(byId.get(id),r);updated++;}else{data.records.unshift(r);byId.set(id,r);added++;}});
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
