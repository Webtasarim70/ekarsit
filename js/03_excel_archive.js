/* ============================================================
   Genel amaçlı dosya okuma: Excel / CSV / XML
   (Her tablo adımında "Dosyadan İçe Aktar" için kullanılır)
   ============================================================ */

async function readTabularFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const buf = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    let best = wb.worksheets[0];
    wb.worksheets.forEach(ws => { if (ws.rowCount > (best ? best.rowCount : 0)) best = ws; });
    const rows2D = [];
    for (let r = 1; r <= best.rowCount; r++) {
      const row = best.getRow(r);
      const arr = [];
      const colCount = Math.max(row.cellCount, 15);
      for (let c = 1; c <= colCount; c++) {
        let v = row.getCell(c).value;
        if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
        if (v instanceof Date) v = fmtDate(v);
        arr.push(v === null || v === undefined ? '' : String(v).trim());
      }
      rows2D.push(arr);
    }
    return { rows2D };
  }
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = await file.text();
    const delim = name.endsWith('.tsv') ? '\t' : ((text.split('\n')[0] || '').includes(';') ? ';' : ',');
    const rows2D = text.split(/\r?\n/).filter(l => l.trim().length)
      .map(l => l.split(delim).map(c => c.trim().replace(/^"(.*)"$/, '$1')));
    return { rows2D };
  }
  return null; // xls (eski ikili format) veya bilinmeyen tür desteklenmiyor
}

async function readXmlFlatten(file) {
  const text = await file.text();
  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('xml ayrıştırılamadı');
  } catch (e) {
    return { text, rows2D: null, error: e.message };
  }
  const lines = [];
  const repeatedGroups = {}; // tagName -> [{childTag: value, ...}, ...]  (basit tablo tespiti için)

  function walk(node, path) {
    const childEls = Array.from(node.childNodes).filter(n => n.nodeType === 1);
    if (childEls.length === 0) {
      const val = (node.textContent || '').trim();
      if (val) lines.push(`${path}: ${val}`);
      return;
    }
    // Aynı isimde birden çok kardeş eleman varsa (örn. tekrar eden satır kayıtları), tablo adayı olarak işaretle
    const nameCounts = {};
    childEls.forEach(ch => { const t = ch.localName || ch.nodeName; nameCounts[t] = (nameCounts[t] || 0) + 1; });
    Object.entries(nameCounts).forEach(([tag, count]) => {
      if (count >= 2) {
        const group = childEls.filter(ch => (ch.localName || ch.nodeName) === tag);
        const rows = group.map(g => {
          const obj = {};
          Array.from(g.childNodes).filter(n => n.nodeType === 1).forEach(leaf => {
            const lt = leaf.localName || leaf.nodeName;
            obj[lt] = (leaf.textContent || '').trim();
          });
          return obj;
        });
        if (!repeatedGroups[tag]) repeatedGroups[tag] = [];
        repeatedGroups[tag] = repeatedGroups[tag].concat(rows);
      }
    });
    childEls.forEach(ch => {
      const tag = ch.localName || ch.nodeName;
      walk(ch, path ? path + ' > ' + tag : tag);
    });
  }
  if (doc.documentElement) walk(doc.documentElement, doc.documentElement.localName || doc.documentElement.nodeName);

  // En çok satırı olan tekrar eden grubu basit bir 2D tabloya çevir (varsa)
  let rows2D = null;
  const groupEntries = Object.entries(repeatedGroups).sort((a, b) => b[1].length - a[1].length);
  if (groupEntries.length) {
    const [, rowsObj] = groupEntries[0];
    const cols = Array.from(rowsObj.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set()));
    rows2D = [cols, ...rowsObj.map(r => cols.map(c => r[c] || ''))];
  }

  return { text: lines.join('\n'), rows2D };
}

// Bir başlık satırını colDef etiketleriyle bulanık eşleştirir.
function tryMapHeaderRow(rows2D, colDef) {
  const normLabels = colDef.map(c => normalizeHeader(c.label));
  let best = { idx: -1, score: 0, colMap: {} };
  for (let r = 0; r < Math.min(rows2D.length, 6); r++) {
    const row = rows2D[r];
    const colMap = {};
    let score = 0;
    row.forEach((cell, ci) => {
      const nc = normalizeHeader(cell);
      if (!nc || nc.length < 3) return;
      const matchIdx = normLabels.findIndex((nl, li) =>
        nl && colMap[colDef[li].key] === undefined && (nl.includes(nc) || nc.includes(nl)));
      if (matchIdx !== -1) { colMap[colDef[matchIdx].key] = ci; score++; }
    });
    if (score > best.score) best = { idx: r, score, colMap };
  }
  return best;
}

function importRowsFromTable(rows2D, colDef, targetRows) {
  if (!rows2D || !rows2D.length) return { imported: 0 };
  const { idx, score, colMap } = tryMapHeaderRow(rows2D, colDef);
  if (score < 2) return { imported: 0 };
  let imported = 0;
  for (let r = idx + 1; r < rows2D.length; r++) {
    const row = rows2D[r];
    if (!row || row.every(c => c === '' || c === undefined || c === null)) continue;
    const obj = emptyRow(colDef);
    let any = false;
    colDef.forEach(c => {
      if (colMap[c.key] !== undefined) {
        const v = row[colMap[c.key]];
        obj[c.key] = v === undefined || v === null ? '' : String(v).trim();
        if (obj[c.key]) any = true;
      }
    });
    if (any) { targetRows.push(obj); imported++; }
  }
  return { imported };
}

function renderRawTablePreview(rows2D) {
  const box = el('div', { style: 'max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;margin-top:8px;' });
  const table = el('table', { class: 'editable-table' });
  (rows2D || []).slice(0, 40).forEach(r => {
    const tr = el('tr');
    r.forEach(c => tr.appendChild(el('td', { style: 'padding:4px 6px;white-space:nowrap;' }, String(c ?? ''))));
    table.appendChild(tr);
  });
  box.appendChild(table);
  return box;
}

// Herhangi bir tablo adımına eklenebilen ortak "Dosyadan İçe Aktar" bileşeni.
// PDF/XML için: ham metni gösterir + varsa specialParser çalıştırıp tek satıra yama uygular.
// Excel/CSV için: başlık satırını colDef ile eşleştirip doğrudan satır ekler; eşleşmezse ham tabloyu gösterir.
function addGenericImportButton(container, colDef, rows, opts = {}) {
  const wrap = el('div', { class: 'card', style: 'background:#fbfdfd;' });
  wrap.appendChild(el('h3', {}, '📎 Dosyadan İçe Aktar (Excel / CSV / XML / PDF)'));
  wrap.appendChild(el('div', { class: 'hint info' },
    'Elinizdeki Excel, CSV, e-berat (.xml) veya PDF dosyasını yükleyin. Sütun başlıkları otomatik eşleşirse satırlar doğrudan tabloya eklenir; eşleşmezse ham içerik gösterilir, ilgili verileri yukarıdaki tabloya elle işleyebilirsiniz.'));
  const previewHolder = el('div');
  fileUploadBox(wrap, {
    accept: '.xlsx,.xlsm,.csv,.tsv,.txt,.xml,.pdf',
    hint: 'Excel (.xlsx), CSV, e-berat/XML veya PDF dosyası',
    multiple: true,
    onFile: async (file, box) => {
      markFileChip(box, file.name);
      previewHolder.innerHTML = '';
      const name = file.name.toLowerCase();
      try {
        if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
          const { rows2D } = await readTabularFile(file);
          const res = importRowsFromTable(rows2D, colDef, rows);
          if (res.imported > 0) {
            if (opts.rerender) opts.rerender();
            previewHolder.appendChild(el('div', { class: 'hint ok' }, `✅ ${res.imported} satır otomatik eşleşen sütunlarla aktarıldı — lütfen tablodan kontrol edin.`));
          } else {
            previewHolder.appendChild(el('div', { class: 'hint warn' }, '⚠️ Sütun başlıkları otomatik eşleşmedi. Aşağıdaki ham veriye bakıp ilgili satırları tabloya elle girin.'));
            previewHolder.appendChild(renderRawTablePreview(rows2D));
          }
        } else if (name.endsWith('.xml')) {
          const { text, rows2D } = await readXmlFlatten(file);
          if (rows2D) {
            const res = importRowsFromTable(rows2D, colDef, rows);
            if (res.imported > 0) {
              if (opts.rerender) opts.rerender();
              previewHolder.appendChild(el('div', { class: 'hint ok' }, `✅ XML içindeki tekrar eden kayıtlardan ${res.imported} satır aktarıldı — lütfen kontrol edin.`));
            }
          }
          const det = el('details', { class: 'raw-details', open: '' });
          det.appendChild(el('summary', {}, 'XML içeriği (metne dönüştürülmüş — kontrol/kopyalama için)'));
          det.appendChild(el('pre', { class: 'raw-text' }, text || '(okunamadı)'));
          previewHolder.appendChild(det);
          if (opts.specialParser) {
            const patch = opts.specialParser(text || '');
            if (patch && Object.keys(patch).length && opts.onSpecialParse) opts.onSpecialParse(patch);
          }
        } else if (name.endsWith('.pdf')) {
          const text = await extractPdfText(file);
          const det = el('details', { class: 'raw-details', open: '' });
          det.appendChild(el('summary', {}, 'PDF içeriği (ham metin — kontrol/kopyalama için)'));
          det.appendChild(el('pre', { class: 'raw-text' }, text));
          previewHolder.appendChild(det);
          if (opts.specialParser) {
            const patch = opts.specialParser(text);
            if (patch && Object.keys(patch).length && opts.onSpecialParse) opts.onSpecialParse(patch);
          } else {
            previewHolder.appendChild(el('div', { class: 'hint info' }, 'ℹ️ Bu belge türü için otomatik alan okuma yapılmıyor; yukarıdaki metinden ilgili değerleri tabloya elle işleyebilirsiniz.'));
          }
        }
      } catch (err) {
        previewHolder.appendChild(el('div', { class: 'hint warn' }, '⚠️ Dosya okunamadı: ' + err.message));
      }
    }
  });
  wrap.appendChild(previewHolder);
  container.appendChild(wrap);
}

/* ============================================================
   Mevcut yıllık arşiv Excel dosyasını okuma (varsa devam ettirmek için)
   Birden fazla yıla ait "ARŞİV <yıl>" sayfası olabilir; hepsi okunup birleştirilir.
   ============================================================ */

function sheetToRows(ws) {
  const rows = [];
  const maxCol = 12;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const arr = [];
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      let v = cell.value;
      if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
      if (v instanceof Date) v = fmtDate(v);
      arr.push(v === null || v === undefined ? '' : String(v).trim());
    }
    rows.push(arr);
  }
  return rows;
}

function isBlankRow(row) {
  return row.every(c => c === '' || c === undefined || c === null);
}

function findRowIndex(rows, matcher, from = 0) {
  for (let i = from; i < rows.length; i++) {
    if (matcher(rows[i])) return i;
  }
  return -1;
}

function readSimpleTable(rows, headerIdx, colDef) {
  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    if (isBlankRow(rows[i])) break;
    const r = rows[i];
    const obj = {};
    colDef.forEach((c, ci) => obj[c.key] = r[ci + 1] || '');
    out.push(obj);
  }
  return out;
}

function normalizeDefterNevi(value){
  const raw=String(value??'').trim();
  if(!raw) return '';
  const u=raw.toLocaleUpperCase('tr-TR').replace(/\s+/g,'_').replaceAll('I','İ');
  if(u==='ENVANTER_DEFTERİ' || u==='E_DEFTER_ENVANTER_DEFTERİ') return 'ENVANTER DEFTERİ';
  if(u==='YEVMİYE_DEFTERİ' || u==='E_DEFTER_YEVMİYE_DEFTERİ') return 'YEVMİYE_DEFTERİ';
  if(u==='DEFTERİ_KEBİR' || u==='E_DEFTER_DEFTERİ_KEBİR') return 'DEFTERİ_KEBİR';
  return raw;
}

function parseArchiveSheet(ws) {
  const rows = sheetToRows(ws);
  const result = {
    mukellef: { unvan: '', vkn: '', vergiDairesi: '', adres: '', telefon: '' },
    ortaklar: [], defterler: [], faturalar: [], isciler: [], kdvBeyanlari: [],
    imalatcilar: [], tedarikciler: []
  };

  const unvanIdx = findRowIndex(rows, r => r[1] === 'ADI VE SOYADI / ÜNVANI');
  if (unvanIdx !== -1) {
    result.mukellef.unvan = rows[unvanIdx][2] || '';
    for (let i = unvanIdx + 1; i < unvanIdx + 5; i++) {
      const label = rows[i] && rows[i][1];
      if (label === 'VERGI/T.C. KIMLIK NUMARASI' || label === 'VERGİ/T.C. KİMLİK NUMARASI') result.mukellef.vkn = rows[i][2] || '';
      if (label === 'VERGI DAIRESI' || label === 'VERGİ DAİRESİ') result.mukellef.vergiDairesi = rows[i][2] || '';
      if (label === 'ADRES') result.mukellef.adres = rows[i][2] || '';
      if (label === 'TELEFON NUMARASI') result.mukellef.telefon = rows[i][2] || '';
    }
  }

  const ortakSecIdx = findRowIndex(rows, r => r[1] === 'Ortak Bilgileri');
  if (ortakSecIdx !== -1) result.ortaklar = readSimpleTable(rows, ortakSecIdx + 1, COLS.ortak);

  const defterSecIdx = findRowIndex(rows, r => r[1] === 'Defter Bilgileri');
  if (defterSecIdx !== -1) result.defterler = readSimpleTable(rows, defterSecIdx + 1, COLS.defter).map(d => ({ ...d, nevi: normalizeDefterNevi(d.nevi) }));

  const faturaHeaderIdx = findRowIndex(rows, r => r[1] === 'Faturanın Tarihi');
  if (faturaHeaderIdx !== -1) result.faturalar = readSimpleTable(rows, faturaHeaderIdx, COLS.fatura);

  const isciSecIdx = findRowIndex(rows, r => r[1] === 'İŞCİ SAYILARI' || r[1] === 'İŞÇİ SAYILARI');
  if (isciSecIdx !== -1) result.isciler = readSimpleTable(rows, isciSecIdx + 1, COLS.isci);

  const kdvSecIdx = findRowIndex(rows, r => r[1] === 'KDV BEYANNAMESİ BİLGİLERİ');
  if (kdvSecIdx !== -1) result.kdvBeyanlari = readSimpleTable(rows, kdvSecIdx + 1, COLS.kdv);

  const imalatciSecIdx = findRowIndex(rows, r => r[1] === 'İMALATÇI FİRMA BİLGİLERİ');
  if (imalatciSecIdx !== -1) result.imalatcilar = readSimpleTable(rows, imalatciSecIdx + 1, COLS.imalatci);

  const tedarikciSecIdx = findRowIndex(rows, r => /TEDARİK[ÇC]İ FİRMA BİLGİLERİ/i.test(r[1] || ''));
  if (tedarikciSecIdx !== -1) {
    let donem = null;
    for (let i = tedarikciSecIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (isBlankRow(r)) continue;
      const monthMatch = (r[0] || '').match(/^(\d{1,2})\s*\/\s*(\d{4})/);
      if (monthMatch) { donem = fmtDonem(parseInt(monthMatch[1], 10), parseInt(monthMatch[2], 10)); continue; }
      if (r[1] === 'Adı Soyadı/Ünvanı' || r[1] === 'Adı Soyadı / Ünvanı') continue;
      if (!r[1]) continue;
      result.tedarikciler.push({
        donem: donem || '',
        adSoyad: r[1] || '', vkn: r[2] || '', vergiDairesi: r[3] || '',
        faturaTarihi: r[4] || '', faturaSeri: r[5] || '', faturaNo: r[6] || '',
        kdvDahilTutar: r[7] || ''
      });
    }
  }

  return result;
}

function dedupArraysByKey(combined) {
  const dedupe = (arr, keyFn) => {
    const seen = new Set();
    return arr.filter(x => { const k = keyFn(x); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  combined.ortaklar = dedupe(combined.ortaklar, x => (x.adSoyad || '') + '|' + (x.vkn || ''));
  combined.defterler = dedupe(combined.defterler, x => (x.nevi || '') + '|' + (x.baslangic || '') + '|' + (x.bitis || ''));
  combined.imalatcilar = dedupe(combined.imalatcilar, x => (x.adSoyad || '') + '|' + (x.vkn || '') + '|' + (x.belgeNo || ''));
  combined.faturalar = dedupe(combined.faturalar, x => (x.tarih || '') + '|' + (x.no || ''));
  combined.isciler = dedupe(combined.isciler, x => x.donem);
  combined.kdvBeyanlari = dedupe(combined.kdvBeyanlari, x => x.donem);
  combined.tedarikciler = dedupe(combined.tedarikciler, x => (x.donem || '') + '|' + (x.faturaNo || '') + '|' + (x.adSoyad || ''));
}

function parseArchiveWorkbook(workbook) {
  const sheets = workbook.worksheets.filter(s => /ARŞİV|ARSIV/i.test(s.name));
  const targets = sheets.length ? sheets : (workbook.worksheets[0] ? [workbook.worksheets[0]] : []);
  const combined = {
    mukellef: { unvan: '', vkn: '', vergiDairesi: '', adres: '', telefon: '' },
    ortaklar: [], defterler: [], faturalar: [], isciler: [], kdvBeyanlari: [],
    imalatcilar: [], tedarikciler: []
  };
  targets.forEach(ws => {
    const part = parseArchiveSheet(ws);
    if (part.mukellef.unvan && !combined.mukellef.unvan) combined.mukellef = part.mukellef;
    combined.ortaklar.push(...part.ortaklar);
    combined.defterler.push(...part.defterler);
    combined.faturalar.push(...part.faturalar);
    combined.isciler.push(...part.isciler);
    combined.kdvBeyanlari.push(...part.kdvBeyanlari);
    combined.imalatcilar.push(...part.imalatcilar);
    combined.tedarikciler.push(...part.tedarikciler);
  });
  dedupArraysByKey(combined);
  return combined;
}

/* ============================================================
   Birleştirme (mevcut arşiv + bu çalıştırmadaki veriler)
   ============================================================ */

function upsertByKey(list, newItem, keyFn) {
  const k = keyFn(newItem);
  const idx = list.findIndex(x => keyFn(x) === k);
  if (idx !== -1) list[idx] = { ...list[idx], ...newItem };
  else list.push(newItem);
}

function mergeArchive(existing, current) {
  const merged = existing ? JSON.parse(JSON.stringify(existing)) : {
    mukellef: { unvan: '', vkn: '', vergiDairesi: '', adres: '', telefon: '' },
    ortaklar: [], defterler: [], faturalar: [], isciler: [], kdvBeyanlari: [],
    imalatcilar: [], tedarikciler: []
  };

  if (current.meta.cUnvan) {
    merged.mukellef = {
      unvan: current.meta.cUnvan || merged.mukellef.unvan,
      vkn: current.meta.cVkn || merged.mukellef.vkn,
      vergiDairesi: current.meta.cVergiDairesi || merged.mukellef.vergiDairesi,
      adres: current.meta.cAdres || merged.mukellef.adres,
      telefon: current.meta.cTelefon || merged.mukellef.telefon
    };
  }

  current.ortaklar.forEach(o => {
    if (!o.adSoyad && !o.vkn) return;
    upsertByKey(merged.ortaklar, o, x => (x.adSoyad || '') + '|' + (x.vkn || ''));
  });

  current.defterler.forEach(d => {
    if (!d.nevi) return;
    const normalized = { ...d, nevi: normalizeDefterNevi(d.nevi) };
    upsertByKey(merged.defterler, normalized, x => (x.nevi || '') + '|' + (x.baslangic || '') + '|' + (x.bitis || ''));
  });

  current.faturalar.forEach(f => {
    if (!f.no && !f.tarih) return;
    upsertByKey(merged.faturalar, f, x => (x.tarih || '') + '|' + (x.no || ''));
  });

  current.isciler.forEach(i => {
    if (!i.donem) return;
    upsertByKey(merged.isciler, i, x => x.donem);
  });
  merged.isciler.sort((a, b) => donemCompare(a.donem || '01.1900', b.donem || '01.1900'));

  current.kdvBeyanlari.forEach(k => {
    if (!k.donem) return;
    upsertByKey(merged.kdvBeyanlari, k, x => x.donem);
  });
  merged.kdvBeyanlari.sort((a, b) => donemCompare(a.donem || '01.1900', b.donem || '01.1900'));

  current.imalatcilar.forEach(m => {
    if (!m.adSoyad) return;
    upsertByKey(merged.imalatcilar, m, x => (x.adSoyad || '') + '|' + (x.vkn || '') + '|' + (x.belgeNo || ''));
  });

  current.tedarikciler.forEach(t => {
    if (!t.adSoyad && !t.faturaNo) return;
    const donem = (t.donem || '').trim() || donemFromFaturaTarihi(t.faturaTarihi);
    const item = { ...t, donem };
    const exists = merged.tedarikciler.some(x =>
      x.donem === item.donem && (x.faturaNo || '') === (item.faturaNo || '') && (x.adSoyad || '') === (item.adSoyad || ''));
    if (!exists) merged.tedarikciler.push(item);
  });

  return merged;
}


/* --- Kullanıcı tarafından sağlanan gerçek 7 Excel şablonu: çıktı formatları bunlardan türetilir. --- */
const OUTPUT_XLSX_TEMPLATES = {"fatura": "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", "imalatci": "UEsDBC0ACAAIAAAAAAAAAAAAAAAAAAAAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLVTy27CMBD8lcjXKjb0UFUVgUMfxxap9ANce5NY+CWvofD3XQc4lFKJCnHyY2ZnZlf2ZLZxtlpDQhN8w8Z8xCrwKmjju4Z9LF7qe1Zhll5LGzw0bAvIZtPJYhsBK6r12LA+5/ggBKoenEQeInhC2pCczHRMnYhSLWUH4nY0uhMq+Aw+17losOnkCVq5srl63N0X6YbJGK1RMlMssfb6SLTeC/IEduBgbyLeEIFVzxtS2bVDKDJxhsNxYTlT3RsNJhkN/4oW2tYo0EGtHJVwKKoadB0TEVM2sM85lym/SkeCgshzQlGQNL/E+zAWFRKcZViIFzkedYsxgdTYA2RnOfYygX7PiV7T7xAbK34Qrpgjb+2JKZQAA3LNCdDKnTT+lPtXSMvPEJbX8y8Ow/4v+wFEMSzjQw4xfO/pN1BLBwiRLCi8OwEAAAAAAAAdBAAAAAAAAFBLAwQtAAgACAAAAAAAAAAAAAAAAAAAAAAACwAAAF9yZWxzLy5yZWxzrZLBSgMxEIZfJcy9m20FEWnaiwi9idQHGJPZ3bCbTEhG3b69wYu2bEHB4zAz3/8xyXY/h0m9Uy6eo4F104KiaNn52Bt4OT6u7kAVwehw4kgGTlRgv9s+04RSV8rgU1GVEYuBQSTda13sQAFLw4li7XScA0otc68T2hF70pu2vdX5JwPOmergDOSDW4M6Yu5JDMyT/uA8vjKPTcXWxinRb0K567ylB7ZvgaIsZF9MgF522Xy7OLZPmesmpvTfMjQLRUdulWoCZfH14leMbhaMLGf6m9L1R9GBBB0KflEvhPTZH9h9AlBLBwhuMghL5QAAAAAAAABKAgAAAAAAAFBLAwQtAAgACAAAAAAAAAAAAAAAAAAAAAAAEAAAAGRvY1Byb3BzL2FwcC54bWxNjsEKwjAQRO9+Rci93epBRNKUggie7EE/IKTbNtBsQrJKP9+c1OPMMI+nus2v4o0pu0Ct3NeNFEg2jI7mVj4f1+okO71TQwoREzvMohwot3JhjmeAbBf0JtdlprJMIXnDJaYZwjQ5i5dgXx6J4dA0R8CNkUYcq/gFSq36GFdnDRcH3UdTkGK43xT89wp+DvoDUEsHCOF8d9iRAAAAAAAAALcAAAAAAAAAUEsDBC0ACAAIAAAAAAAAAAAAAAAAAAAAAAARAAAAZG9jUHJvcHMvY29yZS54bWxtkN1KxDAQRl+l5L6dpoVVQ9tFlAVBccGK4l1IxrbY/JBEu/v2pnWtoN4l+c4cJl+1Pagx+UDnB6NrQrOcJKiFkYPuavLY7tJzkvjAteSj0ViTI3qybSphmTAO985YdGFAn0SP9kzYmvQhWAbgRY+K+ywSOoavxike4tV1YLl44x1CkecbUBi45IHDLEztaiQnpRSr0r67cRFIATiiQh080IzCDxvQKf/vwJKs5MEPKzVNUzaVCxc3ovB8d/uwLJ8Oev67QNJUJzUTDnlAmUQBC0cbK/lOnsqr63ZHmiIvNml+kRa0pSWjZ6woXyr4NT8Lv87GNZexkB6T/f3NzK3PFfypufkEUEsHCLzZRFYGAQAAAAAAALEBAAAAAAAAUEsDBC0ACAAIAAAAAAAAAAAAAAAAAAAAAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWw9jEEOwiAQAO++guzdLnowxpT2YOIL9AGEroWkLJQF4/Pl5HEykxnnb9zUh4qExAZOgwZF7NISeDXwej6OV5inwyhSlUuNq4FeNA57o/uf+4PFgK813xDFeYpWhpSJu3mnEm3tWFaUXMgu4olq3PCs9QWjDQw4/QBQSwcIcL/YJngAAAAAAAAAiQAAAAAAAABQSwMELQAIAAgAAAAAAAAAAAAAAAAAAAAAAA0AAAB4bC9zdHlsZXMueG1s7VhLc9owEL73V2h0b4yBpKRjnGkzQ6eXXpLO9CpsGTTRwyOLFPLrqwcGg+1EJiR1Z3rB8nr307cPr9ZEN2tGwSOWBRF8CsOLAQSYJyIlfDGFP+9nHyfwJv4QFWpD8d0SYwW0AS+mcKlU/jkIimSJGSouRI65fpIJyZDSt3IRFLnEKC2MEaPBcDC4ChgiHMYRX7EZUwVIxIqrKRzAII4ywfeSa+gEcVQ8gUdENTNDTaslggoJCE/xGqdTODEyjhh2WreIkrkkFg8xQjdOPDQCy3SrxwgX0ggDt4v7bcTZERg7AnN3q+QKdwQIGwGOHAonZ0H9D3AKAHk2NcNRBdVeCo1OKN2V7RV0gjjKkVJY8pm+Adv1/SbHU8gF35Kzei9op0g+fJNo429h8bXW4vaIvH0HgoqdL2IhKEnPC9lGchSeneQzkPaiUzgXMtUNsExieAlLWRxRnCltL8liaa5K5KbOhFKC6UVK0EJwRM0OpcX+apSAbZy6pJYkeYC+es1tLnCqDRiWXgWCN+5U12rZxyo2AJhgHO9yftAWe6PX++10fbyYhvdl0KKt1XpNrfZW9D2WDYS7vsWePjfU2KnRCs6N1tiIum+xXejenGBK74zWr2zfoHVk1xlwQ+T31MyPwJzG5VJ39e3Swbgbg19Fc9hV2MlJuGCd7TZosw5brId7a4DynG5mwjCx84cTfLW6B6IvlCw4wzvFOEKlBCyFJE8aw0wxiRZgCc1wr0hSlfyWKL/H6xLARGadHbEfXzc6P6rSDwfH/D3oOumPFZtjObNfCwcPzAl9qmNdHBm8nSNvyrvXCXhNZfUpIX5+9DY/tgt711lfstHGunNRDf9ONmod/G3KrnKsjPaOXh44On7xXGl2s+bNQYDa/DGDgG+1VdiPW9jXstRH8pdtNfa+oe92pHjMM3X+BzyemXH8EZsD0Orv0UtR8VUPlic7Wquyd2V15R0sz/J5XbV0bTyf/m36k9OK39Mj/yqpN6KSebD9NtGr/T/v8R9QSwcIIA5v2vkCAAAAAAAArRcAAAAAAABQSwMELQAIAAgAAAAAAAAAAAAAAAAAAAAAAA8AAAB4bC93b3JrYm9vay54bWyNjk1PwzAMhu/8ish3lnRDCKqmu6BJu3EYu2epu0bLR2WHjZ9P2qnAkZP1yo8fv832K3hxRWKXooZqpUBgtKlz8azh47B7fIFt+9DcEl1OKV1EwSNrGHIeaynZDhgMr9KIsWz6RMHkEukseSQ0HQ+IOXi5VupZBuMi3A01/ceR+t5ZfEv2M2DMdwmhN7mU5cGNDO1Ps3cSnclYvaonDb3xjCDbZtocHd74F5yiMDa7Kx7MSYOaOPkHnDsvU0QTUMMRyXkkEFS7TgPtuw2IGdiXWM2K5U4un9pvUEsHCLzWpXLZAAAAAAAAAF4BAAAAAAAAUEsDBC0ACAAIAAAAAAAAAAAAAAAAAAAAAAAaAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHOtkU1rwzAMQP+K0X1x0sEYo24vY9BrP36AsJU4NLGNpbXLv6+7w9ZABzv0JIzwew+0XH+NgzpR5j4GA01Vg6Jgo+tDZ+Cw/3h6BcWCweEQAxmYiGG9Wm5pQClf2PeJVWEENuBF0pvWbD2NyFVMFMqmjXlEKc/c6YT2iB3pRV2/6HzLgDlTbZyBvHENqD3mjsQAe8zkdpJLGlcFXFZTov9oY9v2lt6j/RwpyB27nsFB349Z3MTINNDjK76pf+mff/XnmI/sieRaXkbz6JIfwTVGz669ugBQSwcIZ+uiqNUAAAAAAAAANAIAAAAAAABQSwMELQAIAAgAAAAAAAAAAAAAAAAAAAAAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWyVlk1vmzAYgO/7FRaTdhsmQD7ahlSkTbKoH5tK1mmnygUnWAE7MqZp/8u0Hnfuvbdk/2svhCabRqC9gJ34eV+/fiyb7vF9HKE7KhMmuKM1dENDlPsiYHzmaF8nw48d7bj3rrsUcp6ElCoE43niaKFSi0OMEz+kMUl0saAc/pkKGRMFXTnDyUJSEuRQHGHTMFo4JoxrvW7AYsqzhEjSqaO5jcORpeFeNx97zegy+auNstS3QsyzzjhwNJihIrcejaivKPSVTGlG4//wYT6bLxIFdErSSF2J5SfKZqGCQptQKUC+iJL8iWKW1a+hmNzn7yULVOholpEtiZ8mSsTfNj+9JNxSZkGZW6rRqqesgrK2lGnXU3ZB2W/K1Syo5pvqahVUa0eZ9VS7oNq7uvbnwhsBua5ToghsNSmWSGYKoO1nLRdswI7rgHdHYzxinHpKwj5iQKqeG6yfkCceCLzx6ge/I3z91MUKgmcDsN/bhOlXh7mmcsbwRD/R0RmLIzZHl2lMJElKg51UB+uT9WME0+qnUcqDdP2YIo9w8sDQ52BPxNOaiDSaUTQhkoWshB68hq4qaPiq9KtnuXouoUc1ila/1k/ziMTkXxaD651xc2fczMNZe8J5JEYXZM44+fD+PjiCBzmC5dUnzNfPVaB7qmyJ+tVB27ZpWOaB0THKdG/Y5h72zL1yL9zLMqvVSRuWbrR0OBubZU6r2aZtd9plkx3WrJ576X4f33jjk/H5TX9wPhp44zKl1SVXibR2Iq08iFkrEr34Q5lA9PtnucLqcNUKN6z9doXVSU04fg9AoWmXKaxmGxbutDtlCqu50/FocFXmrKZGsiAJUxRJshAyLVWId0dxd0Fm9ILAscgTdCsUnN5w++pt2BJTIRSVWQ8yhnDNbzsRnap8lIbk5qrN20osCjY79LdfE70/UEsHCHGqrN25AgAAAAAAAIAIAAAAAAAAUEsBAi0AFAAIAAgAAAAAAJEsKLw7AQAAHQQAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECLQAUAAgACAAAAAAAbjIIS+UAAABKAgAACwAAAAAAAAAAAAAAAACEAQAAX3JlbHMvLnJlbHNQSwECLQAUAAgACAAAAAAA4Xx32JEAAAC3AAAAEAAAAAAAAAAAAAAAAACqAgAAZG9jUHJvcHMvYXBwLnhtbFBLAQItABQACAAIAAAAAAC82URWBgEAALEBAAARAAAAAAAAAAAAAAAAAIEDAABkb2NQcm9wcy9jb3JlLnhtbFBLAQItABQACAAIAAAAAABwv9gmeAAAAIkAAAAUAAAAAAAAAAAAAAAAAM4EAAB4bC9zaGFyZWRTdHJpbmdzLnhtbFBLAQItABQACAAIAAAAAAAgDm/a+QIAAK0XAAANAAAAAAAAAAAAAAAAAJAFAAB4bC9zdHlsZXMueG1sUEsBAi0AFAAIAAgAAAAAALzWpXLZAAAAXgEAAA8AAAAAAAAAAAAAAAAAzAgAAHhsL3dvcmtib29rLnhtbFBLAQItABQACAAIAAAAAABn66Ko1QAAADQCAAAaAAAAAAAAAAAAAAAAAOoJAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc1BLAQItABQACAAIAAAAAABxqqzduQIAAIAIAAAYAAAAAAAAAAAAAAAAAA8LAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwUGAAAAAAkACQA/AgAAFg4AAAAA", "tedarikci": "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", "kdv": "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", "isci": "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", "ortak": "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", "defter": "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"};

function outputTemplateBytes(base64){
  const bin=atob(base64); const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return bytes;
}
function copyExcelCellStyle(src,dst){
  if(!src || !dst) return;
  dst.font=src.font ? JSON.parse(JSON.stringify(src.font)) : undefined;
  dst.fill=src.fill ? JSON.parse(JSON.stringify(src.fill)) : undefined;
  dst.border=src.border ? JSON.parse(JSON.stringify(src.border)) : undefined;
  dst.alignment=src.alignment ? JSON.parse(JSON.stringify(src.alignment)) : undefined;
  dst.protection=src.protection ? JSON.parse(JSON.stringify(src.protection)) : undefined;
  dst.numFmt=src.numFmt;
}
async function buildOutputWorkbookFromRealTemplate(templateKey,cols,rows){
  /*
    ÖNEMLİ:
    Gerçek Excel şablonu artık çıktı çalışma kitabının kendisi olarak
    değiştirilmez. Şablon sadece biçim/başlık/yardımcı sayfa kaynağıdır.
    Böylece örnek satırlar, gizli satır yapıları veya şablonun iç XML'i
    çıktı dosyasına veri olarak taşınmaz ve Excel'in "dosyada onarım yapıldı"
    uyarısına yol açabilecek spliceRows/addRow işlemleri yapılmaz.
  */
  const sourceWb=new ExcelJS.Workbook();
  await sourceWb.xlsx.load(outputTemplateBytes(OUTPUT_XLSX_TEMPLATES[templateKey]));
  const sourceWs=sourceWb.worksheets[0];

  const outWb=new ExcelJS.Workbook();
  outWb.creator='KDV Karşıt İnceleme Arşiv Sihirbazı';
  outWb.created=new Date();

  function cloneStyle(src,dst){
    if(!src || !dst) return;
    if(src.font) dst.font=JSON.parse(JSON.stringify(src.font));
    if(src.fill) dst.fill=JSON.parse(JSON.stringify(src.fill));
    if(src.border) dst.border=JSON.parse(JSON.stringify(src.border));
    if(src.alignment) dst.alignment=JSON.parse(JSON.stringify(src.alignment));
    if(src.protection) dst.protection=JSON.parse(JSON.stringify(src.protection));
    if(src.numFmt) dst.numFmt=src.numFmt;
  }

  function copySheetLayout(src,dst,maxCol){
    for(let c=1;c<=maxCol;c++){
      const sc=src.getColumn(c), dc=dst.getColumn(c);
      if(sc.width!=null) dc.width=sc.width;
      if(sc.hidden!=null) dc.hidden=sc.hidden;
      if(sc.outlineLevel!=null) dc.outlineLevel=sc.outlineLevel;
    }
    if(src.views) dst.views=JSON.parse(JSON.stringify(src.views));
    if(src.pageSetup) dst.pageSetup=JSON.parse(JSON.stringify(src.pageSetup));
    if(src.pageMargins) dst.pageMargins=JSON.parse(JSON.stringify(src.pageMargins));
    if(src.printOptions) dst.printOptions=JSON.parse(JSON.stringify(src.printOptions));
    if(src.properties) {
      if(src.properties.defaultRowHeight!=null) dst.properties.defaultRowHeight=src.properties.defaultRowHeight;
      if(src.properties.defaultColWidth!=null) dst.properties.defaultColWidth=src.properties.defaultColWidth;
    }
  }

  // 1) Ana "Veriler" sayfasını sıfırdan oluştur.
  const ws=outWb.addWorksheet(sourceWs.name || 'Veriler');
  const maxCols=Math.max(sourceWs.columnCount,cols.length);

  copySheetLayout(sourceWs,ws,maxCols);

  // Başlık: şablondaki gerçek başlıklar aynen korunur.
  const srcHeader=sourceWs.getRow(1);
  const dstHeader=ws.getRow(1);
  dstHeader.height=srcHeader.height;
  for(let c=1;c<=maxCols;c++){
    const sc=srcHeader.getCell(c), dc=dstHeader.getCell(c);
    dc.value=sc.value ?? (cols[c-1]?.label ?? '');
    cloneStyle(sc,dc);
  }

  // Veri satırı için şablondaki 2. satırın yalnızca biçimini kullan.
  const srcDataRow=sourceWs.getRow(2);
  const toExcelNumber=(value)=>{
    if(value===null || value===undefined || value==='') return null;
    if(typeof value==='number' && Number.isFinite(value)) return value;
    let raw=String(value).trim().replace(/₺/g,'').replace(/\s/g,'');
    if(!raw) return null;
    if(raw.includes(',') && raw.includes('.')) raw=raw.replace(/\./g,'').replace(',','.');
    else if(raw.includes(',')) raw=raw.replace(',','.');
    const n=Number(raw);
    return Number.isFinite(n)?n:null;
  };

  (rows||[]).forEach((item,idx)=>{
    const r=ws.getRow(idx+2);
    if(srcDataRow.height!=null) r.height=srcDataRow.height;

    for(let c=1;c<=maxCols;c++){
      const sc=srcDataRow.getCell(c);
      const dc=r.getCell(c);
      cloneStyle(sc,dc);
      dc.value=null;
    }

    cols.forEach((col,i)=>{
      const cell=r.getCell(i+1);
      let value=item[col.key] ?? '';
      if(templateKey==='fatura' && (col.key==='tutar' || col.key==='kdv')){
        const num=toExcelNumber(value);
        value=(num===null?'':num);
        if(typeof value==='number'){
          // Gerçek Excel sayısı + şablonun sayı biçimi.
          if(!cell.numFmt) cell.numFmt='#,##0.00';
        }
      }
      cell.value=value;
    });
  });

  /*
    Fatura örnek dosyasındaki "Ödeme Şekli Referans" yardımcı sayfası
    veri kaynağı değil, gerçek referans sayfasıdır. Bu nedenle sadece bu
    sayfa aynen kopyalanır; örnek fatura kayıtları hiçbir şekilde kopyalanmaz.
  */
  if(templateKey==='fatura' && sourceWb.worksheets.length>1){
    for(let si=1;si<sourceWb.worksheets.length;si++){
      const src=sourceWb.worksheets[si];
      const dst=outWb.addWorksheet(src.name);
      const mc=Math.max(src.columnCount,1);
      copySheetLayout(src,dst,mc);

      for(let r=1;r<=src.rowCount;r++){
        const sr=src.getRow(r), dr=dst.getRow(r);
        if(sr.height!=null) dr.height=sr.height;
        for(let c=1;c<=mc;c++){
          const sc=sr.getCell(c), dc=dr.getCell(c);
          dc.value=sc.value;
          cloneStyle(sc,dc);
        }
      }

      if(src.mergedCells){
        src.mergedCells.forEach(range=>{
          try{ dst.mergeCells(range); }catch(e){}
        });
      }
    }
  }

  return outWb;
}

