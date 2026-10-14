(() => {
  if(window.__ekarsitTebligatContentInstalled)return;
  window.__ekarsitTebligatContentInstalled=true;

  const wrap=document.createElement('div');
  Object.assign(wrap.style,{
    position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',
    display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'10px',
    fontFamily:'Arial,sans-serif'
  });

  const menu=document.createElement('div');
  Object.assign(menu.style,{display:'none',flexDirection:'column',alignItems:'flex-end',gap:'8px'});
  menu.setAttribute('role','group');
  menu.setAttribute('aria-label','e-Karşıt e-Tebligat işlemleri');

  const btn=document.createElement('button');
  btn.type='button';
  btn.textContent='↻ Tebligat Takip’e Aktar / Güncelle';
  Object.assign(btn.style,{
    padding:'11px 16px',border:'0',borderRadius:'10px',background:'#1769aa',
    color:'#fff',font:'600 14px Arial,sans-serif',
    boxShadow:'0 4px 14px rgba(0,0,0,.25)',cursor:'pointer',whiteSpace:'nowrap'
  });
  menu.appendChild(btn);

  const fab=document.createElement('button');
  fab.type='button';
  fab.setAttribute('aria-label','e-Karşıt e-Tebligat işlemlerini aç');
  fab.setAttribute('aria-expanded','false');
  fab.title='e-Karşıt e-Tebligat işlemleri';
  fab.innerHTML='<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:20px;font-weight:800;letter-spacing:-1.5px;color:#fff">eK</span>';
  Object.assign(fab.style,{
    width:'58px',height:'58px',padding:'0',border:'2px solid rgba(255,255,255,.9)',
    borderRadius:'50%',background:'linear-gradient(145deg,#2185d0,#124c87)',
    boxShadow:'0 5px 18px rgba(0,0,0,.32)',cursor:'pointer',
    display:'flex',alignItems:'center',justifyContent:'center',touchAction:'none'
  });

  const setMenuOpen=open=>{
    menu.style.display=open?'flex':'none';
    fab.setAttribute('aria-expanded',String(open));
    fab.setAttribute('aria-label',open?'e-Karşıt e-Tebligat işlemlerini kapat':'e-Karşıt e-Tebligat işlemlerini aç');
    fab.innerHTML='<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:'+(open?'25px':'20px')+';font-weight:800;letter-spacing:'+(open?'0':'-1.5px')+';color:#fff">'+(open?'×':'eK')+'</span>';
  };
  fab.addEventListener('click',()=>setMenuOpen(menu.style.display!=='flex'));
  wrap.append(menu,fab);
  document.documentElement.appendChild(wrap);

  // Kullanıcı logolu yüzen butonu sürükleyebilir; konum sayfa yenilemelerinde korunur.
  fab.style.cursor='grab';
  const positionKey='ekarsitTebligatFabPosition';
  const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max));
  const placeWrap=(left,top)=>{
    const margin=8,rect=wrap.getBoundingClientRect();
    const x=clamp(left,margin,window.innerWidth-rect.width-margin);
    const y=clamp(top,margin,window.innerHeight-rect.height-margin);
    wrap.style.left=x+'px';wrap.style.top=y+'px';
    wrap.style.right='auto';wrap.style.bottom='auto';
    return {x,y};
  };
  try{
    const saved=JSON.parse(localStorage.getItem(positionKey)||'null');
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))requestAnimationFrame(()=>placeWrap(saved.x,saved.y));
  }catch(_){}
  let dragState=null,suppressNextClick=false;
  fab.addEventListener('pointerdown',event=>{
    if(event.button!==0&&event.pointerType!=='touch')return;
    const rect=wrap.getBoundingClientRect();
    dragState={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,moved:false};
    fab.style.cursor='grabbing';
    try{fab.setPointerCapture(event.pointerId);}catch(_){}
  });
  fab.addEventListener('pointermove',event=>{
    if(!dragState||event.pointerId!==dragState.pointerId)return;
    const dx=event.clientX-dragState.startX,dy=event.clientY-dragState.startY;
    if(Math.abs(dx)>4||Math.abs(dy)>4)dragState.moved=true;
    if(dragState.moved){
      event.preventDefault();
      const p=placeWrap(dragState.left+dx,dragState.top+dy);
      try{localStorage.setItem(positionKey,JSON.stringify({x:p.x,y:p.y}));}catch(_){}
    }
  });
  const finishDrag=event=>{
    if(!dragState||event.pointerId!==dragState.pointerId)return;
    suppressNextClick=dragState.moved;dragState=null;fab.style.cursor='grab';
  };
  fab.addEventListener('pointerup',finishDrag);
  fab.addEventListener('pointercancel',finishDrag);
  fab.addEventListener('click',event=>{
    if(suppressNextClick){event.preventDefault();event.stopImmediatePropagation();suppressNextClick=false;}
  },true);
  window.addEventListener('resize',()=>{
    const rect=wrap.getBoundingClientRect(),p=placeWrap(rect.left,rect.top);
    try{localStorage.setItem(positionKey,JSON.stringify({x:p.x,y:p.y}));}catch(_){}
  });

  btn.addEventListener('click',()=>{
    btn.disabled=true;btn.textContent='Tebligatlar alınıyor…';
    window.postMessage({source:'ekarsit-extension',type:'GIB_TEBLIGAT_FETCH'},'*');
  });

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type!=='GIB_TEBLIGAT_TRIGGER_SYNC')return;
    btn.disabled=true;btn.textContent='Tebligatlar alınıyor…';
    window.postMessage({source:'ekarsit-extension',type:'GIB_TEBLIGAT_FETCH'},'*');
    sendResponse({ok:true});
    return true;
  });
  const reset=()=>{btn.disabled=false;btn.textContent='↻ Tebligat Takip’e Aktar / Güncelle';};
  window.addEventListener('message',event=>{
    if(event.source!==window||event.data?.source!=='ekarsit-tebligat-main')return;
    if(event.data.type==='STATUS'){btn.textContent='GİB listesi alınıyor…';return;}
    if(event.data.type==='ERROR'){btn.textContent='⚠ '+event.data.message;setTimeout(reset,6000);return;}
    if(event.data.type==='RESULT'){
      chrome.runtime.sendMessage({type:'GIB_TEBLIGAT_SEND_TO_APP',payload:event.data.payload},response=>{
        if(chrome.runtime.lastError||!response?.ok){btn.textContent='⚠ Uygulamaya aktarılamadı';setTimeout(reset,5000);return;}
        btn.textContent='✓ '+(event.data.payload?.records?.length||0)+' tebligat gönderildi';
        setTimeout(reset,5000);
      });
    }
  });
})();