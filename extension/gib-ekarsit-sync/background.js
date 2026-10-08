const APP_URL='https://webtasarim70.github.io/ekarsit/';
const GIB_URL='https://eymm.gib.gov.tr/portal/karsitIncelemeTutanagi*';

async function getOrOpenGibTab(){
  const tabs=await chrome.tabs.query({url:GIB_URL});
  let tab=tabs[0];
  if(!tab?.id){
    tab=await chrome.tabs.create({url:'https://eymm.gib.gov.tr/portal/karsitIncelemeTutanagi'});
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(listener);reject(new Error('GİB sayfası zamanında açılamadı.'));},30000);
      const listener=(tabId,info)=>{
        if(tabId===tab.id && info.status==='complete'){
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }
  if(!tab?.id) throw new Error('GİB sayfası açılamadı.');
  return tab;
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type==='EKARSIT_START_GIB_SYNC'){
    // Uygulamaya hemen yanıt ver; GİB açılması/aktarımı uzun sürebilir.
    // Aksi halde uygulamadaki kısa timeout, eklenti çalışıyor olsa bile
    // "eklenti bulunamadı" mesajı gösterebilir.
    sendResponse({ok:true,message:'GİB senkronizasyonu başlatıldı.'});
    (async()=>{
      try{
        const tab=await getOrOpenGibTab();
        await chrome.tabs.update(tab.id,{active:true});
        await chrome.tabs.sendMessage(tab.id,{type:'EKARSIT_TRIGGER_SYNC'});
      }catch(error){
        const tabs=await chrome.tabs.query({url:APP_URL+'*'});
        const appTab=tabs[0];
        if(appTab?.id){
          try{
            await chrome.tabs.sendMessage(appTab.id,{
              type:'EKARSIT_GIB_SYNC_STATUS',
              status:'error',
              message:error?.message||String(error)
            });
          }catch(_){}
        }
      }
    })();
    return true;
  }

  if(message?.type==='EKARSIT_SYNC_STATUS_TO_APP'){
    (async()=>{
      try{
        const tabs=await chrome.tabs.query({url:APP_URL+'*'});
        const tab=tabs[0];
        if(tab?.id) await chrome.tabs.sendMessage(tab.id,{type:'EKARSIT_GIB_SYNC_STATUS',status:message.status,message:message.message||''});
        sendResponse({ok:true});
      }catch(error){sendResponse({ok:false,message:error?.message||String(error)});}
    })();
    return true;
  }

  if(message?.type==='EKARSIT_DOWNLOAD_XLSX'){
    chrome.downloads.download({url:message.dataUrl,filename:message.filename||'E_KARSIT_TAKIP.xlsx',saveAs:true},downloadId=>{
      if(chrome.runtime.lastError) sendResponse({ok:false,message:chrome.runtime.lastError.message});
      else sendResponse({ok:true,downloadId});
    });
    return true;
  }

  if(message?.type!=='EKARSIT_SEND_TO_APP') return;
  (async()=>{
    const tabs=await chrome.tabs.query({url:APP_URL+'*'});
    let tab=tabs[0];
    if(!tab?.id){
      tab=await chrome.tabs.create({url:APP_URL});
      await new Promise(resolve=>{
        const listener=(tabId,info)=>{
          if(tabId===tab.id && info.status==='complete'){
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
    if(!tab?.id) throw new Error('e-Karşıt uygulama sekmesi açılamadı.');
    await chrome.tabs.sendMessage(tab.id,{type:'EKARSIT_GIB_DATA',payload:message.payload});
    await chrome.tabs.update(tab.id,{active:true});
    sendResponse({ok:true});
  })().catch(error=>sendResponse({ok:false,message:error?.message||String(error)}));
  return true;
});