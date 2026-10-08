(() => {
  if (window.__ekarsitGibContentInstalled) return;
  window.__ekarsitGibContentInstalled = true;

  const button=document.createElement('button');
  button.type='button';
  button.textContent='↻ e-Karşıt Takip’e Aktar';
  Object.assign(button.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',padding:'11px 16px',border:'0',borderRadius:'8px',background:'#1769aa',color:'#fff',font:'600 14px Arial,sans-serif',boxShadow:'0 4px 14px rgba(0,0,0,.25)',cursor:'pointer'});

  const reset=()=>{button.textContent='↻ e-Karşıt Takip’e Aktar';button.disabled=false;};
  button.addEventListener('click',()=>{
    button.disabled=true;
    button.textContent='GİB kayıtları alınıyor…';
    window.postMessage({source:'ekarsit-extension',type:'EKARSIT_FETCH_GIB'},'*');
  });

  window.addEventListener('message',event=>{
    if(event.source!==window || event.data?.source!=='ekarsit-gib-main') return;
    if(event.data.type==='EKARSIT_FETCH_STATUS'){button.textContent='GİB kayıtları alınıyor…';return;}
    if(event.data.type==='EKARSIT_FETCH_ERROR'){
      button.textContent='⚠ '+event.data.message;
      setTimeout(reset,5000);
      return;
    }
    if(event.data.type==='EKARSIT_FETCH_RESULT'){
      const result=event.data.result;
      chrome.runtime.sendMessage({type:'EKARSIT_SEND_TO_APP',payload:result},response=>{
        if(chrome.runtime.lastError){button.textContent='⚠ Uygulamaya gönderilemedi';setTimeout(reset,5000);return;}
        if(!response?.ok){button.textContent='⚠ '+(response?.message||'Uygulama bulunamadı');setTimeout(reset,5000);return;}
        button.textContent='✓ '+result.records.length+' kayıt aktarıldı';
        setTimeout(reset,5000);
      });
    }
  });

  document.documentElement.appendChild(button);
})();