/* ============================================================
   Araçlar — e-Defter XML / Berat Görüntüleyici
   Tamamen tarayıcı tarafında çalışır; yüklenen dosyalar sunucuya gönderilmez.
   ============================================================ */

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

function edefterStylesheetHref(xmlText){
  const source=String(xmlText||'');
  const match=source.match(/<\?xml-stylesheet\b[\s\S]*?\bhref\s*=\s*(["'])(.*?)\1[\s\S]*?\?>/i);
  return match ? match[2] : '';
}

function edefterStylesheetKey(value){
  const name=String(value||'').trim().replaceAll('\\','/').split('/').pop().split(/[?#]/)[0].toLowerCase();
  const allowed=['yevmiye.xslt','kebir.xslt','berat.xslt','defterraporu.xslt'];
  return allowed.includes(name) ? name : '';
}

function edefterInfoTable(summary){
  const table=el('table',{style:'width:100%; border-collapse:collapse; margin-top:12px; font-size:13px;'});
  const rows=[
    ['Dosya türü',summary.type||'—'],
    ['Kök eleman',summary.root||'—'],
    ['VKN / TCKN',summary.vkn||'—'],
    ['Dönem',summary.period||'—'],
    ['Yevmiye maddesi',summary.entries ? String(summary.entries) : '—'],
    ['Detay satırı',summary.detail ? String(summary.detail) : '—'],
    ['İmza / mühür alanı',summary.signatures ? String(summary.signatures) : '—']
  ];
  for(const [label,value] of rows){
    const tr=el('tr');
    tr.appendChild(el('th',{style:'text-align:left; padding:6px 8px; border-bottom:1px solid var(--border,#ddd); width:180px;'},label));
    tr.appendChild(el('td',{style:'padding:6px 8px; border-bottom:1px solid var(--border,#ddd);'},value));
    table.appendChild(tr);
  }
  return table;
}

async function edefterLoadBuiltinStylesheet(name){
  const key=edefterStylesheetKey(name);
  const candidateMap={
    'yevmiye.xslt':'assets/edefter/xslt/yevmiye.xslt',
    'kebir.xslt':'assets/edefter/xslt/kebir.xslt',
    'berat.xslt':'assets/edefter/xslt/berat.xslt',
    'defterraporu.xslt':'assets/edefter/xslt/defterraporu.xslt'
  };
  const path=candidateMap[key];
  if(!path) return null;
  const response=await fetch(path,{cache:'force-cache'});
  if(!response.ok) throw new Error(key+' yerleşik XSLT kaynağı bulunamadı.');
  return {name:key,text:await response.text()};
}

async function edefterResolveBuiltinStylesheet(xmlFile,xmlText){
  const hrefKey=edefterStylesheetKey(edefterStylesheetHref(xmlText));
  const rootName=(xmlText.match(/<([A-Za-z_][\w:.-]*)(?:\s|>)/)||[])[1]||'';
  const local=rootName.split(':').pop().toLowerCase();
  const name=String(xmlFile?.name||'').toUpperCase();
  const candidates =
    (hrefKey && ['yevmiye.xslt','kebir.xslt','berat.xslt','defterraporu.xslt'].includes(hrefKey)) ? [hrefKey]
      : /(?:-YB(?:[-_.]|$)|BERAT)/.test(name) || local==='berat' ? ['berat.xslt']
      : /(?:-KB(?:[-_.]|$)|KEBIR)/.test(name) || /(?:^|-)K(?:[-_.]|$)/.test(name) ? ['kebir.xslt']
      : /(?:-DR(?:[-_.]|$)|RAPOR)/.test(name) || /rapor/.test(local) ? ['defterraporu.xslt']
      : /(?:-Y(?:[-_.]|$)|YEVM[Iİ]YE)/.test(name) || local==='defter' ? ['yevmiye.xslt']
      : [];
  let lastError=null;
  for(const candidate of candidates){
    try{
      const file=await edefterLoadBuiltinStylesheet(candidate);
      if(file) return {file,source:'Yerleşik GİB XSLT'};
    }catch(err){ lastError=err; }
  }
  if(lastError) throw lastError;
  return {file:null,source:'Uygun XSLT eşleştirilemedi'};
}

function edefterBrowserCompatibleXslt(xsltText){
  let text=String(xsltText||'');
  // GİB şablonları XSLT 2.0 bildirse de dönüşüm mantıkları tarayıcıların
  // XSLT 1.0 işlemcisiyle uyumludur. XSLT 2.0'ye özgü karakter haritasını
  // ve çıktı sürüm bilgisini kaldırıp stylesheet sürümünü 1.0'a indiriyoruz.
  text=text.replace(/(<xsl:stylesheet\b[^>]*?)\bversion\s*=\s*["']2\.0["']/i,'$1version="1.0"');
  text=text.replace(/<xsl:character-map\b[^>]*>[\s\S]*?<\/xsl:character-map>/gi,'');
  text=text.replace(/\s+use-character-maps\s*=\s*["'][^"']*["']/gi,'');
  text=text.replace(/\s+version\s*=\s*["']4\.0["']/gi,'');
  return text;
}

async function edefterTransformXml(xmlText,xsltText){
  if(typeof XSLTProcessor==='undefined') throw new Error('Bu tarayıcı XSLT görüntülemeyi desteklemiyor.');
  const parser=new DOMParser();
  const xmlDoc=parser.parseFromString(String(xmlText||''),'application/xml');
  if(xmlDoc.getElementsByTagName('parsererror')[0]) throw new Error('XML sözdizimi okunamadı.');
  const xsltDoc=parser.parseFromString(edefterBrowserCompatibleXslt(xsltText),'application/xml');
  if(xsltDoc.getElementsByTagName('parsererror')[0]) throw new Error('XSLT sözdizimi okunamadı.');
  const processor=new XSLTProcessor();
  processor.importStylesheet(xsltDoc);
  const fragment=processor.transformToFragment(xmlDoc,document);
  const holder=document.createElement('div');
  holder.appendChild(fragment);
  return holder.innerHTML;
}

function edefterRenderedFrame(html){
  const frame=document.createElement('iframe');
  frame.className='edefter-render-frame';
  frame.title='e-Defter XSLT ile oluşturulmuş görünüm';
  frame.setAttribute('sandbox','allow-same-origin allow-modals');
  frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;}body{min-height:100vh;}img{max-width:100%;}table{max-width:100%;}</style></head><body>'+html+'</body></html>';
  return frame;
}

function edefterSetPrintScale(frame, scale){
  const value=Math.max(0.5,Math.min(1.2,Number(scale)||1));
  if(!frame) return value;
  frame.dataset.printScale=String(value);
  try{
    const doc=frame.contentDocument;
    if(doc?.documentElement){
      doc.documentElement.style.zoom=String(value);
      doc.documentElement.style.setProperty('--edefter-print-scale',String(value));
    }
  }catch(err){}
  return value;
}

function edefterDownloadRenderedPdf(frame, scale){
  const value=edefterSetPrintScale(frame,scale||frame?.dataset?.printScale||1);
  if(frame && frame.contentWindow){
    try{frame.contentWindow.focus();frame.contentWindow.print();return;}catch(err){}
  }
  document.body.classList.add('edefter-render-print-mode');
  document.body.style.setProperty('--edefter-print-scale',String(value));
  setTimeout(()=>window.print(),40);
}

function renderEdefterXmlViewerPage(){
  currentToolPage='xml';
  currentPage='tools-xml';
  currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'e-Defter XML / Berat Görüntüleyici'));
  content.appendChild(el('p',{class:'step-desc'},'e-Defter ve berat XML dosyanızı yükleyin. Uygun GİB XSLT şablonu sistem tarafından otomatik seçilir; ayrıca XSLT yüklemeniz gerekmez.'));
  const card=el('div',{class:'card edefter-no-print'});
  card.appendChild(el('h3',{},'📄 e-Defter / Berat XML Dosyalarını Yükle'));
  card.appendChild(el('div',{class:'hint info'},'Desteklenen dosyalar: .xml. Yevmiye, Kebir, Defter Raporu/Mizan ve YB/KB ile GİB onaylı berat dosyaları otomatik tür algılama ve yerleşik XSLT şablonuyla görüntülenir.'));
  const result=el('div');
  const xmlFilesByName=new Map();
  const uploadBoxHost=el('div');
  const clearBtn=el('button',{class:'btn btn-secondary edefter-no-print',style:'margin-top:10px;',onclick:()=>{
    xmlFilesByName.clear();
    result.innerHTML='';
    const input=uploadBoxHost.querySelector('input[type="file"]');
    if(input) input.value='';
    const chips=uploadBoxHost.querySelector('.file-chip-list');
    if(chips) chips.remove();
  }},'🧹 Temizle');
  const actions=el('div',{class:'table-actions edefter-no-print',style:'margin-top:10px;'},[clearBtn]);
  card.appendChild(uploadBoxHost);
  fileUploadBox(uploadBoxHost,{accept:'.xml',multiple:true,hint:'e-Defter veya berat XML dosyalarını sürükleyin veya seçin',onFiles:async(files,box)=>{
    result.innerHTML='';
    for(const file of files) if(/\.xml$/i.test(file.name)) xmlFilesByName.set(file.name,file);
    const oldChips=box.querySelector('.file-chip-list');
    if(oldChips) oldChips.remove();
    for(const file of xmlFilesByName.values()){
      markFileChip(box,file.name,true);
      const item=el('div',{class:'card edefter-document'});
      try{
        const textValue=await file.text();
        const doc=new DOMParser().parseFromString(textValue,'application/xml');
        const parserError=doc.getElementsByTagName('parsererror')[0];
        if(parserError) throw new Error('XML sözdizimi okunamadı.');
        const summary=edefterSummary(doc,file);
        const resolved=await edefterResolveBuiltinStylesheet(file,textValue);
        const head=el('div',{class:'edefter-doc-head'},[
          el('div',{},[
            el('strong',{},file.name),
            el('div',{class:'hint info'},summary.type+' · '+(summary.period||'Dönem okunamadı')),
            el('div',{class:'hint ok',style:'margin-top:6px;'},'✓ Yerleşik XSLT: '+resolved.file.name)
          ]),
          el('div',{class:'table-actions edefter-no-print'})
        ]);
        const actions=head.lastChild;
        item.appendChild(head);
        item.appendChild(edefterInfoTable(summary));
        const printBtn=el('button',{class:'btn btn-primary'},'🖨 Görünümü Yazdır / PDF Kaydet');
        actions.appendChild(printBtn);
        const preview=el('div',{class:'card edefter-render-card',style:'margin-top:14px;'});
        preview.appendChild(el('h3',{},'🖥️ e-Defter Görünümü'));
        try{
          const html=await edefterTransformXml(textValue,resolved.file.text);
          const renderedFrame=edefterRenderedFrame(html);
          printBtn.onclick=()=>edefterDownloadRenderedPdf(renderedFrame);
          preview.appendChild(renderedFrame);
        }catch(transformErr){
          preview.appendChild(el('div',{class:'hint warn'},'⚠️ XSLT ile görselleştirme başarısız: '+transformErr.message));
        }
        item.appendChild(preview);
      }catch(err){
        item.appendChild(el('div',{class:'hint warn'},'⚠️ '+file.name+': '+err.message));
      }
      result.appendChild(item);
    }
  }});
  card.appendChild(actions);
  card.appendChild(result);
  content.appendChild(card);
  content.appendChild(el('div',{class:'hint warn edefter-no-print'},'Not: XSLT ile oluşturulan görünüm dosyanın biçimlendirilmiş sunumudur; elektronik imza/mali mühür geçerliliğini doğrulamaz ve GİB kayıtlarıyla karşılaştırma yapmaz.'));
  document.getElementById('btn-prev').disabled=true; document.getElementById('btn-next').disabled=true; document.getElementById('footer-msg').textContent='Araçlar → e-Defter XML / Berat Görüntüleyici'; renderNav();
}

window.addEventListener('afterprint',()=>document.body.classList.remove('edefter-print-mode','edefter-render-print-mode'));
