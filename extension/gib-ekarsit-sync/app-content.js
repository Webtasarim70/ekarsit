(() => {
  if (window.__ekarsitAppContentInstalled) return;
  window.__ekarsitAppContentInstalled = true;

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type==='EKARSIT_PDF_STATUS'){
      window.postMessage({source:'ekarsit-gib-extension',type:'EKARSIT_PDF_STATUS',requestId:message.requestId,status:message.status,message:message.message||'',filename:message.filename||''},'*');
      sendResponse({ok:true});
      return true;
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
    if(event.source!==window || event.data?.source!=='ekarsit-app') return;
    if(event.data.type==='GIB_TEBLIGAT_START_SYNC'){
      chrome.runtime.sendMessage({type:'GIB_TEBLIGAT_START_SYNC'},response=>{
        if(chrome.runtime.lastError||!response?.ok){
          window.postMessage({source:'ekarsit-gib-extension',type:'GIB_TEBLIGAT_SYNC_STATUS',status:'error',message:response?.message||chrome.runtime.lastError?.message||'Eklentiyle bağlantı kurulamadı. Eklentinin yüklü ve etkin olduğunu kontrol edin.'},'*');
        }else{
          window.postMessage({source:'ekarsit-gib-extension',type:'GIB_TEBLIGAT_SYNC_STATUS',status:'working',message:'GİB e-Tebligat sayfası açılıyor veya etkinleştiriliyor…'},'*');
        }
      });
      return;
    }
    if(event.data.type==='EKARSIT_DOWNLOAD_PDF'){
      chrome.runtime.sendMessage({type:'EKARSIT_REQUEST_PDF',payload:event.data.payload},response=>{
        if(chrome.runtime.lastError || !response?.ok){
          window.postMessage({source:'ekarsit-gib-extension',type:'EKARSIT_PDF_STATUS',requestId:event.data.payload?.requestId,status:'error',message:response?.message||chrome.runtime.lastError?.message||'PDF isteği başlatılamadı.'},'*');
        }
      });
      return;
    }
    if(event.data.type!=='EKARSIT_START_GIB_SYNC') return;
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