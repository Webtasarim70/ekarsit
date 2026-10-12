/* GİB e-Tebligat Takip — ayrı yerel kayıt modülü */
const GIB_TEBLIGAT_FILE='GIB_TEBLIGAT_TAKIP.json';
function gibTebligatDefault(){return {schemaVersion:1,records:[],total:0,lastSync:null};}
async function gibTebligatRead(){
  if(!userStore?.directoryHandle)return gibTebligatDefault();
  try{const h=await userStore.directoryHandle.getFileHandle(GIB_TEBLIGAT_FILE);const d=JSON.parse(await(await h.getFile()).text());return {schemaVersion:1,records:Array.isArray(d.records)?d.records:[],total:Number(d.total||0),lastSync:d.lastSync||null};}
  catch(e){if(e?.name==='NotFoundError')return gibTebligatDefault();throw e;}
}
async function gibTebligatWrite(d){
  if(!userStore?.directoryHandle)throw new Error('Önce kullanıcı klasörünü bağlayın.');
  const h=await userStore.directoryHandle.getFileHandle(GIB_TEBLIGAT_FILE,{create:true});const w=await h.createWritable();await w.write(JSON.stringify(d,null,2));await w.close();await userScanCurrentFolder();
}
function gibTebligatKey(r){return String(r?.tebligId||r?.tebligSecureId||r?.belgeNo||'').trim();}
function gibTebligatDate(v){return String(v||'').trim();}
async function gibTebligatMerge(payload){
  const old=await gibTebligatRead(), map=new Map(old.records.map(r=>[gibTebligatKey(r),r]));
  let added=0,updated=0;
  (payload?.records||[]).forEach(r=>{
    const key=gibTebligatKey(r);if(!key)return;
    const prev=map.get(key);
    const next={...(prev||{}),...r,_key:key,_firstSeen:prev?prev._firstSeen:(new Date().toISOString()),_lastSeen:new Date().toISOString()};
    if(prev)updated++;else added++;
    map.set(key,next);
  });
  const d={schemaVersion:1,records:[...map.values()].sort((a,b)=>String(b.gonderimZamani||'').localeCompare(String(a.gonderimZamani||''))),total:Number(payload?.total||map.size),lastSync:new Date().toISOString()};
  await gibTebligatWrite(d);return {added,updated,total:d.records.length,reportedTotal:d.total};
}
window.addEventListener('message',async e=>{
  if(e.source!==window||e.data?.source!=='ekarsit-gib-extension'||e.data.type!=='GIB_TEBLIGAT_DATA')return;
  try{const result=await gibTebligatMerge(e.data.payload);window.postMessage({source:'ekarsit-gib-app',type:'GIB_TEBLIGAT_SYNC_RESULT',result},'*');if(typeof renderGibTebligatTakipPage==='function'&&currentPage==='gib-tebligat-takip')await renderGibTebligatTakipPage();}
  catch(err){window.postMessage({source:'ekarsit-gib-app',type:'GIB_TEBLIGAT_SYNC_ERROR',message:err?.message||String(err)},'*');}
});
async function renderGibTebligatTakipPage(){
  currentPage='gib-tebligat-takip';archiveViewParsed=null;currentStep=-1;
  const content=document.getElementById('step-content');content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'GİB Tebligat Takip'));
  content.appendChild(el('p',{class:'step-desc'},'GİB e-Tebligat listesini ayrı bir yerel dosyada saklar. Eklentiden alınan yeni kayıtlar mevcut kayıtlarla birleştirilir.'));
  const host=el('div');content.appendChild(host);
  const render=async()=>{
    host.innerHTML='';
    if(!userStore?.directoryHandle){host.appendChild(el('div',{class:'hint warn'},'Önce Kullanıcı bölümünden bir kullanıcı klasörü seçin.'));return;}
    let d;try{d=await gibTebligatRead();}catch(e){host.appendChild(el('div',{class:'hint warn'},'Kayıt dosyası okunamadı: '+e.message));return;}
    const card=el('div',{class:'card'});
    card.appendChild(el('h3',{},'Tebligat Kayıtları — '+d.records.length+(d.total&&d.total!==d.records.length?' / GİB toplamı '+d.total:'')));
    card.appendChild(el('div',{class:'hint info'},'Son güncelleme: '+(d.lastSync?new Date(d.lastSync).toLocaleString('tr-TR'):'Henüz senkronizasyon yapılmadı')));
    const bar=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;'});
    const search=el('input',{class:'input',placeholder:'Belge no, kurum veya belge türü ara…'});
    const exportBtn=el('button',{class:'btn btn-secondary',onclick:async()=>{
      try{const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('GİB Tebligat');const cols=[['Gönderen Kurum','kurumAciklama'],['Alt Birim','altKurum'],['Belge Türü','belgeTuruAciklama'],['Belge No','belgeNo'],['Gönderme Tarihi','gonderimZamani'],['Tebliğ Tarihi','tebligZamani'],['Mükellef Okuma Tarihi','mukellefOkumaZamani']];ws.columns=cols.map(([header,key])=>({header,key,width:Math.max(18,header.length+3)}));rows.forEach(r=>ws.addRow(Object.fromEntries(cols.map(([,k])=>[k,r[k]||'']))));ws.getRow(1).font={bold:true};ws.views=[{state:'frozen',ySplit:1}];const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf]));a.download='GIB_TEBLIGAT_TAKIP.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){alert('Excel oluşturulamadı: '+e.message);}
    }},'Görünen Kayıtları Excel’e Aktar');
    bar.append(search,exportBtn);card.appendChild(bar);
    const table=el('table',{class:'editable-table'}),thead=el('thead'),trh=el('tr');
    const cols=[['Gönderen Kurum','kurumAciklama'],['Alt Birim','altKurum'],['Belge Türü','belgeTuruAciklama'],['Belge No','belgeNo'],['Gönderme Tarihi','gonderimZamani'],['Tebliğ Tarihi','tebligZamani'],['Mükellef Okuma Tarihi','mukellefOkumaZamani']];
    cols.forEach(([h])=>trh.appendChild(el('th',{},h)));thead.appendChild(trh);table.appendChild(thead);const tbody=el('tbody');table.appendChild(tbody);
    let rows=d.records.slice();
    const draw=()=>{const q=String(search.value||'').toLocaleLowerCase('tr-TR');const shown=rows.filter(r=>cols.some(([,k])=>String(r[k]||'').toLocaleLowerCase('tr-TR').includes(q)));tbody.innerHTML='';shown.forEach(r=>{const tr=el('tr');cols.forEach(([,k])=>tr.appendChild(el('td',{},r[k]||'—')));tbody.appendChild(tr);});if(!shown.length)tbody.appendChild(el('tr',{},[el('td',{colSpan:7,style:'text-align:center;padding:16px;'},'Kayıt bulunamadı.')]));};
    search.addEventListener('input',draw);draw();const scroll=el('div',{class:'table-scroll'});scroll.appendChild(table);card.appendChild(scroll);host.appendChild(card);
  };
  await render();
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='GİB Tebligat Takip';document.getElementById('footer-msg').textContent='GİB Tebligat Takip';renderNav();
}
