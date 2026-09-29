/* ============================================================
   Araçlar — e-Fatura XML Görüntüleyici
   UBL-TR Invoice XML içindeki gömülü XSLT'yi otomatik kullanır.
   Tamamen tarayıcı tarafında çalışır; yüklenen dosyalar sunucuya gönderilmez.
   ============================================================ */

function efaturaSafeName(name){
  return String(name||'e-fatura').replace(/\.xml$/i,'').replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,90)||'e-fatura';
}

function efaturaDecodeBase64Utf8(value){
  const clean=String(value||'').replace(/\s+/g,'');
  if(!clean) throw new Error('Gömülü XSLT verisi boş.');
  let binary;
  try{ binary=atob(clean); }catch(err){ throw new Error('Gömülü XSLT Base64 verisi okunamadı.'); }
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  try{
    return new TextDecoder('utf-8',{fatal:false}).decode(bytes);
  }catch(err){
    let out='';
    for(let i=0;i<binary.length;i++) out+=String.fromCharCode(bytes[i]);
    return out;
  }
}

function efaturaExtractEmbeddedXslt(xmlDoc){
  const all=Array.from(xmlDoc.getElementsByTagName('*'));
  for(const ref of all){
    if(String(ref.localName||ref.nodeName||'').toLowerCase()!=='additionaldocumentreference') continue;
    const children=Array.from(ref.getElementsByTagName('*'));
    let documentType='';
    let binaryNode=null;
    for(const node of children){
      const local=String(node.localName||node.nodeName||'').toLowerCase();
      if(local==='documenttype') documentType=String(node.textContent||'').trim();
      if(local==='embeddeddocumentbinaryobject') binaryNode=node;
    }
    if(documentType.toUpperCase()==='XSLT' && binaryNode){
      const xsltText=efaturaDecodeBase64Utf8(binaryNode.textContent||'');
      const filename=binaryNode.getAttribute('filename')||'fatura.xslt';
      return {text:xsltText,name:filename};
    }
  }
  throw new Error('Fatura XML içinde gömülü XSLT bulunamadı.');
}

function efaturaSummary(doc,file){
  const get=(local)=>{
    const node=Array.from(doc.getElementsByTagName('*')).find(n=>String(n.localName||n.nodeName||'').toLowerCase()===local.toLowerCase());
    return String(node?.textContent||'').trim();
  };
  const root=doc.documentElement;
  const invoiceId=get('ID');
  const uuid=get('UUID');
  const issueDate=get('IssueDate');
  const profile=get('ProfileID');
  const typeCode=get('InvoiceTypeCode');
  const supplierParty=Array.from(doc.getElementsByTagName('*')).find(n=>String(n.localName||'').toLowerCase()==='accountingsupplierparty');
  const customerParty=Array.from(doc.getElementsByTagName('*')).find(n=>String(n.localName||'').toLowerCase()==='accountingcustomerparty');
  const partyValue=(party)=>{
    if(!party) return '';
    const nodes=Array.from(party.getElementsByTagName('*'));
    const find=(name)=>nodes.find(n=>String(n.localName||'').toLowerCase()===name.toLowerCase());
    return String(find('RegistrationName')?.textContent||find('Name')?.textContent||'').trim();
  };
  const monetary=Array.from(doc.getElementsByTagName('*')).find(n=>String(n.localName||'').toLowerCase()==='payableamount');
  const currency=monetary?.getAttribute('currencyID')||'';
  return {
    file:file.name,
    root:String(root?.localName||root?.nodeName||''),
    invoiceId,uuid,issueDate,profile,typeCode,
    supplier:partyValue(supplierParty),
    customer:partyValue(customerParty),
    total:monetary ? String(monetary.textContent||'').trim() : '',
    currency
  };
}

function efaturaInfoTable(s){
  const rows=[
    ['Fatura No',s.invoiceId||'—'],
    ['Fatura Tarihi',s.issueDate||'—'],
    ['UUID',s.uuid||'—'],
    ['Profil',s.profile||'—'],
    ['Fatura Tipi',s.typeCode||'—'],
    ['Gönderici',s.supplier||'—'],
    ['Alıcı',s.customer||'—'],
    ['Ödenecek Tutar',s.total ? s.total+(s.currency?' '+s.currency:'') : '—']
  ];
  const table=el('table',{class:'data-table edefter-info-table'});
  const tbody=el('tbody');
  rows.forEach(([a,b])=>{
    const tr=el('tr');
    tr.appendChild(el('th',{},a));
    tr.appendChild(el('td',{},b));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function renderEfaturaXmlViewerPage(){
  currentToolPage='efatura';
  currentPage='tools-efatura';
  currentStep=-1;
  const content=document.getElementById('step-content');
  content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'e-Fatura XML Görüntüleyici'));
  content.appendChild(el('p',{class:'step-desc'},'UBL-TR e-Fatura XML dosyalarınızı yükleyin. Faturanın XML içine gömülü XSLT şablonu otomatik çıkarılır ve tarayıcıda görüntülenir.'));
  
  const card=el('div',{class:'card edefter-no-print'});
  card.appendChild(el('h3',{},'🧾 e-Fatura XML Dosyalarını Yükle'));
  card.appendChild(el('div',{class:'hint info'},'Birden fazla .xml dosyası aynı anda yüklenebilir. Ayrı bir XSLT yüklemeniz gerekmez; fatura XML içindeki görüntüleme XSLT’si kullanılır.'));
  
  const result=el('div');
  const renderedFrames=[];
  const renderedScales=[];
  const fileMap=new Map();
  const uploadHost=el('div');
  const clearBtn=el('button',{
    class:'btn btn-secondary edefter-no-print',
    style:'margin-top:10px;',
    onclick:()=>{
      fileMap.clear();
      renderedFrames.length=0;
      renderedScales.length=0;
      result.innerHTML='';
      const input=uploadHost.querySelector('input[type="file"]');
      if(input) input.value='';
      const chips=uploadHost.querySelector('.file-chip-list');
      if(chips) chips.remove();
    }
  },'🧹 Temizle');
  const allScaleSelect=el('select',{class:'form-control edefter-no-print',style:'width:auto; min-width:120px;',title:'Tüm faturalar için başlangıç PDF ölçeği'},[
    el('option',{value:'1'},'Tümü %100'),el('option',{value:'0.9'},'Tümü %90'),el('option',{value:'0.8'},'Tümü %80'),el('option',{value:'0.7'},'Tümü %70'),el('option',{value:'0.6'},'Tümü %60')
  ]);
  const allPrintBtn=el('button',{class:'btn btn-primary edefter-no-print',onclick:()=>edefterPrintAllRendered(renderedFrames,renderedScales)},'🖨 Tümünü Tek PDF Kaydet');
  const eachPrintBtn=el('button',{class:'btn btn-secondary edefter-no-print',onclick:()=>edefterPrintEachRendered(renderedFrames,renderedScales)},'🖨 Tümünü Ayrı PDF Kaydet');
  const actions=el('div',{class:'table-actions edefter-no-print',style:'margin-top:10px;'},[clearBtn,allScaleSelect,allPrintBtn,eachPrintBtn]);
  
  card.appendChild(uploadHost);
  fileUploadBox(uploadHost,{
    accept:'.xml',
    multiple:true,
    hint:'e-Fatura XML dosyalarını sürükleyin veya seçmek için tıklayın',
    onFiles:async(files,box)=>{
      result.innerHTML='';
      for(const file of files){
        if(/\.xml$/i.test(file.name)) fileMap.set(file.name,file);
      }
      const oldChips=box.querySelector('.file-chip-list');
      if(oldChips) oldChips.remove();
      
      for(const file of fileMap.values()){
        markFileChip(box,file.name,true);
        const item=el('div',{class:'card edefter-document'});
        try{
          const xmlText=await file.text();
          const doc=new DOMParser().parseFromString(xmlText,'application/xml');
          if(doc.getElementsByTagName('parsererror')[0]) throw new Error('XML sözdizimi okunamadı.');
          if(String(doc.documentElement?.localName||'').toLowerCase()!=='invoice'){
            throw new Error('Bu dosya UBL-TR Invoice XML formatında görünmüyor.');
          }
          
          const summary=efaturaSummary(doc,file);
          const xslt=efaturaExtractEmbeddedXslt(doc);
          const head=el('div',{class:'edefter-doc-head'},[
            el('div',{},[
              el('strong',{},file.name),
              el('div',{class:'hint info'},'e-Fatura · '+(summary.invoiceId||'Fatura numarası okunamadı')),
              el('div',{class:'hint ok',style:'margin-top:6px;'},'✓ Gömülü XSLT: '+xslt.name)
            ]),
            el('div',{class:'table-actions edefter-no-print'})
          ]);
          const headActions=head.lastChild;
          const scaleSelect=el('select',{class:'form-control edefter-no-print',style:'width:auto; min-width:110px;',title:'PDF yazdırma ölçeği'},[
            el('option',{value:'1'},'PDF %100'),
            el('option',{value:'0.9'},'PDF %90'),
            el('option',{value:'0.8'},'PDF %80'),
            el('option',{value:'0.7'},'PDF %70'),
            el('option',{value:'0.6'},'PDF %60')
          ]);
          const printBtn=el('button',{class:'btn btn-primary'},'🖨 Yazdır / PDF Kaydet');
          headActions.appendChild(scaleSelect);
          headActions.appendChild(printBtn);
          item.appendChild(head);
          item.appendChild(efaturaInfoTable(summary));
          
          const preview=el('div',{class:'card edefter-render-card',style:'margin-top:14px;'});
          preview.appendChild(el('h3',{},'🖥️ Fatura Görünümü'));
          try{
            const html=await edefterTransformXml(xmlText,xslt.text);
            const frame=edefterRenderedFrame(html);
            renderedFrames.push(frame);
            renderedScales.push(scaleSelect.value);
            scaleSelect.onchange=()=>{ renderedScales[renderedFrames.indexOf(frame)]=scaleSelect.value; edefterSetPrintScale(frame,scaleSelect.value); };
            allScaleSelect.onchange=()=>{
              renderedFrames.forEach((item,i)=>{ renderedScales[i]=allScaleSelect.value; edefterSetPrintScale(item,allScaleSelect.value); });
            };
            frame.addEventListener('load',()=>edefterSetPrintScale(frame,scaleSelect.value),{once:true});
            printBtn.onclick=()=>edefterDownloadRenderedPdf(frame,scaleSelect.value);
            preview.appendChild(frame);
          }catch(transformErr){
            preview.appendChild(el('div',{class:'hint warn'},'⚠️ XSLT ile fatura görüntüsü oluşturulamadı: '+transformErr.message));
          }
          item.appendChild(preview);
        }catch(err){
          item.appendChild(el('div',{class:'hint warn'},'⚠️ '+file.name+': '+err.message));
        }
        result.appendChild(item);
      }
    }
  });
  card.appendChild(actions);
  card.appendChild(result);
  content.appendChild(card);
  content.appendChild(el('div',{class:'hint warn edefter-no-print'},'Not: Bu araç fatura XML’inin XSLT ile görsel sunumunu yapar. Elektronik imza/mali mühür doğrulaması veya GİB kayıt sorgulaması yapmaz.'));
  document.getElementById('btn-prev').disabled=true;
  document.getElementById('btn-next').disabled=true;
  document.getElementById('footer-msg').textContent='Araçlar → e-Fatura XML Görüntüleyici';
  renderNav();
}
