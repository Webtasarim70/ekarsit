(() => {
  if (window.__ekarsitGibMainInstalled) return;
  window.__ekarsitGibMainInstalled = true;
  let authHeader = '';

  const remember = value => {
    const v = String(value || '').trim();
    if (/^Bearer\s+\S+$/i.test(v)) authHeader = v;
  };

  const oldFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const h = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      remember(h.get('authorization'));
    } catch (_) {}
    return oldFetch.apply(this, arguments);
  };

  const oldSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (String(name).toLowerCase() === 'authorization') remember(value);
    return oldSet.apply(this, arguments);
  };

  const endpoint = '/apigateway/ymm/karsit-isteme-yazisi/gonderilen-listele';

  async function getPage(pageNo, basTarihi, bitTarihi) {
    if (!authHeader) throw new Error('GİB oturum yetkilendirmesi yakalanamadı. Sayfayı yenileyip tekrar deneyin.');
    const body = {
      data: {basTarihi, bitTarihi},
      meta: {pagination: {pageNo, pageSize: 20}, filters: [], sortFieldName: 'sonDuzenlemeTarihi'}
    };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {'Accept':'application/json, text/plain, */*','Content-Type':'application/json','Authorization':authHeader},
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('GİB API '+response.status+' '+response.statusText);
    return response.json();
  }

  async function getAll(basTarihi, bitTarihi) {
    const first = await getPage(1, basTarihi, bitTarihi);
    const detail = first?.pageDetail || {};
    const totalPage = Number(detail.totalPage || 1);
    const total = Number(detail.total || 0);
    const records = Array.isArray(first?.gonderilenVeCevapAlinanList) ? [...first.gonderilenVeCevapAlinanList] : [];

    for (let pageNo=2; pageNo<=totalPage; pageNo++) {
      const page = await getPage(pageNo, basTarihi, bitTarihi);
      if (Array.isArray(page?.gonderilenVeCevapAlinanList)) records.push(...page.gonderilenVeCevapAlinanList);
    }

    const unique = new Map();
    records.forEach(r => {
      const id=String(r?.islemId||'').trim();
      if(id) unique.set(id,r);
    });
    return {records:[...unique.values()],total,fetchedPages:totalPage,basTarihi,bitTarihi};
  }

  window.addEventListener('message', async event => {
    if(event.source!==window || event.data?.source!=='ekarsit-extension') return;
    if(event.data.type==='EKARSIT_FETCH_PDF'){
      const request=event.data.payload||{};
      const requestId=String(request.requestId||'');
      try{
        const islemId=String(request.islemId||'').trim();
        const teyitTuru=String(request.teyitTuru||'').trim();
        if(!islemId) throw new Error('İşlem ID bulunamadı.');
        if(!['ISTEME_YAZISI','CEVAP_YAZISI'].includes(teyitTuru)) throw new Error('Geçersiz yazı türü.');
        if(!authHeader) throw new Error('GİB oturum yetkilendirmesi bulunamadı. GİB sayfasını açıp yenileyin.');
        const url=new URL('/apigateway/ymm/file-export/pdf-aktar',location.origin);
        url.searchParams.set('islemId',islemId);
        url.searchParams.set('teyitTuru',teyitTuru);
        const response=await fetch(url.toString(),{method:'GET',headers:{'Accept':'application/json, text/plain, */*','Authorization':authHeader},credentials:'include'});
        if(!response.ok) throw new Error('GİB PDF isteği başarısız: '+response.status+' '+response.statusText);
        const result=await response.json();
        if(!result?.file || typeof result.file!=='string') {
          const detail=typeof result?.messages==='string'?result.messages:Array.isArray(result?.messages)?result.messages.join(' '):'';
          throw new Error(detail||'GİB yanıtında PDF dosyası bulunamadı.');
        }
        window.postMessage({source:'ekarsit-gib-main',type:'EKARSIT_PDF_RESULT',requestId,result:{file:result.file,fileName:result.fileName||teyitTuru+'_'+islemId}},'*');
      }catch(error){
        window.postMessage({source:'ekarsit-gib-main',type:'EKARSIT_PDF_ERROR',requestId,message:error?.message||String(error)},'*');
      }
      return;
    }
    if(event.data.type!=='EKARSIT_FETCH_GIB') return;
    try {
      const now=new Date();
      const fmt=d=>[String(d.getDate()).padStart(2,'0'),String(d.getMonth()+1).padStart(2,'0'),d.getFullYear()].join('.');
      const startDate=new Date(now);
      startDate.setFullYear(startDate.getFullYear()-1);
      const action=event.data.action==='excel'?'excel':'sync';
      window.postMessage({source:'ekarsit-gib-main',type:'EKARSIT_FETCH_STATUS',action},'*');
      const result=await getAll(fmt(startDate),fmt(now));
      window.postMessage({source:'ekarsit-gib-main',type:'EKARSIT_FETCH_RESULT',action,result},'*');
    } catch(error) {
      window.postMessage({source:'ekarsit-gib-main',type:'EKARSIT_FETCH_ERROR',action:event.data.action==='excel'?'excel':'sync',message:error?.message||String(error)},'*');
    }
  });
})();