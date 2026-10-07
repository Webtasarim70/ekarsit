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
    const status=el('div',{style:'margin-top:10px;'});
    const saveBtn=el('button',{class:'btn btn-primary',style:'margin-top:12px;',onclick:async()=>{
      const m=String(mukellef.value||'').trim(), d=String(donem.value||'').trim(), s=String(sonTarih.value||'').trim();
      if(!m||!d||!s){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ İlgili Mükellef, Dönem ve Son Tarih zorunludur.'));return;}
      const record={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),mukellef:m,donem:d,yaziTarihi:tebligatDateValue(yaziTarihi.value),tebligTarihi:tebligatDateValue(tebligTarihi.value),sonTarih:tebligatDateValue(s),durum:durum.value,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      try{data.records.unshift(record);await tebligatWrite(data);status.innerHTML='';status.appendChild(el('div',{class:'hint ok'},'✓ Kayıt kullanıcı klasörüne kaydedildi.'));await render();}catch(e){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ Kayıt kaydedilemedi: '+e.message));}
    }},'＋ Kaydı Ekle');
    formCard.appendChild(grid);formCard.appendChild(saveBtn);formCard.appendChild(status);host.appendChild(formCard);

    const listCard=el('div',{class:'card',style:'margin-top:14px;'});
    listCard.appendChild(el('h3',{},'Kayıtlar — '+data.records.length));
    if(!data.records.length){listCard.appendChild(el('div',{class:'hint info'},'Henüz kayıt bulunmuyor.'));host.appendChild(listCard);return;}
    const table=el('table',{class:'editable-table'});
    const head=el('tr');['İlgili Mükellef','Dönem','Yazı Tarihi','Tebliğ Tarihi','Son Tarih','Durum','İşlem'].forEach(x=>head.appendChild(el('th',{},x)));table.appendChild(el('thead',{},head));
    const body=el('tbody');
    data.records.forEach(rec=>{
      const tr=el('tr');
      [rec.mukellef,rec.donem,tebligatDateDisplay(rec.yaziTarihi),tebligatDateDisplay(rec.tebligTarihi),tebligatDateDisplay(rec.sonTarih),rec.durum].forEach(v=>tr.appendChild(el('td',{},v||'—')));
      const actions=el('td',{style:'white-space:nowrap;text-align:center;'});
      actions.appendChild(el('button',{class:'btn btn-secondary',title:'Düzenle',style:'padding:5px 9px;margin-right:4px;',onclick:()=>tebligatEditRecord(rec.id)},'✎'));
      actions.appendChild(el('button',{class:'btn btn-secondary',title:'Sil',style:'padding:5px 9px;',onclick:()=>tebligatDeleteRecord(rec.id)},'🗑'));
      tr.appendChild(actions);body.appendChild(tr);
    });
    table.appendChild(body);const sc=el('div',{class:'table-scroll'});sc.appendChild(table);listCard.appendChild(sc);host.appendChild(listCard);
  };
  window.tebligatYaziTakipRerender=render;
  await render();
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='Tebligat Yazı Takip';document.getElementById('footer-msg').textContent='Tebligat Yazı Takip';renderNav();
}
async function tebligatEditRecord(id){
  if(!userStore?.directoryHandle) return;
  const data=await tebligatRead(), r=data.records.find(x=>x.id===id); if(!r)return;
  const m=prompt('İlgili Mükellef:',r.mukellef); if(m===null)return;
  const d=prompt('Dönem:',r.donem); if(d===null)return;
  const yt=prompt('Yazı Tarihi (gg.aa.yyyy):',r.yaziTarihi||''); if(yt===null)return;
  const tt=prompt('Tebliğ Tarihi (gg.aa.yyyy):',r.tebligTarihi||''); if(tt===null)return;
  const s=prompt('Son Tarih (gg.aa.yyyy):',r.sonTarih); if(s===null)return;
  const durum=prompt('Durum (yazı gönderildi / cevaplandı / tamamlandı / diğer):',r.durum); if(durum===null)return;
  if(!m.trim()||!d.trim()||!s.trim()){alert('İlgili Mükellef, Dönem ve Son Tarih zorunludur.');return;}
  r.mukellef=m.trim();r.donem=d.trim();r.yaziTarihi=tebligatDateValue(yt.trim());r.tebligTarihi=tebligatDateValue(tt.trim());r.sonTarih=tebligatDateValue(s.trim());
  r.durum=['yazı gönderildi','cevaplandı','tamamlandı','diğer'].includes(durum.trim().toLocaleLowerCase('tr-TR'))?durum.trim().toLocaleLowerCase('tr-TR'):'diğer';
  r.updatedAt=new Date().toISOString();
  await tebligatWrite(data); if(window.tebligatYaziTakipRerender) await window.tebligatYaziTakipRerender();
}
async function tebligatDeleteRecord(id){
  if(!userStore?.directoryHandle)return;
  if(!confirm('Bu Tebligat Yazı kaydı silinsin mi?'))return;
  const data=await tebligatRead(); data.records=data.records.filter(x=>x.id!==id);
  await tebligatWrite(data); if(window.tebligatYaziTakipRerender) await window.tebligatYaziTakipRerender();
}
