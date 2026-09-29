/* ============================================================
   Araçlar — e-Defter XML / Berat ve PDF Görüntüleyici
   Tamamen tarayıcı tarafında çalışır; yüklenen dosyalar sunucuya gönderilmez.
   ============================================================ */

let toolsMenuOpen = true;
let currentToolPage = '';

function edefterSafeName(name, suffix){
  const base=String(name||'e-defter').replace(/\.xml$/i,'').replace(/\.pdf$/i,'').replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,90)||'e-defter';
  return base+suffix;
}

function edefterFileType(name, root){
  const n=String(name||'').toUpperCase();
  const local=String(root?.localName||root?.nodeName||'').toLowerCase();
  if(/GIB-.*-YB-|GIB.*YB/.test(n)) return 'GİB Onaylı Yevmiye Beratı';
  if(/GIB-.*-KB-|GIB.*KB/.test(n)) return 'GİB Onaylı Kebir Beratı';
  if(/-YB[-_.]/.test(n)) return 'Yevmiye Beratı';
  if(/-KB[-_.]/.test(n)) return 'Kebir Beratı';
  if(/-DR[-_.]/.test(n)) return 'Defter Raporu / Mizan';
  if(/-Y[-_.]/.test(n)) return 'Yevmiye Defteri';
  if(/-K[-_.]/.test(n)) return 'Kebir / Büyük Defter';
  if(local==='berat') return 'Berat';
  if(local==='defter') return 'e-Defter';
  return 'XML';
}

function edefterLocalName(node){
  return String(node?.localName||node?.nodeName||'').split(':').pop();
}

function edefterFirstText(doc, names, regex){
  const wanted=new Set(names.map(x=>String(x).toLowerCase()));
  const all=doc.getElementsByTagName('*');
  for(let i=0;i<all.length;i++){
    const n=all[i], local=edefterLocalName(n).toLowerCase();
    if(!wanted.has(local)) continue;
    const value=String(n.textContent||'').replace(/\s+/g,' ').trim();
    if(!value) continue;
    if(!regex || regex.test(value)) return value;
  }
  return '';
}

function edefterSummary(doc,file){
  const root=doc.documentElement;
  const all=doc.getElementsByTagName('*');
  const identifiers=[];
  for(let i=0;i<all.length;i++){
    const local=edefterLocalName(all[i]).toLowerCase();
    if(local!=='identifier') continue;
    const v=String(all[i].textContent||'').replace(/\s+/g,'').trim();
    if(/^\d{10,11}$/.test(v) && !identifiers.includes(v)) identifiers.push(v);
  }
  const start=edefterFirstText(doc,['startDate']);
  const end=edefterFirstText(doc,['endDate']);
  const instant=edefterFirstText(doc,['instant']);
  const period=start&&end ? start+' → '+end : (instant||start||end||'');
  const entries=[...all].filter(n=>edefterLocalName(n).toLowerCase()==='entryheader').length;
  const detail=[...all].filter(n=>edefterLocalName(n).toLowerCase()==='entrydetail').length;
  const signatures=[...all].filter(n=>edefterLocalName(n).toLowerCase()==='signature').length;
  return {
    type:edefterFileType(file.name,root),
    root:edefterLocalName(root),
    vkn:identifiers[0]||'',
    period,
    entries,
    detail,
    signatures,
    size:file.size,
    xsl:/<\?xml-stylesheet[^>]*href\s*=\s*["'][^"']+["']/i.test(file.__text||'')
  };
}

function edefterPrettyXml(text){
  return String(text||'').replace(/>\s*</g,'><').replace(/(>)(<)(\/?)/g,'$1\n$2$3');
}

function edefterXmlNodeView(node, depth=0){
  const wrap=el('div',{class:'edefter-xml-node'});
  const attrs=[...node.attributes||[]].map(a=>a.name+'="'+a.value+'"').join(' ');
  const children=[...node.childNodes||[]].filter(n=>n.nodeType===1);
  const texts=[...node.childNodes||[]].filter(n=>n.nodeType===3).map(n=>String(n.nodeValue||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  const label=edefterLocalName(node);
  const head=el('div',{class:'edefter-xml-tag'},'<'+label+(attrs?' '+attrs:'')+'>');
  wrap.appendChild(head);
  if(texts.length){
    const value=texts.join(' ').slice(0,320);
    wrap.appendChild(el('div',{class:'edefter-xml-value'},value+(texts.join(' ').length>320?' …':'')));
  }
  if(children.length){
    const details=el('details',{class:'edefter-xml-children'});
    const summary=el('summary',{},children.length+' alt öğe');
    details.appendChild(summary);
    let built=false;
    details.addEventListener('toggle',()=>{
      if(!details.open || built) return;
      built=true;
      const frag=document.createDocumentFragment();
      const max=500;
      children.slice(0,max).forEach(child=>frag.appendChild(edefterXmlNodeView(child,depth+1)));
      if(children.length>max) frag.appendChild(el('div',{class:'hint info'},`İlk ${max} alt öğe gösterildi; kalan ${children.length-max} öğe performans için açılmadı.`));
      details.appendChild(frag);
    });
    wrap.appendChild(details);
  }
  return wrap;
}

function edefterInfoTable(summary){
  const table=el('table',{class:'editable-table edefter-info-table'});
  [
    ['Dosya türü',summary.type],
    ['Kök XML öğesi',summary.root||'—'],
    ['Vergi/T.C. Kimlik Numarası',summary.vkn||'—'],
    ['Dönem',summary.period||'—'],
    ['Yevmiye kayıt başlığı',summary.entries||0],
    ['Kayıt detayı',summary.detail||0],
    ['Elektronik imza düğümü',summary.signatures||0],
    ['XSLT tanımı',summary.xsl?'Bulundu':'Bulunamadı']
  ].forEach(([a,b])=>{const tr=el('tr');tr.appendChild(el('th',{},a));tr.appendChild(el('td',{},String(b)));table.appendChild(tr);});
  return table;
}

function printEdefterXml(){
  document.body.classList.add('edefter-print-mode');
  setTimeout(()=>window.print(),30);
}

function edefterDownloadText(fileName,textValue){
  const blob=new Blob([String(textValue||'')],{type:'application/xml;charset=utf-8'});
  downloadBlob(blob,fileName);
}

function renderEdefterXmlViewerPage(){
  currentToolPage='xml';
  currentPage='tools-xml';
  currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'e-Defter XML / Berat Görüntüleyici'));
  content.appendChild(el('p',{class:'step-desc'},'Yevmiye, Kebir, Defter Raporu ve Berat XML dosyalarını tarayıcı içinde inceleyin. Dosya içeriği bu cihazda işlenir; yükleme sunucuya yapılmaz.'));
  const card=el('div',{class:'card edefter-no-print'});
  card.appendChild(el('h3',{},'📄 e-Defter / Berat XML Yükle'));
  card.appendChild(el('div',{class:'hint info'},'Desteklenen dosya türleri: Y, K, DR, YB, KB ve GİB onaylı berat XML dosyaları. Büyük defterlerde ayrıntılı XML ağacı yalnızca açtığınız bölümlerde oluşturulur.'));
  const result=el('div');
  fileUploadBox(card,{accept:'.xml',multiple:true,hint:'XML dosyasını sürükleyin veya seçin',onFiles:async(files,box)=>{
    result.innerHTML='';
    for(const file of files){
      markFileChip(box,file.name,true);
      const item=el('div',{class:'card edefter-document'});
      try{
        const textValue=await file.text();
        const doc=new DOMParser().parseFromString(textValue,'application/xml');
        const parserError=doc.getElementsByTagName('parsererror')[0];
        if(parserError) throw new Error('XML sözdizimi okunamadı.');
        file.__text=textValue;
        const summary=edefterSummary(doc,file);
        const head=el('div',{class:'edefter-doc-head'},[
          el('div',{},[el('strong',{},file.name),el('div',{class:'hint info'},summary.type+' · '+(summary.period||'Dönem okunamadı'))]),
          el('div',{class:'table-actions edefter-no-print'})
        ]);
        const actions=head.lastChild;
        actions.appendChild(el('button',{class:'btn btn-primary',onclick:()=>printEdefterXml()},'🖨 Yazdır / PDF Kaydet'));
        actions.appendChild(el('button',{class:'btn btn-secondary',onclick:()=>edefterDownloadText(file.name,textValue)},'⬇ XML Kaydet'));
        item.appendChild(head);
        item.appendChild(edefterInfoTable(summary));
        const treeCard=el('div',{class:'card',style:'margin-top:14px;'});
        treeCard.appendChild(el('h3',{},'🌳 Yapısal XML Görünümü'));
        treeCard.appendChild(edefterXmlNodeView(doc.documentElement));
        item.appendChild(treeCard);
        const raw=el('details',{class:'raw-details edefter-no-print',style:'margin-top:12px;'});
        raw.appendChild(el('summary',{},'Ham XML metnini göster'));
        raw.appendChild(el('pre',{class:'raw-text edefter-xml-raw'},edefterPrettyXml(textValue)));
        item.appendChild(raw);
      }catch(err){
        item.appendChild(el('div',{class:'hint warn'},`⚠️ ${file.name}: ${err.message}`));
      }
      result.appendChild(item);
    }
  }});
  card.appendChild(result);
  content.appendChild(card);
  const note=el('div',{class:'hint warn edefter-no-print'},'Not: Bu görüntüleyici XML içeriğini okur ve yazdırılabilir hale getirir; elektronik imza/mali mühür geçerliliğini doğrulamaz ve GİB kayıtlarıyla karşılaştırma yapmaz.');
  content.appendChild(note);
  document.getElementById('btn-prev').disabled=true; document.getElementById('btn-next').disabled=true; document.getElementById('footer-msg').textContent='Araçlar → e-Defter XML / Berat Görüntüleyici'; renderNav();
}

let edefterPdfObjectUrl='';

function renderEdefterPdfViewerPage(){
  currentToolPage='pdf';
  currentPage='tools-pdf';
  currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'e-Defter PDF Görüntüleyici'));
  content.appendChild(el('p',{class:'step-desc'},'Elinizdeki e-Defter PDF çıktısını ekranda görüntüleyin ve aynı dosyayı bilgisayarınıza kaydedin.'));
  const card=el('div',{class:'card edefter-no-print'});
  card.appendChild(el('h3',{},'📑 PDF Yükle'));
  const status=el('div');
  const viewer=el('div',{class:'edefter-pdf-viewer'});
  fileUploadBox(card,{accept:'.pdf',multiple:false,hint:'e-Defter PDF dosyasını sürükleyin veya seçin',onFiles:async(files,box)=>{
    const file=files[0]; if(!file) return;
    markFileChip(box,file.name,true);
    if(edefterPdfObjectUrl) URL.revokeObjectURL(edefterPdfObjectUrl);
    edefterPdfObjectUrl=URL.createObjectURL(file);
    status.innerHTML='';
    const actions=el('div',{class:'table-actions'});
    actions.appendChild(el('button',{class:'btn btn-primary',onclick:()=>downloadBlob(file,file.name)},'⬇ PDF Kaydet'));
    actions.appendChild(el('a',{class:'btn btn-secondary',href:edefterPdfObjectUrl,target:'_blank',rel:'noopener noreferrer',style:'text-decoration:none;'},'↗ Yeni Sekmede Aç'));
    status.appendChild(el('div',{class:'hint ok'},`✓ ${file.name} — ${(file.size/1024/1024).toFixed(2)} MB`));
    status.appendChild(actions);
    viewer.innerHTML='';
    const iframe=document.createElement('iframe');
    iframe.src=edefterPdfObjectUrl;
    iframe.title='e-Defter PDF görüntüleme';
    iframe.className='edefter-pdf-frame';
    viewer.appendChild(iframe);
  }});
  card.appendChild(status); card.appendChild(viewer); content.appendChild(card);
  content.appendChild(el('div',{class:'hint info edefter-no-print'},'PDF dosyası tarayıcının yerleşik PDF görüntüleyicisiyle açılır. “PDF Kaydet” düğmesi yüklediğiniz orijinal PDF dosyasını aynen indirir.'));
  document.getElementById('btn-prev').disabled=true; document.getElementById('btn-next').disabled=true; document.getElementById('footer-msg').textContent='Araçlar → e-Defter PDF Görüntüleyici'; renderNav();
}

window.addEventListener('afterprint',()=>document.body.classList.remove('edefter-print-mode'));
