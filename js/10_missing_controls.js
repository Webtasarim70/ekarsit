/* ============================================================
   DÖNEM BAZLI EKSİK BİLGİ KONTROLÜ — v1.4
   Kaynaklar:
   - Karşıt incelemeye konu faturalar: doldurulmuş Fatura Excel'i
   - KDV / Muhtasar / diğer tablolar: doldurulmuş Excel'ler
   - e-Berat: onaylanarak defter tablosuna alınmış e-Berat kayıtları
   - Envanter: Yasal Defter tablosu
   ============================================================ */

function controlNorm(v){
  return String(v??'').toLocaleUpperCase('tr-TR')
    .replace(/İ/g,'I').replace(/ı/g,'I').replace(/Ğ/g,'G').replace(/ğ/g,'G')
    .replace(/Ü/g,'U').replace(/ü/g,'U').replace(/Ş/g,'S').replace(/ş/g,'S')
    .replace(/Ö/g,'O').replace(/ö/g,'O').replace(/Ç/g,'C').replace(/ç/g,'C')
    .replace(/[^A-Z0-9]/g,'');
}
function controlPeriod(v){
  const s=String(v??'').trim();
  let m=s.match(/^(\d{1,2})[.\/-](\d{4})$/); if(m) return `${String(+m[1]).padStart(2,'0')}.${m[2]}`;
  m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/); if(m) return `${String(+m[2]).padStart(2,'0')}.${m[3]}`;
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return `${String(+m[2]).padStart(2,'0')}.${m[1]}`;
  m=s.match(/(\d{1,2})[.\/-](\d{4})/); return m?`${String(+m[1]).padStart(2,'0')}.${m[2]}`:'';
}
function controlPrevPeriod(p){
  const m=String(p||'').match(/^(\d{2})\.(\d{4})$/); if(!m)return '';
  let mo=+m[1], y=+m[2]; mo--; if(mo===0){mo=12;y--;} return `${String(mo).padStart(2,'0')}.${y}`;
}
function controlYear(p){const m=String(p||'').match(/^(\d{2})\.(\d{4})$/);return m?m[2]:'';}
function controlMoney(v){
  if(v===null||v===undefined||v==='')return 0;
  if(typeof v==='number')return v;
  let s=String(v).trim().replace(/\s/g,'');
  if(s.includes(',')&&s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(',')) s=s.replace(',','.');
  const n=Number(s); return Number.isFinite(n)?n:0;
}
function controlHeaderIndex(headers, matchers){
  const hs=(headers||[]).map(controlNorm), ms=Array.isArray(matchers)?matchers:[matchers];
  return hs.findIndex(h=>ms.some(m=>h.includes(controlNorm(m))));
}
function controlRowValue(table,row,matchers){
  if(!table||!row)return '';
  const i=controlHeaderIndex(table.headers,matchers); return i>=0?(row[i]??''):'';
}
function controlTable(key){return state.doluTablolar?.[key]||null;}
function controlFaturaRows(){const t=controlTable('fatura');return t?.rows||[];}
function controlFaturaPeriods(){
  const t=controlTable('fatura'); if(!t)return [];
  const i=controlHeaderIndex(t.headers,['Faturanın Tarihi']);
  return [...new Set(t.rows.map(r=>controlPeriod(i>=0?r[i]:'')).filter(Boolean))].sort(donemCompare);
}
function controlYears(periods){return [...new Set((periods||[]).map(controlYear).filter(Boolean))].sort((a,b)=>+a-+b);}
function controlKdvPeriods(invoicePeriods){
  const actual=new Set(invoicePeriods||[]), set=new Set();
  (invoicePeriods||[]).forEach(p=>{set.add(p);set.add(controlPrevPeriod(p));});
  return [...set].sort(donemCompare).map(period=>({period,previous:!actual.has(period)}));
}
function controlDefterRows(){
  const rows=[];
  const t=controlTable('defter');
  (t?.rows||[]).forEach(r=>rows.push({raw:r,source:'Dolu Yasal Defter',nevi:controlRowValue(t,r,['Defterin Nev','Defterin Nevi']),bas:controlRowValue(t,r,['Başlangıç Dönemi']),bit:controlRowValue(t,r,['Bitiş Dönemi']),aciklama:controlRowValue(t,r,['Açıklama']),berat:controlRowValue(t,r,['Tasdik Numarası','Berat Numarası'])}));
  (state.defterler||[]).forEach(r=>rows.push({raw:r,source:'Yüklenen e-Berat / Defter',nevi:r.nevi||'',bas:r.baslangic||'',bit:r.bitis||'',aciklama:r.aciklama||'',berat:r.tasdikNo||''}));
  const seen=new Set();
  return rows.filter(r=>{const k=[controlNorm(r.nevi),controlPeriod(r.bas),controlPeriod(r.bit||r.bas),String(r.berat||'').trim(),String(r.aciklama||'').trim()].join('|');if(seen.has(k))return false;seen.add(k);return true;});
}
function controlStrictMonthPeriod(v){
  const s=String(v??'').trim();
  return /^\d{2}\.\d{4}$/.test(s) ? s : '';
}
function controlDefterHasInformation(row){
  return !!(String(row.berat||'').trim() || String(row.aciklama||'').trim() || String(row.tasdikTarihi||'').trim());
}
function controlDefterCovers(row,period){
  // e-Defter için aylık kontrol katıdır: Başlangıç ve Bitiş dönemleri
  // ayrı ayrı MM.YYYY biçiminde yazılmalı ve aynı aya eşit olmalıdır.
  // Örn. 01.2025-12.2025 kaydı hiçbir aylık e-Defter kontrolünü karşılamaz.
  const p=controlStrictMonthPeriod(period);
  const b=controlStrictMonthPeriod(row.bas);
  const e=controlStrictMonthPeriod(row.bit);
  return !!(p && b && e && b===p && e===p);
}
function controlIsYevmiye(row){const n=controlNorm(row.nevi+' '+row.aciklama);return n.includes('YEVMİYE'.replace(/İ/g,'I'))||n.includes('YEVM');}
function controlIsKebir(row){const n=controlNorm(row.nevi+' '+row.aciklama);return n.includes('KEBIR')||n.includes('BUYUKDEFTER')||n.includes('DEFTERIKEBIR');}
function controlIsInventory(row){return controlNorm(row.nevi).includes('ENVANTER');}
function controlEberatRows(period,type){
  return controlDefterRows().filter(r=>
    controlDefterCovers(r,period) &&
    controlDefterHasInformation(r) &&
    (type==='yevmiye'?controlIsYevmiye(r):controlIsKebir(r))
  );
}
function controlEtnt(row){
  const text=String(row.aciklama||'')+' '+String(row.berat||'');
  return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text);
}
function controlHasInventory(year){
  return controlDefterRows().some(r=>controlIsInventory(r)&&controlYear(controlPeriod(r.bas))===String(year));
}
function controlMuhtasar(period){
  const t=controlTable('muhtasar'); if(!t)return false;
  return t.rows.some(r=>controlPeriod(controlRowValue(t,r,['Dönem']))===period);
}
function controlKdv(period){
  const t=controlTable('kdv'); if(!t)return false;
  return t.rows.some(r=>controlPeriod(controlRowValue(t,r,['Dönem']))===period);
}
function controlSupplierRows(period){
  const t=controlTable('tedarikci'); if(!t)return [];
  return t.rows.filter(r=>controlPeriod(controlRowValue(t,r,['Faturanın Tarihi']))===period);
}
function controlInvoiceRows(period){
  const t=controlTable('fatura'); if(!t)return [];
  return t.rows.filter(r=>controlPeriod(controlRowValue(t,r,['Faturanın Tarihi']))===period);
}
function controlSupplierComparison(period){
  const st=controlTable('tedarikci'),ft=controlTable('fatura'); if(!st||!ft)return [];
  const suppliers=controlSupplierRows(period), invoices=controlInvoiceRows(period), out=[];
  suppliers.forEach(sr=>{
    const no=String(controlRowValue(st,sr,['Faturanın Numarası'])||'').trim().toUpperCase();
    const date=controlPeriod(controlRowValue(st,sr,['Faturanın Tarihi']));
    const vkn=String(controlRowValue(st,sr,['Vergi/T.C. Kimlik Numarası'])||'').trim().toUpperCase();
    const match=invoices.find(fr=>{
      const fno=String(controlRowValue(ft,fr,['Faturanın Numarası'])||'').trim().toUpperCase();
      const fv=String(controlRowValue(ft,fr,['Vergi/T.C. Kimlik Numarası'])||'').trim().toUpperCase();
      const fd=controlPeriod(controlRowValue(ft,fr,['Faturanın Tarihi']));
      return fno&&no&&fno===no&&fd===date&&(!vkn||!fv||fv===vkn);
    });
    const sm=controlMoney(controlRowValue(st,sr,['Faturanın Matrahı']));
    const sk=controlMoney(controlRowValue(st,sr,['Faturanın KDV Tutarı']));
    if(match){
      const fm=controlMoney(controlRowValue(ft,match,['Faturanın Tutarı (TL)','Faturanın Tutarı']));
      const fk=controlMoney(controlRowValue(ft,match,['K.D.V(TL)','KDV(TL)','KDV']));
      out.push({period,no,date,found:true,matrahOk:Math.abs(sm-fm)>0.01,kdvOk:Math.abs(sk-fk)>0.01});
    }else out.push({period,no,date,found:false,matrahOk:false,kdvOk:false});
  });
  return out;
}

function controlBadge(ok, warning=false){
  if(ok) return '<span style="font-size:20px;line-height:1;color:#15803d;font-weight:900;">✓</span>';
  if(warning) return '<span style="font-size:20px;line-height:1;color:#ca8a04;font-weight:900;">!</span>';
  return '<span style="font-size:20px;line-height:1;color:#dc2626;font-weight:900;">✕</span>';
}
function controlStatusCell(ok, warning=false, textOk='Bilgi girilmiş', textNo='Bilgi girilmemiş'){
  const text=ok?textOk:(warning?'ETTN eksik':textNo);
  return el('td',{style:`text-align:center;font-weight:700;color:${ok?'#15803d':warning?'#a16207':'#b91c1c'};white-space:nowrap;`},[document.createTextNode(ok?'':warning?'':'') ,el('span',{style:'display:inline-flex;align-items:center;gap:6px;'},[htmlControlBadge(ok,warning),el('span',{},text)])]);
}
function htmlControlBadge(ok, warning=false){
  const s=ok?'✓':warning?'!':'✕', c=ok?'#15803d':warning?'#ca8a04':'#dc2626';
  return el('span',{style:`font-size:19px;line-height:1;color:${c};font-weight:900;`},s);
}
function controlCard(title,subtitle){
  const c=el('div',{class:'card',style:'margin-top:14px;'});
  c.appendChild(el('h3',{},title));
  if(subtitle)c.appendChild(el('div',{class:'hint info',style:'margin-bottom:10px;'},subtitle));
  return c;
}
function controlTableShell(headers, rows){
  const table=el('table',{class:'data-table',style:'width:100%;'});
  table.appendChild(el('thead',{},[el('tr',{},headers.map(h=>el('th',{},h)))]));
  const tb=el('tbody'); rows.forEach(r=>tb.appendChild(r)); table.appendChild(tb); return table;
}
function controlPeriodBadge(p, previous=false){
  return el('span',{style:`display:inline-block;padding:4px 8px;border-radius:8px;font-weight:800;${previous?'background:#f3f4f6;color:#4b5563;':'background:#eef6ff;color:#1d4ed8;'}`},previous?`(${p})`:p);
}

function buildDetailedMissingControlModel(){
  const months=controlFaturaPeriods();
  const years=controlYears(months);
  const kdvPeriods=controlKdvPeriods(months);
  return {months,years,kdvPeriods};
}

function renderDoluTutanakMissingPage(){
  const p=requireDoluTutanak('Tutanak Eksiklik Tespit'); if(!p)return;
  currentPage='dolu-tutanak-missing'; currentStep=-1;
  const content=document.getElementById('step-content'); content.innerHTML='';
  content.appendChild(el('h2',{class:'step-title'},'Tutanak ve Tablo Ekle — Dönem Bazlı Kontrol'));
  content.appendChild(el('p',{class:'step-desc'},'Karşıt incelemeye konu fatura dönemleri belirlenir ve her dönem için belge/bilgi varlığı ayrı ayrı kontrol edilir. Yeşil ✓ bilgi girilmiş, kırmızı ✕ bilgi girilmemiş, sarı ! ETTN eksik anlamındadır.'));

  const model=buildDetailedMissingControlModel();
  if(!model.months.length){
    content.appendChild(el('div',{class:'hint warn'},'⚠️ Karşıt incelemeye konu faturalar Excel tablosundan dönem tespit edilemedi. Önce doldurulmuş fatura tablosunu yükleyin.'));
    document.getElementById('btn-prev').disabled=true;document.getElementById('btn-next').disabled=true;document.getElementById('footer-msg').textContent='Dönem Bazlı Kontrol';renderNav();return;
  }

  const scope=controlCard('1. Tespit Edilen Dönemler','Bu liste yalnızca Karşıt İncelemeye Konu Faturalar tablosundaki fatura tarihlerinden oluşturulur.');
  scope.appendChild(controlTableShell(['Kontrol Kapsamı','Tespit Edilen Değer'],[
    el('tr',{},[el('td',{style:'font-weight:700;'},'Tespit edilen aylar'),el('td',{},model.months.map(x=>controlPeriodBadge(x,false)).reduce((a,b)=>(a.appendChild(b),a),el('div',{style:'display:flex;gap:6px;flex-wrap:wrap;'})))]),
    el('tr',{},[el('td',{style:'font-weight:700;'},'Tespit edilen yıl'),el('td',{},model.years.join(', '))]),
    el('tr',{},[el('td',{style:'font-weight:700;'},'Tespit edilen KDV dönemleri'),el('td',{},model.kdvPeriods.map(x=>{const wrap=el('span',{style:'display:inline-flex;align-items:center;gap:4px;margin-right:8px;'},[controlPeriodBadge(x.period,x.previous)]);if(x.previous)wrap.appendChild(el('small',{style:'color:#6b7280;font-weight:700;'},'* önceki dönem'));return wrap;} ).reduce((a,b)=>(a.appendChild(b),a),el('div',{style:'display:flex;gap:6px;flex-wrap:wrap;'})))])
  ]));
  content.appendChild(scope);

  const invCard=controlCard('2. Envanter Defterleri','Tespit edilen yılların her biri için ENVANTER DEFTERİ bilgisi kontrol edilir.');
  const invRows=model.years.map(y=>el('tr',{},[el('td',{style:'font-weight:700;'},y),controlStatusCell(controlHasInventory(y),false,'Bilgi girilmiş','Bilgi girilmemiş')]));
  invCard.appendChild(controlTableShell(['Yıl','Durum'],invRows)); content.appendChild(invCard);

  const ebCard=controlCard('3. e-Beratlar','Her tespit edilen fatura ayı için Yevmiye ve Kebir e-Berat bilgileri ayrı ayrı kontrol edilir. Her kayıt için Başlangıç Dönemi ve Bitiş Dönemi açıkça MM.YYYY biçiminde ve kontrol edilen ayla aynı olmalıdır. Örn. 01.2025–12.2025 kaydı aylık kontrol için geçerli kabul edilmez. ETTN/UUID yoksa kayıt kırmızı değil, sarı uyarı olarak gösterilir.');
  const ebRows=[];
  model.months.forEach(period=>{
    const y=controlEberatRows(period,'yevmiye'), k=controlEberatRows(period,'kebir');
    const yOk=y.length>0, kOk=k.length>0, yWarn=yOk&&y.some(r=>!controlEtnt(r)), kWarn=kOk&&k.some(r=>!controlEtnt(r));
    const yDetail=y.length?y.map(r=>`${r.bas} → ${r.bit}`).join('\n'):'—';
    const kDetail=k.length?k.map(r=>`${r.bas} → ${r.bit}`).join('\n'):'—';
    ebRows.push(el('tr',{},[
      el('td',{style:'font-weight:800;'},period),
      el('td',{},[htmlControlBadge(yOk,yWarn),el('span',{style:`margin-left:7px;font-weight:700;color:${yOk?'#15803d':yWarn?'#a16207':'#b91c1c'};`},yOk?'Bilgi girilmiş':yWarn?'ETTN eksik':'Bilgi girilmemiş'),el('div',{style:'margin-top:4px;font-size:12px;color:#6b7280;white-space:pre-line;'},yDetail)]),
      el('td',{},[htmlControlBadge(kOk,kWarn),el('span',{style:`margin-left:7px;font-weight:700;color:${kOk?'#15803d':kWarn?'#a16207':'#b91c1c'};`},kOk?'Bilgi girilmiş':kWarn?'ETTN eksik':'Bilgi girilmemiş'),el('div',{style:'margin-top:4px;font-size:12px;color:#6b7280;white-space:pre-line;'},kDetail)])
    ]));
  });
  ebCard.appendChild(controlTableShell(['Dönem','e-Defter Yevmiye Defteri','e-Defter Defteri Kebir'],ebRows)); content.appendChild(ebCard);

  const beyanCard=controlCard('4. KDV Beyannameleri','Tespit edilen her fatura ayı ve onun bir önceki dönemi ayrı ayrı kontrol edilir. Parantez içindeki dönemler önceki dönem kontrolüdür.');
  const kdvRows=model.kdvPeriods.map(x=>el('tr',{},[
    el('td',{},controlPeriodBadge(x.period,x.previous)),
    controlStatusCell(controlKdv(x.period),false,'Beyan girilmiş','Beyan girilmemiş'),
    el('td',{style:'text-align:center;color:#6b7280;font-size:12px;font-weight:700;'},x.previous?'* önceki dönem':'Fatura dönemi')
  ]));
  beyanCard.appendChild(controlTableShell(['KDV Dönemi','Beyan Durumu','Kontrol Türü'],kdvRows)); content.appendChild(beyanCard);

  const muhCard=controlCard('5. Muhtasar / Çalışan','Tespit edilen fatura aylarının her biri için Muhtasar/Çalışan bilgisi kontrol edilir.');
  const muhRows=model.months.map(x=>el('tr',{},[el('td',{style:'font-weight:800;'},x),controlStatusCell(controlMuhtasar(x),false,'Bilgi girilmiş','Bilgi girilmemiş')]));
  muhCard.appendChild(controlTableShell(['Dönem','Muhtasar / Çalışan'],muhRows)); content.appendChild(muhCard);

  const summaryCard=controlCard('6. Genel Durum','Yalnızca hata ve uyarılar kısa olarak listelenir. Yeşil/tamamlanan kayıtlar burada gösterilmez.');
  const critical=[];
  const warnings=[];
  model.years.forEach(y=>{if(!controlHasInventory(y))critical.push(`${y} — Envanter Defteri bilgisi girilmemiş`);});
  model.months.forEach(p=>{
    const y=controlEberatRows(p,'yevmiye'), k=controlEberatRows(p,'kebir');
    if(!y.length) critical.push(`${p} — e-Defter Yevmiye Defteri bilgisi girilmemiş`);
    else if(y.some(r=>!controlEtnt(r))) warnings.push(`${p} — e-Defter Yevmiye Defteri ETTN eksik`);
    if(!k.length) critical.push(`${p} — e-Defter Defteri Kebir bilgisi girilmemiş`);
    else if(k.some(r=>!controlEtnt(r))) warnings.push(`${p} — e-Defter Defteri Kebir ETTN eksik`);
    if(!controlMuhtasar(p)) critical.push(`${p} — Muhtasar / Çalışan bilgisi girilmemiş`);
  });
  model.kdvPeriods.forEach(x=>{if(!controlKdv(x.period))critical.push(`${x.period}${x.previous?' — önceki dönem':''} — KDV Beyannamesi girilmemiş`);});
  if(!critical.length && !warnings.length){
    summaryCard.appendChild(el('div',{class:'hint ok'},'✓ Hata veya uyarı tespit edilmedi.'));
  }else{
    if(critical.length){
      const c=el('div',{style:'margin-bottom:10px;'});
      c.appendChild(el('div',{style:'font-weight:800;color:#b91c1c;margin-bottom:5px;'},`✕ Hatalar (${critical.length})`));
      const ul=el('ul',{style:'margin:0 0 0 20px;line-height:1.6;'});
      critical.forEach(x=>ul.appendChild(el('li',{},x))); c.appendChild(ul); summaryCard.appendChild(c);
    }
    if(warnings.length){
      const c=el('div',{});
      c.appendChild(el('div',{style:'font-weight:800;color:#a16207;margin-bottom:5px;'},`! Uyarılar (${warnings.length})`));
      const ul=el('ul',{style:'margin:0 0 0 20px;line-height:1.6;'});
      warnings.forEach(x=>ul.appendChild(el('li',{},x))); c.appendChild(ul); summaryCard.appendChild(c);
    }
  }
  content.appendChild(summaryCard);

  document.getElementById('btn-prev').disabled=true; document.getElementById('btn-next').disabled=true; document.getElementById('footer-msg').textContent='Dönem Bazlı Kontrol'; renderNav();
}
