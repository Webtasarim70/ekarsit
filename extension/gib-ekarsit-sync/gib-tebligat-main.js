(() => {
  if (window.__ekarsitTebligatMainInstalled) return;
  window.__ekarsitTebligatMainInstalled = true;
  let authHeader = '';
  let listRequestBody = null;
  const endpointPart='/apigateway/etebligat/etebligat/tebligat-listele';
  const remember=v=>{const x=String(v||'').trim();if(/^Bearer\s+\S+$/i.test(x))authHeader=x;};
  const ekListeEndpointPart='/apigateway/etebligat/etebligat/belge-ek-listele';
  const observedTebligSecureIds=new Map();
  const observedZarfDetails=new Map();
  const zarfDetailEndpointPart='/apigateway/etebligat/etebligat/zarf-detay-sorgula';
  const rememberZarfDetail=(value)=>{try{const root=typeof value==='string'?JSON.parse(value):value;const data=root?.data||root;const id=String(data?.tebligId||'').trim();if(id&&data?.tebligSecureId)observedZarfDetails.set(id,data);}catch(_){}};
  const rememberEkListeBody=(body)=>{
    try{
      const data=typeof body==='string'?JSON.parse(body):body;
      const id=String(data?.tebligId||data?.data?.tebligId||'').trim();
      const secure=String(data?.tebligSecureId||data?.data?.tebligSecureId||'').trim();
      if(id&&secure)observedTebligSecureIds.set(id,secure);
    }catch(_){}
  };
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
    const response=await oldFetch.apply(this,arguments);
    if(url.includes(ekListeEndpointPart)&&response.ok){
      try{const requestData=typeof body==='string'?JSON.parse(body):body;const id=String(requestData?.tebligId||requestData?.data?.tebligId||'').trim();const secure=String(requestData?.tebligSecureId||requestData?.data?.tebligSecureId||'').trim();if(id&&secure)observedTebligSecureIds.set(id,secure);}catch(_){}
    }
    if(url.includes(zarfDetailEndpointPart)&&response.ok){try{rememberZarfDetail(await response.clone().json());}catch(_){}}
    return response;
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
      if(url.includes(zarfDetailEndpointPart)){
        this.addEventListener('load',function(){if(this.status>=200&&this.status<300){try{rememberZarfDetail(this.responseText);}catch(_){}}});
      }
      if(url.includes(ekListeEndpointPart)){
        let data;try{data=typeof body==='string'?JSON.parse(body):body;}catch(_){}
        this.addEventListener('load',function(){
          if(this.status>=200&&this.status<300){
            const id=String(data?.tebligId||data?.data?.tebligId||'').trim();
            const secure=String(data?.tebligSecureId||data?.data?.tebligSecureId||'').trim();
            if(id&&secure)observedTebligSecureIds.set(id,secure);
          }
        });
      }
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

  async function fetchWithTimeout(url,options={},timeoutMs=30000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{return await fetch(url,{...options,signal:controller.signal});}
    catch(error){
      if(error?.name==='AbortError')throw new Error('GİB isteği '+Math.round(timeoutMs/1000)+' saniyede yanıt vermedi; bağlantı zaman aşımına uğradı.');
      throw error;
    }finally{clearTimeout(timer);}
  }
  async function gibJsonPost(path,data,wrapData=true){
    if(!authHeader)throw new Error('GİB oturumu bulunamadı. GİB e-Tebligat sekmesini yenileyip yeniden deneyin.');
    const response=await fetchWithTimeout(path,{method:'POST',headers:{'Accept':'application/json, text/plain, */*','Content-Type':'application/json','Authorization':authHeader,'page-name':'e-tebligat','ui-client':'fe'},credentials:'include',body:JSON.stringify(wrapData?{data}:data)},30000);
    if(!response.ok){
      let detail='';
      try{
        const body=await response.clone().json();
        const messages=Array.isArray(body?.messages)?body.messages:[];
        const messageText=messages.map(x=>x?.text||x?.message||x?.description||x?.code).filter(Boolean).join('; ');
        const errors=body?.errors&&typeof body.errors==='object'?Object.entries(body.errors).map(([key,value])=>key+': '+(Array.isArray(value)?value.join(', '):String(value))).join('; '):'';
        detail=String(messageText||body?.message||body?.detail||body?.errorDescription||body?.error||errors||'').trim();
        if(!detail&&body&&typeof body==='object')detail=JSON.stringify(body).slice(0,500);
      }catch(_){
        try{detail=(await response.clone().text()).slice(0,300).replace(/\s+/g,' ').trim();}catch(_){}
      }
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
    const tebligId=String(record?.tebligId||'').trim();
    if(!tebligId)throw new Error('Tebligat kimliği (tebligId) kayıtta bulunamadı. GİB listesini yeniden aktarın.');
    // GİB arayüzü ilgili zarf açılırken zarf-detay-sorgula yanıtını yakalar.
    // Liste kaydındaki taraf kimlikleriyle aynı servisi yeniden çağırmak 422 yetki hatasına yol açabildiğinden
    // PDF akışında yeni bir sorgu göndermek yerine yalnızca aynı tebligata ait yakalanmış yanıtı kullan.
    const detail=observedZarfDetails.get(tebligId)||null;
    const listedTarafId=record?.tarafId||record?.mukellefId||record?.taraf?.id||record?.tarafBilgileri?.id;
    const listedTarafSecureId=record?.tarafSecureId||record?.mukellefSecureId||record?.taraf?.secureId||record?.tarafBilgileri?.secureId;
    if(!detail?.tebligSecureId){
      throw new Error('Bu tebligatın güncel zarf detayı GİB arayüzünden alınamadı. GİB sekmesinde ilgili tebligat için “İşlem Yap” → “Zarf İçeriğini Gör” adımlarını uygulayın, detay sayfası yüklendikten sonra PDF Kaydet’i yeniden deneyin.');
    }
    const tebligSecureId=String(detail.tebligSecureId||observedTebligSecureIds.get(tebligId)||'').trim();
    if(!tebligSecureId)throw new Error('GİB zarf-detay-sorgula yanıtından bu tebligata ait güncel tebligSecureId alınamadı. GİB’de ilgili zarfın detayını açıp yeniden deneyin.');
    const ekler=await gibJsonPost('/apigateway/etebligat/etebligat/belge-ek-listele',{tebligId,tebligSecureId},false);
    const belge=gibFindObject(ekler,x=>x.adi&&x.id&&x.secureId&&String(x.uzanti||'').toLowerCase()==='pdf')||gibFindObject(ekler,x=>x.tebligBelge?.adi)?.tebligBelge;
    if(!belge)throw new Error('GİB yanıtında PDF belge bulunamadı.');
    const tarafId=detail?.tarafId||listedTarafId;
    const tarafSecureId=detail?.tarafSecureId||listedTarafSecureId;
    if(!tarafId||!tarafSecureId)throw new Error('GİB zarf detayında tarafId/tarafSecureId bulunamadı.');
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
    const reportLink=gibFindObject(getir,x=>typeof x.reportLink==='string')?.reportLink;
    if(!reportLink)throw new Error('GİB belge yanıtında PDF indirme bağlantısı bulunamadı.');
    const url=new URL(reportLink,location.origin);
    if(url.origin!==location.origin)throw new Error('Güvenlik nedeniyle GİB dışındaki indirme adresi kabul edilmedi.');
    const response=await fetchWithTimeout(url.href,{headers:{'Accept':'application/pdf, application/octet-stream, */*','Authorization':authHeader},credentials:'include'},45000);
    if(!response.ok)throw new Error('PDF indirilemedi: '+response.status+' '+response.statusText);
    const contentType=String(response.headers.get('content-type')||'belirsiz');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<5||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-'){
      const preview=new TextDecoder().decode(bytes.subarray(0,1200)).trim();
      let reason='PDF imzası yok';
      if(response.redirected||/text\/html/i.test(contentType)||/^<!doctype html|^<html/i.test(preview))reason='HTML sayfası döndü (oturum/giriş veya yönlendirme olabilir)';
      else if(/json/i.test(contentType)||/^[{[]/.test(preview)){
        try{const parsed=JSON.parse(preview);const msg=Array.isArray(parsed?.messages)?parsed.messages.map(x=>x?.text||x?.message||x?.description||x?.code).filter(Boolean).join('; '):'';reason='JSON yanıtı döndü'+(msg?': '+String(msg).slice(0,180):'');}
        catch(_){reason='JSON veya metin yanıtı döndü';}
      }
      throw new Error('GİB PDF indirme yanıtı PDF değil ('+reason+'). HTTP '+response.status+'; Content-Type: '+contentType+'; yönlendirme: '+(response.redirected?'evet':'hayır')+'.');
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