(() => {
  if(window.__ekarsitTebligatContentInstalled)return;
  window.__ekarsitTebligatContentInstalled=true;
  const wrap=document.createElement('div');
  Object.assign(wrap.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',display:'flex',gap:'8px',alignItems:'center'});
  const btn=document.createElement('button');btn.type='button';btn.textContent='↻ Tebligat Takip’e Aktar / Güncelle';
  Object.assign(btn.style,{padding:'11px 16px',border:'0',borderRadius:'8px',background:'#1769aa',color:'#fff',font:'600 14px Arial,sans-serif',boxShadow:'0 4px 14px rgba(0,0,0,.25)',cursor:'pointer'});
  wrap.appendChild(btn);document.documentElement.appendChild(wrap);
  btn.addEventListener('click',()=>{btn.disabled=true;btn.textContent='Tebligatlar alınıyor…';window.postMessage({source:'ekarsit-extension',type:'GIB_TEBLIGAT_FETCH'},'*');});
  const reset=()=>{btn.disabled=false;btn.textContent='↻ Tebligat Takip’e Aktar / Güncelle';};
  window.addEventListener('message',event=>{
    if(event.source!==window||event.data?.source!=='ekarsit-tebligat-main')return;
    if(event.data.type==='STATUS'){btn.textContent='GİB listesi alınıyor…';return;}
    if(event.data.type==='ERROR'){btn.textContent='⚠ '+event.data.message;setTimeout(reset,6000);return;}
    if(event.data.type==='RESULT'){
      chrome.runtime.sendMessage({type:'GIB_TEBLIGAT_SEND_TO_APP',payload:event.data.payload},response=>{
        if(chrome.runtime.lastError||!response?.ok){btn.textContent='⚠ Uygulamaya aktarılamadı';setTimeout(reset,5000);return;}
        btn.textContent='✓ '+(event.data.payload?.records?.length||0)+' tebligat gönderildi';setTimeout(reset,5000);
      });
    }
  });
})();