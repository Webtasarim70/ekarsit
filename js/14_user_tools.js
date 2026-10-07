/* ============================================================
   Kullanıcı İşlemleri / Kullanıcı Dosyası
   Yerel klasör tabanlı, tarayıcı içinde çalışan kullanıcı alanı.
   ============================================================ */

const userStore = {
  directoryHandle: null,
  info: null,
  firms: [],
  files: [],
  scanned: false,
  sessionConnected: false,
  sessionRemembered: false,
  sessionNeedsPermission: false
};

/* ============================================================
   Yerel kullanıcı oturumu
   FileSystemDirectoryHandle IndexedDB'de saklanır. Kullanıcının
   gerçek dosyaları tarayıcıya kopyalanmaz; yalnızca seçilen klasöre
   yeniden erişebilmek için handle hatırlanır.
   ============================================================ */
const USER_SESSION_DB='ekarsit-user-session';
const USER_SESSION_STORE='session';
const USER_SESSION_KEY='directory-handle';
const USER_ARCHIVE_KEY='archive-relative-path';
let userSessionRestoreStarted=false;

function userOpenSessionDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB desteklenmiyor.')); return; }
    const req=indexedDB.open(USER_SESSION_DB,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(USER_SESSION_STORE)) db.createObjectStore(USER_SESSION_STORE);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Yerel oturum veritabanı açılamadı.'));
  });
}
async function userRememberDirectoryHandle(handle){
  if(!handle) return false;
  try{
    const db=await userOpenSessionDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(USER_SESSION_STORE,'readwrite');
      tx.objectStore(USER_SESSION_STORE).put(handle,USER_SESSION_KEY);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error||new Error('Oturum kaydedilemedi.'));
    });
    db.close();
    userStore.sessionRemembered=true;
    return true;
  }catch(e){
    userStore.sessionRemembered=false;
    return false;
  }
}
async function userGetRememberedDirectoryHandle(){
  try{
    const db=await userOpenSessionDb();
    const handle=await new Promise((resolve,reject)=>{
      const tx=db.transaction(USER_SESSION_STORE,'readonly');
      const req=tx.objectStore(USER_SESSION_STORE).get(USER_SESSION_KEY);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
    db.close();
    userStore.sessionRemembered=!!handle;
    return handle;
  }catch(e){
    userStore.sessionRemembered=false;
    return null;
  }
}
async function userRememberArchivePath(relativePath){
  if(!relativePath) return false;
  try{
    const db=await userOpenSessionDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(USER_SESSION_STORE,'readwrite');
      tx.objectStore(USER_SESSION_STORE).put(String(relativePath),USER_ARCHIVE_KEY);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error||new Error('Arşiv oturumu kaydedilemedi.'));
    });
    db.close();
    return true;
  }catch(e){ return false; }
}
async function userGetRememberedArchivePath(){
  try{
    const db=await userOpenSessionDb();
    const path=await new Promise((resolve,reject)=>{
      const tx=db.transaction(USER_SESSION_STORE,'readonly');
      const req=tx.objectStore(USER_SESSION_STORE).get(USER_ARCHIVE_KEY);
      req.onsuccess=()=>resolve(req.result||'');
      req.onerror=()=>reject(req.error);
    });
    db.close();
    return String(path||'');
  }catch(e){ return ''; }
}
async function userForgetRememberedArchivePath(){
  try{
    const db=await userOpenSessionDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(USER_SESSION_STORE,'readwrite');
      tx.objectStore(USER_SESSION_STORE).delete(USER_ARCHIVE_KEY);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error||new Error('Arşiv oturumu silinemedi.'));
    });
    db.close();
  }catch(e){}
}
async function userRestoreRememberedArchive(){
  const relativePath=await userGetRememberedArchivePath();
  if(!relativePath || !userStore.directoryHandle) return false;
  try{
    const file=await userLoadArchiveFromPath(relativePath);
    const parsed=await readArchiveUpload(file);
    state.existingArchiveParsed=parsed;
    state.existingArchiveFile={name:file.name,source:'user-folder',relativePath};
    syncSharedArchiveRefs(parsed);
    archiveToState(parsed);
    return true;
  }catch(e){
    await userForgetRememberedArchivePath();
    return false;
  }
}

async function userForgetRememberedDirectoryHandle(){
  try{
    const db=await userOpenSessionDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(USER_SESSION_STORE,'readwrite');
      tx.objectStore(USER_SESSION_STORE).delete(USER_SESSION_KEY);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error||new Error('Oturum silinemedi.'));
    });
    db.close();
  }catch(e){}
  userStore.sessionRemembered=false;
}
async function userCheckDirectoryPermission(handle,request=false){
  if(!handle) return 'denied';
  try{
    const options={mode:'readwrite'};
    if(request && typeof handle.requestPermission==='function') return await handle.requestPermission(options);
    if(typeof handle.queryPermission==='function') return await handle.queryPermission(options);
    return 'granted';
  }catch(e){ return 'denied'; }
}
function userResetLocalStore(){
  userStore.directoryHandle=null;
  userStore.info=null;
  userStore.firms=[];
  userStore.files=[];
  userStore.scanned=false;
  userStore.sessionConnected=false;
  userStore.sessionNeedsPermission=false;
}
async function userRestoreRememberedSession({rerender=true}={}){
  if(userSessionRestoreStarted) return userStore.sessionConnected;
  userSessionRestoreStarted=true;
  const handle=await userGetRememberedDirectoryHandle();
  if(!handle) return false;
  const permission=await userCheckDirectoryPermission(handle,false);
  if(permission!=='granted'){
    userStore.directoryHandle=handle;
    userStore.sessionConnected=false;
    userStore.sessionNeedsPermission=true;
    if(rerender && typeof renderNav==='function') renderNav();
    return false;
  }
  try{
    userStore.directoryHandle=handle;
    await handle.getFileHandle('KULLANICI_BILGILERI.json');
    await userScanCurrentFolder();
    if(!userStore.info?.kullanici) throw new Error('Geçerli kullanıcı bilgisi bulunamadı.');
    await userRestoreRememberedArchive();
    userStore.sessionConnected=true;
    userStore.sessionNeedsPermission=false;
    if(rerender && typeof renderNav==='function') renderNav();
    if(rerender && typeof renderWelcomePage==='function' && currentPage==='welcome') await renderWelcomePage();
    return true;
  }catch(e){
    await userForgetRememberedDirectoryHandle();
    userResetLocalStore();
    if(rerender && typeof renderNav==='function') renderNav();
    return false;
  }
}
async function userReconnectRememberedSession(){
  const handle=userStore.directoryHandle||await userGetRememberedDirectoryHandle();
  if(!handle) throw new Error('Hatırlanan kullanıcı klasörü bulunamadı.');
  const permission=await userCheckDirectoryPermission(handle,true);
  if(permission!=='granted') throw new Error('Kullanıcı klasörüne erişim izni verilmedi.');
  userStore.directoryHandle=handle;
  await handle.getFileHandle('KULLANICI_BILGILERI.json');
  await userScanCurrentFolder();
  if(!userStore.info?.kullanici) throw new Error('KULLANICI_BILGILERI.json geçerli kullanıcı bilgisi içermiyor.');
  await userRestoreRememberedArchive();
  userStore.sessionConnected=true;
  userStore.sessionNeedsPermission=false;
  await userRememberDirectoryHandle(handle);
  if(typeof renderNav==='function') renderNav();
  if(currentPage==='user' && typeof renderUserPage==='function') renderUserPage();
  return true;
}
async function userLogout(){
  await userForgetRememberedDirectoryHandle();
  await userForgetRememberedArchivePath();
  userResetLocalStore();
  // Çıkışta bellekteki arşiv/kullanıcı verilerinin başka kullanıcıya görünmemesi için
  // uygulama baştan başlatılır; klasördeki hiçbir dosya silinmez/değiştirilmez.
  window.location.reload();
}

// Sayfa yenilendiğinde son kullanıcı klasörünü otomatik olarak geri yükle.
window.addEventListener('load',()=>{ userRestoreRememberedSession({rerender:true}); });

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
    recordCount:userCountRecords(parsed),
    files:[relativePath]
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
async function userGetFileByRelativePath(relativePath){
  if(!userStore.directoryHandle) throw new Error('Önce kullanıcı klasörünü seçin.');
  const parts=String(relativePath||'').split('/').filter(Boolean);
  if(!parts.length) throw new Error('Dosya yolu bulunamadı.');
  let dir=userStore.directoryHandle;
  for(let i=0;i<parts.length-1;i++){
    dir=await dir.getDirectoryHandle(parts[i]);
  }
  const fileHandle=await dir.getFileHandle(parts[parts.length-1]);
  return await fileHandle.getFile();
}

async function userLoadArchiveFromPath(relativePath){
  const file=await userGetFileByRelativePath(relativePath);
  if(!userIsArchiveWorkbook(file.name)) throw new Error('Seçilen dosya desteklenen arşiv Excel dosyası değil.');
  return file;
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
async function userSaveArchiveParsedToFolder(parsed,filename=''){
  if(!userStore.directoryHandle) return false;
  const m=parsed?.mukellef||{};
  const vkn=userVkn(m.vkn);
  if(!vkn) throw new Error('Firma arşivindeki VKN/T.C. Kimlik Numarası bulunamadı.');
  const folder=await userEnsureVknFolder(vkn,m.unvan);
  const safe=userFileSafeName(m.unvan||vkn||'arsiv');
  const target=filename||('ARSIV_'+safe+'.xlsx');
  await userWriteWorkbook(folder,target,buildArchiveWorkbook(parsed));
  await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());
  await userScanCurrentFolder();
  return true;
}

async function userSaveCurrentArchiveToFolder(){
  if(!userStore.directoryHandle) throw new Error('Önce kullanıcı klasörünü tanımlayın.');
  const merged=mergeArchive(state.existingArchiveParsed,state);
  if(!merged) throw new Error('Kaydedilecek arşiv bulunamadı.');
  return await userSaveArchiveParsedToFolder(merged);
}
async function userSelectFolder({createUser=false}={}){
  if(!window.showDirectoryPicker) throw new Error('Bu tarayıcı yerel klasör seçimini desteklemiyor. Güncel Chrome/Edge kullanın.');
  const handle=await window.showDirectoryPicker({mode:'readwrite'});
  userResetLocalStore();
  userStore.directoryHandle=handle;
  if(createUser){
    await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());
  }else{
    try{
      await handle.getFileHandle('KULLANICI_BILGILERI.json');
    }catch(e){
      userResetLocalStore();
      await userForgetRememberedDirectoryHandle();
      if(e?.name==='NotFoundError'){
        throw new Error('Bu klasörde KULLANICI_BILGILERI.json bulunamadı. Lütfen daha önce kullanıcı olarak tanımlanmış klasörü seçin. Firma arşiv klasörleri bu kontrol yapılmadan kullanıma açılamaz.');
      }
      throw e;
    }
  }
  await userScanCurrentFolder();
  if(!createUser && !userStore.info?.kullanici){
    userResetLocalStore();
    await userForgetRememberedDirectoryHandle();
    throw new Error('KULLANICI_BILGILERI.json bulundu ancak geçerli kullanıcı bilgisi içermiyor. Firma arşivleri bu klasörden yüklenemez.');
  }
  userStore.sessionConnected=true;
  userStore.sessionNeedsPermission=false;
  await userRememberDirectoryHandle(handle);
  await userForgetRememberedArchivePath();
  return handle;
}
function userFolderStatus(container){
  if(userStore.sessionConnected && userStore.directoryHandle){
    container.appendChild(el('div',{class:'hint ok'},'✓ Kullanıcı bağlı · Klasör: '+(userStore.directoryHandle.name||'seçildi')));
    container.appendChild(el('div',{class:'hint info',style:'margin-top:6px;'},userStore.sessionRemembered?'Bu tarayıcıda kullanıcı oturumu hatırlanıyor. Sayfa yenilendiğinde klasör otomatik yeniden bağlanır.':'Kullanıcı klasörü bu oturumda bağlı.'));
    return;
  }
  if(userStore.sessionNeedsPermission && userStore.directoryHandle){
    container.appendChild(el('div',{class:'hint warn'},'⚠️ Kullanıcı klasörü hatırlanıyor ancak erişim izni yeniden onaylanmalı.'));
    return;
  }
  container.appendChild(el('div',{class:'hint info'},'Kullanıcı klasörü henüz tanımlanmadı.'));
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

async function renderUserPage(){
  currentPage='user'; currentStep=-1;
  const content=document.getElementById('step-content');
  content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Kullanıcı'));
  content.appendChild(el('p',{class:'step-desc'},'Mevcut kullanıcı klasörünüzü seçin veya yeni bir kullanıcı klasörü oluşturun.'));

  const actions=el('div',{class:'card',style:'max-width:1000px;'});
  actions.appendChild(el('h3',{},'Kullanıcı İşlemleri'));

  const existing=el('button',{class:'btn btn-primary',onclick:async()=>{
    try{await userSelectFolder();renderUserPage();}
    catch(e){if(e?.name!=='AbortError')alert('Kullanıcı klasörü açılamadı: '+e.message);}
  }},'👤 Mevcut Kullanıcı Seç');
  actions.appendChild(existing);

  const create=el('button',{class:'btn btn-secondary',style:'margin-left:8px;',onclick:async()=>{
    try{await userSelectFolder({createUser:true});renderUserPage();}
    catch(e){if(e?.name!=='AbortError')alert('Yeni kullanıcı klasörü oluşturulamadı: '+e.message);}
  }},'➕ Yeni Kullanıcı Oluştur');
  actions.appendChild(create);

  if(userStore.sessionNeedsPermission && userStore.directoryHandle){
    actions.appendChild(el('button',{class:'btn btn-primary',style:'margin-left:8px;',onclick:async()=>{
      try{await userReconnectRememberedSession();}
      catch(e){if(e?.name!=='AbortError') alert('Kullanıcı klasörü yeniden bağlanamadı: '+e.message);}
    }},'🔐 Klasör Erişimini Onayla'));
  }
  if(userStore.sessionConnected){
    actions.appendChild(el('button',{class:'btn btn-secondary',style:'margin-left:8px;',onclick:async()=>{
      if(confirm('Oturumu kapatmak istediğinize emin misiniz? Kullanıcı klasöründeki dosyalar silinmez.')) await userLogout();
    }},'↪ Çıkış Yap'));
  }

  const status=el('div',{id:'user-page-status',style:'margin-top:14px;'});
  userFolderStatus(status);
  actions.appendChild(status);
  content.appendChild(actions);

  if(userStore.directoryHandle && userStore.scanned){
    const info=userStore.info?.kullanici||{};
    const values={
      adSoyad:String(info.adSoyad||state.meta?.ymmAdSoyad||''),
      vkn:String(info.vkn||state.meta?.ymmVkn||''),
      vergiDairesi:String(info.vergiDairesi||state.meta?.ymmVergiDairesi||''),
      oda:String(info.oda||state.meta?.ymmOda||''),
      sicil:String(info.sicil||state.meta?.ymmSicil||''),
      telefon:String(info.telefon||state.meta?.ymmTelefon||''),
      adres:String(info.adres||state.meta?.ymmAdres||''),
      sirketUnvani:String(info.sirketUnvani||state.meta?.ymmSirketUnvan||''),
      sirketVkn:String(info.sirketVkn||state.meta?.ymmSirketVkn||'')
    };
    const card=el('div',{class:'card',style:'max-width:1000px;margin-top:14px;'});
    card.appendChild(el('h3',{},'Klasörde Bulunan Kullanıcı'));
    const fields=[
      ['adSoyad','Adı Soyadı'],['vkn','Vergi / T.C. Kimlik No'],['vergiDairesi','Vergi Dairesi'],
      ['oda','Bağlı Olduğu Oda'],['sicil','Sicil Numarası'],['telefon','Telefon'],['adres','Adres'],
      ['sirketUnvani','YMM Şirketi Ünvanı'],['sirketVkn','YMM Şirketi VKN']
    ];
    const inputs={};
    fields.forEach(([key,label])=>{
      const row=el('div',{style:'display:grid;grid-template-columns:220px 1fr;gap:10px;align-items:center;margin:8px 0;'});
      row.appendChild(el('label',{},label));
      const input=el('input',{type:'text',value:values[key]});
      inputs[key]=input; row.appendChild(input); card.appendChild(row);
    });
    const update=el('button',{class:'btn btn-primary',style:'margin-top:10px;',onclick:async()=>{
      try{
        state.meta.ymmAdSoyad=inputs.adSoyad.value.trim();
        state.meta.ymmVkn=inputs.vkn.value.trim();
        state.meta.ymmVergiDairesi=inputs.vergiDairesi.value.trim();
        state.meta.ymmOda=inputs.oda.value.trim();
        state.meta.ymmSicil=inputs.sicil.value.trim();
        state.meta.ymmTelefon=inputs.telefon.value.trim();
        state.meta.ymmAdres=inputs.adres.value.trim();
        state.meta.ymmSirketUnvan=inputs.sirketUnvani.value.trim();
        state.meta.ymmSirketVkn=inputs.sirketVkn.value.trim();
        await userWriteJson(userStore.directoryHandle,'KULLANICI_BILGILERI.json',userCurrentInfo());
        await userScanCurrentFolder();
        renderUserPage();
      }catch(e){alert('Kullanıcı bilgileri güncellenemedi: '+e.message);}
    }},'✓ Güncelle');
    card.appendChild(update);
    content.appendChild(card);

    const firmsCard=userFirmTable();
    const firmUpdate=el('button',{class:'btn btn-secondary',style:'margin-top:10px;',onclick:async()=>{
      try{await userScanCurrentFolder();renderUserPage();}
      catch(e){alert('Firmalar güncellenemedi: '+e.message);}
    }},'↻ Firmaları Güncelle');
    firmsCard.appendChild(firmUpdate);
    const newArchive=el('button',{class:'btn btn-primary',style:'margin-top:10px;margin-left:8px;',onclick:()=>renderArchiveUploadPage()},'➕ Yeni Firma Arşiv Oluştur');
    firmsCard.appendChild(newArchive);
    content.appendChild(firmsCard);
  }

  document.getElementById('btn-prev').disabled=true;
  document.getElementById('btn-next').disabled=true;
  document.getElementById('footer-msg').textContent='Kullanıcı';
  renderNav();
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
