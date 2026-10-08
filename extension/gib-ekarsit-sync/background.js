const APP_URL='https://webtasarim70.github.io/ekarsit/';
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
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