/* ============================================================
   Araçlar — XML'den İndirilebilir KDV Listesi Oluştur
   UBL-TR e-Fatura XML dosyalarını tarayıcıda okuyup Excel üretir.
   ============================================================ */

function kdvXmlLocalName(node){
  return String(node?.localName||node?.nodeName||'').split(':').pop().toLowerCase();
}
function kdvXmlNodes(doc,name){
  if(!doc || typeof doc.getElementsByTagName!=='function') return [];
  return Array.from(doc.getElementsByTagName('*')).filter(n=>kdvXmlLocalName(n)===String(name).toLowerCase());
}
function kdvXmlFirst(doc,name){
  return kdvXmlNodes(doc,name)[0]||null;
}
function kdvXmlText(doc,name){
  return String(kdvXmlFirst(doc,name)?.textContent||'').trim();
}
function kdvXmlPartyName(party){
  if(!party) return '';
  const nodes=Array.from(party.getElementsByTagName('*'));
  const find=n=>nodes.find(x=>kdvXmlLocalName(x)===n.toLowerCase());
  const pn=Array.from(party.getElementsByTagName('*')).find(x=>kdvXmlLocalName(x)==='partyname');
  const pnName=pn?Array.from(pn.getElementsByTagName('*')).find(x=>kdvXmlLocalName(x)==='name'):null;
  if(String(pnName?.textContent||'').trim()) return String(pnName.textContent).trim();
  const reg=nodes.find(x=>kdvXmlLocalName(x)==='registrationname');
  if(String(reg?.textContent||'').trim()) return String(reg.textContent).trim();
  const person=Array.from(party.getElementsByTagName('*')).find(x=>kdvXmlLocalName(x)==='person');
  const pnodes=person?Array.from(person.getElementsByTagName('*')):[];
  const first=pnodes.find(x=>kdvXmlLocalName(x)==='firstname');
  const last=pnodes.find(x=>kdvXmlLocalName(x)==='familyname');
  return [first?.textContent,last?.textContent].map(x=>String(x||'').trim()).filter(Boolean).join(' ');
}
function kdvXmlPartyId(party){
  if(!party) return '';
  const nodes=Array.from(party.getElementsByTagName('*'));
  const id=nodes.find(x=>kdvXmlLocalName(x)==='id');
  return String(id?.textContent||'').trim();
}
function kdvXmlNumber(value){
  const raw=String(value??'').trim().replace(/\s/g,'');
  if(!raw) return 0;
  const normalized=raw.includes(',') && raw.includes('.')
    ? (raw.lastIndexOf(',')>raw.lastIndexOf('.') ? raw.replace(/\./g,'').replace(',','.') : raw.replace(/,/g,''))
    : raw.replace(',','.');
  const n=Number(normalized);
  return Number.isFinite(n)?n:0;
}
function kdvXmlDirectChildren(doc,name){
  const root=doc?.documentElement;
  if(!root) return [];
  return Array.from(root.childNodes||[]).filter(n=>n.nodeType===1 && kdvXmlLocalName(n)===String(name).toLowerCase());
}
function kdvXmlTlNotes(doc){
  const notes=kdvXmlNodes(doc,'Note').map(n=>String(n.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  const out={};
  for(const note of notes){
    let m=note.match(/Kur\s*:\s*([0-9.,]+)/i);
    if(m) out.kur=kdvXmlNumber(m[1]);
    m=note.match(/FTutar\s*([0-9.,]+).*?KDV\s*([0-9.,]+).*?GenelToplam\s*([0-9.,]+).*?TEVK[İI]FAT\s*([0-9.,]+)/i);
    if(m){
      out.matrah=kdvXmlNumber(m[1]);
      out.kdv=kdvXmlNumber(m[2]);
      out.toplam=kdvXmlNumber(m[3]);
      out.tevkifat=kdvXmlNumber(m[4]);
    }
    m=note.match(/Karşılığı\s*([0-9.,]+)\s*TL/i);
    if(m) out.toplam=kdvXmlNumber(m[1]);
  }
  return out;
}
function kdvXmlMoney(doc,name){
  const node=kdvXmlFirst(doc,name);
  return {value:kdvXmlNumber(node?.textContent),currency:String(node?.getAttribute('currencyID')||'').trim()};
}
function kdvXmlInvoiceData(doc,file){
  if(kdvXmlLocalName(doc.documentElement)!=='invoice') throw new Error('UBL-TR Invoice XML değil.');
  const supplier=kdvXmlNodes(doc,'AccountingSupplierParty')[0];
  const customer=kdvXmlNodes(doc,'AccountingCustomerParty')[0];
  const invoiceType=kdvXmlText(doc,'InvoiceTypeCode').toUpperCase();
  const topTax=kdvXmlDirectChildren(doc,'TaxTotal')[0]||null;
  const topWithholding=kdvXmlDirectChildren(doc,'WithholdingTaxTotal')[0]||null;

  // Faturanın gerçek toplam KDV'si, tevkifatlı faturada TaxTotal/TaxAmount'tan
  // farklı olabilir; TaxSubtotal/TaxAmount tam KDV'yi verir.
  const topTaxSubtotals=topTax ? kdvXmlNodes(topTax,'TaxSubtotal') : [];
  const topTaxAmount=topTax ? kdvXmlFirst(topTax,'TaxAmount') : null;
  const fullKdvXml=topTaxSubtotals.length
    ? topTaxSubtotals.reduce((sum,sub)=>sum+kdvXmlNumber(kdvXmlFirst(sub,'TaxAmount')?.textContent),0)
    : kdvXmlNumber(topTaxAmount?.textContent);

  const withholdingAmount=topWithholding ? kdvXmlFirst(topWithholding,'TaxAmount') : null;
  const withholdingXml=kdvXmlNumber(withholdingAmount?.textContent);
  const matrah=kdvXmlMoney(doc,'TaxExclusiveAmount');
  const dahil=kdvXmlMoney(doc,'TaxInclusiveAmount');
  const payable=kdvXmlMoney(doc,'PayableAmount');
  const tl=kdvXmlTlNotes(doc);
  const isWithholding=invoiceType==='TEVKIFAT' || !!topWithholding || withholdingXml>0;

  // Kullanıcının eklediği örneklerde yabancı para fatura için TL karşılığı
  // Note alanında ayrıca veriliyor. Liste TL esaslı oluşturulduğu için bu
  // değerler doğrudan kullanılır.
  const matrahTl=Number.isFinite(tl.matrah)?tl.matrah:matrah.value;
  const kdvTl=Number.isFinite(tl.kdv)?tl.kdv:fullKdvXml;
  const withholdingTl=Number.isFinite(tl.tevkifat)?tl.tevkifat:withholdingXml;
  const toplamTl=Number.isFinite(tl.toplam)?tl.toplam:(payable.value||dahil.value);

  let tevkifatIndirilen=0;
  let tevkifat2No=0;
  let toplamIndirilenKdv=kdvTl;

  if(isWithholding){
    // 06/2024 sonrası kılavuz mantığı:
    // L = tevkifata tabi olmayan ve bu dönemde indirilen KDV
    // M = 2 No.lu beyannamede ödenen tevkifat KDV
    // N = L + M, KDV'yi aşamaz.
    tevkifat2No=Math.max(0,Math.min(withholdingTl,kdvTl));
    tevkifatIndirilen=Math.max(0,kdvTl-tevkifat2No);
    toplamIndirilenKdv=Math.min(kdvTl,tevkifatIndirilen+tevkifat2No);
  }

  const rates=[];
  topTaxSubtotals.forEach(sub=>{
    const percent=kdvXmlFirst(sub,'Percent')?.textContent;
    if(String(percent||'').trim()!=='') rates.push(kdvXmlNumber(percent));
  });
  const uniqueRates=[...new Set(rates.map(x=>String(x)))];

  return {
    belgeTuru:'Fatura',
    vkn:kdvXmlPartyId(supplier),
    saticiUnvan:kdvXmlPartyName(supplier),
    aliciUnvan:kdvXmlPartyName(customer),
    tarih:kdvXmlText(doc,'IssueDate'),
    faturaNo:kdvXmlText(doc,'ID'),
    uuid:kdvXmlText(doc,'UUID'),
    profil:kdvXmlText(doc,'ProfileID'),
    faturaTipi:invoiceType,
    matrah:matrahTl,
    kdv:kdvTl,
    kdvOrani:uniqueRates.length===1?Number(uniqueRates[0]):null,
    toplam:toplamTl,
    toplamIndirilenKdv,
    cins:kdvXmlItemDescription(doc),
    miktar:kdvXmlQuantity(doc),
    kalemler:kdvXmlLineDetails(doc),
    tevkifatIndirilen,
    tevkifat2No,
    ggbTescilNo:'',
    indirimDonemi:'',
    paraBirimi:'TRY',
    kaynakParaBirimi:matrah.currency||dahil.currency||payable.currency,
    dosya:file.name
  };
}
function kdvExcelDate(value){
  if(!value) return '';
  const parts=String(value).slice(0,10).split('-').map(Number);
  if(parts.length!==3 || !parts.every(Number.isFinite)) return String(value);
  return new Date(parts[0],parts[1]-1,parts[2]);
}
function kdvInvoiceSeriesNo(invoiceNo){
  const s=String(invoiceNo||'').trim();
  // GİB KDV listesinde seri alanı boş bırakılır; XML'deki
  // tam fatura numarası (örn. ABC2026000000001) doğrudan
  // "Alış Faturasının Sıra No'su" alanına yazılır.
  return {series:'', number:s};
}
function kdvXmlLineDetails(doc){
  return kdvXmlNodes(doc,'InvoiceLine').map((line,index)=>{
    const nodes=Array.from(line.getElementsByTagName('*'));
    const q=nodes.find(x=>kdvXmlLocalName(x)==='invoicedquantity');
    const item=nodes.find(x=>kdvXmlLocalName(x)==='item');
    const descNodes=item?Array.from(item.getElementsByTagName('*')).filter(x=>['description','name'].includes(kdvXmlLocalName(x))).map(x=>String(x.textContent||'').trim()).filter(Boolean):[];
    const taxTotal=nodes.find(x=>kdvXmlLocalName(x)==='taxtotal');
    const lineExtension=nodes.find(x=>kdvXmlLocalName(x)==='lineextensionamount');
    const taxSubtotal=taxTotal?Array.from(taxTotal.getElementsByTagName('*')).find(x=>kdvXmlLocalName(x)==='taxsubtotal'):null;
    const subtotalTaxAmount=taxSubtotal?Array.from(taxSubtotal.getElementsByTagName('*')).find(x=>kdvXmlLocalName(x)==='taxamount'):null;
    const taxAmount=taxTotal?Array.from(taxTotal.getElementsByTagName('*')).find(x=>kdvXmlLocalName(x)==='taxamount'):null;
    return {
      no:String(nodes.find(x=>kdvXmlLocalName(x)==='id')?.textContent||'').trim()||String(index+1),
      cins:descNodes[0]||'',
      miktar:String(q?.textContent||'').trim(),
      matrah:kdvXmlNumber(lineExtension?.textContent),
      kdv:kdvXmlNumber(subtotalTaxAmount?.textContent||taxAmount?.textContent)
    };
  });
}
function kdvXmlQuantity(doc){
  return kdvXmlLineDetails(doc).map(x=>x.miktar).filter(Boolean).join(', ');
}
function kdvXmlItemDescription(doc){
  const names=kdvXmlNodes(doc,'InvoiceLine').map(line=>{
    const nodes=Array.from(line.getElementsByTagName('*'));
    const item=nodes.find(x=>kdvXmlLocalName(x)==='item');
    if(!item) return '';
    const ds=Array.from(item.getElementsByTagName('*')).filter(x=>['description','name'].includes(kdvXmlLocalName(x))).map(x=>String(x.textContent||'').trim()).filter(Boolean);
    return ds[0]||'';
  }).filter(Boolean);
  return [...new Set(names)].join(', ');
}
function kdvCreateWorkbook(rows,errors){
  const wb=new ExcelJS.Workbook();
  wb.creator='KDV İade · Karşıt İnceleme Arşiv Sihirbazı';
  wb.created=new Date();
  const ws=wb.addWorksheet('İndirilecek KDV Listesi');
  ws.getColumn(1).width=6.28;
  [4.41,12.56,8.56,10.99,17.14,14.70,16.99,11.85,12.70,9.14,12.85,14.99,15.70,14.28,9.14].forEach((w,i)=>ws.getColumn(i+2).width=w);
  ws.getCell('H2').value='İNDİRİLECEK KDV LİSTESİ';
  ws.getCell('H2').font={bold:true,size:12};
  ws.getCell('H2').alignment={horizontal:'center',vertical:'center'};
  const headers=[
    'Sıra No','Alış Faturasının Tarihi','Alış Faturasının Serisi',"Alış Faturasının Sıra No'su",
    'Satıcının Adı-Soyadı / Ünvanı','Satıcının Vergi Kimlik Numarası / TC Kimlik Numarası',
    'Alınan Mal ve/veya Hizmetin Cinsi','Alınan Mal ve/veya Hizmetin Miktarı',
    'Alınan Mal ve/veya Hizmetin KDV Hariç Tutarı',"KDV'si",
    'Tevkifatlı Faturanın Tevkifata Tabi Olmayan Ve Bu Dönemde İndirilen Kdv Tutarı',
    '2 Nolu Beyannamede Ödenen Kdv Tutarı','Toplam İndirilen KDV Tutarı',
    "GGB Tescil No'su (Alış İthalat İse)",'Belgenin İndirim Hakkının Kullanıldığı KDV Dönemi'
  ];
  headers.forEach((h,i)=>{
    const c=ws.getCell(4,i+2); c.value=h; c.font={bold:true};
    c.alignment={horizontal:'center',vertical:'center',wrapText:true};
    c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};
  });
  ws.getRow(4).height=72;
  const startRow=5;
  rows.forEach((r,i)=>{
    const sn=kdvInvoiceSeriesNo(r.faturaNo);
    const row=ws.getRow(startRow+i);
    [
      i+1,kdvExcelDate(r.tarih),sn.series,sn.number,r.saticiUnvan,r.vkn,r.cins,r.miktar,
      r.matrah,r.kdv,
      r.tevkifatIndirilen,
      r.tevkifat2No,
      r.toplamIndirilenKdv,
      r.ggbTescilNo||'',r.indirimDonemi||''
    ].forEach((v,j)=>row.getCell(j+2).value=v);
    row.eachCell({includeEmpty:true},c=>{
      if(c.column>=2&&c.column<=16){
        c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};
        c.alignment={vertical:'center',wrapText:true};
      }
    });
    row.getCell(3).numFmt='dd.mm.yyyy';
    [10,11,12,13,14].forEach(c=>row.getCell(c).numFmt='#,##0.00');
  });
  const totalRow=startRow+rows.length;
  ws.getCell(totalRow,9).value='TOPLAM'; ws.getCell(totalRow,9).font={bold:true};
  ws.getCell(totalRow,10).value={formula:'SUM(J5:J'+(totalRow-1)+')'};
  ws.getCell(totalRow,11).value={formula:'SUM(K5:K'+(totalRow-1)+')'};
  ws.getCell(totalRow,12).value={formula:'SUM(L5:L'+(totalRow-1)+')'};
  ws.getCell(totalRow,13).value={formula:'SUM(M5:M'+(totalRow-1)+')'};
  ws.getCell(totalRow,14).value={formula:'SUM(N5:N'+(totalRow-1)+')'};
  for(let c=9;c<=16;c++){const cell=ws.getCell(totalRow,c);cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};cell.font={bold:true};}
  [10,11,12,13,14].forEach(c=>ws.getCell(totalRow,c).numFmt='#,##0.00');
  ws.views=[{state:'frozen',ySplit:4}];
  ws.autoFilter={from:'B4',to:'P4'};
  if(errors.length){
    const es=wb.addWorksheet('Okunamayan XML'); es.addRow(['Dosya','Hata']);
    errors.forEach(e=>es.addRow([e.file,e.error])); es.getRow(1).font={bold:true};
    es.columns=[{width:45},{width:80}];
  }
  return wb.xlsx.writeBuffer();
}
function kdvCreateDetailWorkbook(rows,errors){
  const wb=new ExcelJS.Workbook();
  wb.creator='KDV İade · Karşıt İnceleme Arşiv Sihirbazı';
  wb.created=new Date();
  const ws=wb.addWorksheet('Fatura Kalem Detayı');
  const headers=[
    'Sıra No','Fatura Tarihi','Fatura Seri No','Fatura Sıra No',
    'Satıcının Adı-Soyadı / Ünvanı','Satıcının Vergi Kimlik Numarası / TC Kimlik Numarası',
    'Kalem Sıra No','Mal ve/veya Hizmetin Cinsi','Miktar',
    'Kalem KDV Hariç Tutarı','Kalem KDV Tutarı',
    'Faturanın Toplam Matrahı','Faturanın Toplam KDV’si',
    'Toplam İndirilen KDV Tutarı'
  ];
  headers.forEach((h,i)=>{
    const c=ws.getCell(1,i+1); c.value=h; c.font={bold:true};
    c.alignment={horizontal:'center',vertical:'center',wrapText:true};
    c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};
  });
  ws.getRow(1).height=52;
  [7,14,14,16,34,22,12,34,12,18,16,18,18,20].forEach((w,i)=>ws.getColumn(i+1).width=w);
  let rowNo=2;
  rows.forEach(r=>{
    const sn=kdvInvoiceSeriesNo(r.faturaNo);
    const lines=(r.kalemler&&r.kalemler.length)?r.kalemler:[{no:1,cins:r.cins||'',miktar:r.miktar||'',matrah:0,kdv:0}];
    lines.forEach(line=>{
      const values=[
        rowNo-1,r.tarih,sn.series,sn.number,r.saticiUnvan,r.vkn,
        line.no,line.cins,line.miktar,line.matrah,line.kdv,r.matrah,r.kdv,r.toplamIndirilenKdv
      ];
      const excelRow=ws.getRow(rowNo++);
      values.forEach((v,i)=>excelRow.getCell(i+1).value=v);
      excelRow.eachCell({includeEmpty:true},c=>{
        c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};
        c.alignment={vertical:'center',wrapText:true};
      });
      excelRow.getCell(2).numFmt='dd.mm.yyyy';
      [10,11,12,13,14].forEach(c=>excelRow.getCell(c).numFmt='#,##0.00');
    });
  });
  const totalRow=rowNo;
  ws.getCell(totalRow,9).value='TOPLAM';
  ws.getCell(totalRow,9).font={bold:true};
  [10,11].forEach(c=>{
    ws.getCell(totalRow,c).value={formula:'SUM('+String.fromCharCode(64+c)+'2:'+String.fromCharCode(64+c)+(totalRow-1)+')'};
    ws.getCell(totalRow,c).numFmt='#,##0.00';
  });
  for(let c=9;c<=14;c++){
    const cell=ws.getCell(totalRow,c);
    cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};
    cell.font={bold:true};
  }
  ws.views=[{state:'frozen',ySplit:1}];
  ws.autoFilter={from:'A1',to:'N1'};
  if(errors.length){
    const es=wb.addWorksheet('Okunamayan XML');
    es.addRow(['Dosya','Hata']);
    errors.forEach(e=>es.addRow([e.file,e.error]));
    es.getRow(1).font={bold:true};
    es.columns=[{width:45},{width:80}];
  }
  return wb.xlsx.writeBuffer();
}
function kdvDetailExcelSafeFileName(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return 'Detay_Kalemli_Fatura_Listesi_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+'.xlsx';
}
function kdvExcelSafeFileName(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return 'Indirilecek_KDV_Listesi_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+'.xlsx';
}
function kdvDownloadBuffer(buffer,name){
  const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function renderXmlKdvListesiPage(){
  currentPage='tools-xml-kdv-list';
  currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'XML’den KDV Listesi Oluştur'));
  content.appendChild(el('p',{class:'step-desc'},'Birden fazla e-Fatura XML dosyası yükleyin. XML içindeki fatura bilgileri okunur ve indirilebilir Excel KDV listesi oluşturulur.'));
  const card=el('div',{class:'card'});
  card.appendChild(el('h3',{},'📊 XML Faturaları Yükle'));
  card.appendChild(el('div',{class:'hint info'},'Her fatura için satıcı VKN/TCKN, ünvan, fatura tarihi ve numarası, matrah, KDV tutarı, KDV oranı ve toplam tutar XML’den alınır. Dosyalar yalnızca bu tarayıcıda işlenir.'));
  const status=el('div',{style:'margin-top:12px;'});
  const result=el('div',{style:'margin-top:12px;'});
  const downloadBtn=el('button',{class:'btn btn-primary',style:'display:none;',onclick:async()=>{
    const rows=window.__xmlKdvRows||[], errors=window.__xmlKdvErrors||[];
    if(!rows.length){alert('İndirilecek KDV listesi için okunabilir XML bulunamadı.');return;}
    try{
      const buffer=await kdvCreateWorkbook(rows,errors);
      kdvDownloadBuffer(buffer,kdvExcelSafeFileName());
    }catch(err){
      console.error('KDV Excel oluşturma hatası:',err);
      alert('Excel oluşturulamadı: '+String(err?.message||err));
    }
  }},'⬇ Excel KDV Listesini İndir');
  const detailDownloadBtn=el('button',{class:'btn btn-primary',style:'display:none;margin-left:8px;',onclick:async()=>{
    const rows=window.__xmlKdvRows||[], errors=window.__xmlKdvErrors||[];
    if(!rows.length){alert('Detaylı Excel için okunabilir XML bulunamadı.');return;}
    try{
      const buffer=await kdvCreateDetailWorkbook(rows,errors);
      kdvDownloadBuffer(buffer,kdvDetailExcelSafeFileName());
    }catch(err){
      console.error('Detay KDV Excel oluşturma hatası:',err);
      alert('Detaylı Excel oluşturulamadı: '+String(err?.message||err));
    }
  }},'⬇ Detay Kalemli Excel Fatura Listesi İndir');
  const clearBtn=el('button',{class:'btn btn-secondary',style:'margin-left:8px;',onclick:()=>{
    window.__xmlKdvRows=[]; window.__xmlKdvErrors=[]; status.innerHTML=''; result.innerHTML=''; downloadBtn.style.display='none'; detailDownloadBtn.style.display='none';
    const input=card.querySelector('input[type="file"]'); if(input) input.value='';
    const chips=card.querySelector('.file-chip-list'); if(chips) chips.remove();
  }},'🧹 Temizle');
  fileUploadBox(card,{accept:'.xml',multiple:true,hint:'Birden fazla e-Fatura XML dosyasını seçin veya sürükleyip bırakın.',onFiles:async(files,box)=>{
    window.__xmlKdvRows=[]; window.__xmlKdvErrors=[];
    status.innerHTML=''; result.innerHTML=''; downloadBtn.style.display='none';
    const validFiles=files.filter(f=>/\.xml$/i.test(f.name));
    const chips=box.querySelector('.file-chip-list'); if(chips) chips.remove();
    let ok=0;
    for(const file of validFiles){
      try{
        const text=await file.text();
        const doc=new DOMParser().parseFromString(text,'application/xml');
        if(doc.getElementsByTagName('parsererror')[0]) throw new Error('XML sözdizimi okunamadı.');
        const row=kdvXmlInvoiceData(doc,file);
        window.__xmlKdvRows.push(row); ok++;
      }catch(err){
        const msg=String(err?.message||err||'Bilinmeyen hata');
        console.error('XML KDV okuma hatası:',file.name,err);
        window.__xmlKdvErrors.push({file:file.name,error:msg});
        markFileChip(box,file.name,false);
      }
    }
    const total=validFiles.length;
    const bad=window.__xmlKdvErrors.length;
    const summary=el('div',{class:'hint '+(bad?'warn':'ok')},
      '✓ '+ok+' dosya okundu'+(bad?' · ⚠️ '+bad+' hatalı dosya':'')+' · Toplam '+total+' dosya');
    status.appendChild(summary);
    if(bad){
      const errorCard=el('div',{class:'hint warn',style:'margin-top:8px;'});
      errorCard.appendChild(el('strong',{},'Okunamayan / hatalı dosyalar'));
      const errorList=el('div',{style:'margin-top:6px;'});
      window.__xmlKdvErrors.forEach(e=>{
        errorList.appendChild(el('div',{style:'margin-top:3px;'},['❌ ',e.file,' — ',e.error]));
      });
      errorCard.appendChild(errorList);
      status.appendChild(errorCard);
    }
    if(ok){
      const previewCount=Math.min(20,window.__xmlKdvRows.length);
      const table=el('table',{class:'data-table'});
      const tr=el('tr'); ['Sıra','Fatura No','Tarih','Satıcı VKN','Matrah','KDV','Toplam'].forEach(h=>tr.appendChild(el('th',{},h))); table.appendChild(tr);
      window.__xmlKdvRows.slice(0,previewCount).forEach((r,i)=>{const row=el('tr');[i+1,r.faturaNo,r.tarih,r.vkn,r.matrah.toFixed(2),r.kdv.toFixed(2),r.toplam.toFixed(2)].forEach(v=>row.appendChild(el('td',{},String(v))));table.appendChild(row);});
      result.appendChild(table);
      if(window.__xmlKdvRows.length>previewCount){
        result.appendChild(el('div',{class:'hint info',style:'margin-top:8px;'},'ℹ️ Ekranda ilk '+previewCount+' fatura gösteriliyor. '+window.__xmlKdvRows.length+' okunabilir dosyanın tamamı Excel’e aktarılır.'));
      }
      downloadBtn.style.display='inline-flex'; detailDownloadBtn.style.display='inline-flex';
    }
  }});
  card.appendChild(el('div',{style:'margin-top:12px;'},[downloadBtn,detailDownloadBtn,clearBtn]));
  card.appendChild(status); card.appendChild(result); content.appendChild(card);
  document.getElementById('btn-prev').disabled=true; document.getElementById('btn-next').disabled=true;
  document.getElementById('footer-msg').textContent='Araçlar → XML’den KDV Listesi Oluştur'; renderNav();
}
