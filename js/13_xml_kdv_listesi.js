/* ============================================================
   Araçlar — XML'den İndirilebilir KDV Listesi Oluştur
   UBL-TR e-Fatura XML dosyalarını tarayıcıda okuyup Excel üretir.
   ============================================================ */

function kdvXmlLocalName(node){
  return String(node?.localName||node?.nodeName||'').split(':').pop().toLowerCase();
}
function kdvXmlNodes(doc,name){
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
  return String(find('RegistrationName')?.textContent||find('Name')?.textContent||'').trim();
}
function kdvXmlPartyId(party){
  if(!party) return '';
  const nodes=Array.from(party.getElementsByTagName('*'));
  const id=nodes.find(x=>kdvXmlLocalName(x)==='id');
  return String(id?.textContent||'').trim();
}
function kdvXmlNumber(value){
  const n=Number(String(value??'').replace(/\s/g,'').replace(',','.'));
  return Number.isFinite(n)?n:0;
}
function kdvXmlMoney(doc,name){
  const node=kdvXmlFirst(doc,name);
  return {value:kdvXmlNumber(node?.textContent),currency:String(node?.getAttribute('currencyID')||'').trim()};
}
function kdvXmlInvoiceData(doc,file){
  if(kdvXmlLocalName(doc.documentElement)!=='invoice') throw new Error('UBL-TR Invoice XML değil.');
  const supplier=kdvXmlNodes(doc,'AccountingSupplierParty')[0];
  const customer=kdvXmlNodes(doc,'AccountingCustomerParty')[0];
  const taxTotals=kdvXmlNodes(doc,'TaxTotal');
  let kdv=0;
  const rates=[];
  taxTotals.forEach(t=>{
    kdvXmlNodes(t,'TaxAmount').slice(0,1).forEach(n=>{kdv+=kdvXmlNumber(n.textContent);});
    kdvXmlNodes(t,'TaxSubtotal').forEach(sub=>{
      const percent=kdvXmlFirst(sub,'Percent')?.textContent;
      if(String(percent||'').trim()!=='') rates.push(kdvXmlNumber(percent));
    });
  });
  const uniqueRates=[...new Set(rates.map(x=>String(x)))];
  const matrah=kdvXmlMoney(doc,'TaxExclusiveAmount');
  const dahil=kdvXmlMoney(doc,'TaxInclusiveAmount');
  const payable=kdvXmlMoney(doc,'PayableAmount');
  return {
    belgeTuru:'Fatura',
    vkn:kdvXmlPartyId(supplier),
    saticiUnvan:kdvXmlPartyName(supplier),
    aliciUnvan:kdvXmlPartyName(customer),
    tarih:kdvXmlText(doc,'IssueDate'),
    faturaNo:kdvXmlText(doc,'ID'),
    uuid:kdvXmlText(doc,'UUID'),
    profil:kdvXmlText(doc,'ProfileID'),
    faturaTipi:kdvXmlText(doc,'InvoiceTypeCode'),
    matrah:matrah.value,
    kdv,
    kdvOrani:uniqueRates.length===1?Number(uniqueRates[0]):null,
    toplam:payable.value||dahil.value,
    toplamIndirilenKdv:kdv,
    cins:kdvXmlItemDescription(doc),
    miktar:kdvXmlQuantity(doc),
    tevkifatIndirilen:0,
    tevkifat2No:0,
    ggbTescilNo:'',
    indirimDonemi:'',
    paraBirimi:matrah.currency||dahil.currency||payable.currency,
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
  const m=s.match(/^([A-Za-z]+)(.*)$/);
  return {series:m?m[1]:s, number:m?m[2]:''};
}
function kdvXmlQuantity(doc){
  return kdvXmlNodes(doc,'InvoicedQuantity').reduce((sum,n)=>sum+kdvXmlNumber(n.textContent),0);
}
function kdvXmlItemDescription(doc){
  const names=kdvXmlNodes(doc,'InvoiceLine').map(line=>{
    const nodes=Array.from(line.getElementsByTagName('*'));
    const item=nodes.find(x=>kdvXmlLocalName(x)==='item');
    if(!item) return '';
    const ds=Array.from(item.getElementsByTagName('*')).filter(x=>['description','name'].includes(kdvXmlLocalName(x)));
    return String(ds[0]?.textContent||'').trim();
  }).filter(Boolean);
  return [...new Set(names)].join(' / ');
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
      r.matrah,r.kdv,r.tevkifatIndirilen||0,r.tevkifat2No||0,r.toplamIndirilenKdv,r.ggbTescilNo||'',r.indirimDonemi||''
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
  ws.autoFilter={from:2,to:16};
  if(errors.length){
    const es=wb.addWorksheet('Okunamayan XML'); es.addRow(['Dosya','Hata']);
    errors.forEach(e=>es.addRow([e.file,e.error])); es.getRow(1).font={bold:true};
    es.columns=[{width:45},{width:80}];
  }
  return wb.xlsx.writeBuffer();
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
    const buffer=await kdvCreateWorkbook(rows,errors);
    kdvDownloadBuffer(buffer,kdvExcelSafeFileName());
  }},'⬇ Excel KDV Listesini İndir');
  const clearBtn=el('button',{class:'btn btn-secondary',style:'margin-left:8px;',onclick:()=>{
    window.__xmlKdvRows=[]; window.__xmlKdvErrors=[]; status.innerHTML=''; result.innerHTML=''; downloadBtn.style.display='none';
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
        markFileChip(box,file.name,true);
      }catch(err){
        window.__xmlKdvErrors.push({file:file.name,error:err.message});
        markFileChip(box,file.name,false);
      }
    }
    status.appendChild(el('div',{class:'hint '+(ok?'ok':'warn')},ok?'✓ '+ok+' XML fatura okundu.':'⚠️ Okunabilir XML fatura bulunamadı.'));
    if(window.__xmlKdvErrors.length) status.appendChild(el('div',{class:'hint warn',style:'margin-top:6px;'},'⚠️ '+window.__xmlKdvErrors.length+' dosya okunamadı; ayrıntılar Excel içindeki “Okunamayan XML” sayfasına eklenir.'));
    if(ok){
      const table=el('table',{class:'data-table'});
      const tr=el('tr'); ['Sıra','Fatura No','Tarih','Satıcı VKN','Matrah','KDV','Toplam'].forEach(h=>tr.appendChild(el('th',{},h))); table.appendChild(tr);
      window.__xmlKdvRows.forEach((r,i)=>{const row=el('tr');[i+1,r.faturaNo,r.tarih,r.vkn,r.matrah.toFixed(2),r.kdv.toFixed(2),r.toplam.toFixed(2)].forEach(v=>row.appendChild(el('td',{},String(v))));table.appendChild(row);});
      result.appendChild(table);
      downloadBtn.style.display='inline-flex';
    }
  }});
  card.appendChild(el('div',{style:'margin-top:12px;'},[downloadBtn,clearBtn]));
  card.appendChild(status); card.appendChild(result); content.appendChild(card);
  document.getElementById('btn-prev').disabled=true; document.getElementById('btn-next').disabled=true;
  document.getElementById('footer-msg').textContent='Araçlar → XML’den KDV Listesi Oluştur'; renderNav();
}
