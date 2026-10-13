(() => {
  if (window.__ekarsitAppContentInstalled) return;
  window.__ekarsitAppContentInstalled = true;

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type==='GIB_TEBLIGAT_PDF_RESULT'){
      window.postMessage({source:'ekarsit-gib-extension',type:'GIB_TEBLIGAT_PDF_RESULT',requestId:message.requestId,ok:message.ok,pdf:message.pdf,message:message.message},'*');
      sendResponse({ok:true});return true;
    }
    if(message?.type==='GIB_TEBLIGAT_DATA'){
      window.postMessage({source:'ekarsit-gib-extension',type:'GIB_TEBLIGAT_DATA',payload:message.payload},'*');
      sendResponse({ok:true});
      return true;
    }
    if(message?.type==='EKARSIT_GIB_DATA'){
      window.postMessage({source:'ekarsit-gib-extension',type:'EKARSIT_GIB_DATA',payload:message.payload},'*');
      sendResponse({ok:true});
      return true;
    }
    if(message?.type==='EKARSIT_GIB_SYNC_STATUS'){
      window.postMessage({source:'ekarsit-gib-extension',type:'EKARSIT_GIB_SYNC_STATUS',status:message.status,message:message.message||''},'*');
      sendResponse({ok:true});
      return true;
    }
  });

  window.addEventListener('message',event=>{
    if(event.source===window&&event.data?.source==='ekarsit-gib-app'&&event.data.type==='GIB_TEBLIGAT_DOWNLOAD_PDF'){
      chrome.runtime.sendMessage({type:'GIB_TEBLIGAT_DOWNLOAD_PDF',requestId:event.data.requestId,record:event.data.record},response=>{
        if(chrome.runtime.lastError||!response?.ok)window.postMessage({source:'ekarsit-gib-extension',type:'GIB_TEBLIGAT_PDF_RESULT',requestId:event.data.requestId,ok:false,message:chrome.runtime.lastError?.message||response?.message||'PDF isteği başlatılamadı.'},'*');
      });return;
    }
    if(event.source!==window || event.data?.source!=='ekarsit-app' || event.data.type!=='EKARSIT_START_GIB_SYNC') return;
    chrome.runtime.sendMessage({type:'EKARSIT_START_GIB_SYNC'},response=>{
      if(chrome.runtime.lastError){
        window.postMessage({source:'ekarsit-gib-extension',type:'EKARSIT_GIB_SYNC_STATUS',status:'error',message:'Chrome eklentisi ile bağlantı kurulamadı.'},'*');
        return;
      }
      if(!response?.ok){
        window.postMessage({source:'ekarsit-gib-extension',type:'EKARSIT_GIB_SYNC_STATUS',status:'error',message:response?.message||'GİB senkronizasyonu başlatılamadı.'},'*');
      }
    });
  });
})();