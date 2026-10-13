/* GİB e-Tebligat Takip — ayrı yerel kayıt modülü */
const GIB_TEBLIGAT_FILE='GIB_TEBLIGAT_TAKIP.json';
function gibTebligatDefault(){return {schemaVersion:1,records:[],total:0,lastSync:null};}
async function gibTebligatRead(){
  if(!userStore?.directoryHandle)return gibTebligatDefault();
  try{const h=await userStore.directoryHandle.getFileHandle(GIB_TEBLIGAT_FILE);const d=JSON.parse(await(await h.getFile()).text());const records=Array.isArray(d.records)?d.records:[];let migrated=false;records.forEach(r=>GIB_TEBLIGAT_DATE_FIELDS?.forEach(field=>{if(r[field]!==undefined&&r[field]!==null&&r[field]!==''){const formatted=gibTebligatDate(r[field]);if(formatted!==r[field]){r[field]=formatted;migrated=true;}}}));const normalized={schemaVersion:1,records,total:Number(d.total||0),lastSync:d.lastSync||null};if(migrated){const w=await h.createWritable();await w.write(JSON.stringify(normalized,null,2));await w.close();}return normalized;}
  catch(e){if(e?.name==='NotFoundError')return gibTebligatDefault();throw e;}
}
async function gibTebligatWrite(d){
  if(!userStore?.directoryHandle)throw new Error('Önce kullanıcı klasörünü bağlayın.');
  const h=await userStore.directoryHandle.getFileHandle(GIB_TEBLIGAT_FILE,{create:true});const w=await h.createWritable();await w.write(JSON.stringify(d,null,2));await w.close();await userScanCurrentFolder();
}
function gibTebligatKey(r){return String(r?.tebligId||r?.tebligSecureId||r?.belgeNo||'').trim();}
function gibTebligatDate(v){
  if(v===null||v===undefined||v==='')return '';
  const raw=String(v).trim();if(!raw)return '';
  const m=raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  let d;
  if(m)d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0));
  else if(/^\d{10,13}$/.test(raw))d=new Date(Number(raw.length===10?Number(raw)*1000:raw));
  else d=new Date(raw);
  if(Number.isNaN(d.getTime()))return raw;
  const pad=n=>String(n).padStart(2,'0');
  return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}
function gibTebligatDateValue(v){
  const raw=String(v||'').trim();
  const m=raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0)).getTime();
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:d.getTime();
}
const GIB_TEBLIGAT_DATE_FIELDS=['gonderimZamani','tebligZamani','mukellefOkumaZamani'];
async function gibTebligatMerge(payload){
  const old=await gibTebligatRead(), map=new Map(old.records.map(r=>[gibTebligatKey(r),r]));
  let added=0,updated=0;
  (payload?.records||[]).forEach(r=>{
    const key=gibTebligatKey(r);if(!key)return;
    const prev=map.get(key);
    const next={...(prev||{}),...r,_key:key,_firstSeen:prev?prev._firstSeen:(new Date().toISOString()),_lastSeen:new Date().toISOString()};
    // Kullanıcının yazdığı notlar yeni GİB senkronizasyonlarında aynen korunur.
    if(prev&&Object.prototype.hasOwnProperty.call(prev,'note'))next.note=prev.note;
    GIB_TEBLIGAT_DATE_FIELDS.forEach(field=>{if(next[field]!==undefined&&next[field]!==null&&next[field]!=='')next[field]=gibTebligatDate(next[field]);});
    // Bazı GİB liste yanıtlarında güvenli kimlik secureId adıyla gelebilir.
    // Yeni aktarımda gelen güncel değeri eski kayıttaki tebligSecureId'nin üzerinde tut.
    const incomingSecureId=String(r?.tebligSecureId||r?.secureId||'').trim();
    if(incomingSecureId)next.tebligSecureId=incomingSecureId;
    if(prev)updated++;else added++;
    map.set(key,next);
  });
  const d={schemaVersion:1,records:[...map.values()].sort((a,b)=>(gibTebligatDateValue(b.gonderimZamani)||0)-(gibTebligatDateValue(a.gonderimZamani)||0)),total:Number(payload?.total||map.size),lastSync:new Date().toISOString()};
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
    const cols=[['Gönderen Kurum','kurumAciklama'],['Alt Birim','altKurum'],['Belge Türü','belgeTuruAciklama'],['Belge No','belgeNo'],['Gönderme Tarihi','gonderimZamani'],['Tebliğ Tarihi','tebligZamani'],['Mükellef Okuma Tarihi','mukellefOkumaZamani']];
    let rows=d.records.slice();
    let showHiddenOnly=false, sortKey='', sortDir=1;
    const selected=new Set();
    const bar=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0;'});
    const search=el('input',{class:'input',placeholder:'Belge no, kurum veya belge türü ara…'});
    const selectAllBtn=el('button',{class:'btn btn-secondary'},'Tümünü Seç');
    const clearBtn=el('button',{class:'btn btn-secondary'},'Seçimi Temizle');
    const hideBtn=el('button',{class:'btn btn-secondary'},'Seçilenleri Gizle');
    const hiddenBtn=el('button',{class:'btn btn-secondary'},'Gizlenen Kayıtları Göster');
    const clearDataBtn=el('button',{class:'btn btn-secondary',style:'border-color:#b42318;color:#b42318;'},'Tablodaki Tüm Veriyi Temizle');
    const exportBtn=el('button',{class:'btn btn-secondary',onclick:async()=>{
      try{const q=String(search.value||'').toLocaleLowerCase('tr-TR');const exportRows=rows.filter(r=>cols.some(([,k])=>String(r[k]||'').toLocaleLowerCase('tr-TR').includes(q)));const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('GİB Tebligat');const exportCols=[['Gönderen Kurum','kurumAciklama'],['Alt Birim','altKurum'],['Belge Türü','belgeTuruAciklama'],['Belge No','belgeNo'],['Gönderme Tarihi','gonderimZamani'],['Tebliğ Tarihi','tebligZamani'],['Mükellef Okuma Tarihi','mukellefOkumaZamani']];ws.columns=exportCols.map(([header,key])=>({header,key,width:Math.max(18,header.length+3)}));exportRows.forEach(r=>ws.addRow(Object.fromEntries(exportCols.map(([,k])=>[k,r[k]||'']))));ws.getRow(1).font={bold:true};ws.views=[{state:'frozen',ySplit:1}];const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf]));a.download='GIB_TEBLIGAT_TAKIP.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){alert('Excel oluşturulamadı: '+e.message);}
    }},'Görünen Kayıtları Excel’e Aktar');
    bar.append(search,selectAllBtn,clearBtn,hideBtn,hiddenBtn,exportBtn,clearDataBtn);card.appendChild(bar);
    const table=el('table',{class:'editable-table',style:'min-width:1080px;width:100%;table-layout:auto;'}),thead=el('thead'),trh=el('tr');
    const selectTh=el('th',{style:'width:44px;text-align:center;'});const headCheck=el('input',{type:'checkbox','aria-label':'Görünen kayıtların tümünü seç'});selectTh.appendChild(headCheck);trh.appendChild(selectTh);
    const headerNodes=[];
    cols.forEach(([h,k])=>{const th=el('th',{style:'cursor:pointer;user-select:none;'},h+' ↕');th.title='Sıralamak için tıklayın';th.addEventListener('click',()=>{if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1;}draw();});headerNodes.push({node:th,label:h,key:k});trh.appendChild(th);});
    trh.appendChild(el('th',{},'Not'));
    thead.appendChild(trh);table.appendChild(thead);const tbody=el('tbody');table.appendChild(tbody);
    const visibleRows=()=>{
      const q=String(search.value||'').toLocaleLowerCase('tr-TR');
      let result=rows.filter(r=>cols.some(([,k])=>String(r[k]||'').toLocaleLowerCase('tr-TR').includes(q)));
      result=result.filter(r=>showHiddenOnly?Boolean(r._hidden):!r._hidden);
      if(sortKey)result.sort((a,b)=>{const av=String(a[sortKey]||''),bv=String(b[sortKey]||'');const ad=GIB_TEBLIGAT_DATE_FIELDS.includes(sortKey)?gibTebligatDateValue(av):null;const bd=GIB_TEBLIGAT_DATE_FIELDS.includes(sortKey)?gibTebligatDateValue(bv):null;let cmp=ad!==null&&bd!==null?ad-bd:av.localeCompare(bv,'tr',{numeric:true,sensitivity:'base'});return cmp*sortDir;});
      return result;
    };
    const draw=()=>{
      const shown=visibleRows();tbody.innerHTML='';
      headerNodes.forEach(({node,label,key})=>{node.textContent=label+(sortKey===key?(sortDir===1?' ▲':' ▼'):' ↕');});
      shown.forEach(r=>{
        const tr=el('tr');const td=el('td',{style:'text-align:center;'});const check=el('input',{type:'checkbox','aria-label':'Kaydı seç'});check.checked=selected.has(gibTebligatKey(r));check.addEventListener('change',()=>{const key=gibTebligatKey(r);if(check.checked)selected.add(key);else selected.delete(key);updateSelectionControls();});td.appendChild(check);tr.appendChild(td);
        cols.forEach(([,k])=>tr.appendChild(el('td',{},r[k]||'—')));
        const noteTd=el('td',{style:'min-width:180px;max-width:320px;white-space:pre-wrap;cursor:pointer;'},r.note||'Not eklemek için tıklayın');
        noteTd.title='Not eklemek veya düzenlemek için tıklayın';
        noteTd.addEventListener('click',async()=>{
          const entered=window.prompt('Bu tebligat için notunuzu yazın:',String(r.note||''));
          if(entered===null)return;
          const updated={...d,records:d.records.map(item=>gibTebligatKey(item)===gibTebligatKey(r)?{...item,note:entered}:item)};
          try{await gibTebligatWrite(updated);d=updated;rows=d.records.slice();draw();}
          catch(e){alert('Not kaydedilemedi: '+e.message);}
        });
        tr.appendChild(noteTd);tbody.appendChild(tr);
      });
      if(!shown.length)tbody.appendChild(el('tr',{},[el('td',{colSpan:cols.length+2,style:'text-align:center;padding:16px;'},showHiddenOnly?'Gizlenen kayıt bulunamadı.':'Kayıt bulunamadı.')]));
      headCheck.checked=shown.length>0&&shown.every(r=>selected.has(gibTebligatKey(r)));
      headCheck.indeterminate=shown.some(r=>selected.has(gibTebligatKey(r)))&&!headCheck.checked;
      hiddenBtn.textContent=showHiddenOnly?'Tüm Kayıtları Göster ('+rows.filter(r=>!r._hidden).length+')':'Gizlenen Kayıtları Göster ('+rows.filter(r=>r._hidden).length+')';
      hideBtn.disabled=showHiddenOnly||!shown.some(r=>selected.has(gibTebligatKey(r)));
      updateSelectionControls();
    };
    const updateSelectionControls=()=>{const count=selected.size;selectAllBtn.textContent='Tümünü Seç ('+visibleRows().length+')';clearBtn.textContent='Seçimi Temizle ('+count+')';hideBtn.textContent='Seçilenleri Gizle ('+count+')';};
    headCheck.addEventListener('change',()=>{visibleRows().forEach(r=>{const key=gibTebligatKey(r);if(headCheck.checked)selected.add(key);else selected.delete(key);});draw();});
    selectAllBtn.addEventListener('click',()=>{visibleRows().forEach(r=>selected.add(gibTebligatKey(r)));draw();});
    clearBtn.addEventListener('click',()=>{selected.clear();draw();});
    clearDataBtn.addEventListener('click',async()=>{
      if(!window.confirm('DİKKAT: GİB Tebligat Takip tablosundaki tüm kayıtlar kalıcı olarak temizlenecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?'))return;
      try{const empty={schemaVersion:1,records:[],total:0,lastSync:new Date().toISOString()};await gibTebligatWrite(empty);d=empty;rows=[];selected.clear();showHiddenOnly=false;search.value='';draw();const heading=card.querySelector('h3');if(heading)heading.textContent='Tebligat Kayıtları — 0';}
      catch(e){alert('Tablo verileri temizlenemedi: '+e.message);}
    });
    hideBtn.addEventListener('click',async()=>{
      const keys=new Set(selected);if(!keys.size)return;
      const updated={...d,records:d.records.map(r=>keys.has(gibTebligatKey(r))?{...r,_hidden:true}:r),total:d.total,lastSync:d.lastSync};
      try{await gibTebligatWrite(updated);selected.clear();d=updated;rows=d.records.slice();draw();card.querySelector?.('h3');}
      catch(e){alert('Seçilen kayıtlar gizlenemedi: '+e.message);}
    });
    hiddenBtn.addEventListener('click',()=>{showHiddenOnly=!showHiddenOnly;draw();});
    search.addEventListener('input',draw);draw();
    const scroll=el('div',{class:'table-scroll',style:'border:1px solid var(--border);border-radius:6px;'});scroll.appendChild(table);card.appendChild(el('div',{class:'hint info',style:'margin:8px 0;'},'Sütun başlığına tıklayarak sıralayın. Son sütundaki Not alanına tıklayarak not ekleyebilir veya düzenleyebilirsiniz; notlar yeni senkronizasyonlarda korunur. Tarihler GG/AA/YYYY SS:DD:SS biçiminde saklanır ve tarih sırasıyla sıralanır. Gizleme kayıtları silmez; tüm veriyi temizleme işlemi onay ister. Tabloyu yatay kaydırabilirsiniz.'));card.appendChild(scroll);host.appendChild(card);
  };
  await render();
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='GİB Tebligat Takip';document.getElementById('footer-msg').textContent='GİB Tebligat Takip';renderNav();
}
