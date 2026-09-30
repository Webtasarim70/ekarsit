/* ============================================================
   Kullanıcı İşlemleri / Kullanıcı Dosyası
   Yerel klasör tabanlı, tarayıcı içinde çalışan kullanıcı alanı.
   ============================================================ */

const userStore = {
  directoryHandle: null,
  info: null,
  firms: [],
  files: [],
  scanned: false
};

function userFileSafeName(v){
  return String(v||'').replace(/[<>:"/\\|?*\x00-\x1F]/g,' ').replace(/\s+/g,' ').trim().slice(0,80) || 'Kullanici';
}
function userVkn(v){
  return String(v||'').replace(/\D/g,'').slice(0,11);
}
function userIsArchiveWorkbook(name){
  return /\.(xlsx|xlsm)$/i.test(name) && !/~\$/i.test(name);
}
function userCountRecords(a){
  if(!a) return 0;
  return ['ortaklar','defterler','faturalar','isciler','kdvBeyanlari','imalatcilar','tedarikciler']
    .reduce((n,k)=>n+(Array.isArray(a[k])?a[k].length:0),0);
}
function userFirmFromArchive(parsed, fileName, relativePath){
  const m=parsed?.mukellef||{};
  const vkn=userVkn(m.vkn);
  return {
    vkn,
    unvan:String(m.unvan||'').trim(),
    vergiDairesi:String(m.vergiDairesi||'').trim(),
    fileName,
    relativePath,
    recordCount:userCountRecords(parsed)
  };
}
function userMergeFirm(list, firm){
  const key=firm.vkn||('FILE:'+firm.relativePath);
  const old=list.find(x=>(x.vkn||('FILE:'+x.relativePath))===key);
  if(!old) list.push({...firm});
  else{
    old.unvan=old.unvan||firm.unvan;
    old.vergiDairesi=old.vergiDairesi||firm.vergiDairesi;
    old.recordCount+=firm.recordCount;
    old.files=[...(old.files||[]),firm.relativePath];
  }
}
async function userScanDirectory(dir, prefix=''){
  const firms=[];
  const files=[];
  for await(const [name,handle] of dir.entries()){
    const rel=prefix?prefix+'/'+name:name;
    if(handle.kind==='directory'){
      await userScanDirectory(handle,rel).then(r=>{
        r.firms.forEach(f=>userMergeFirm(firms,f));
        files.push(...r.files);
      });
    }else{
      if(prefix==='' && name==='KULLANICI_BILGILERI.json'){
        try{
          userStore.info=JSON.parse(await (await handle.getFile()).text());
          const u=userStore.info?.kullanici||{};
          if(!state.meta.ymmAdSoyad && u.adSoyad) state.meta.ymmAdSoyad=u.adSoyad;
          if(!state.meta.ymmVkn && u.vkn) state.meta.ymmVkn=u.vkn;
          if(!state.meta.ymmVergiDairesi && u.vergiDairesi) state.meta.ymmVergiDairesi=u.vergiDairesi;
          if(!state.meta.ymmOda && u.oda) state.meta.ymmOda=u.oda;
          if(!state.meta.ymmSicil && u.sicil) state.meta.ymmSicil=u.sicil;
          if(!state.meta.ymmTelefon && u.telefon) state.meta.ymmTelefon=u.telefon;
          if(!state.meta.ymmAdres && u.adres) state.meta.ymmAdres=u.adres;
          if(!state.meta.ymmSirketUnvan && u.sirketUnvani) state.meta.ymmSirketUnvan=u.sirketUnvani;
          if(!state.meta.ymmSirketVkn && u.sirketVkn) state.meta.ymmSirketVkn=u.sirketVkn;
        }catch(e){}
      }
      files.push({name,relativePath:rel,type:handle.name?.toLowerCase().endsWith('.json')?'json':'file'});
      if(userIsArchiveWorkbook(name)){
        try{
          const file=await handle.getFile();
          const wb=new ExcelJS.Workbook();
          await wb.xlsx.load(await file.arrayBuffer());
          const parsed=parseArchiveWorkbook(wb);
          if(parsed?.mukellef?.unvan || parsed?.mukellef?.vkn){
            userMergeFirm(firms,userFirmFromArchive(parsed,name,rel));
          }
        }catch(e){
          // Klasördeki desteklenmeyen/bozuk Excel diğer dosyaların taranmasını engellemez.
        }
      }
    }
  }
  return {firms,files};
}
async function userScanCurrentFolder(){
  if(!userStore.directoryHandle) throw new Error('Önce bir kullanıcı klasörü seçin.');
  const r=await userScanDirectory(userStore.directoryHandle);
  userStore.firms=r.firms;
  userStore.files=r.files;
  userStore.scanned=true;
  return r;
}
function userCurrentInfo(){
  const m=state.meta||{};
  return {
    schemaVersion:1,
    uygulama:'KDV İade · Karşıt İnceleme Arşiv Sihirbazı',
    kullanici:{
      adSoyad:String(m.ymmAdSoyad||'').trim(),
      vkn:userVkn(m.ymmVkn),
      vergiDairesi:String(m.ymmVergiDairesi||'').trim(),
      oda:String(m.ymmOda||'').trim(),
      sicil:String(m.ymmSicil||'').trim(),
      telefon:String(m.ymmTelefon||'').trim(),
      adres:String(m.ymmAdres||'').trim(),
      sirketUnvani:String(m.ymmSirketUnvan||'').trim(),
      sirketVkn:userVkn(m.ymmSirketVkn)
    },
    guncelleme:new Date().toISOString(),
    firmalar:userStore.firms.map(f=>({vkn:f.vkn,unvan:f.unvan,vergiDairesi:f.vergiDairesi,recordCount:f.recordCount}))
  };
}
async function userWriteJson(dir,name,data){
  const h=await dir.getFileHandle(name,{create:true});
  const w=await h.createWritable();
  await w.write(JSON.stringify(data,null,2));
  await w.close();
}
async function userWriteWorkbook(dir,name,workbook){
  const buf=await workbook.xlsx.writeBuffer();
  const h=await dir.getFileHandle(name,{create:true});
  const w=await h.createWritable();
  await w.write(buf);
  await w.close();
}
function userSafeFolderName(vkn){
  const digits=userVkn(vkn);
  if(digits) return digits;
  return 'VKN_BELIRSIZ';
}
async function userEnsureVknFolder(vkn,unvan=''){
  const folderName=userSafeFolderName(vkn);
  return await userStore.directoryHandle.getDirectoryHandle(folderName,{create:true});
}
async function userCreateFirmFolders(){
  if(!userStore.directoryHandle) throw new Error('Önce kullanıcı klasörünü tanımlayın.');
  let created=0;
  for(const firm of userStore.firms){
    if(!firm.vkn) continue;
    await userEnsureVknFolder(firm.vkn,firm.unvan);
    created++;
  }
  await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());
  return created;
}
async function userSaveCurrentArchiveToFolder(){
  if(!userStore.directoryHandle) throw new Error('Önce kullanıcı klasörünü tanımlayın.');
  const merged=mergeArchive(state.existingArchiveParsed,state);
  if(!merged) throw new Error('Kaydedilecek arşiv bulunamadı.');
  const m=merged.mukellef||{};
  const folder=await userEnsureVknFolder(userVkn(m.vkn),m.unvan);
  const safe=userFileSafeName(m.unvan||m.vkn||'arsiv');
  await userWriteWorkbook(folder,'ARSIV_'+safe+'.xlsx',buildArchiveWorkbook(merged));
  await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());
  await userScanCurrentFolder();
}
function userFolderStatus(container){
  const ok=!!userStore.directoryHandle;
  container.appendChild(el('div',{class:'hint '+(ok?'ok':'info')},ok
    ? '✓ Kullanıcı klasörü: '+(userStore.directoryHandle.name||'seçildi')
    : 'Kullanıcı klasörü henüz tanımlanmadı.'));
}
function userFirmTable(){
  const box=el('div',{class:'card',style:'margin-top:14px;'});
  box.appendChild(el('h3',{},'Klasörde Bulunan Firmalar'));
  if(!userStore.firms.length){
    box.appendChild(el('div',{class:'hint info'},'Henüz arşiv Excel’i içinde firma bilgisi bulunamadı.'));
    return box;
  }
  const table=el('table',{class:'editable-table'});
  const tr=el('tr'); ['Firma','Vergi Kimlik No','Vergi Dairesi','Kayıt','Dosya'].forEach(h=>tr.appendChild(el('th',{},h))); table.appendChild(el('thead',{},tr));
  const tb=el('tbody');
  userStore.firms.forEach(f=>{
    const r=el('tr');
    [f.unvan||'—',f.vkn||'—',f.vergiDairesi||'—',String(f.recordCount||0),f.relativePath||((f.files||[]).join(', ')||'—')].forEach(v=>r.appendChild(el('td',{},v)));
    tb.appendChild(r);
  });
  table.appendChild(tb); const sc=el('div',{class:'table-scroll'}); sc.appendChild(table); box.appendChild(sc); return box;
}

async function renderUserFolderPage(){
  currentPage='user-folder'; currentStep=-1; const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Kullanıcı / Kullanıcı Dosyası Oluştur'));
  content.appendChild(el('p',{class:'step-desc'},'Bilgisayarınızda bu uygulamaya ait bir klasör seçin. Sistem klasörü tarar; içindeki arşiv Excel dosyalarından kullanıcıya ait firma ve VKN bilgilerini bulur.'));
  const card=el('div',{class:'card',style:'max-width:1000px;'}); card.appendChild(el('h3',{},'Yerel Kullanıcı Klasörü'));
  card.appendChild(el('div',{class:'hint info'},'Klasör yalnızca sizin bilgisayarınızda okunur. Dosyalar sunucuya gönderilmez. Yazma izni verdiğiniz klasöre daha sonra KULLANICI_BILGILERI.json ve ilgili VKN klasörleri oluşturulabilir.'));
  const choose=el('button',{class:'btn btn-primary',onclick:async()=>{
    try{
      if(!window.showDirectoryPicker) throw new Error('Bu tarayıcı yerel klasör seçimini desteklemiyor. Güncel Chrome/Edge kullanın.');
      userStore.directoryHandle=await window.showDirectoryPicker({mode:'readwrite'});
      const status=document.getElementById('user-folder-status'); status.innerHTML='<div class="hint info">⏳ Klasör taranıyor...</div>';
      await userScanCurrentFolder();
      status.innerHTML=''; userFolderStatus(status);
      status.appendChild(el('div',{class:'hint ok',style:'margin-top:8px;'},`✓ ${userStore.files.length} dosya tarandı, ${userStore.firms.length} firma bulundu.`));
      document.getElementById('user-create-info').disabled=false;
      document.getElementById('user-create-firm-folders').disabled=userStore.firms.length===0;
      renderNav();
    }catch(e){alert('Kullanıcı klasörü açılamadı: '+e.message);}
  }},'📁 Kullanıcı Klasörü Seç');
  card.appendChild(choose);
  const status=el('div',{id:'user-folder-status',style:'margin-top:14px;'}); userFolderStatus(status); card.appendChild(status);
  const create=el('button',{id:'user-create-info',class:'btn btn-secondary',disabled:!userStore.directoryHandle,style:'margin-top:12px;',onclick:async()=>{
    try{await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());alert('KULLANICI_BILGILERI.json oluşturuldu/güncellendi.');await userScanCurrentFolder();renderUserFolderPage();}
    catch(e){alert('Kullanıcı dosyası oluşturulamadı: '+e.message);}
  }},'Kullanıcı Dosyasını Oluştur / Güncelle');
  card.appendChild(create);
  const folders=el('button',{class:'btn btn-secondary',style:'margin:10px 0 0 8px;',disabled:true,onclick:async()=>{
    try{const n=await userCreateFirmFolders();alert(n+' firma için VKN klasörü oluşturuldu/güncellendi.');await userScanCurrentFolder();renderUserFolderPage();}
    catch(e){alert('Firma klasörleri oluşturulamadı: '+e.message);}
  }},'Firma VKN Klasörlerini Oluştur');
  folders.id='user-create-firm-folders'; card.appendChild(folders); content.appendChild(card);
  content.appendChild(userFirmTable());
  if(userStore.directoryHandle){
    const saveArchive=el('button',{class:'btn btn-secondary',style:'margin-top:14px;',onclick:async()=>{
      try{await userSaveCurrentArchiveToFolder();alert('Güncel arşiv kullanıcı klasöründeki ilgili VKN klasörüne kaydedildi.');renderUserFolderPage();}
      catch(e){alert('Arşiv kullanıcı klasörüne kaydedilemedi: '+e.message);}
    }},'Güncel Arşivi Kullanıcı Dosyasına Kaydet');
    content.appendChild(saveArchive);
  }
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Kullanıcı Dosyası';renderNav();
}
function renderUserDefinePage(){
  currentPage='user-define'; currentStep=-1; const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Kullanıcı Tanımla'));
  content.appendChild(el('p',{class:'step-desc'},'Kullanıcı bilgileri tutanaktan okunabiliyorsa aşağıdaki alanlar otomatik doldurulur. Alanları düzenleyip kullanıcı dosyasına kaydedebilirsiniz.'));
  const m=state.meta||{}; const card=el('div',{class:'card',style:'max-width:900px;'});
  const fields=[
    ['adSoyad','Adı Soyadı','ymmAdSoyad'],['vkn','Vergi / T.C. Kimlik No','ymmVkn'],['vergiDairesi','Vergi Dairesi','ymmVergiDairesi'],
    ['oda','Bağlı Olduğu Oda','ymmOda'],['sicil','Sicil Numarası','ymmSicil'],['telefon','Telefon','ymmTelefon'],['adres','Adres','ymmAdres'],
    ['sirketUnvani','YMM Şirketi Ünvanı','ymmSirketUnvan'],['sirketVkn','YMM Şirketi VKN','ymmSirketVkn']
  ];
  const inputs={};
  fields.forEach(([key,label,stateKey])=>{
    const row=el('div',{style:'display:grid;grid-template-columns:220px 1fr;gap:10px;align-items:center;margin:8px 0;'});
    row.appendChild(el('label',{},label)); const input=el('input',{type:'text',value:m[stateKey]||''}); input.addEventListener('input',e=>{state.meta[stateKey]=e.target.value;}); inputs[key]=input; row.appendChild(input); card.appendChild(row);
  });
  card.appendChild(el('div',{class:'hint info',style:'margin-top:12px;'},'Kaydetme işlemi kullanıcı klasöründe KULLANICI_BILGILERI.json dosyasını günceller.'));
  const save=el('button',{class:'btn btn-primary',style:'margin-top:12px;',onclick:async()=>{
    if(!userStore.directoryHandle){alert('Önce Kullanıcı / Kullanıcı Dosyası Oluştur bölümünden bir klasör seçin.');return;}
    try{await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());alert('Kullanıcı bilgileri kaydedildi.');await userScanCurrentFolder();renderUserInfoPage();}
    catch(e){alert('Kullanıcı bilgileri kaydedilemedi: '+e.message);}
  }},'Kullanıcı Bilgilerini Kaydet');
  card.appendChild(save); content.appendChild(card);
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Kullanıcı Tanımla';renderNav();
}
function renderUserInfoPage(){
  currentPage='user-info'; currentStep=-1; const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Kullanıcı Bilgilerini Görüntüle'));
  content.appendChild(el('p',{class:'step-desc'},'Seçili kullanıcı klasörünün kısa bilgi özeti ve klasörde tespit edilen firmalar.'));
  const info=userCurrentInfo(); const card=el('div',{class:'card',style:'max-width:1000px;'});
  const u=info.kullanici; [['Adı Soyadı',u.adSoyad],['VKN',u.vkn],['Vergi Dairesi',u.vergiDairesi],['Oda',u.oda],['Sicil',u.sicil],['Telefon',u.telefon],['YMM Şirketi',u.sirketUnvani],['Şirket VKN',u.sirketVkn]].forEach(([l,v])=>{
    const row=el('div',{style:'display:grid;grid-template-columns:220px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);'});row.appendChild(el('strong',{},l));row.appendChild(el('div',{},v||'—'));card.appendChild(row);
  });
  content.appendChild(card); content.appendChild(userFirmTable());
  if(userStore.directoryHandle){
    const save=el('button',{class:'btn btn-secondary',style:'margin-top:14px;',onclick:async()=>{
      try{await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());alert('Kullanıcı bilgi dosyası güncellendi.');}
      catch(e){alert('Kaydedilemedi: '+e.message);}
    }},'Kullanıcı Bilgi Dosyasını Güncelle');content.appendChild(save);
  }
  document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Kullanıcı Bilgileri';renderNav();
}
