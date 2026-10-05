/* YMM Yazıları — bağımsız YMM ve firma rehberi tabloları. */
const YMM_REHBER_FILE='YMM_REHBER.json', FIRMA_REHBER_FILE='FIRMA_REHBER.json';

async function ymmGuideRead(name,def){
  if(!userStore.directoryHandle)return def;
  try{const h=await userStore.directoryHandle.getFileHandle(name);return JSON.parse(await (await h.getFile()).text());}
  catch(e){return def;}
}
async function ymmGuideWrite(name,data){
  if(!userStore.directoryHandle)throw new Error('Önce Kullanıcı → Kullanıcı bölümünden kullanıcı klasörünü seçin.');
  await userWriteJson(userStore.directoryHandle,name,{schemaVersion:2,guncelleme:new Date().toISOString(),...data});
}
function ymmGuideFolderRequired(){
  if(!userStore.directoryHandle){alert('Önce Kullanıcı → Kullanıcı bölümünden mevcut kullanıcı klasörünü seçin.');return false;}
  return true;
}
function ymmGuideNormalizeYmm(d){
  if(Array.isArray(d?.kayitlar))return d.kayitlar;
  const a=d?.bilgiVeren&&Object.keys(d.bilgiVeren).length?d.bilgiVeren:null;
  const b=d?.bilgiIstenen&&Object.keys(d.bilgiIstenen).length?d.bilgiIstenen:null;
  return [a,b].filter(Boolean);
}
function ymmGuideNormalizeFirma(d){
  if(Array.isArray(d?.kayitlar))return d.kayitlar;
  return [d?.kendiFirmam,d?.cevapFirmasi].filter(x=>x&&Object.keys(x).length).map(x=>({...x}));
}
function ymmGuideFieldsYmm(){
  return [['adSoyad','Adı Soyadı'],['oda','Bağlı Olduğu Oda'],['sicil','Oda Sicil / Mühür No'],['vkn','VKN / T.C. No'],['vergiDairesi','Vergi Dairesi'],['adres','Adres'],['telefon','Telefon / Faks'],['ePosta','E-posta']];
}
function ymmGuideFieldsFirma(){
  return [['unvan','Firma Ünvanı'],['vkn','Vergi Kimlik No'],['vergiDairesi','Vergi Dairesi'],['adres','Adres'],['telefon','Telefon / Faks'],['ePosta','E-posta'],['oda','Bağlı Olduğu Oda'],['sicil','Oda Sicil No']];
}
function ymmGuideInputRow(label,value,key){
  const row=el('div',{style:'display:grid;grid-template-columns:190px 1fr;gap:10px;align-items:center;margin:7px 0;'});
  row.appendChild(el('label',{},label));
  const i=el('input',{class:'input',value:String(value||''),placeholder:label});i.dataset.key=key;row.appendChild(i);return row;
}
function ymmGuideCollect(card,fields){
  const o={};card.querySelectorAll('input[data-key],textarea[data-key]').forEach(i=>o[i.dataset.key]=i.value.trim());return o;
}
function ymmGuideEditor(title,fields,current,onSave,onCancel){
  const card=el('div',{class:'card',style:'margin-top:12px;'});
  card.appendChild(el('h3',{},title));
  const form=el('div',{});fields.forEach(([k,l])=>form.appendChild(ymmGuideInputRow(l,current?.[k]||'',k)));
  card.appendChild(form);
  const actions=el('div',{style:'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;'});
  actions.appendChild(el('button',{class:'btn btn-primary',onclick:()=>onSave(ymmGuideCollect(form,fields))},'Kaydet'));
  actions.appendChild(el('button',{class:'btn',onclick:onCancel},'Vazgeç'));
  card.appendChild(actions);return card;
}
function ymmGuideTable(records,fields,emptyText,onEdit,onDelete){
  const wrap=el('div',{style:'overflow:auto;margin-top:10px;'});
  if(!records.length){wrap.appendChild(el('div',{class:'hint info'},emptyText));return wrap;}
  const table=el('table',{class:'table',style:'width:100%;'});
  const trh=el('tr',{});fields.slice(0,4).forEach(x=>trh.appendChild(el('th',{},x[1])));trh.appendChild(el('th',{},'İşlem'));table.appendChild(trh);
  records.forEach((r,i)=>{
    const tr=el('tr',{});
    fields.slice(0,4).forEach(x=>tr.appendChild(el('td',{},r[x[0]]||'—')));
    const td=el('td',{style:'white-space:nowrap;'});
    td.appendChild(el('button',{class:'btn',style:'margin-right:5px;',onclick:()=>onEdit(i)},'Düzenle'));
    td.appendChild(el('button',{class:'btn',style:'color:#b42318;',onclick:()=>onDelete(i)},'Sil'));
    tr.appendChild(td);table.appendChild(tr);
  });
  wrap.appendChild(table);return wrap;
}
function ymmGuideList(records,fields){
  const box=el('div',{style:'display:grid;gap:8px;margin-top:10px;'});
  records.forEach((r,i)=>{
    const item=el('div',{class:'card',style:'padding:12px;'});
    item.appendChild(el('div',{style:'font-weight:700;'},(r.adSoyad||r.unvan||('Kayıt '+(i+1)))));
    fields.slice(1).forEach(x=>{if(r[x[0]])item.appendChild(el('div',{style:'margin-top:3px;font-size:13px;color:var(--muted);'},x[1]+': '+r[x[0]]));});
    box.appendChild(item);
  });
  if(!records.length)box.appendChild(el('div',{class:'hint info'},'Henüz kayıt bulunmuyor.'));
  return box;
}
function ymmGuideViewToggle(target,records,fields){
  target.innerHTML='';
  const bar=el('div',{style:'display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;'});
  const tableBtn=el('button',{class:'btn btn-primary'},'Tablo Görünümü');
  const listBtn=el('button',{class:'btn'},'Liste Görünümü');
  bar.append(tableBtn,listBtn);target.appendChild(bar);
  const body=el('div',{});target.appendChild(body);
  const showTable=()=>{tableBtn.className='btn btn-primary';listBtn.className='btn';body.innerHTML='';body.appendChild(ymmGuideTable(records,fields,'Henüz kayıt bulunmuyor.',()=>{},()=>{}));};
  const showList=()=>{tableBtn.className='btn';listBtn.className='btn btn-primary';body.innerHTML='';body.appendChild(ymmGuideList(records,fields));};
  tableBtn.onclick=showTable;listBtn.onclick=showList;showTable();
}
async function renderYmmRehberPage(){
  currentPage='ymm-rehber';currentStep=-1;
  const c=document.getElementById('step-content');c.innerHTML='';
  c.appendChild(el('h2',{class:'step-title'},'YMM Rehberi'));
  c.appendChild(el('p',{class:'step-desc'},'YMM bilgilerini yazılardan bağımsız bir adres defteri gibi kaydedin. Kayıtlar kullanıcı klasöründe YMM_REHBER.json dosyasında tutulur.'));
  const d=await ymmGuideRead(YMM_REHBER_FILE,{kayitlar:[]});let records=ymmGuideNormalizeYmm(d);
  const stateBox=el('div',{});c.appendChild(stateBox);
  const render=()=>{
    stateBox.innerHTML='';
    const card=el('div',{class:'card'});
    card.appendChild(el('h3',{},'YMM Kayıtları'));
    card.appendChild(el('div',{class:'hint info'},records.length+' YMM kaydı bulunuyor. Kayıtlar yazıdan bağımsızdır; daha sonra cevap yazısında seçilebilir.'));
    const editorHost=el('div',{});card.appendChild(editorHost);
    const add=()=>{editorHost.innerHTML='';editorHost.appendChild(ymmGuideEditor('Yeni YMM Ekle',ymmGuideFieldsYmm(),{},async v=>{records.push(v);await save();render();},()=>{editorHost.innerHTML='';}));};
    card.appendChild(el('button',{class:'btn btn-primary',style:'margin-top:10px;',onclick:add},'+ Yeni YMM Ekle'));
    const edit=i=>{editorHost.innerHTML='';editorHost.appendChild(ymmGuideEditor('YMM Kaydını Düzenle',ymmGuideFieldsYmm(),records[i],async v=>{records[i]=v;await save();render();},()=>{editorHost.innerHTML='';}));};
    const del=async i=>{if(!confirm('Bu YMM kaydı silinsin mi?'))return;records.splice(i,1);await save();render();};
    const view=el('div',{});card.appendChild(el('h4',{style:'margin-top:22px;'},'Görüntüleme'));card.appendChild(view);
    const save=async()=>{try{await ymmGuideWrite(YMM_REHBER_FILE,{kayitlar:records});}catch(e){alert('YMM rehberi kaydedilemedi: '+e.message);throw e;}};
    ymmGuideViewToggle(view,records,ymmGuideFieldsYmm());
    stateBox.appendChild(card);
  };
  render();document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='YMM Rehberi';renderNav();
}
async function renderFirmaRehberPage(){
  currentPage='firma-rehber';currentStep=-1;
  const c=document.getElementById('step-content');c.innerHTML='';
  c.appendChild(el('h2',{class:'step-title'},'Firma Rehberi'));
  c.appendChild(el('p',{class:'step-desc'},'Firma bilgilerini yazılardan bağımsız bir telefon/adres defteri gibi kaydedin. Kayıtlar kullanıcı klasöründe FIRMA_REHBER.json dosyasında tutulur.'));
  const d=await ymmGuideRead(FIRMA_REHBER_FILE,{kayitlar:[]});let records=ymmGuideNormalizeFirma(d);
  const stateBox=el('div',{});c.appendChild(stateBox);
  const render=()=>{
    stateBox.innerHTML='';
    const card=el('div',{class:'card'});card.appendChild(el('h3',{},'Firma Kayıtları'));
    card.appendChild(el('div',{class:'hint info'},records.length+' firma kaydı bulunuyor. Bu kayıtlar YMM yazısından bağımsızdır.'));
    const editorHost=el('div',{});card.appendChild(editorHost);
    const add=()=>{editorHost.innerHTML='';editorHost.appendChild(ymmGuideEditor('Yeni Firma Ekle',ymmGuideFieldsFirma(),{},async v=>{records.push(v);await save();render();},()=>{editorHost.innerHTML='';}));};
    card.appendChild(el('button',{class:'btn btn-primary',style:'margin-top:10px;',onclick:add},'+ Yeni Firma Ekle'));
    const edit=i=>{editorHost.innerHTML='';editorHost.appendChild(ymmGuideEditor('Firma Kaydını Düzenle',ymmGuideFieldsFirma(),records[i],async v=>{records[i]=v;await save();render();},()=>{editorHost.innerHTML='';}));};
    const del=async i=>{if(!confirm('Bu firma kaydı silinsin mi?'))return;records.splice(i,1);await save();render();};
    const view=el('div',{});card.appendChild(el('h4',{style:'margin-top:22px;'},'Görüntüleme'));card.appendChild(view);
    const save=async()=>{try{await ymmGuideWrite(FIRMA_REHBER_FILE,{kayitlar:records});}catch(e){alert('Firma rehberi kaydedilemedi: '+e.message);throw e;}};
    ymmGuideViewToggle(view,records,ymmGuideFieldsFirma());
    c.appendChild(card);
  };
  render();document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Firma Rehberi';renderNav();
}
