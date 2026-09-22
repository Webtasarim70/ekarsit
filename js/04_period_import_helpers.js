/* ============================================================
   Excel üretimi (ExcelJS)
   ============================================================ */

function styleHeaderRow(row) {
  row.eachCell(cell => {
    cell.font = { bold: true, size: 10.5, color: { argb: 'FF0E4A5C' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EDEE' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5D8' } } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 24;
}

function styleSectionTitle(row) {
  row.eachCell(cell => {
    cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF155E75' } };
  });
  row.height = 22;
}

function addTableSheet(wb, sheetName, colDef, rows, title) {
  const ws = wb.addWorksheet(sheetName);
  ws.columns = colDef.map(c => ({ width: Math.max(12, c.w / 7) }));
  let r = 1;
  if (title) {
    const tRow = ws.getRow(r);
    tRow.getCell(1).value = title;
    styleSectionTitle(tRow);
    ws.mergeCells(r, 1, r, colDef.length);
    r += 2;
  }
  const headerRow = ws.getRow(r);
  colDef.forEach((c, i) => headerRow.getCell(i + 1).value = c.label);
  styleHeaderRow(headerRow);
  r += 1;
  rows.forEach(row => {
    const dr = ws.getRow(r);
    colDef.forEach((c, i) => dr.getCell(i + 1).value = row[c.key] ?? '');
    r += 1;
  });
  ws.views = [{ state: 'frozen', ySplit: title ? 3 : 1 }];
  return ws;
}

function buildResultWorkbook(s) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KDV Karşıt İnceleme Arşiv Sihirbazı';
  wb.created = new Date();

  const info = wb.addWorksheet('1-BİLGİ');
  info.columns = [{ width: 42 }, { width: 60 }];
  const infoRows = [
    ['TUTANAK SAYI', s.meta.tutanakSayi], ['TUTANAK TARİHİ', s.meta.tutanakTarih],
    ['TESPİT EDİLEN FATURA DÖNEMLERİ', s.donemler.join(', ') || '—'],
    ['KDV İÇİN GEREKEN DÖNEMLER', s.kdvDonemleri.join(', ') || '—'], ['', ''],
    ['A) KARŞIT İNCELEMEYİ YAPAN YMM', ''],
    ['Adı Soyadı', s.meta.ymmAdSoyad], ['Vergi/T.C. Kimlik No', s.meta.ymmVkn],
    ['Vergi Dairesi', s.meta.ymmVergiDairesi], ['Mühür No', s.meta.ymmMuhur],
    ['Sicil No', s.meta.ymmSicil], ['Bağlı Olduğu Oda', s.meta.ymmOda],
    ['Adres', s.meta.ymmAdres], ['Telefon', s.meta.ymmTelefon],
    ['YMM Şirket VKN/Ünvan', `${s.meta.ymmSirketVkn} / ${s.meta.ymmSirketUnvan}`], ['', ''],
    ['B) TASDİK HİZMETİ VERİLEN MÜKELLEF', ''],
    ['Ünvan', s.meta.tasdikMukellefUnvan], ['Vergi/T.C. Kimlik No', s.meta.tasdikMukellefVkn],
    ['Vergi Dairesi', s.meta.tasdikMukellefVergiDairesi], ['Adres', s.meta.tasdikMukellefAdres],
    ['Telefon', s.meta.tasdikMukellefTelefon], ['', ''],
    ['Sözleşme Başlangıç Dönemi', s.meta.sozBaslangic], ['Sözleşme Bitiş Dönemi', s.meta.sozBitis],
    ['Sözleşme Tarihi', s.meta.sozTarihi], ['Sözleşme Seri-Sıra No', s.meta.sozSeriSira],
    ['Sisteme Giriş Tarihi', s.meta.sozSistemeGiris], ['', ''],
    ['Ç) NEZDİNDE KARŞIT İNCELEME YAPILAN MÜKELLEF (Bu tutanağın konusu)', ''],
    ['Ünvan', s.meta.cUnvan], ['Vergi/T.C. Kimlik No', s.meta.cVkn],
    ['Vergi Dairesi', s.meta.cVergiDairesi], ['Adres', s.meta.cAdres], ['Telefon', s.meta.cTelefon]
  ];
  infoRows.forEach(([a, b]) => {
    const row = info.addRow([a, b]);
    if (b === '' && a && a === a.toUpperCase() && a.length > 3 && !a.includes(':')) styleSectionTitle(row);
    else row.getCell(1).font = { bold: true, size: 10.5 };
  });

  addTableSheet(wb, '3-ORTAK', COLS.ortak, s.ortaklar);
  addTableSheet(wb, '4-DEFTER', COLS.defter, s.defterler);
  addTableSheet(wb, '5- SATIŞ FATURA', COLS.fatura, s.faturalar);
  addTableSheet(wb, '6-İŞCİ', COLS.isci, s.isciler);
  addTableSheet(wb, '7-KDV', COLS.kdv, s.kdvBeyanlari);
  addTableSheet(wb, '8-İMALATCI-BİLGİLERİ', COLS.imalatci, s.imalatcilar);
  addTableSheet(wb, '9-TEDARİK_EDİLDİĞİ_FİRMA', COLS.tedarikci, s.tedarikciler);

  return wb;
}

function getAllArchiveYears(merged) {
  const years = new Set();
  merged.isciler.forEach(i => { const y = extractYearFromDonem(i.donem); if (y) years.add(y); });
  merged.kdvBeyanlari.forEach(k => { const y = extractYearFromDonem(k.donem); if (y) years.add(y); });
  merged.tedarikciler.forEach(t => { const y = extractYearFromDonem(t.donem) || extractYearFromTarih(t.faturaTarihi); if (y) years.add(y); });
  merged.defterler.forEach(d => { const y = extractYearFromDonem(d.baslangic); if (y) years.add(y); });
  merged.faturalar.forEach(f => { const y = extractYearFromTarih(f.tarih); if (y) years.add(y); });
  return Array.from(years).sort((a, b) => a - b);
}

function buildArchiveWorkbook(merged) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KDV Karşıt İnceleme Arşiv Sihirbazı';
  wb.created = new Date();

  const years = getAllArchiveYears(merged);
  const finalYears = years.length ? years : [new Date().getFullYear()];

  finalYears.forEach(yil => {
    const ws = wb.addWorksheet(`ARŞİV ${yil}`);
    ws.columns = [{ width: 8 }].concat(Array(11).fill({ width: 22 }));
    let r = 3;
    const put = (label, value) => {
      const row = ws.getRow(r);
      row.getCell(2).value = label;
      row.getCell(3).value = value;
      row.getCell(2).font = { bold: true };
      r++;
    };
    put('ADI VE SOYADI / ÜNVANI', merged.mukellef.unvan);
    put('VERGI/T.C. KIMLIK NUMARASI', merged.mukellef.vkn);
    put('VERGI DAIRESI', merged.mukellef.vergiDairesi);
    put('ADRES', merged.mukellef.adres);
    put('TELEFON NUMARASI', merged.mukellef.telefon);
    r += 2;

    function sectionTitle(text) {
      const row = ws.getRow(r);
      row.getCell(2).value = text;
      styleSectionTitle(row);
      r++;
    }
    function headerRowFn(colDef) {
      const row = ws.getRow(r);
      colDef.forEach((c, i) => row.getCell(i + 2).value = c.label);
      styleHeaderRow(row);
      r++;
    }
    function dataRows(colDef, rows) {
      rows.forEach(item => {
        const row = ws.getRow(r);
        colDef.forEach((c, i) => row.getCell(i + 2).value = item[c.key] ?? '');
        r++;
      });
    }

    sectionTitle('Ortak Bilgileri');
    headerRowFn(COLS.ortak);
    dataRows(COLS.ortak, merged.ortaklar);
    r += 2;

    sectionTitle('Defter Bilgileri');
    headerRowFn(COLS.defter);
    dataRows(COLS.defter, merged.defterler.filter(d => extractYearFromDonem(d.baslangic) === yil));
    r += 2;

    // Fatura kayıtları yıllık arşivde tutulmaz. Karşıt incelemeye özel çalışma
    // verisi ayrı fatura çalışma kitabında üretilir.
    r += 2;

    sectionTitle('İŞCİ SAYILARI');
    headerRowFn(COLS.isci);
    dataRows(COLS.isci, merged.isciler.filter(i => extractYearFromDonem(i.donem) === yil));
    r += 2;

    sectionTitle('KDV BEYANNAMESİ BİLGİLERİ');
    headerRowFn(COLS.kdv);
    dataRows(COLS.kdv, merged.kdvBeyanlari.filter(k => extractYearFromDonem(k.donem) === yil));
    r += 2;

    sectionTitle('İMALATÇI FİRMA BİLGİLERİ');
    headerRowFn(COLS.imalatci);
    dataRows(COLS.imalatci, merged.imalatcilar);
    r += 2;

    sectionTitle('TEDARİKÇİ FİRMA BİLGİLERİ');
    const tedarikciKolonlari = COLS.tedarikci.filter(c => c.key !== 'donem'); // dönem, ay bloğu başlığında zaten belirtiliyor
    const yilTedarikci = merged.tedarikciler.filter(t => (extractYearFromDonem(t.donem) || extractYearFromTarih(t.faturaTarihi)) === yil);
    const donemGruplari = {};
    yilTedarikci.forEach(t => {
      const d = t.donem || 'Dönem Belirtilmemiş';
      (donemGruplari[d] = donemGruplari[d] || []).push(t);
    });
    const siraliDonemler = Object.keys(donemGruplari).sort((a, b) => {
      if (a === 'Dönem Belirtilmemiş') return 1;
      if (b === 'Dönem Belirtilmemiş') return -1;
      return donemCompare(a, b);
    });
    siraliDonemler.forEach(donem => {
      const { ay } = parseDonem(donem);
      const markerRow = ws.getRow(r);
      markerRow.getCell(1).value = donem === 'Dönem Belirtilmemiş' ? donem : `${ay}/${yil}`;
      tedarikciKolonlari.forEach((c, i) => markerRow.getCell(i + 2).value = c.label);
      styleHeaderRow(markerRow);
      r++;
      donemGruplari[donem].forEach((t, idx) => {
        const row = ws.getRow(r);
        row.getCell(1).value = idx + 1;
        tedarikciKolonlari.forEach((c, i) => row.getCell(i + 2).value = t[c.key] ?? '');
        r++;
      });
      r++;
    });
  });

  return wb;
}

async function downloadWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ============================================================
   Adım (step) yardımcı bileşenleri
   ============================================================ */

function metaField(container, obj, key, label, placeholder = '') {
  const f = el('div', { class: 'field' });
  f.appendChild(el('label', {}, label));
  const input = el('input', {
    type: 'text', value: obj[key] || '', placeholder,
    oninput: (e) => { obj[key] = e.target.value; }
  });
  f.appendChild(input);
  container.appendChild(f);
  return input;
}

function fileUploadBox(container, { accept, hint, onFile, onFiles, multiple = false }) {
  const box = el('div', { class: 'upload-box' }, [
    el('div', {}, multiple ? '📄 Dosyaları buraya sürükleyin veya seçmek için tıklayın' : '📄 Dosyayı buraya sürükleyin veya seçmek için tıklayın'),
    el('div', { style: 'font-size:11px;margin-top:4px;' }, hint || ''),
    ...(multiple ? [el('div', { style:'font-size:11px;margin-top:6px;color:#48636f;' }, 'Birden fazla dosya aynı anda seçilebilir.')] : [])
  ]);
  const input = el('input', { type: 'file', accept });
  if (multiple) input.multiple = true;
  const dispatch = (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    if (typeof onFiles === 'function') onFiles(list, box);
    else if (typeof onFile === 'function') {
      list.reduce((chain, file) => chain.then(() => onFile(file, box)), Promise.resolve());
    }
  };
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('change', () => dispatch(input.files));
  box.appendChild(input);
  box.addEventListener('click', () => input.click());
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('dragover'); });
  box.addEventListener('dragleave', () => box.classList.remove('dragover'));
  box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('dragover'); dispatch(e.dataTransfer.files); });
  container.appendChild(box);
  return box;
}

function markFileChip(box, name, append = false) {
  if (!append) {
    const old = box.querySelector('.file-chip-list');
    if (old) old.remove();
  }
  let list = box.querySelector('.file-chip-list');
  if (!list) {
    list = el('div', { class:'file-chip-list', style:'display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;' });
    box.appendChild(list);
  }
  list.appendChild(el('div', { class: 'file-chip' }, `✅ ${name}`));
}

// Dönem listesi düzenleyici (ör. ["01.2026","03.2026"]) - satır ekle/sil, elle düzeltme.
function renderDonemListEditor(container, arr, opts = {}) {
  container.innerHTML = '';
  const wrap = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;' });
  arr.forEach((val, idx) => {
    const row = el('div', { style: 'display:flex;align-items:center;gap:4px;background:#f4f7f8;border:1px solid var(--border);border-radius:6px;padding:3px 4px;' });
    const inp = el('input', {
      type: 'text', value: val, placeholder: 'AA.YYYY', style: 'width:80px;border:none;background:transparent;font-size:12.5px;',
      oninput: (e) => { arr[idx] = e.target.value.trim(); }
    });
    const del = el('button', {
      class: 'btn-del', title: 'Kaldır',
      onclick: () => { arr.splice(idx, 1); renderDonemListEditor(container, arr, opts); if (opts.onChange) opts.onChange(); }
    }, '✕');
    row.appendChild(inp); row.appendChild(del);
    wrap.appendChild(row);
  });
  container.appendChild(wrap);
  container.appendChild(el('button', {
    class: 'btn btn-ghost',
    onclick: () => { arr.push(''); renderDonemListEditor(container, arr, opts); if (opts.onChange) opts.onChange(); }
  }, '+ Dönem Ekle'));
}

// KDV/İşçi gibi dönem bazlı adımlarda: dönem seçici + dosya yükleme; PDF/XML için
// specialParser çalıştırıp seçilen dönemin satırına yama uygular.
function renderPeriodicFileImport(container, { donemList, rows, colDef, specialParser, specialLabel, rerender }) {
  const wrap = el('div', { class: 'card', style: 'background:#fbfdfd;' });
  wrap.appendChild(el('h3', {}, `📎 ${specialLabel} Dosyasından İçe Aktar`));
  wrap.appendChild(el('div', { class: 'hint info' },
    'Önce belgenin ait olduğu dönemi seçin, sonra dosyayı yükleyin. Excel/CSV yüklerseniz birden fazla dönem satırı otomatik eşleşmeye çalışılır; PDF/XML yüklerseniz seçtiğiniz döneme ait tek satır otomatik doldurulmaya çalışılır — sonucu mutlaka kontrol edin.'));

  const selectRow = el('div', { class: 'field', style: 'max-width:220px;' });
  selectRow.appendChild(el('label', {}, 'Belge Hangi Döneme Ait?'));
  const select = el('select', {});
  donemList.forEach(d => select.appendChild(el('option', { value: d }, d)));
  selectRow.appendChild(select);
  wrap.appendChild(selectRow);

  const previewHolder = el('div');
  fileUploadBox(wrap, {
    accept: '.xlsx,.xlsm,.csv,.tsv,.txt,.xml,.pdf',
    hint: 'Excel (.xlsx), CSV, e-berat/XML veya PDF dosyası',
    multiple: true,
    onFile: async (file, box) => {
      markFileChip(box, file.name);
      previewHolder.innerHTML = '';
      const name = file.name.toLowerCase();
      const secilenDonem = select.value;
      try {
        if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
          const { rows2D } = await readTabularFile(file);
          const res = importRowsFromTable(rows2D, colDef, rows);
          if (res.imported > 0) {
            if (rerender) rerender();
            previewHolder.appendChild(el('div', { class: 'hint ok' }, `✅ ${res.imported} satır aktarıldı — lütfen dönem eşleşmelerini tablodan kontrol edin.`));
          } else {
            previewHolder.appendChild(el('div', { class: 'hint warn' }, '⚠️ Sütun başlıkları otomatik eşleşmedi.'));
            previewHolder.appendChild(renderRawTablePreview(rows2D));
          }
        } else {
          let text;
          if (name.endsWith('.xml')) {
            const r = await readXmlFlatten(file); text = r.text;
          } else {
            text = await extractPdfText(file);
          }
          const det = el('details', { class: 'raw-details', open: '' });
          det.appendChild(el('summary', {}, 'Belge içeriği (ham metin — kontrol/kopyalama için)'));
          det.appendChild(el('pre', { class: 'raw-text' }, text || '(okunamadı)'));
          previewHolder.appendChild(det);
          if (specialParser) {
            const patch = specialParser(text || '');
            if (patch && Object.keys(patch).length) {
              let row = rows.find(r => (r.donem || '').trim() === secilenDonem);
              if (!row) { row = emptyRow(colDef); row.donem = secilenDonem; rows.push(row); }
              Object.assign(row, patch);
              if (rerender) rerender();
              previewHolder.appendChild(el('div', { class: 'hint ok' }, `✅ ${secilenDonem} dönemi satırına otomatik değerler işlendi — lütfen kontrol edin.`));
            } else {
              previewHolder.appendChild(el('div', { class: 'hint warn' }, '⚠️ Belgeden otomatik değer okunamadı; yukarıdaki metinden ilgili değerleri tabloya elle işleyin.'));
            }
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

