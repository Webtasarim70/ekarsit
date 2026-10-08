/* İade Takip Listesi — kullanıcı klasöründe ayrı JSON */
const IADE_TAKIP_FILE='IADE_TAKIP_LISTESI.json';
const IADE_TURLERI=[
  '301 - Mal İhracatı (11/1-a)',
  '308 - Teşvikli Yatırım Mallarının Teslimi ile Yazılım ve Gayri Maddi Hak Satış ve Kiralamaları (13/d)',
  '332 - İstisna Belgesine İstinaden',
  '338 - İmalatçıların %10',
  '439 - İndirimli Orana Tabi İşlemlere İlişkin',
  '701 - İhracatı Yapılacak Nihai Ürünlerin Kanunun 11/1-C Maddesi Kapsamında Teslimi'
];
const IADE_DURUMLARI=['Dilekçe Girilecek','Devam Eden','Tamamlandı','Reddedildi'];

async function iadeTakipRead(){
  if(!userStore?.directoryHandle) return {schemaVersion:1,records:[],iadeTurleri:[...IADE_TURLERI],isDurumlari:[]};
  try{
    const h=await userStore.directoryHandle.getFileHandle(IADE_TAKIP_FILE);
    const d=JSON.parse(await (await h.getFile()).text());
    return {schemaVersion:1,records:Array.isArray(d?.records)?d.records:[],iadeTurleri:Array.isArray(d?.iadeTurleri)?d.iadeTurleri:[...IADE_TURLERI],isDurumlari:Array.isArray(d?.isDurumlari)?d.isDurumlari:[]};
  }catch(e){ if(e?.name==='NotFoundError') return {schemaVersion:1,records:[],iadeTurleri:[...IADE_TURLERI],isDurumlari:[]}; throw e; }
}
async function iadeTakipWrite(data){
  if(!userStore?.directoryHandle) throw new Error('Önce Kullanıcı bölümünden kullanıcı klasörünü seçin.');
  const h=await userStore.directoryHandle.getFileHandle(IADE_TAKIP_FILE,{create:true});
  const w=await h.createWritable(); await w.write(JSON.stringify(data,null,2)); await w.close(); await userScanCurrentFolder();
}
function iadeSelectOptions(select,items,placeholder){
  select.innerHTML=''; if(placeholder) select.appendChild(el('option',{value:''},placeholder));
  items.forEach(x=>select.appendChild(el('option',{value:x},x)));
}

function iadeExcelValue(v){
  if(v==null||v==='')return '';
  if(v instanceof Date)return v.toLocaleDateString('tr-TR');
  if(typeof v==='object'){if(v.result!=null)return iadeExcelValue(v.result);if(v.text!=null)return String(v.text);}
  return String(v).trim();
}
function iadeExcelNorm(v){
  return String(v??'').toLocaleLowerCase('tr-TR').replace(/\s+/g,'').replace(/[İIıi]/g,'i').replace(/[Üü]/g,'u').replace(/[Öö]/g,'o').replace(/[Şş]/g,'s').replace(/[Ğğ]/g,'g').replace(/[Çç]/g,'c').replace(/[^a-z0-9]/g,'');
}
function iadeExcelHeaderMap(headers){
  const aliases={
    firma:['firma','firmaadiunvan','firmadiunvan','unvan'],
    donem:['donem','donemi'],
    iadeTuru:['iadeturu','iadeturuadi'],
    tutar:['tutar','tutartl','iadeedilentutar'],
    iadeDurumu:['iadedurumu','durum'],
    isDurumu:['isdurumu','isdurumuaciklama'],
    aciklama:['aciklama'],
    ekBilgiler:['ekbilgiler','ekbilgi']
  };
  const map={}; headers.forEach((h,i)=>{const n=iadeExcelNorm(h);for(const k of Object.keys(aliases)){if(aliases[k].includes(n)&&map[k]==null)map[k]=i;}}); return map;
}
async function iadeExcelImport(file){
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
  const ws=wb.worksheets[0]; if(!ws)throw new Error('Excel çalışma sayfası bulunamadı.');
  const headers=[];ws.getRow(1).eachCell({includeEmpty:true},(cell,i)=>headers[i-1]=iadeExcelValue(cell.value));
  const map=iadeExcelHeaderMap(headers);
  if(map.firma==null||map.donem==null||map.iadeTuru==null)throw new Error('Excel başlıklarında en az Firma, Dönem ve İade Türü bulunmalıdır.');
  const records=[], now=new Date().toISOString();
  ws.eachRow((row,ri)=>{
    if(ri===1)return;
    const get=k=>map[k]==null?'':iadeExcelValue(row.getCell(map[k]+1).value);
    const firma=String(get('firma')).trim(),donem=String(get('donem')).trim(),tur=String(get('iadeTuru')).trim();
    if(!firma&&!donem&&!tur)return;
    if(!firma||!donem||!tur)return;
    const rawTutar=String(get('tutar')).trim().replace(/\s/g,'').replace(/\.(?=\d{3}(?:,|$))/g,'').replace(',','.');
    const tutar=rawTutar===''?'':(Number(rawTutar)||0);
    const isDurumu=String(get('isDurumu')).trim();
    records.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+ri)),firma,donem,iadeTuru:tur,tutar,iadeDurumu:String(get('iadeDurumu')).trim(),isDurumu,aciklama:String(get('aciklama')).trim(),ekBilgiler:String(get('ekBilgiler')).trim(),createdAt:now,updatedAt:now});
  });
  return records;
}
async function iadeExcelYedekle(){
  const data=await iadeTakipRead();
  const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('İade Takip Listesi');
  ws.columns=[{header:'Firma',key:'firma',width:34},{header:'Dönem',key:'donem',width:14},{header:'İade Türü',key:'iadeTuru',width:70},{header:'Tutar (TL)',key:'tutar',width:16},{header:'İade Durumu',key:'iadeDurumu',width:20},{header:'İş Durumu',key:'isDurumu',width:28},{header:'Açıklama',key:'aciklama',width:42},{header:'Ek Bilgiler',key:'ekBilgiler',width:42}];
  data.records.forEach(r=>ws.addRow(r));ws.getRow(1).font={bold:true};ws.getColumn('tutar').numFmt='#,##0.00';
  const buf=await wb.xlsx.writeBuffer();const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='IADE_TAKIP_LISTESI_YEDEK.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function iadeInputField(label,input,grid,wide=false){
  const f=el('div',{class:'field',style:wide?'grid-column:1/-1;':''});
  f.appendChild(el('label',{},label)); f.appendChild(input); grid.appendChild(f);
}
let iadeEditingId=null;
async function renderIadeTakipListesiPage(){
  currentPage='iade-takip-listesi'; archiveViewParsed=null; currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'İade Takip Listesi'));
  content.appendChild(el('p',{class:'step-desc'},'İade kayıtlarını kullanıcı klasörünüzde ayrı bir dosyada saklayabilir, düzenleyebilir ve takip edebilirsiniz.'));
  const host=el('div'); content.appendChild(host);
  const render=async()=>{
    host.innerHTML='';
    if(!userStore?.directoryHandle){
      host.appendChild(el('div',{class:'card'},[el('div',{class:'hint warn'},'Önce Kullanıcı → Kullanıcı bölümünden bir kullanıcı klasörü seçin.')]));
      return;
    }
    const data=await iadeTakipRead();
    const form=el('div',{class:'card'}); form.appendChild(el('h3',{},'Yeni İade Takip Kaydı'));
    const excelBar=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px;'});
    const importInput=el('input',{type:'file',accept:'.xlsx,.xlsm',style:'display:none;'});
    const importBtn=el('button',{class:'btn btn-secondary',onclick:()=>importInput.click()},'⬆ Excelden Liste Al');
    const backupBtn=el('button',{class:'btn btn-secondary',onclick:async()=>{try{await iadeExcelYedekle();}catch(e){alert('Excel yedeği oluşturulamadı: '+e.message);}}},'⬇ Excel\'e Yedekle');
    const excelStatus=el('div',{class:'hint info',style:'margin:8px 0;display:none;'});
    importInput.addEventListener('change',async()=>{
      const file=importInput.files?.[0];if(!file)return;
      try{
        const imported=await iadeExcelImport(file);
        if(!imported.length){excelStatus.style.display='block';excelStatus.textContent='Excelde aktarılacak kayıt bulunamadı.';return;}
        const mevcut=await iadeTakipRead();
        imported.forEach(r=>{if(r.isDurumu&&!mevcut.isDurumlari.includes(r.isDurumu))mevcut.isDurumlari.unshift(r.isDurumu);if(r.iadeTuru&&!mevcut.iadeTurleri.includes(r.iadeTuru))mevcut.iadeTurleri.push(r.iadeTuru);});
        mevcut.records=[...imported,...mevcut.records];
        await iadeTakipWrite(mevcut);
        excelStatus.style.display='block';excelStatus.className='hint ok';excelStatus.textContent='✓ '+imported.length+' kayıt Excelden listeye eklendi.';
        await render();
      }catch(e){excelStatus.style.display='block';excelStatus.className='hint warn';excelStatus.textContent='⚠️ Excel aktarılamadı: '+e.message;}
      importInput.value='';
    });
    excelBar.appendChild(importBtn);excelBar.appendChild(backupBtn);excelBar.appendChild(importInput);form.appendChild(excelBar);form.appendChild(excelStatus);
    const grid=el('div',{class:'archive-create-grid',style:'margin-top:12px;'});
    const firma=el('input',{class:'input',placeholder:'Firma adı / unvanı'});
    const donem=el('input',{class:'input',placeholder:'Örn: 11/2025'});
    const tur=el('select',{class:'input'}); iadeSelectOptions(tur,data.iadeTurleri,'İade türü seçin');
    const yeniTur=el('input',{class:'input',placeholder:'Yeni iade türü yazın',style:'margin-top:6px;'});
    const yeniTurBtn=el('button',{class:'btn btn-secondary',style:'margin-top:6px;',onclick:async()=>{
      const v=yeniTur.value.trim();if(!v)return;
      if(!data.iadeTurleri.includes(v))data.iadeTurleri.push(v);
      iadeSelectOptions(tur,data.iadeTurleri,'İade türü seçin');tur.value=v;yeniTur.value='';
      try{await iadeTakipWrite(data);}catch(e){alert('Yeni iade türü kaydedilemedi: '+e.message);}
    }},'＋ Yeni İade Türü Ekle');
    const turWrap=el('div');turWrap.appendChild(tur);turWrap.appendChild(yeniTur);turWrap.appendChild(yeniTurBtn);
    const tutar=el('input',{class:'input',type:'number',step:'0.01',min:'0',placeholder:'0,00'});
    const iadeDurumu=el('select',{class:'input'}); iadeSelectOptions(iadeDurumu,IADE_DURUMLARI,'İade durumu seçin');
    const isDurumu=el('input',{class:'input',list:'iade-is-durum-list',placeholder:'İş durumu yazın'});
    const dl=el('datalist',{id:'iade-is-durum-list'}); data.isDurumlari.forEach(x=>dl.appendChild(el('option',{value:x})));
    const aciklama=el('textarea',{class:'input',rows:'4',placeholder:'Açıklama'});
    const ekBilgiler=el('textarea',{class:'input',rows:'4',placeholder:'Ek Bilgiler'});
    iadeInputField('Firma *',firma,grid); iadeInputField('Dönem *',donem,grid); iadeInputField('İade Türü *',turWrap,grid);
    iadeInputField('Tutar (TL)',tutar,grid); iadeInputField('İade Durumu',iadeDurumu,grid); iadeInputField('İş Durumu',isDurumu,grid);
    iadeInputField('Açıklama',aciklama,grid,true); iadeInputField('Ek Bilgiler',ekBilgiler,grid,true);
    const editing=iadeEditingId?data.records.find(x=>x.id===iadeEditingId):null;
    if(editing){
      firma.value=editing.firma||''; donem.value=editing.donem||''; tur.value=editing.iadeTuru||''; tutar.value=editing.tutar===''?'':editing.tutar; iadeDurumu.value=editing.iadeDurumu||''; isDurumu.value=editing.isDurumu||''; aciklama.value=editing.aciklama||''; ekBilgiler.value=editing.ekBilgiler||'';
    }
    form.querySelector('h3').textContent=editing?'İade Takip Kaydını Düzenle':'Yeni İade Takip Kaydı';
    const status=el('div');
    const btn=el('button',{class:'btn btn-primary',style:'margin-top:12px;',onclick:async()=>{
      const f=firma.value.trim(), d=donem.value.trim(), t=tur.value;
      if(!f||!d||!t){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ Firma, Dönem ve İade Türü zorunludur.'));return;}
      try{
        const work=isDurumu.value.trim(); if(work&&!data.isDurumlari.includes(work))data.isDurumlari.unshift(work);
        if(iadeEditingId){
          const r=data.records.find(x=>x.id===iadeEditingId); if(!r)return;
          r.firma=f;r.donem=d;r.iadeTuru=t;r.tutar=tutar.value===''?'':Number(tutar.value);r.iadeDurumu=iadeDurumu.value;r.isDurumu=work;r.aciklama=aciklama.value.trim();r.ekBilgiler=ekBilgiler.value.trim();r.updatedAt=new Date().toISOString(); iadeEditingId=null;
        }else{
          data.records.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),firma:f,donem:d,iadeTuru:t,tutar:tutar.value===''?'':Number(tutar.value),iadeDurumu:iadeDurumu.value,isDurumu:work,aciklama:aciklama.value.trim(),ekBilgiler:ekBilgiler.value.trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
        }
        await iadeTakipWrite(data); await render();
      }catch(e){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ Kaydedilemedi: '+e.message));}
    }},editing?'💾 Değişiklikleri Kaydet':'＋ Kaydı Ekle');
    if(editing) form.appendChild(el('button',{class:'btn btn-secondary',style:'margin:12px 0 0 8px;',onclick:async()=>{iadeEditingId=null;await render();}},'İptal'));
    form.appendChild(grid);form.appendChild(btn);form.appendChild(dl);form.appendChild(status);host.appendChild(form);
    const list=el('div',{class:'card',style:'margin-top:14px;'}); list.appendChild(el('h3',{},'İade Kayıtları — '+data.records.length));
    if(!data.records.length){list.appendChild(el('div',{class:'hint info'},'Henüz kayıt bulunmuyor.'));host.appendChild(list);return;}
    const columns=[['Firma',r=>r.firma],['Dönem',r=>r.donem],['İade Türü',r=>r.iadeTuru],['Tutar (TL)',r=>r.tutar===''?'':Number(r.tutar).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})],['İade Durumu',r=>r.iadeDurumu],['İş Durumu',r=>r.isDurumu],['Açıklama',r=>r.aciklama],['Ek Bilgiler',r=>r.ekBilgiler]];
    const tools=el('div',{class:'table-search-tools'});
    const globalSearch=el('input',{class:'input',placeholder:'Gelişmiş arama: firma, dönem, tutar, durum, açıklama…'});tools.appendChild(globalSearch);
    const fieldFilters=el('div',{class:'table-column-filters'});const filters=columns.map(([label])=>{const box=el('div',{class:'field'});box.appendChild(el('label',{},label+' filtresi'));const input=el('input',{class:'input',placeholder:label+' ara…','aria-label':label+' filtresi'});box.appendChild(input);fieldFilters.appendChild(box);return input;});const reset=el('button',{class:'btn btn-secondary',type:'button',style:'margin-top:8px;',onclick:()=>{globalSearch.value='';filters.forEach(x=>x.value='');sortIndex=-1;sortDirection=1;draw();}},'Filtreleri Temizle');tools.appendChild(fieldFilters);tools.appendChild(reset);list.appendChild(tools);
    const table=el('table',{class:'editable-table'}),thead=el('thead'),trh=el('tr');let sortIndex=-1,sortDirection=1;
    const sortHeads=[];columns.forEach(([label],i)=>{const th=el('th',{class:'sortable-th',title:'Sıralamak için tıklayın','aria-sort':'none'},label+' ↕');th.addEventListener('click',()=>{sortDirection=sortIndex===i?-sortDirection:1;sortIndex=i;draw();});sortHeads.push(th);trh.appendChild(th);});
    trh.appendChild(el('th',{},'İşlem'));thead.appendChild(trh);table.appendChild(thead);const body=el('tbody');table.appendChild(body);
    const draw=()=>{
      body.innerHTML='';const q=String(globalSearch.value||'').trim().toLocaleLowerCase('tr-TR');
      const rows=data.records.filter(r=>{const vals=columns.map(([,get])=>String(get(r)??''));return (!q||vals.some(v=>v.toLocaleLowerCase('tr-TR').includes(q)))&&filters.every((input,i)=>!input.value.trim()||vals[i].toLocaleLowerCase('tr-TR').includes(input.value.trim().toLocaleLowerCase('tr-TR')));});
      if(sortIndex>=0)rows.sort((a,b)=>String(columns[sortIndex][1](a)??'').localeCompare(String(columns[sortIndex][1](b)??''),'tr',{numeric:true,sensitivity:'base'})*sortDirection);
      sortHeads.forEach((th,i)=>{th.textContent=columns[i][0]+' '+(sortIndex===i?(sortDirection===1?'▲':'▼'):'↕');th.setAttribute('aria-sort',sortIndex===i?(sortDirection===1?'ascending':'descending'):'none');});
      list.querySelector('h3').textContent='İade Kayıtları — '+rows.length+' / '+data.records.length;
      rows.forEach(r=>{const tr=el('tr');columns.forEach(([label,get])=>{let value=get(r);if(value==null||value==='')value='—';tr.appendChild(el('td',{},String(value)));});
        const a=el('td',{style:'white-space:nowrap;text-align:center;'});a.appendChild(el('button',{class:'btn btn-secondary',title:'Düzenle',style:'padding:5px 9px;margin-right:4px;',onclick:async()=>{iadeEditingId=r.id;await render();}},'✎'));a.appendChild(el('button',{class:'btn btn-secondary',title:'Sil',style:'padding:5px 9px;',onclick:()=>iadeTakipDeleteRecord(r.id)},'🗑'));tr.appendChild(a);body.appendChild(tr);});
      if(!rows.length)body.appendChild(el('tr',{},[el('td',{colSpan:'9',style:'text-align:center;padding:18px;color:var(--muted);'},'Filtreye uygun kayıt bulunamadı.')]));
    };
    globalSearch.addEventListener('input',draw);filters.forEach(input=>input.addEventListener('input',draw));draw();const sc=el('div',{class:'table-scroll'});sc.appendChild(table);list.appendChild(sc);host.appendChild(list);
  };
  window.iadeTakipRerender=render; await render();
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='İade Takip Listesi';document.getElementById('footer-msg').textContent='İade Takip Listesi';renderNav();
}
async function iadeTakipEditRecord(id){ iadeEditingId=id; if(window.iadeTakipRerender) await window.iadeTakipRerender(); }
async function iadeTakipDeleteRecord(id){
  if(!confirm('Bu iade takip kaydı silinsin mi?'))return;
  const data=await iadeTakipRead();data.records=data.records.filter(x=>x.id!==id);await iadeTakipWrite(data);if(window.iadeTakipRerender)await window.iadeTakipRerender();
}
