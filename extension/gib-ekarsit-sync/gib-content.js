(() => {
  if (window.__ekarsitGibContentInstalled) return;
  window.__ekarsitGibContentInstalled = true;

  const actionWrap=document.createElement('div');
  Object.assign(actionWrap.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',display:'flex',gap:'8px',alignItems:'center'});
  const syncButton=document.createElement('button');
  syncButton.type='button';
  syncButton.textContent='↻ e-Karşıt Takip’e Aktar';
  const excelButton=document.createElement('button');
  excelButton.type='button';
  excelButton.textContent='⇩ Excel’e Aktar';
  const styleButton=el=>Object.assign(el.style,{padding:'11px 16px',border:'0',borderRadius:'8px',background:'#1769aa',color:'#fff',font:'600 14px Arial,sans-serif',boxShadow:'0 4px 14px rgba(0,0,0,.25)',cursor:'pointer'});
  styleButton(syncButton); styleButton(excelButton);
  excelButton.style.background='#2e7d32';
  actionWrap.append(syncButton,excelButton);
  document.documentElement.appendChild(actionWrap);

  const reset=()=>{syncButton.textContent='↻ e-Karşıt Takip’e Aktar';syncButton.disabled=false;excelButton.disabled=false;};
  const start=()=>{
    syncButton.disabled=true; excelButton.disabled=true;
    syncButton.textContent='GİB kayıtları alınıyor…';
    window.postMessage({source:'ekarsit-extension',type:'EKARSIT_FETCH_GIB'},'*');
  };

  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const col=n=>{let s='';while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s};
  const xml=(name,attrs='')=>'<'+name+(attrs?' '+attrs:'')+'>';
  const crc32=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
  const u16=n=>new Uint8Array([n&255,(n>>>8)&255]);
  const u32=n=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const cat=(...arr)=>{const out=new Uint8Array(arr.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arr){out.set(a,p);p+=a.length}return out};

  function makeZip(files){
    const enc=new TextEncoder(), locals=[], centrals=[];let offset=0;
    for(const f of files){
      const name=enc.encode(f.name), data=enc.encode(f.data), crc=crc32(data);
      const lh=cat(new Uint8Array([80,75,3,4]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data);
      locals.push(lh);
      const ch=cat(new Uint8Array([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name);
      centrals.push(ch); offset+=lh.length;
    }
    const central=cat(...centrals), local=cat(...locals);
    const end=cat(new Uint8Array([80,75,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(local.length),u16(0));
    return new Blob([local,central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  function makeXlsx(records){
    const headers=['İşlem ID','Son Düzenleme Tarihi','Onay Tarihi','Durum','YMM VKN','YMM Ad Soyad','Mükellef VKN/TCKN','Mükellef Ad Soyad','Sözleşme Başlangıç Dönemi','Sözleşme Bitiş Dönemi','Nezdinde İnceleme Yapılan Mükellef VKN/TCKN','Nezdinde İnceleme Yapılan Mükellef Ad Soyad','Son Düzenlemeyi Yapan TCKN','Son Düzenlemeyi Yapan Ad Soyad','İptal/Pasif Açıklama'];
    const map=r=>[r.islemId,r.sonDuzenlemeTarihi,r.onayTarihi,(r.isPasif===true||r.pasif===true)?'Pasife Çekilmiş':r.durum,r.karsitIsteyenYmmVkn,r.karsitIsteyenYmmAdSoyad,r.karsitIsteyenMukellefVknTckn,r.karsitIsteyenMukellefAdSoyad,r.sozlesmeBaslangicDonemi,r.sozlesmeBitisDonemi,r.nezdindeIncelemeYapilanMukellefVknTckn,r.nezdindeIncelemeYapilanMukellefAdSoyad,r.yaziyiOlusturanTckn,r.yaziyiOlusturanAdSoyad,r.iptalPasifAciklama];
    const rows=[headers,...records.map(map)];
    const sheet=rows.map((row,i)=>xml('row',{r:i+1})+row.map((v,j)=>xml('c',{r:col(j+1)+(i+1),t:'inlineStr'})+'<is><t>'+esc(v)+'</t></is></c>').join('')+'</row>').join('');
    const sheetXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sheet+'</sheetData></worksheet>';
    const files=[
      {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
      {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
      {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="e-Karşıt Takip" sheetId="1" r:id="rId1"/></sheets></workbook>'},
      {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
      {name:'xl/worksheets/sheet1.xml',data:sheetXml}
    ];
    return makeZip(files);
  }

  const downloadExcel=records=>{
    if(!records?.length){excelButton.textContent='⚠ Kayıt bulunamadı';setTimeout(reset,3000);return}
    excelButton.disabled=true;excelButton.textContent='Excel hazırlanıyor…';
    try{
      const blob=makeXlsx(records);
      const url=URL.createObjectURL(blob);
      const stamp=new Date().toISOString().slice(0,10);
      chrome.downloads.download({url,filename:'E_KARSIT_TAKIP_'+stamp+'.xlsx',saveAs:true},id=>{
        URL.revokeObjectURL(url);
        if(chrome.runtime.lastError) excelButton.textContent='⚠ '+chrome.runtime.lastError.message;
        else excelButton.textContent='✓ Excel kaydediliyor…';
        setTimeout(reset,4000);
      });
    }catch(error){excelButton.textContent='⚠ Excel oluşturulamadı';setTimeout(reset,4000)}
  };

  syncButton.addEventListener('click',start);
  excelButton.addEventListener('click',start);

  window.addEventListener('message',event=>{
    if(event.source!==window || event.data?.source!=='ekarsit-gib-main') return;
    if(event.data.type==='EKARSIT_FETCH_STATUS'){syncButton.textContent='GİB kayıtları alınıyor…';excelButton.textContent='GİB kayıtları alınıyor…';return}
    if(event.data.type==='EKARSIT_FETCH_ERROR'){
      syncButton.textContent='⚠ '+event.data.message;excelButton.textContent='⚠ GİB verisi alınamadı';setTimeout(reset,5000);return;
    }
    if(event.data.type==='EKARSIT_FETCH_RESULT'){
      const result=event.data.result;
      excelButton.disabled=false;
      downloadExcel(result.records);
      chrome.runtime.sendMessage({type:'EKARSIT_SEND_TO_APP',payload:result},response=>{
        if(chrome.runtime.lastError){syncButton.textContent='⚠ Uygulamaya gönderilemedi';setTimeout(()=>{syncButton.disabled=false},5000);return}
        if(!response?.ok){syncButton.textContent='⚠ '+(response?.message||'Uygulama bulunamadı');setTimeout(()=>{syncButton.disabled=false},5000);return}
        syncButton.textContent='✓ '+result.records.length+' kayıt aktarıldı';
        setTimeout(()=>{syncButton.textContent='↻ e-Karşıt Takip’e Aktar';syncButton.disabled=false},5000);
      });
    }
  });

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type==='EKARSIT_TRIGGER_SYNC'){start();sendResponse({ok:true});return true}
  });
})();