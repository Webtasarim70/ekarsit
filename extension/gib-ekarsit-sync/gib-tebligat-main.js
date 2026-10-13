(() => {
  if (window.__ekarsitTebligatMainInstalled) return;
  window.__ekarsitTebligatMainInstalled = true;
  let authHeader = '';
  let listRequestBody = null;
  const endpointPart='/apigateway/etebligat/etebligat/tebligat-listele';
  const remember=v=>{const x=String(v||'').trim();if(/^Bearer\s+\S+$/i.test(x))authHeader=x;};
  const oldFetch=window.fetch;
  window.fetch=async function(input,init){
    let url='',body=init?.body;
    try{
      url=input instanceof Request?input.url:String(input||'');
      const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
      remember(headers.get('authorization'));
      if(body==null&&input instanceof Request){try{body=await input.clone().text();}catch(_){}}
      if(url.includes(endpointPart)&&typeof body==='string'){try{listRequestBody=JSON.parse(body);}catch(_){}}
    }catch(_){}
    return oldFetch.apply(this,arguments);
  };
  const oldOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){this.__ekarsitTebligatUrl=String(url||'');return oldOpen.apply(this,arguments);};
  const oldSet=XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader=function(name,value){if(String(name).toLowerCase()==='authorization')remember(value);return oldSet.apply(this,arguments);};
  const oldSend=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send=function(body){
    try{
      const url=String(this.__ekarsitTebligatUrl||'');
      if(url.includes(endpointPart)&&typeof body==='string')listRequestBody=JSON.parse(body);
    }catch(_){}
    return oldSend.apply(this,arguments);
  };
  async function getPage(pageNo,pageSize){
    if(!authHeader)throw new Error('GİB oturum bilgisi yakalanamadı. e-Tebligat sayfasını yenileyip tekrar deneyin.');
    if(!listRequestBody)throw new Error('e-Tebligat liste isteği henüz yakalanmadı. Sayfayı yenileyin ve tablo yüklenince tekrar deneyin.');
    const body=JSON.parse(JSON.stringify(listRequestBody));
    body.meta=body.meta||{};body.meta.pagination=body.meta.pagination||{};
    body.meta.pagination.pageNo=pageNo;body.meta.pagination.pageSize=pageSize;
    const response=await fetch(endpointPart,{method:'POST',headers:{'Accept':'application/json, text/plain, */*','Content-Type':'application/json','Authorization':authHeader,'page-name':'e-tebligat','ui-client':'fe'},credentials:'include',body:JSON.stringify(body)});
    if(!response.ok)throw new Error('GİB API '+response.status+' '+response.statusText);
    return response.json();
  }
  async function getAll(){
    const pageSize=10;
    const first=await getPage(1,pageSize);
    const data=first?.data||{};
    const total=Number(data.count||first?.pageDetail?.total||0);
    const firstRows=Array.isArray(data.tebligatDtoList)?data.tebligatDtoList:[];
    const records=[...firstRows];
    const totalPages=Math.max(1,Number(first?.pageDetail?.totalPage||Math.ceil(total/pageSize)));
    for(let p=2;p<=totalPages;p++){
      const next=await getPage(p,pageSize);
      const rows=next?.data?.tebligatDtoList;
      if(Array.isArray(rows))records.push(...rows);
    }
    const map=new Map();
    records.forEach(r=>{const key=String(r?.tebligId||r?.tebligSecureId||r?.belgeNo||'').trim();if(key)map.set(key,r);});
    return {records:[...map.values()],total,fetchedPages:totalPages};
  }

  window.addEventListener('message',async event=>{
    if(event.source!==window||event.data?.source!=='ekarsit-extension')return;
    if(event.data.type!=='GIB_TEBLIGAT_FETCH')return;
    window.postMessage({source:'ekarsit-tebligat-main',type:'STATUS'},'*');
    try{const payload=await getAll();window.postMessage({source:'ekarsit-tebligat-main',type:'RESULT',payload},'*');}
    catch(e){window.postMessage({source:'ekarsit-tebligat-main',type:'ERROR',message:e?.message||String(e)},'*');}
  });
})();