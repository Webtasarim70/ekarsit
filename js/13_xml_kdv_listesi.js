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
    paraBirimi:matrah.currency||dahil.currency||payable.currency,
    dosya:file.name
  };
}
function kdvExcelDate(value){
  if(!value) return '';
  const d=new Date(String(value).slice(0,10)+'T00:00:00');
  return Number.isNaN(d.getTime())?String(value):d;
}
function kdvExcelSafeFileName(){
  return 'XMLden_KDV_Listesi_'+new Date().toISOString().slice(0,10)+'.xlsx';
}
async function kdvCreateWorkbook(rows,errors){
  const wb=new ExcelJS.Workbook();
  wb.creator='KDV İade · Karşıt İnceleme Arşiv Sihirbazı';
  wb.created=new Date();
  const ws=wb.addWorksheet('KDV Listesi');
  const headers=['Sıra','Belge Türü','Satıcı VKN/TCKN','Satıcı Ünvanı','Alıcı Ünvanı','Fatura Tarihi','Fatura No','UUID','Matrah','KDV Oranı (%)','KDV Tutarı','KDV Dahil / Ödenecek','Para Birimi','Profil','Fatura Tipi','Kaynak XML'];
  ws.addRow(headers);
  rows.forEach((r,i)=>ws.addRow([i+1,r.belgeTuru,r.vkn,r.saticiUnvan,r.aliciUnvan,kdvExcelDate(r.tarih),r.faturaNo,r.uuid,r.matrah,r.kdvOrani,r.kdv,r.toplam,r.paraBirimi,r.profil,r.faturaTipi,r.dosya]));
  const totalRow=ws.addRow(['','','','','','','','','=SUM(I2:I'+(rows.length+1)+')','', '=SUM(K2:K'+(rows.length+1)+')','=SUM(L2:L'+(rows.length+1)+')','','','','']);
  totalRow.getCell(1).value='TOPLAM';
  totalRow.font={bold:true};
  totalRow.eachCell(c=>{c.border={top:{style:'thin'}};});
  ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF34495E'}};
  ws.getRow(1).alignment={vertical:'middle',wrapText:true};
  ws.autoFilter={from:1,to:16};
  ws.views=[{state:'frozen',ySplit:1}];
  [8,18,18,32,32,14,24,38,16,14,16,20,12,18,16,36].forEach((w,i)=>ws.getColumn(i+1).width=w);
  ws.getColumn(6).numFmt='dd.mm.yyyy';
  [9,11,12].forEach(i=>ws.getColumn(i).numFmt='#,##0.00');
  if(errors.length){
    const es=wb.addWorksheet('Okunamayan XML');
    es.addRow(['Dosya','Hata']);
    errors.forEach(e=>es.addRow([e.file,e.error]));
    es.getRow(1).font={bold:true};
    es.columns=[{width:45},{width:80}];
  }
  const buffer=await wb.xlsx.writeBuffer();
  return buffer;
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
