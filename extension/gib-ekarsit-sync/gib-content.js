(() => {
  if (window.__ekarsitGibContentInstalled) return;
  window.__ekarsitGibContentInstalled = true;

  const wrap=document.createElement('div');
  Object.assign(wrap.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',display:'flex',gap:'8px',alignItems:'center'});

  const makeButton=(text,bg)=>{const b=document.createElement('button');b.type='button';b.textContent=text;Object.assign(b.style,{padding:'11px 16px',border:'0',borderRadius:'8px',background:bg,color:'#fff',font:'600 14px Arial,sans-serif',boxShadow:'0 4px 14px rgba(0,0,0,.25)',cursor:'pointer'});return b};
  const syncButton=makeButton('↻ e-Karşıt Takip’e Aktar','#1769aa');
  const excelButton=makeButton('⇩ Excel’e Aktar','#2e7d32');
  wrap.append(syncButton,excelButton);
  document.documentElement.appendChild(wrap);

  let activeAction=null;

  const reset=()=>{
    activeAction=null;
    syncButton.disabled=false;
    excelButton.disabled=false;
    syncButton.textContent='↻ e-Karşıt Takip’e Aktar';
    excelButton.textContent='⇩ Excel’e Aktar';
  };

  const start=action=>{
    activeAction=action;
    syncButton.disabled=true;
    excelButton.disabled=true;
    if(action==='sync') syncButton.textContent='GİB kayıtları alınıyor…';
    else excelButton.textContent='GİB kayıtları alınıyor…';
    window.postMessage({source:'ekarsit-extension',type:'EKARSIT_FETCH_GIB'},'*');
  };

  const safe=s=>String(s??'')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

  const col=n=>{let s='';while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s};
  const u16=n=>new Uint8Array([n&255,(n>>>8)&255]);
  const u32=n=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const cat=(...arr)=>{const out=new Uint8Array(arr.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arr){out.set(a,p);p+=a.length}return out};
  const crc32=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};

  function makeZip(files){
    const enc=new TextEncoder(), locals=[],centrals=[];let offset=0;
    for(const f of files){
      const name=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);
      const local=cat(new Uint8Array([80,75,3,4]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data);
      const central=cat(new Uint8Array([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name);
      locals.push(local);centrals.push(central);offset+=local.length;
    }
    const local=cat(...locals),central=cat(...centrals);
    return new Blob([local,central,cat(new Uint8Array([80,75,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(local.length),u16(0))],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  function makeXlsx(records){
    const headers=['İşlem ID','Son Düzenleme Tarihi','Onay Tarihi','Durum','YMM VKN','YMM Ad Soyad','Mükellef VKN/TCKN','Mükellef Ad Soyad','Sözleşme Başlangıç Dönemi','Sözleşme Bitiş Dönemi','Nezdinde İnceleme Yapılan Mükellef VKN/TCKN','Nezdinde İnceleme Yapılan Mükellef Ad Soyad','Son Düzenlemeyi Yapan TCKN','Son Düzenlemeyi Yapan Ad Soyad','İptal/Pasif Açıklama'];
    const row=r=>[r?.islemId,r?.sonDuzenlemeTarihi,r?.onayTarihi,(r?.isPasif===true||r?.pasif===true)?'Pasife Çekilmiş':r?.durum,r?.karsitIsteyenYmmVkn,r?.karsitIsteyenYmmAdSoyad,r?.karsitIsteyenMukellefVknTckn,r?.karsitIsteyenMukellefAdSoyad,r?.sozlesmeBaslangicDonemi,r?.sozlesmeBitisDonemi,r?.nezdindeIncelemeYapilanMukellefVknTckn,r?.nezdindeIncelemeYapilanMukellefAdSoyad,r?.yaziyiOlusturanTckn,r?.yaziyiOlusturanAdSoyad,r?.iptalPasifAciklama];
    const rows=[headers,...records.map(row)];
    const sheet=rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>'<c r="'+col(j+1)+(i+1)+'" t="inlineStr"><is><t>'+safe(v)+'</t></is></c>').join('')+'</row>').join('');
    const sheetXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sheet+'</sheetData></worksheet>';
    return makeZip([
      {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
      {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
      {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="e-Karşıt Takip" sheetId="1" r:id="rId1"/></sheets></workbook>'},
      {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
      {name:'xl/worksheets/sheet1.xml',data:sheetXml}
    ]);
  }

  const blobToDataUrl=blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error('Dosya okunamadı.'));
    reader.readAsDataURL(blob);
  });

  const downloadExcel=async records=>{
    if(!records?.length){excelButton.textContent='⚠ Kayıt bulunamadı';setTimeout(reset,3000);return}
    try{
      excelButton.textContent='Excel hazırlanıyor…';
      const dataUrl=await blobToDataUrl(makeXlsx(records));
      chrome.runtime.sendMessage({type:'EKARSIT_DOWNLOAD_XLSX',dataUrl,filename:'E_KARSIT_TAKIP_'+new Date().toISOString().slice(0,10)+'.xlsx'},response=>{
        if(chrome.runtime.lastError||!response?.ok){
          excelButton.textContent='⚠ Excel kaydedilemedi';
          setTimeout(reset,4000);
          return;
        }
        excelButton.textContent='✓ Excel kaydediliyor…';
        setTimeout(reset,4000);
      });
    }catch(error){
      excelButton.textContent='⚠ Excel oluşturulamadı';
      setTimeout(reset,4000);
    }
  };

  syncButton.addEventListener('click',()=>start('sync'));
  excelButton.addEventListener('click',()=>start('excel'));

  window.addEventListener('message',event=>{
    if(event.source!==window || event.data?.source!=='ekarsit-gib-main') return;

    if(event.data.type==='EKARSIT_FETCH_STATUS'){
      if(activeAction==='sync') syncButton.textContent='GİB kayıtları alınıyor…';
      if(activeAction==='excel') excelButton.textContent='GİB kayıtları alınıyor…';
      return;
    }

    if(event.data.type==='EKARSIT_FETCH_ERROR'){
      if(activeAction==='sync') syncButton.textContent='⚠ '+event.data.message;
      if(activeAction==='excel') excelButton.textContent='⚠ '+event.data.message;
      setTimeout(reset,5000);
      return;
    }

    if(event.data.type==='EKARSIT_FETCH_RESULT'){
      const result=event.data.result;
      if(activeAction==='excel'){
        downloadExcel(result.records);
        return;
      }

      chrome.runtime.sendMessage({type:'EKARSIT_SEND_TO_APP',payload:result},response=>{
        if(chrome.runtime.lastError||!response?.ok){
          syncButton.textContent='⚠ Uygulamaya gönderilemedi';
          setTimeout(reset,5000);
          return;
        }
        syncButton.textContent='✓ '+result.records.length+' kayıt aktarıldı';
        setTimeout(reset,5000);
      });
    }
  });

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type==='EKARSIT_TRIGGER_SYNC'){
      start('sync');
      sendResponse({ok:true});
      return true;
    }
  });
})();