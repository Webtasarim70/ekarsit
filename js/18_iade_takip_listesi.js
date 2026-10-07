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
function iadeInputField(label,input,grid,wide=false){
  const f=el('div',{class:'field',style:wide?'grid-column:1/-1;':''});
  f.appendChild(el('label',{},label)); f.appendChild(input); grid.appendChild(f);
}
function renderIadeTakipListesiPage(){
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
    const grid=el('div',{class:'archive-create-grid',style:'margin-top:12px;'});
    const firma=el('input',{class:'input',placeholder:'Firma adı / unvanı'});
    const donem=el('input',{class:'input',placeholder:'Örn: 11/2025'});
    const tur=el('select',{class:'input'}); iadeSelectOptions(tur,data.iadeTurleri,'İade türü seçin');
    const tutar=el('input',{class:'input',type:'number',step:'0.01',min:'0',placeholder:'0,00'});
    const iadeDurumu=el('select',{class:'input'}); iadeSelectOptions(iadeDurumu,IADE_DURUMLARI,'İade durumu seçin');
    const isDurumu=el('input',{class:'input',list:'iade-is-durum-list',placeholder:'İş durumu yazın'});
    const dl=el('datalist',{id:'iade-is-durum-list'}); data.isDurumlari.forEach(x=>dl.appendChild(el('option',{value:x})));
    const aciklama=el('textarea',{class:'input',rows:'4',placeholder:'Açıklama'});
    const ekBilgiler=el('textarea',{class:'input',rows:'4',placeholder:'Ek Bilgiler'});
    iadeInputField('Firma *',firma,grid); iadeInputField('Dönem *',donem,grid); iadeInputField('İade Türü *',tur,grid);
    iadeInputField('Tutar (TL)',tutar,grid); iadeInputField('İade Durumu',iadeDurumu,grid); iadeInputField('İş Durumu',isDurumu,grid);
    iadeInputField('Açıklama',aciklama,grid,true); iadeInputField('Ek Bilgiler',ekBilgiler,grid,true);
    const status=el('div');
    const btn=el('button',{class:'btn btn-primary',style:'margin-top:12px;',onclick:async()=>{
      const f=firma.value.trim(), d=donem.value.trim(), t=tur.value;
      if(!f||!d||!t){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ Firma, Dönem ve İade Türü zorunludur.'));return;}
      const work=isDurumu.value.trim();
      if(work&&!data.isDurumlari.includes(work)) data.isDurumlari.unshift(work);
      const rec={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),firma:f,donem:d,iadeTuru:t,tutar:tutar.value===''?'':Number(tutar.value),iadeDurumu:iadeDurumu.value,isDurumu:work,aciklama:aciklama.value.trim(),ekBilgiler:ekBilgiler.value.trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      data.records.unshift(rec);
      try{await iadeTakipWrite(data);await render();}catch(e){status.innerHTML='';status.appendChild(el('div',{class:'hint warn'},'⚠️ Kaydedilemedi: '+e.message));}
    }},'＋ Kaydı Ekle');
    form.appendChild(grid);form.appendChild(btn);form.appendChild(dl);form.appendChild(status);host.appendChild(form);
    const list=el('div',{class:'card',style:'margin-top:14px;'}); list.appendChild(el('h3',{},'İade Kayıtları — '+data.records.length));
    if(!data.records.length){list.appendChild(el('div',{class:'hint info'},'Henüz kayıt bulunmuyor.'));host.appendChild(list);return;}
    const table=el('table',{class:'editable-table'}), trh=el('tr');
    ['Firma','Dönem','İade Türü','Tutar (TL)','İade Durumu','İş Durumu','Açıklama','Ek Bilgiler','İşlem'].forEach(x=>trh.appendChild(el('th',{},x)));
    table.appendChild(el('thead',{},trh)); const body=el('tbody');
    data.records.forEach(r=>{
      const tr=el('tr'); [r.firma,r.donem,r.iadeTuru,r.tutar===''?'':Number(r.tutar).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}),r.iadeDurumu||'—',r.isDurumu||'—',r.aciklama||'—',r.ekBilgiler||'—'].forEach(v=>tr.appendChild(el('td',{},v)));
      const a=el('td',{style:'white-space:nowrap;text-align:center;'});
      a.appendChild(el('button',{class:'btn btn-secondary',title:'Düzenle',style:'padding:5px 9px;margin-right:4px;',onclick:()=>iadeTakipEditRecord(r.id)},'✎'));
      a.appendChild(el('button',{class:'btn btn-secondary',title:'Sil',style:'padding:5px 9px;',onclick:()=>iadeTakipDeleteRecord(r.id)},'🗑'));
      tr.appendChild(a);body.appendChild(tr);
    });
    table.appendChild(body);const sc=el('div',{class:'table-scroll'});sc.appendChild(table);list.appendChild(sc);host.appendChild(list);
  };
  window.iadeTakipRerender=render; await render();
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('btn-next').textContent='İade Takip Listesi';document.getElementById('footer-msg').textContent='İade Takip Listesi';renderNav();
}
async function iadeTakipEditRecord(id){
  const data=await iadeTakipRead(),r=data.records.find(x=>x.id===id);if(!r)return;
  const f=prompt('Firma adı / unvanı:',r.firma);if(f===null)return;
  const d=prompt('Dönem:',r.donem);if(d===null)return;
  const t=prompt('İade Türü:',r.iadeTuru);if(t===null)return;
  const tu=prompt('Tutar (TL):',r.tutar);if(tu===null)return;
  const idu=prompt('İade Durumu:',r.iadeDurumu||'');if(idu===null)return;
  const isu=prompt('İş Durumu:',r.isDurumu||'');if(isu===null)return;
  const a=prompt('Açıklama:',r.aciklama||'');if(a===null)return;
  const e=prompt('Ek Bilgiler:',r.ekBilgiler||'');if(e===null)return;
  if(!f.trim()||!d.trim()||!t.trim()){alert('Firma, Dönem ve İade Türü zorunludur.');return;}
  if(isu.trim()&&!data.isDurumlari.includes(isu.trim()))data.isDurumlari.unshift(isu.trim());
  r.firma=f.trim();r.donem=d.trim();r.iadeTuru=t.trim();r.tutar=tu.trim()===''?'':Number(tu.replace(',','.'));r.iadeDurumu=idu.trim();r.isDurumu=isu.trim();r.aciklama=a;r.ekBilgiler=e;r.updatedAt=new Date().toISOString();
  await iadeTakipWrite(data);if(window.iadeTakipRerender)await window.iadeTakipRerender();
}
async function iadeTakipDeleteRecord(id){
  if(!confirm('Bu iade takip kaydı silinsin mi?'))return;
  const data=await iadeTakipRead();data.records=data.records.filter(x=>x.id!==id);await iadeTakipWrite(data);if(window.iadeTakipRerender)await window.iadeTakipRerender();
}
