(() => {
  if (window.__ekarsitTebligatMainInstalled) return;
  window.__ekarsitTebligatMainInstalled = true;
  let authHeader = '';
  let listRequestBody = null;
  const endpointPart='/apigateway/etebligat/etebligat/tebligat-listele';
  const remember=v=>{const x=String(v||'').trim();if(/^Bearer\s+\S+$/i.test(x))authHeader=x;};
  const oldFetch=window.fetch;
  window.fetch=async function(input,init){
    try{
      const url=input instanceof Request?input.url:String(input||'');
      const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
      remember(headers.get('authorization'));
      if(url.includes(endpointPart)){
        let body=init?.body;
        if(body==null&&input instanceof Request){try{body=await input.clone().text();}catch(_){}}
        if(typeof body==='string'){try{listRequestBody=JSON.parse(body);}catch(_){}}
      }
    }catch(_){}
    return oldFetch.apply(this,arguments);
  };
  const oldOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){this.__ekarsitTebligatUrl=String(url||'');return oldOpen.apply(this,arguments);};
  const oldSet=XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader=function(name,value){if(String(name).toLowerCase()==='authorization')remember(value);return oldSet.apply(this,arguments);};
  const oldSend=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send=function(body){
    try{if(String(this.__ekarsitTebligatUrl||'').includes(endpointPart)&&typeof body==='string'){listRequestBody=JSON.parse(body);}}catch(_){}
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

  async function gibJsonPost(path,data,wrapData=true){
    if(!authHeader)throw new Error('GİB oturumu bulunamadı. GİB e-Tebligat sekmesini yenileyip yeniden deneyin.');
    const response=await fetch(path,{method:'POST',headers:{'Accept':'application/json, text/plain, */*','Content-Type':'application/json','Authorization':authHeader,'page-name':'e-tebligat','ui-client':'fe'},credentials:'include',body:JSON.stringify(wrapData?{data}:data)});
    if(!response.ok){
      let detail='';
      try{
        const body=await response.clone().json();
        const messages=Array.isArray(body?.messages)?body.messages:[];
        detail=String(messages.find(x=>x?.message)?.message||body?.message||body?.error||'').trim();
      }catch(_){}
      const endpoint=path.split('/').pop()||'belge servisi';
      throw new Error('GİB '+endpoint+' '+response.status+' '+response.statusText+(detail?': '+detail:''));
    }
    return response.json();
  }
  function gibFindObject(root,predicate,depth=0){
    if(!root||typeof root!=='object'||depth>5)return null;if(predicate(root))return root;
    for(const value of Object.values(root)){if(value&&typeof value==='object'){const found=gibFindObject(value,predicate,depth+1);if(found)return found;}}return null;
  }
  function toBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}
  async function getTebligatPdf(record){
    const tebligId=record?.tebligId||record?.id,tebligSecureId=record?.tebligSecureId||record?.secureId;
    if(!tebligId||!tebligSecureId)throw new Error('Bu kayıtta GİB belge kimlikleri yok. Listeyi GİB üzerinden yeniden aktarın.');
    let ekler;
    try{
      // GİB'in bu uç noktası bazı oturumlarda kök nesne, bazılarında {data:{...}} gövdesi bekleyebiliyor.
      // 400 dönerse diğer biçimi dene; erişim/oturum hatalarını tekrar denemeyle gizleme.
      ekler=await gibJsonPost('/apigateway/etebligat/etebligat/belge-ek-listele',{tebligId,tebligSecureId},false);
    }catch(firstError){
      if(!String(firstError?.message||firstError).includes('400'))throw firstError;
      try{
        ekler=await gibJsonPost('/apigateway/etebligat/etebligat/belge-ek-listele',{tebligId,tebligSecureId},true);
      }catch(secondError){
        throw new Error('GİB belge-ek-listele her iki istek gövdesini de reddetti. Kök gövde: '+String(firstError?.message||firstError)+'; data gövdesi: '+String(secondError?.message||secondError));
      }
    }
    const belge=gibFindObject(ekler,x=>x.adi&&x.id&&x.secureId&&String(x.uzanti||'').toLowerCase()==='pdf')||gibFindObject(ekler,x=>x.tebligBelge?.adi)?.tebligBelge;
    if(!belge)throw new Error('GİB yanıtında PDF belge bulunamadı.');
    const tarafId=record?.tarafId||record?.mukellefId||record?.taraf?.id||record?.tarafBilgileri?.id;
    const tarafSecureId=record?.tarafSecureId||record?.mukellefSecureId||record?.taraf?.secureId||record?.tarafBilgileri?.secureId;
    if(!tarafId||!tarafSecureId)throw new Error('Bu tebligat kaydında tarafId/tarafSecureId bilgileri bulunamadı. GİB e-Tebligat listesini yeniden aktarın; bilgiler hâlâ yoksa GİB liste yanıtındaki taraf alanları için ek uyarlama gerekiyor.');
    const belgePayload={
      belgeAdi:belge.adi||belge.belgeAdi,
      belgeTip:String(belge.belgeTip??'0'),
      id:belge.id,
      secureId:belge.secureId,
      tarafId,
      tarafSecureId,
      uzanti:String(belge.uzanti||'pdf').toLowerCase()
    };
    if(!belgePayload.belgeAdi||!belgePayload.id||!belgePayload.secureId)throw new Error('GİB belge yanıtında belgeAdi/id/secureId alanları eksik.');
    const getir=await gibJsonPost('/apigateway/etebligat/etebligat/belge-getir',belgePayload);
    const reportLink=gibFindObject(getir,x=>typeof x.reportLink==='string')?.reportLink;if(!reportLink)throw new Error('GİB belge yanıtında PDF indirme bağlantısı bulunamadı.');
    const url=new URL(reportLink,location.origin);if(url.origin!==location.origin)throw new Error('Güvenlik nedeniyle GİB dışındaki indirme adresi kabul edilmedi.');
    const response=await fetch(url.href,{headers:{'Accept':'application/pdf, application/octet-stream, */*','Authorization':authHeader},credentials:'include'});
    if(!response.ok)throw new Error('PDF indirilemedi: '+response.status+' '+response.statusText);
    const contentType=String(response.headers.get('content-type')||'belirsiz');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<5||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-'){
      const preview=new TextDecoder().decode(bytes.subarray(0,1200)).trim();
      let reason='PDF imzası yok';
      if(response.redirected||/text\\/html/i.test(contentType)||/^<!doctype html|^<html/i.test(preview))reason='HTML sayfası döndü (oturum/giriş veya yönlendirme olabilir)';
      else if(/json/i.test(contentType)||/^[{[]/.test(preview)){
        try{
          const parsed=JSON.parse(preview);
          const msg=Array.isArray(parsed?.messages)?parsed.messages.map(x=>x?.message).filter(Boolean).join('; '):'';
          reason='JSON yanıtı döndü'+(msg?': '+String(msg).slice(0,180):'');
        }catch(_){reason='JSON veya metin yanıtı döndü';}
      }
      throw new Error('GİB PDF indirme yanıtı PDF değil ('+reason+'). HTTP '+response.status+'; Content-Type: '+contentType+'; yönlendirme: '+(response.redirected?'evet':'hayır')+'. GİB sekmesini yenileyip yeniden deneyin.');
    }
    return {base64:toBase64(bytes),filename:String(belge.adi||belge.belgeAdi||'tebligat.pdf').replace(/[\\/:*?"<>|]/g,'_'),mimeType:'application/pdf'};
  }
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.data?.source!=='ekarsit-extension')return;
    if(event.data.type==='GIB_TEBLIGAT_DOWNLOAD_PDF'){
      const requestId=String(event.data.requestId||'');
      try{const pdf=await getTebligatPdf(event.data.record||{});window.postMessage({source:'ekarsit-tebligat-main',type:'PDF_RESULT',requestId,ok:true,pdf},'*');}
      catch(e){window.postMessage({source:'ekarsit-tebligat-main',type:'PDF_RESULT',requestId,ok:false,message:e?.message||String(e)},'*');}return;
    }
    if(event.data.type!=='GIB_TEBLIGAT_FETCH')return;
    window.postMessage({source:'ekarsit-tebligat-main',type:'STATUS'},'*');
    try{const payload=await getAll();window.postMessage({source:'ekarsit-tebligat-main',type:'RESULT',payload},'*');}
    catch(e){window.postMessage({source:'ekarsit-tebligat-main',type:'ERROR',message:e?.message||String(e)},'*');}
  });
})();