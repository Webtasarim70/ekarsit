(() => {
  if (window.__ekarsitAppContentInstalled) return;
  window.__ekarsitAppContentInstalled = true;
  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type!=='EKARSIT_GIB_DATA') return;
    window.postMessage({source:'ekarsit-gib-extension',type:'EKARSIT_GIB_DATA',payload:message.payload},'*');
    sendResponse({ok:true});
    return true;
  });
})();