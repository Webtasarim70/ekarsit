/* Tebligat Yazı Takip — kullanıcı klasöründe ayrı JSON dosyası */
const TEBLIGAT_YAZI_FILE='TEBLIGAT_YAZI_TAKIP.json';

function tebligatDefaultData(){ return {schemaVersion:1,records:[]}; }

async function tebligatRead(){
  if(!userStore?.directoryHandle) return tebligatDefaultData();
  try{
    const h=await userStore.directoryHandle.getFileHandle(TEBLIGAT_YAZI_FILE);
    const data=JSON.parse(await (await h.getFile()).text());
    return {schemaVersion:1,records:Array.isArray(data?.records)?data.records:[]};
  }catch(e){
    if(e?.name==='NotFoundError') return tebligatDefaultData();
    throw e;
  }
}
async function tebligatWrite(data){
  if(!userStore?.directoryHandle) throw new Error('Önce Kullanıcı İşlemleri bölümünden kullanıcı klasörünü seçin.');
  const h=await userStore.directoryHandle.getFileHandle(TEBLIGAT_YAZI_FILE,{create:true});
  const w=await h.createWritable();
  await w.write(JSON.stringify(data,null,2)); await w.close();
  await userScanCurrentFolder();
}
function tebligatDateValue(v){
  const s=String(v||'').trim();
  if(!s) return '';
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return m[3]+'.'+m[2]+'.'+m[1];
  m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  return m?String(m[1]).padStart(2,'0')+'.'+String(m[2]).padStart(2,'0')+'.'+m[3]:s;
}
function tebligatDateInput(v){
  const m=String(v||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m?m[3]+'-'+m[2]+'-'+m[1]:'';
}
function tebligatDateDisplay(v){ return String(v||''); }
function tebligatYaziTakipYaklasanCount(records){
  const today=new Date(); today.setHours(0,0,0,0);
  const limit=new Date(today); limit.setDate(limit.getDate()+5);
  return (Array.isArray(records)?records:[]).filter(r=>{
    const m=String(r?.sonTarih||'').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(!m) return false;
    const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
    d.setHours(0,0,0,0);
    return !Number.isNaN(d.getTime()) && d>=today && d<=limit;
  }).length;
}
let tebligatYaziTakipBadgeCount=0;
async function tebligatYaziTakipRefreshBadge(){
  if(!userStore?.directoryHandle){ tebligatYaziTakipBadgeCount=0; return 0; }
  try{
    const data=await tebligatRead();
    tebligatYaziTakipBadgeCount=tebligatYaziTakipYaklasanCount(data.records);
  }catch(e){
    tebligatYaziTakipBadgeCount=0;
  }
  const badge=document.getElementById('tebligat-yazi-takip-badge');
  if(badge){
    badge.textContent=String(tebligatYaziTakipBadgeCount);
    badge.style.display=tebligatYaziTakipBadgeCount>0?'inline-flex':'none';
  }
  return tebligatYaziTakipBadgeCount;
}

// Excel içe/dışa aktarma
function tebligatExcelValue(v){
  if(v==null||v==='') return '';
  if(v instanceof Date) return tebligatDateValue(v.toISOString().slice(0,10));
  if(typeof v==='object'){
    if(v.result!=null) return tebligatExcelValue(v.result);
    if(v.text!=null) return String(v.text);
  }
  if(typeof v==='number'){
    const d=new Date(Math.round((v-25569)*86400*1000));
    if(!Number.isNaN(d.getTime())) return tebligatDateValue(d.toISOString().slice(0,10));
  }
  return String(v).trim();
}
function tebligatExcelNorm(v){
  return String(v??'').toLocaleLowerCase('tr-TR').replace(/\s+/g,'').replace(/[İIıi]/g,'i').replace(/[Üü]/g,'u').replace(/[Öö]/g,'o').replace(/[Şş]/g,'s').replace(/[Ğğ]/g,'g').replace(/[Çç]/g,'c').replace(/[^a-z0-9]/g,'');
}
function tebligatExcelHeaderMap(headers){
  const aliases={
    mukellef:['ilgilimukellef','mukellef','mukellefadiunvan','mukellefadi','unvan'],
    donem:['donem','donemi'],
    yaziTarihi:['yazitarihi','yazitarih'],
    tebligTarihi:['tebligatarihi','tebligtarihi','tebligTarihi','tebligarihi'],
    sonTarih:['sontarih','sontebligtarihi'],
    durum:['durum']
  };
  const map={};
  headers.forEach((h,i)=>{const n=tebligatExcelNorm(h);for(const k of Object.keys(aliases)){if(aliases[k].includes(n)&&map[k]==null)map[k]=i;}});
  return map;
}
async function tebligatExcelImport(file){
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
  const ws=wb.worksheets[0]; if(!ws) throw new Error('Excel çalışma sayfası bulunamadı.');
  const headers=[]; ws.getRow(1).eachCell({includeEmpty:true},(cell,i)=>headers[i-1]=tebligatExcelValue(cell.value));
  const map=tebligatExcelHeaderMap(headers);
  if(map.mukellef==null||map.donem==null||map.sonTarih==null) throw new Error('Excel başlıklarında en az İlgili Mükellef, Dönem ve Son Tarih bulunmalıdır.');
  const records=[]; ws.eachRow((row,ri)=>{
    if(ri===1)return;
    const get=k=>map[k]==null?'':tebligatExcelValue(row.getCell(map[k]+1).value);
    const muk=String(get('mukellef')).trim(), don=String(get('donem')).trim(), son=String(get('sonTarih')).trim();
    if(!muk&&!don&&!son)return;
    if(!muk||!don||!son)return;
    records.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+ri)),mukellef:muk,donem:don,yaziTarihi:tebligatDateValue(get('yaziTarihi')),tebligTarihi:tebligatDateValue(get('tebligTarihi')),sonTarih:tebligatDateValue(son),durum:String(get('durum')||'diğer').trim()||'diğer',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  });
  return records;
}
async function tebligatExcelYedekle(){
  const data=await tebligatRead();
  const wb=new ExcelJS.Workbook(); const ws=wb.addWorksheet('Tebligat Yazı Takip');
  ws.columns=[{header:'İlgili Mükellef',key:'mukellef',width:34},{header:'Dönem',key:'donem',width:14},{header:'Yazı Tarihi',key:'yaziTarihi',width:16},{header:'Tebliğ Tarihi',key:'tebligTarihi',width:16},{header:'Son Tarih',key:'sonTarih',width:16},{header:'Durum',key:'durum',width:20}];
  data.records.forEach(r=>ws.addRow(r)); ws.getRow(1).font={bold:true};
  const buf=await wb.xlsx.writeBuffer(); const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='TEBLIGAT_YAZI_TAKIP_YEDEK.xlsx'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

let tebligatEditingId=null;
async function renderTebligatYaziTakipPage(){
  currentPage='tebligat-yazi-takip'; archiveViewParsed=null; currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Tebligat Yazı Takip'));
  content.appendChild(el('p',{class:'step-desc'},'Tebligat ve yazı kayıtlarını kullanıcı klasörünüzde ayrı bir dosyada saklayabilir, düzenleyebilir ve silebilirsiniz.'));
  const host=el('div'); content.appendChild(host);

  const render=async()=>{
    host.innerHTML='';
    if(!userStore?.directoryHandle){
      const c=el('div',{class:'card'});
      c.appendChild(el('div',{class:'hint warn'},'Önce Kullanıcı → Kullanıcı bölümünden bir kullanıcı klasörü seçin.'));
      host.appendChild(c); return;
    }
    let data;
    try{ data=await tebligatRead(); }catch(e){
      host.appendChild(el('div',{class:'hint warn'},'⚠️ Kayıt dosyası okunamadı: '+e.message)); return;
    }
    const formCard=el('div',{class:'card'});
    formCard.appendChild(el('h3',{},'Yeni Tebligat / Yazı Kaydı'));
    const excelBar=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px;'});
    const importInput=el('input',{type:'file',accept:'.xlsx,.xlsm',style:'display:none;'});
    const importBtn=el('button',{class:'btn btn-secondary',onclick:()=>importInput.click()},'⬆ Excelden Liste Al');
    const backupBtn=el('button',{class:'btn btn-secondary',onclick:async()=>{try{await tebligatExcelYedekle();}catch(e){alert('Excel yedeği oluşturulamadı: '+e.message);}}},'⬇ Excel\'e Yedekle');
    const excelStatus=el('div',{class:'hint info',style:'margin:8px 0;display:none;'});
    importInput.addEventListener('change',async()=>{
      const file=importInput.files?.[0]; if(!file)return;
      try{
        const imported=await tebligatExcelImport(file);
        if(!imported.length){excelStatus.style.display='block';excelStatus.textContent='Excelde aktarılacak kayıt bulunamadı.';return;}
        const mevcut=await tebligatRead();
        mevcut.records=[...imported,...mevcut.records];
        await tebligatWrite(mevcut);
        excelStatus.style.display='block';excelStatus.className='hint ok';excelStatus.textContent='✓ '+imported.length+' kayıt Excelden listeye eklendi.';
        await render();
      }catch(e){excelStatus.style.display='block';excelStatus.className='hint warn';excelStatus.textContent='⚠️ Excel aktarılamadı: '+e.message;}
      importInput.value='';
    });
    excelBar.appendChild(importBtn);excelBar.appendChild(backupBtn);excelBar.appendChild(importInput);formCard.appendChild(excelBar);formCard.appendChild(excelStatus);
    const grid=el('div',{class:'archive-create-grid',style:'margin-top:12px;'});
    const mukellef=el('input',{class:'input',placeholder:'Mükellef adı / unvanı'});
    const donem=el('input',{class:'input',placeholder:'Örn. 01/2026'});
    const yaziTarihi=el('input',{class:'input',type:'date'});
    const tebligTarihi=el('input',{class:'input',type:'date'});
    const sonTarih=el('input',{class:'input',type:'date'});
    const durum=el('select',{class:'input'});
    ['yazı gönderildi','cevaplandı','tamamlandı','diğer'].forEach(x=>durum.appendChild(el('option',{value:x},x)));
    [['İlgili Mükellef *',mukellef],['Dönem *',donem],['Yazı Tarihi',yaziTarihi],['Tebliğ Tarihi',tebligTarihi],['Son Tarih *',sonTarih],['Durum',durum]].forEach(([label,input])=>{
      const f=el('div',{class:'field'}); f.appendChild(el('label',{},label)); f.appendChild(input); grid.appendChild(f);
    });
    const editing=tebligatEditingId?data.records.find(x=>x.id===tebligatEditingId):null;
    if(editing){
      mukellef.value=editing.mukellef||''; donem.value=editing.donem||''; yaziTarihi.value=tebligatDateInput(editing.yaziTarihi); tebligTarihi.value=tebligatDateInput(editing.tebligTarihi); sonTarih.value=tebligatDateInput(editing.sonTarih); durum.value=editing.durum||'diğer';
    }
    formCard.querySelector('h3').textContent=editing?'Tebligat / Yazı Kaydını Düzenle':'Yeni Tebligat / Yazı Kaydı';
    const status=el('div',{style:'margin-top:10px;'});
    const saveBtn=el('button',{class:'btn btn-primary',style:'margin-top:12px;',onclick:async()=>{
      const m=String(mukellef.value||'').trim(), d=String(donem.value||'').trim(), s=String(sonTarih.value||'').trim();
      if(!m||!d||!s){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ İlgili Mükellef, Dönem ve Son Tarih zorunludur.'));return;}
      try{
        if(tebligatEditingId){
          const r=data.records.find(x=>x.id===tebligatEditingId); if(!r)return;
          r.mukellef=m;r.donem=d;r.yaziTarihi=tebligatDateValue(yaziTarihi.value);r.tebligTarihi=tebligatDateValue(tebligTarihi.value);r.sonTarih=tebligatDateValue(s);r.durum=durum.value;r.updatedAt=new Date().toISOString();
          tebligatEditingId=null;
        }else{
          data.records.unshift({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),mukellef:m,donem:d,yaziTarihi:tebligatDateValue(yaziTarihi.value),tebligTarihi:tebligatDateValue(tebligTarihi.value),sonTarih:tebligatDateValue(s),durum:durum.value,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
        }
        await tebligatWrite(data); status.innerHTML=''; status.appendChild(el('div',{class:'hint ok'},editing?'✓ Kayıt güncellendi.':'✓ Kayıt kullanıcı klasörüne kaydedildi.')); await render();
      }catch(e){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ Kayıt kaydedilemedi: '+e.message));}
    }},editing?'💾 Değişiklikleri Kaydet':'＋ Kaydı Ekle');
    if(editing) formCard.appendChild(el('button',{class:'btn btn-secondary',style:'margin:12px 0 0 8px;',onclick:async()=>{tebligatEditingId=null;await render();}},'İptal'));
    formCard.appendChild(grid);formCard.appendChild(saveBtn);formCard.appendChild(status);host.appendChild(formCard);

    const listCard=el('div',{class:'card',style:'margin-top:14px;'});
    listCard.appendChild(el('h3',{},'Kayıtlar — '+data.records.length));
    if(!data.records.length){listCard.appendChild(el('div',{class:'hint info'},'Henüz kayıt bulunmuyor.'));host.appendChild(listCard);return;}
    const columns=[['İlgili Mükellef',r=>r.mukellef],['Dönem',r=>r.donem],['Yazı Tarihi',r=>r.yaziTarihi],['Tebliğ Tarihi',r=>r.tebligTarihi],['Son Tarih',r=>r.sonTarih],['Durum',r=>r.durum]];
    const tools=el('div',{class:'table-search-tools'});
    const globalSearch=el('input',{class:'input',placeholder:'Gelişmiş arama: mükellef, dönem, tarih, durum…'});
    tools.appendChild(globalSearch);
    const fieldFilters=el('div',{class:'table-column-filters'});
    const filters=columns.map(([label])=>{const box=el('div',{class:'field'});box.appendChild(el('label',{},label+' filtresi'));const input=el('input',{class:'input',placeholder:label+' ara…'});box.appendChild(input);fieldFilters.appendChild(box);return input;});
    tools.appendChild(fieldFilters);listCard.appendChild(tools);
    const table=el('table',{class:'editable-table'});
    const thead=el('thead');const head=el('tr');let sortIndex=-1,sortDirection=1;
    columns.forEach(([label],i)=>{const th=el('th',{class:'sortable-th',title:'Sıralamak için tıklayın'},label+' ↕');th.addEventListener('click',()=>{sortDirection=sortIndex===i?-sortDirection:1;sortIndex=i;draw();});head.appendChild(th);});
    head.appendChild(el('th',{},'İşlem'));thead.appendChild(head);table.appendChild(thead);
    const body=el('tbody');table.appendChild(body);
    const draw=()=>{
      body.innerHTML='';
      const q=String(globalSearch.value||'').trim().toLocaleLowerCase('tr-TR');
      const rows=data.records.filter(rec=>{
        const vals=columns.map(([,get])=>String(get(rec)||''));
        return (!q||vals.some(v=>v.toLocaleLowerCase('tr-TR').includes(q)))&&filters.every((input,i)=>!input.value.trim()||vals[i].toLocaleLowerCase('tr-TR').includes(input.value.trim().toLocaleLowerCase('tr-TR')));
      });
      if(sortIndex>=0) rows.sort((a,b)=>String(columns[sortIndex][1](a)||'').localeCompare(String(columns[sortIndex][1](b)||''),'tr',{numeric:true,sensitivity:'base'})*sortDirection);
      listCard.querySelector('h3').textContent='Kayıtlar — '+rows.length+' / '+data.records.length;
      rows.forEach(rec=>{
        const tr=el('tr');
        columns.forEach(([,get])=>tr.appendChild(el('td',{},get(rec)||'—')));
        const actions=el('td',{style:'white-space:nowrap;text-align:center;'});
        actions.appendChild(el('button',{class:'btn btn-secondary',title:'Düzenle',style:'padding:5px 9px;margin-right:4px;',onclick:async()=>{tebligatEditingId=rec.id;await render();}},'✎'));
        actions.appendChild(el('button',{class:'btn btn-secondary',title:'Sil',style:'padding:5px 9px;',onclick:()=>tebligatDeleteRecord(rec.id)},'🗑'));
        tr.appendChild(actions);body.appendChild(tr);
      });
      if(!rows.length)body.appendChild(el('tr',{},[el('td',{colSpan:'7',style:'text-align:center;padding:18px;color:var(--muted);'},'Filtreye uygun kayıt bulunamadı.')]));
    };
    globalSearch.addEventListener('input',draw);filters.forEach(input=>input.addEventListener('input',draw));
    draw();const sc=el('div',{class:'table-scroll'});sc.appendChild(table);listCard.appendChild(sc);host.appendChild(listCard);
  };
  window.tebligatYaziTakipRerender=render;
  await render();
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='Tebligat Yazı Takip';document.getElementById('footer-msg').textContent='Tebligat Yazı Takip';renderNav();
}
async function tebligatEditRecord(id){ tebligatEditingId=id; if(window.tebligatYaziTakipRerender) await window.tebligatYaziTakipRerender(); }
async function tebligatDeleteRecord(id){
  if(!userStore?.directoryHandle)return;
  if(!confirm('Bu Tebligat Yazı kaydı silinsin mi?'))return;
  const data=await tebligatRead(); data.records=data.records.filter(x=>x.id!==id);
  await tebligatWrite(data); if(window.tebligatYaziTakipRerender) await window.tebligatYaziTakipRerender();
}
