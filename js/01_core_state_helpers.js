/* ============================================================
   KDV İade - Karşıt İnceleme Arşiv Sihirbazı
   Tamamen tarayıcı içinde çalışır. Hiçbir veri dışarı gönderilmez.
   ============================================================ */

pdfjsLib.GlobalWorkerOptions.workerSrc = window.__KDV_WORKER_URL__;

/* ------------------------- Durum (state) ------------------------- */

const state = {
  existingArchiveFile: null,   // { name }
  existingArchiveParsed: null, // parseArchiveWorkbook() sonucu

  tutanakRawText: '',
  tutanakFileName: '',



  // Dolu Karşıt İnceleme kontrolü için ayrı tutanak kaydı.
  // Dolu Karşıt İnceleme kontrolü için ayrı tutanak kaydı.
  doluTutanakRawText: '',
  doluTutanakFileName: '',
  doluTutanakParsed: null,
  // Doldurulmuş karşıt inceleme için kullanıcı tarafından verilen gerçek Excel tabloları.
  doluTablolar: {},
  doluTabloDosyalari: {},

  // Fatura tarihlerinden otomatik tespit edilen dönemler ("AA.YYYY")
  donemler: [],
  // İşçi/e-berat için = donemler ile aynı; KDV için = donemler + her birinin bir önceki ayı (çakışmasız)
  kdvDonemleri: [],

  meta: {
    tutanakSayi: '', tutanakTarih: '',
    ymmAdSoyad: '', ymmVkn: '', ymmVergiDairesi: '', ymmMuhur: '', ymmSicil: '',
    ymmOda: '', ymmAdres: '', ymmTelefon: '',
    ymmSirketVkn: '', ymmSirketUnvan: '',
    tasdikMukellefUnvan: '', tasdikMukellefVkn: '', tasdikMukellefVergiDairesi: '',
    tasdikMukellefAdres: '', tasdikMukellefTelefon: '',
    sozBaslangic: '', sozBitis: '', sozTarihi: '', sozSeriSira: '', sozSistemeGiris: '',
    // Ç mükellefi = nezdinde karşıt inceleme yapılan mükellef = arşivin öznesi
    cUnvan: '', cVkn: '', cVergiDairesi: '', cAdres: '', cTelefon: ''
  },

  ortaklar: [],
  defterler: [],
  faturalar: [],
  isciler: [],
  kdvBeyanlari: [],
  kdvTahakkuklari: [],
  imalatcilar: [],
  tedarikciler: [],
  eberatOkunan: null,
  eberatOnayBekleyen: null,
  eberatOnayBekleyenler: [],
  muavinRows: [],
  faturaMuavinKontroller: [],
  muhtasarDetaylari: []
};

/* ------------------------- Sütun tanımları ------------------------- */

const COLS = {
  ortak: [
    { key: 'adSoyad', label: 'Adı Soyadı / Ünvanı', w: 220 },
    { key: 'vkn', label: 'Vergi/T.C. Kimlik No', w: 130 },
    { key: 'il', label: 'Bağlı Olduğu İl', w: 110 },
    { key: 'vergiDairesi', label: 'Bağlı Olduğu Vergi Dairesi', w: 150 },
    { key: 'payOrani', label: 'Pay Oranı', w: 80 },
    { key: 'aciklama', label: 'Açıklama', w: 140 }
  ],
  defter: [
    { key: 'nevi', label: "Defterin Nev'i", w: 150 },
    { key: 'baslangic', label: 'Başlangıç Dönemi', w: 110 },
    { key: 'bitis', label: 'Bitiş Dönemi', w: 100 },
    { key: 'tasdikMakami', label: 'Tasdik Makamı', w: 130 },
    { key: 'tasdikTarihi', label: 'Tasdik Tarihi', w: 110 },
    { key: 'tasdikNo', label: 'Tasdik No / Berat No', w: 160 },
    { key: 'aciklama', label: 'Açıklama', w: 160 },
    { key: 'defterTuruAciklama', label: 'Defter Türü Açıklama', w: 150 }
  ],
  fatura: [
    { key: 'tarih', label: 'Faturanın Tarihi', w: 110 },
    { key: 'seri', label: 'Faturanın Serisi', w: 100 },
    { key: 'no', label: 'Faturanın Numarası', w: 150 },
    { key: 'tutar', label: 'Faturanın Tutarı (TL)', w: 130 },
    { key: 'kdv', label: 'K.D.V(TL)', w: 100 },
    { key: 'defterKayitTarihi', label: 'Defter Kayıt Tarihi', w: 120 },
    { key: 'yevmiyeNo', label: 'Yevmiye Numarası', w: 120 },
    { key: 'odemeSekli', label: 'Ödeme Şekli ve Ödemeye İlişkin Bilgiler', w: 240 },
    { key: 'aciklama', label: 'Açıklama', w: 140 },
    { key: 'hataliSatir', label: 'Hatalı Satır Açıklama', w: 140 }
  ],
  isci: [
    { key: 'donem', label: 'Dönem (AA.YYYY)', w: 120 },
    { key: 'sayi', label: 'Çalışan İşçi Sayısı', w: 130 },
    { key: 'vergiDairesi', label: 'Beyannamenin Verildiği Vergi Dairesi', w: 220 }
  ],
  kdv: [
    { key: 'donem', label: 'Dönem', w: 100 },
    { key: 'teslimBedel', label: 'Teslim ve Hizmet Karşılığını Teşkil Eden Bedel', w: 190 },
    { key: 'ozelMatrah', label: 'Özel Matrah Şekline Tabi İşl. Matr. Dahil Olm. Bedel', w: 220 },
    { key: 'kdvMatrahi', label: 'KDV Matrahı', w: 120 },
    { key: 'hesaplananKdv', label: 'Hesaplanan KDV', w: 120 },
    { key: 'ilaveKdv', label: 'İlave Edilecek KDV', w: 120 },
    { key: 'toplamKdv', label: 'Toplam KDV', w: 110 },
    { key: 'indirimler', label: 'İndirimler Toplamı', w: 130 },
    { key: 'odenecekKdv', label: 'Ödenmesi Gereken KDV', w: 140 },
    { key: 'devredenKdv', label: 'Sonraki Döneme Devreden KDV', w: 160 },
    { key: 'tahakkukNo', label: 'Tahakkuk Fişinin Numarası', w: 180 }
  ],
  imalatci: [
    { key: 'adSoyad', label: 'Adı Soyadı / Ünvanı', w: 220 },
    { key: 'vkn', label: 'Vergi/T.C. Kimlik No', w: 130 },
    { key: 'sanayiOdasi', label: 'Bağlı Bulunduğu Sanayi Odası', w: 180 },
    { key: 'belgeTarihi', label: 'Belge Tarihi', w: 100 },
    { key: 'belgeNo', label: 'Belge Numarası', w: 130 },
    { key: 'belgeTuru', label: 'Belge Türü', w: 150 },
    { key: 'aciklama', label: 'Açıklama', w: 140 }
  ],
  tedarikci: [
    { key: 'adSoyad', label: 'Adı Soyadı/Ünvanı', w: 220 },
    { key: 'vkn', label: 'Vergi/T.C. Kimlik Numarası', w: 150 },
    { key: 'vergiDairesi', label: 'Bağlı Olduğu Vergi Dairesi', w: 170 },
    { key: 'faturaTarihi', label: 'Faturanın Tarihi', w: 110 },
    { key: 'faturaSeri', label: 'Faturanın Serisi', w: 100 },
    { key: 'faturaNo', label: 'Faturanın Numarası', w: 150 },
    { key: 'faturaMatrahi', label: 'Faturanın Matrahı', w: 130 },
    { key: 'faturaKdv', label: 'Faturanın KDV Tutarı', w: 130 },
    { key: 'gumrukTarihi', label: 'Gümrük Beyannamesi/Serbest Bölge İşlem Formu Tarihi', w: 250 },
    { key: 'gumrukTescilNo', label: 'Gümrük Beyannamesi/Serbest Bölge İşlem Formu Tescil Numarası', w: 280 }
  ]
};

/* ------------------------- Küçük yardımcılar ------------------------- */

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}

function emptyRow(colDef) {
  const r = {};
  colDef.forEach(c => r[c.key] = '');
  return r;
}

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function fmtDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (d instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  return String(d);
}

function normalizeHeader(s) {
  return (s || '').toString()
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/[^a-z0-9şğüöçı]/g, '');
}

/* ------------------------- Dönem yardımcıları -------------------------
   Dönem formatı her yerde "AA.YYYY" (örn: "01.2026") olarak tutulur.
   ------------------------------------------------------------------- */

function parseDonem(s) {
  const m = (s || '').match(/(\d{1,2})\D+(\d{4})/);
  if (!m) return { ay: 0, yil: 0 };
  return { ay: parseInt(m[1], 10), yil: parseInt(m[2], 10) };
}

function fmtDonem(ay, yil) {
  return String(ay).padStart(2, '0') + '.' + yil;
}

function donemCompare(a, b) {
  const pa = parseDonem(a), pb = parseDonem(b);
  return (pa.yil * 12 + pa.ay) - (pb.yil * 12 + pb.ay);
}

function prevDonem(s) {
  const { ay, yil } = parseDonem(s);
  let a = ay - 1, y = yil;
  if (a < 1) { a = 12; y = yil - 1; }
  return fmtDonem(a, y);
}

function extractYearFromDonem(s) {
  const { yil } = parseDonem(s);
  return yil || null;
}

function extractYearFromTarih(s) {
  const m = (s || '').match(/(\d{4})\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

// "10.06.2026" (GG.AA.YYYY) formatındaki fatura tarihinden dönem ("06.2026") çıkarır.
function donemFromFaturaTarihi(tarih) {
  const m = (tarih || '').match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return '';
  return `${m[2]}.${m[3]}`;
}

function extractDonemlerFromFaturalar(faturalar) {
  const set = new Set();
  (faturalar || []).forEach(f => {
    const d = donemFromFaturaTarihi(f.tarih);
    if (d) set.add(d);
  });
  return Array.from(set).sort(donemCompare);
}

// Fatura dönemleri + her birinin bir önceki ayı; çakışmalar (tekrarlar) temizlenir.
function computeKdvDonemleri(donemler) {
  const set = new Set();
  (donemler || []).forEach(d => {
    if (!d) return;
    set.add(d);
    set.add(prevDonem(d));
  });
  return Array.from(set).sort(donemCompare);
}

function recomputeDonemlerFromTutanak() {
  state.donemler = extractDonemlerFromFaturalar(state.faturalar);
  state.kdvDonemleri = computeKdvDonemleri(state.donemler);
  // Arşiv daha önce yüklenmişse, yeni tespit edilen dönemlere göre tekrar süzülür.
  // Böylece Gelen Karşıt dönemleri arşiv dönemlerinden bağımsız kalır.
  if(state.existingArchiveParsed) archiveToState(state.existingArchiveParsed);
}

// Bir satır dizisinde, verilen dönem listesindeki her dönem için eksikse
// boş bir satır ekler (var olanları bozmaz, tekrar eklemez).
// İlk adımda tutanaktan yakalanan mükellef vergi dairesini çalışan tablosuna
// doğrudan taşır. Muhtasar PDF'sinden vergi dairesi okunmaz.
function syncIsciVergiDairesi() {
  const vd = String(state.meta.cVergiDairesi || '').trim();
  if (!vd) return;
  state.isciler.forEach(r => {
    if (!String(r.vergiDairesi || '').trim()) r.vergiDairesi = vd;
  });
}

function syncDonemRows(rows, donemList, colDef) {
  (donemList || []).forEach(d => {
    if (!d) return;
    if (!rows.some(r => (r.donem || '').trim() === d)) {
      const r = emptyRow(colDef);
      r.donem = d;
      if (colDef === COLS.isci) r.vergiDairesi = String(state.meta.cVergiDairesi || '').trim();
      rows.push(r);
    }
  });
  rows.sort((a, b) => {
    const da = a.donem || '', db = b.donem || '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return donemCompare(da, db);
  });
}

/* ------------------------- Düzenlenebilir tablo bileşeni ------------------------- */
// rows: state içindeki dizinin referansı. Doğrudan mutasyona uğrar.
function renderEditableTable(container, colDef, rows, opts = {}) {
  container.innerHTML = '';
  const table = el('table', { class: 'editable-table' });
  const thead = el('tr');
  colDef.forEach(c => thead.appendChild(el('th', { style: `min-width:${c.w}px` }, c.label)));
  thead.appendChild(el('th', { style: 'width:30px' }, ''));
  table.appendChild(el('thead', {}, thead));

  const tbody = el('tbody');
  rows.forEach((row, idx) => {
    const tr = el('tr');
    colDef.forEach(c => {
      const input = el('input', {
        type: 'text',
        value: row[c.key] ?? '',
        oninput: (e) => { row[c.key] = e.target.value; }
      });
      tr.appendChild(el('td', {}, input));
    });
    const delBtn = el('button', {
      class: 'btn-del', title: 'Satırı sil',
      onclick: () => { rows.splice(idx, 1); renderEditableTable(container, colDef, rows, opts); if (opts.onChange) opts.onChange(); }
    }, '✕');
    tr.appendChild(el('td', { class: 'rownum' }, delBtn));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const tableScroll = el('div', { class: 'table-scroll' });
  tableScroll.appendChild(table);
  container.appendChild(tableScroll);

  const actions = el('div', { class: 'table-actions' });
  actions.appendChild(el('button', {
    class: 'btn btn-ghost',
    onclick: () => { rows.push(emptyRow(colDef)); renderEditableTable(container, colDef, rows, opts); if (opts.onChange) opts.onChange(); }
  }, '+ Satır Ekle'));
  if (opts.extraButtons) opts.extraButtons.forEach(b => actions.appendChild(b));
  container.appendChild(actions);
}

/* ============================================================
   PDF okuma ve tutanaktan alan çıkarma (best-effort)
   ============================================================ */

async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let fullLines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({
      str: it.str,
      x: it.transform[4],
      y: Math.round(it.transform[5])
    })).filter(it => it.str.trim() !== '');
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    let lastY = null;
    let line = [];
    const lines = [];
    for (const it of items) {
      if (lastY === null || Math.abs(it.y - lastY) <= 2) {
        line.push(it.str);
      } else {
        lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
        line = [it.str];
      }
      lastY = it.y;
    }
    if (line.length) lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
    fullLines = fullLines.concat(lines, ['']);
  }
  return fullLines.filter(l => l !== undefined).join('\n');
}

// "ETİKET" değerini aynı satırdaki veya bir sonraki metindeki ilk eşleşmeden alır.
// (Ham hali — satır sonlarını korur; boşluk sıkıştırması yapmaz.)
function grabAfterRaw(text, label, stopLabels = []) {
  const idx = text.indexOf(label);
  if (idx === -1) return '';
  let rest = text.slice(idx + label.length);
  let cut = rest.length;
  for (const s of stopLabels) {
    const p = rest.indexOf(s);
    if (p !== -1 && p < cut) cut = p;
  }
  return rest.slice(0, cut).replace(/^[:\s]+/, '');
}

function grabAfter(text, label, stopLabels = []) {
  return grabAfterRaw(text, label, stopLabels).trim().replace(/\s+/g, ' ');
}

// PDF'te dar sütun genişliği yüzünden 2 satıra bölünen hücrelerde, etiket
// (label) genelde değerin İKİ SATIRI ARASINA, kendi satırında yalnız başına
// düşer: "değer_satır1 \n ETİKET \n değer_satır2". Bu fonksiyon etiketi kendi
// satırında YALNIZ olarak bulup önceki+sonraki satırı birleştirir. Etiket
// değerle aynı satırdaysa (kırılma yoksa) null döner — o durumda normal
// grabAfter kullanılmalıdır.
function grabWrappedLabelValue(text, label) {
  const lines = text.split('\n');
  const idx = lines.findIndex(l => l.trim() === label);
  if (idx === -1) return null;
  const before = (lines[idx - 1] || '').trim();
  const after = (lines[idx + 1] || '').trim();
  const combined = (before + ' ' + after).trim();
  return combined || null;
}

// Etiketle aynı satırda bulunması beklenen tek satırlık değerler için:
// grabAfter'ın (stopLabel uzakta kaldığında) yanlışlıkla sonraki satırları da
// içine almasını engellemek amacıyla yalnızca ilk satırı döndürür.
function grabSingleLine(text, label, stopLabels = []) {
  return grabAfterRaw(text, label, stopLabels).split('\n')[0].trim().replace(/\s+/g, ' ');
}

// Karşıt İnceleme Tutanağının Ç) bölümündeki mükellef vergi dairesini
// doğrudan bu bölümden alır. Örn: "VERGİ DAİRESİ KARAMAN VERGİ DAİRESİ MÜD."
// -> "KARAMAN". Böylece Muhtasar PDF'sinden vergi dairesi aramaya gerek kalmaz.
function extractMukellefVergiDairesi(cBlock) {
  if (!cBlock) return '';

  // PDF.js bazı PDF'lerde etiketi ve değeri ayrı text parçaları/satırları
  // halinde verir. Bu nedenle önce tüm boşlukları tek boşluğa indirip
  // Ç) bölümündeki metni tek satır mantığıyla tarıyoruz.
  const flat = String(cBlock)
    .replace(/\r/g, ' ')
    .replace(/[\t\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Gerçek tutanak biçimi:
  // VERGİ DAİRESİ  KARAMAN VERGİ DAİRESİ MÜD.  ADRES
  let m = flat.match(/VERGİ\s*DAİRESİ\s*:?\s*([A-ZÇĞİÖŞÜ0-9 .,'’\-]+?)\s+VERGİ\s+DAİRESİ\s+(?:MÜD\.?|MÜDÜRLÜĞÜ)\.?/i);
  if (!m) {
    m = flat.match(/VERGİ\s*DAİRESİ\s*:?\s*([A-ZÇĞİÖŞÜ0-9 .,'’\-]+?)(?=\s+ADRES(?:\s|$)|\s+TELEFON\s+NUMARASI|\s+1-\s*|$)/i);
  }
  if (!m) {
    // Satır/kolon yerleşimi bozulmuşsa, etiketten sonraki kısa bölümü al.
    m = flat.match(/VERGİ\s*DAİRESİ\s*:?\s*([^0-9]{1,80})/i);
  }
  if (!m) return '';

  let value = m[1]
    .replace(/\s+/g, ' ')
    .replace(/\s+VERGİ\s+DAİRESİ\s+(?:MÜD\.?|MÜDÜRLÜĞÜ)\.?\s*$/i, '')
    .replace(/\s+(?:VERGİ\s+DAİRESİ\s+)?(?:MÜD\.?|MÜDÜRLÜĞÜ)\.?\s*$/i, '')
    .trim();

  // Kullanıcının istediği çıktı: yalnızca vergi dairesinin adı.
  // Örn. "KARAMAN VERGİ DAİRESİ MÜD." -> "KARAMAN"
  return value;
}

// Telefon alanları çoğu zaman boştur; bu durumda bir sonraki satır
// ("Belge ID : ...") içindeki rakamlar yanlışlıkla telefon sanılmamalı.
function grabTelefon(text, label, stopLabels = []) {
  const raw = grabAfterRaw(text, label, ['Belge ID', ...stopLabels]).split('\n')[0].trim();
  const m = raw.match(/^[\d ]{7,15}$/);
  return m ? raw.trim() : '';
}

// PDF'in dar sütun genişliği yüzünden fatura tablosu satırları çoğu zaman
// birden fazla görsel alt satıra bölünmüş halde gelir (örn. fatura numarası
// "TZL20260000" / "02339" şeklinde iki parçaya ayrılır). Bu nedenle satır
// bazlı değil, TÜM BLOK içindeki token'ları tipine göre sınıflandırıp
// (tarih / tutar / harf+rakam parçası / salt rakam parçası) sırayla eşleştiren
// tolerant bir yaklaşım kullanılır. Birden fazla fatura satırı varsa, alanlar
// tespit sırasına göre eşleştirilir — bu nedenle sonuç her zaman kontrol
// edilmelidir.
function extractFaturaRowsFromBlock(blockText) {
  // Fatura tablosu PDF'de sayfa sonunda bölünebilir. Bu nedenle tüm bloktaki
  // tarih/tutarları ayrı ayrı toplamak yerine HER FATURA TARİHİNİ bir satır
  // başlangıcı kabul ediyoruz. Böylece sonraki sayfadaki devam satırları da
  // aynı sırayla okunur ve bir önceki sayfanın sütunlarıyla karışmaz.
  const raw = String(blockText || '').replace(/\r/g, ' ');
  const tokens = raw.split(/\s+/).map(x => x.trim()).filter(Boolean);
  const dateRe = /^\d{2}\.\d{2}\.\d{4}$/;
  const moneyRe = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
  const letterDigitRe = /^[A-ZÇĞİÖŞÜ]{2,8}\d{3,}$/i;
  const pureDigitRe = /^\d{2,9}$/;

  const dateIndexes = [];
  tokens.forEach((t, i) => { if (dateRe.test(t)) dateIndexes.push(i); });

  const rows = [];
  for (let di = 0; di < dateIndexes.length; di++) {
    const start = dateIndexes[di];
    const end = di + 1 < dateIndexes.length ? dateIndexes[di + 1] : tokens.length;
    const chunk = tokens.slice(start, end);
    const tarih = chunk[0] || '';

    // Bu fatura satırının ilk iki parasal değeri MATRAH ve KDV'dir.
    // TOPLAM satırı bir tarih içermediği için hiçbir faturaya dahil edilmez.
    const moneyIndexes = [];
    chunk.forEach((t, i) => { if (moneyRe.test(t)) moneyIndexes.push(i); });
    if (moneyIndexes.length < 2) continue;

    // Fatura numarası çoğu tutanakta seri ile numaranın PDF satır kırılması
    // nedeniyle iki ayrı token olarak gelir: SME2026000 + 000052.
    // Önce harf+rakam parçasını, sonra ona en yakın salt rakam parçasını bul.
    let seriFrag = '';
    let noFrag = '';
    let seriIndex = -1;
    for (let i = 1; i < Math.min(chunk.length, moneyIndexes[0] + 4); i++) {
      if (letterDigitRe.test(chunk[i])) {
        seriFrag = chunk[i];
        seriIndex = i;
        break;
      }
    }
    if (seriFrag) {
      // Numara parçası bazen tutarlardan sonra gelir; bu nedenle tüm chunk'ta
      // ilk uygun salt sayı tokenını seri parçasıyla eşleştir.
      for (let i = seriIndex + 1; i < chunk.length; i++) {
        if (pureDigitRe.test(chunk[i])) { noFrag = chunk[i]; break; }
      }
    } else {
      // Seri ayrı bir sütun olarak gelmiyorsa salt sayı tokenını fatura no kabul
      // et. Tutarları bu aramadan özellikle hariç tutuyoruz.
      for (let i = 1; i < moneyIndexes[0]; i++) {
        if (pureDigitRe.test(chunk[i])) { noFrag = chunk[i]; break; }
      }
    }

    const no = seriFrag ? `${seriFrag}${noFrag}` : noFrag;
    rows.push({
      no,
      seri: '',
      tarih,
      tutar: chunk[moneyIndexes[0]] || '',
      kdv: chunk[moneyIndexes[1]] || '',
      defterKayitTarihi: '',
      yevmiyeNo: '',
      odemeSekli: '',
      aciklama: '',
      hataliSatir: ''
    });
  }
  return rows;
}

function parseTutanak(text) {
  const out = {};
  const T = text.replace(/\r/g, '');

  const sayiMatch = T.match(/Sayı\s*:?\s*([0-9\/\-A-ZİÇÖŞÜĞa-zçöşüğı]+)\s*Tarih\s*:?\s*([0-9.]+)/);
  if (sayiMatch) { out.tutanakSayi = sayiMatch[1].trim(); out.tutanakTarih = sayiMatch[2].trim(); }

  out.ymmAdSoyad = grabAfter(T, 'ADI VE SOYADI', ['VERGİ', 'VERGİ/T.C.']);
  const ymmVknBlock = grabAfter(T, 'VERGİ/T.C. KİMLİK NUMARASI', ['VERGİ DAİRESİ']);
  out.ymmVkn = (ymmVknBlock.match(/\d{8,11}/) || [''])[0];
  out.ymmVergiDairesi = grabSingleLine(T, 'VERGİ DAİRESİ', ['MÜHÜR', 'ADRES']);
  out.ymmMuhur = (grabAfter(T, 'MÜHÜR NUMARASI', ['SİCİL']).match(/\d+/) || [''])[0];
  out.ymmSicil = (grabAfter(T, 'SİCİL NUMARASI', ['BAĞLI OLDUĞU ODA']).match(/\d+/) || [''])[0];
  out.ymmOda = grabSingleLine(T, 'BAĞLI OLDUĞU ODA', ['ADRES']);
  out.ymmAdres = grabWrappedLabelValue(T, 'ADRESİ') || grabAfter(T, 'ADRESİ', ['TELEFON']) || grabAfter(T, 'ADRES', ['TELEFON']);
  out.ymmTelefon = grabTelefon(T, 'TELEFON NUMARASI', ['YMM ŞİRKETİ', 'B) TASDİK']);

  const ymmSirketBlock = grabAfter(T, 'YMM ŞİRKETİ VERGİ KİMLİK NUMARASI / ÜNVANI', ['B) TASDİK', 'VERGİ/T.C.']);
  if (ymmSirketBlock) {
    const parts = ymmSirketBlock.split('/');
    out.ymmSirketVkn = (parts[0] || '').trim();
    out.ymmSirketUnvan = (parts.slice(1).join('/') || '').trim();
  }

  const bIdx = T.indexOf('B) TASDİK');
  const cIdx = T.indexOf('Ç) NEZDİNDE');
  const bBlock = bIdx !== -1 ? T.slice(bIdx, cIdx !== -1 ? cIdx : undefined) : '';
  if (bBlock) {
    out.tasdikMukellefUnvan = grabWrappedLabelValue(bBlock, 'ADI VE SOYADI / ÜNVANI') || grabAfter(bBlock, 'ADI VE SOYADI / ÜNVANI', ['VERGİ/T.C.']);
    const vknB = grabAfter(bBlock, 'VERGİ/T.C. KİMLİK NUMARASI', ['VERGİ DAİRESİ']);
    out.tasdikMukellefVkn = (vknB.match(/\d{8,11}/) || [''])[0];
    out.tasdikMukellefVergiDairesi = grabSingleLine(bBlock, 'VERGİ DAİRESİ', ['ADRES']);
    out.tasdikMukellefAdres = grabWrappedLabelValue(bBlock, 'ADRES') || grabAfter(bBlock, 'ADRES', ['TELEFON']);
    out.tasdikMukellefTelefon = grabTelefon(bBlock, 'TELEFON NUMARASI', ['Sözleşme', 'TASDİK']);
  }

  const sozRow = T.match(/(\d{2}\.\d{4})\s+(\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})\s+(\S+)\s+(\d{2}\.\d{2}\.\d{4})/);
  if (sozRow) {
    out.sozBaslangic = sozRow[1];
    out.sozBitis = sozRow[2];
    out.sozTarihi = sozRow[3];
    out.sozSeriSira = sozRow[4];
    out.sozSistemeGiris = sozRow[5];
  }

  const cBlockEndIdx = T.indexOf('1- Mükellefin ortaklık');
  const cBlock = cIdx !== -1 ? T.slice(cIdx, cBlockEndIdx !== -1 ? cBlockEndIdx : undefined) : '';
  if (cBlock) {
    out.cUnvan = grabWrappedLabelValue(cBlock, 'ADI VE SOYADI / ÜNVANI') || grabAfter(cBlock, 'ADI VE SOYADI / ÜNVANI', ['VERGİ/T.C.']);
    const vknC = grabAfter(cBlock, 'VERGİ/T.C. KİMLİK NUMARASI', ['VERGİ DAİRESİ']);
    out.cVkn = (vknC.match(/\d{8,11}/) || [''])[0];
    // İlk adımda vergi dairesi doğrudan Karşıt İnceleme Tutanağındaki Ç)
    // mükellef bölümünden alınır; Muhtasar'dan tekrar okunmaz.
    out.cVergiDairesi = extractMukellefVergiDairesi(cBlock) || grabSingleLine(cBlock, 'VERGİ DAİRESİ', ['ADRES']);
    out.cAdres = grabWrappedLabelValue(cBlock, 'ADRES') || grabAfter(cBlock, 'ADRES', ['TELEFON']);
    out.cTelefon = grabTelefon(cBlock, 'TELEFON NUMARASI', ['1-', '2-']);
  }

  const faturaSecIdx = T.indexOf('Karşıt incelemeye konu olan faturalarına');
  out.faturalar = [];
  if (faturaSecIdx !== -1) {
    // Fatura tablosu sayfa sonunda devam edebilir. Eski mantık ilk görülen
    // "TOPLAM" kelimesinde bloğu kesiyordu; bu nedenle ilk sayfadaki
    // faturalar okunuyor, sonraki sayfadaki devam satırları kayboluyordu.
    // Artık bloğu TOPLAM'da değil, bir sonraki numaralı bölümün başlangıcında
    // (4- Muhtasar) kesiyoruz. Böylece 3. bölümün tüm sayfaları birlikte
    // değerlendirilir.
    const nextSectionMatches = [
      T.indexOf('4- Karşıt incelemeye konu dönemde/dönemlerde'),
      T.indexOf('4 - Karşıt incelemeye konu dönemde/dönemlerde'),
      T.indexOf('4- Karşıt incelemeye konu dönemde'),
      T.indexOf('4 - Karşıt incelemeye konu dönemde')
    ].filter(i => i > faturaSecIdx);
    const nextSectionIdx = nextSectionMatches.length ? Math.min(...nextSectionMatches) : T.length;
    const block = T.slice(faturaSecIdx, nextSectionIdx);
    out.faturalar = extractFaturaRowsFromBlock(block);
  }

  return out;
}

