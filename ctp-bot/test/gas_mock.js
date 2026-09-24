// Bản giả lập tối giản của Google Apps Script + Telegram Bot API để chạy thử Code.gs trong Node.
// Chỉ cài những gì Code.gs dùng. Sheet giả lập hiểu chuỗi như người gõ (USER_ENTERED): "=..." là công thức,
// "'abc" là chữ, "06/07/2026" thành ngày nếu ô không định dạng chữ (@) — để bắt lỗi quên định dạng.
'use strict';

const RealDate = Date;
let NOW = RealDate.UTC(2026, 8, 24, 3, 0, 0); // 24/09/2026 10:00 giờ VN
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
function setNow(isoLocalVN) { // 'yyyy-mm-ddTHH:MM' giờ Việt Nam
  const [d, t] = isoLocalVN.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mi] = (t || '10:00').split(':').map(Number);
  NOW = RealDate.UTC(y, m - 1, dd, hh - 7, mi);
}

/* ---------------- Properties / Lock / Html / Logger / Utilities ---------------- */
class Props {
  constructor() { this.m = {}; }
  getProperty(k) { return Object.prototype.hasOwnProperty.call(this.m, k) ? this.m[k] : null; }
  setProperty(k, v) { this.m[k] = String(v); return this; }
  deleteProperty(k) { delete this.m[k]; return this; }
  getProperties() { return Object.assign({}, this.m); }
}
const props = new Props();
const PropertiesService = { getScriptProperties: () => props };
const LockService = { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {}, hasLock: () => true }) };
const HtmlService = { createHtmlOutput: s => ({ __html: true, content: s, getContent: () => s }) };
const logs = [];
const Logger = { log: s => { logs.push(String(s)); } };

function partsVN(date, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const o = {};
  f.formatToParts(date).forEach(p => { o[p.type] = p.value; });
  if (o.hour === '24') o.hour = '00';
  return o;
}
let uuidN = 0;
const Utilities = {
  formatDate(date, tz, fmt) {
    const p = partsVN(date, tz);
    return fmt.replace(/yyyy|MM|dd|HH|mm|ss/g, t => ({ yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second })[t]);
  },
  getUuid() { uuidN++; return ('00000000-0000-4000-8000-' + String(uuidN).padStart(12, '0')).replace(/0/g, () => 'abcdef0123456789'[Math.floor(Math.random() * 16)]); },
};

/* ---------------- Công thức (đủ cho các công thức Code.gs viết ra) ---------------- */
function colNum(s) { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function evalFormula(sheet, f, depth) {
  if (depth > 50) return '#REF';
  const src = f.replace(/^=/, '');
  let i = 0;
  const peek = () => src[i];
  const ws = () => { while (src[i] === ' ') i++; };
  const refRe = /^\$?([A-Z]{1,3})\$?(\d+)/;
  function readRef() {
    const m = src.slice(i).match(refRe);
    if (!m) return null;
    i += m[0].length;
    const a = { r: +m[2], c: colNum(m[1]) };
    if (src[i] === ':') {
      i++;
      const m2 = src.slice(i).match(refRe);
      i += m2[0].length;
      return { range: true, r1: a.r, c1: a.c, r2: +m2[2], c2: colNum(m2[1]) };
    }
    return { range: false, r: a.r, c: a.c };
  }
  const cellVal = (r, c) => sheet._value(r, c, depth + 1);
  const toNum = v => (v === '' || v === null || v === undefined ? 0 : typeof v === 'number' ? v : (() => { throw new Error('#VALUE'); })());
  function rangeVals(x) {
    const out = [];
    for (let r = x.r1; r <= x.r2; r++) for (let c = x.c1; c <= x.c2; c++) out.push(cellVal(r, c));
    return out;
  }
  function args() {
    const a = [];
    ws(); if (src[i] === ')') { i++; return a; }
    for (;;) {
      ws();
      const save = i;
      const ref = readRef();
      ws();
      if (ref && ref.range && (src[i] === ',' || src[i] === ')')) a.push(ref);
      else { i = save; a.push(expr()); }
      ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === ')') { i++; return a; }
      throw new Error('parse');
    }
  }
  function prim() {
    ws();
    if (src[i] === '(') { i++; const v = expr(); ws(); i++; return v; }
    if (src[i] === '+') { i++; return toNum(prim()); }
    if (src[i] === '-') { i++; return -toNum(prim()); }
    if (src[i] === '"') { const j = src.indexOf('"', i + 1); const s = src.slice(i + 1, j); i = j + 1; return s; }
    const num = src.slice(i).match(/^\d+(\.\d+)?/);
    if (num) { i += num[0].length; return parseFloat(num[0]); }
    const fn = src.slice(i).match(/^([A-Z]+)\(/);
    if (fn) {
      i += fn[0].length;
      const a = args();
      const name = fn[1];
      if (name === 'SUM') return a.reduce((s, x) => s + (x && x.range ? rangeVals(x).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0) : toNum(x)), 0);
      if (name === 'N') return typeof a[0] === 'number' ? a[0] : 0;
      if (name === 'SUMIFS') {
        const sv = rangeVals(a[0]), cv = rangeVals(a[1]);
        const crit = String(a[2] && a[2].range ? '' : a[2]).toLowerCase();
        return sv.reduce((s, v, k) => s + (String(cv[k]).toLowerCase() === crit && typeof v === 'number' ? v : 0), 0);
      }
      throw new Error('fn ' + name);
    }
    const ref = readRef();
    if (ref && !ref.range) return cellVal(ref.r, ref.c);
    throw new Error('parse at ' + i + ' in ' + src);
  }
  function term() {
    let v = prim();
    for (;;) { ws(); const o = peek(); if (o !== '*' && o !== '/') return v; i++; const w = prim(); v = o === '*' ? toNum(v) * toNum(w) : toNum(v) / toNum(w); }
  }
  function expr() {
    let v = term();
    for (;;) { ws(); const o = peek(); if (o !== '+' && o !== '-') return v; i++; const w = term(); v = o === '+' ? toNum(v) + toNum(w) : toNum(v) - toNum(w); }
  }
  try { const v = expr(); return v; } catch (e) { return '#' + e.message; }
}

/* ---------------- Spreadsheet ---------------- */
let idN = 100;
const registry = {};   // id → Spreadsheet
const files = {};      // id → file
const opsLog = [];     // thao tác trên bản sao file mẫu (để dựng lại bằng LibreOffice)

class Sheet {
  constructor(ss, name, id) {
    this.ss = ss; this.name = name; this.id = id; this.hidden = false;
    this.cells = new Map(); // "r,c" → {v, f, nf}
    this.merges = []; this.heights = {}; this.maxRows = 1000; this.maxCols = 26;
  }
  rec(op, o) { if (this.ss.record) opsLog.push(Object.assign({ op, sheet: this.name }, o || {})); }
  _get(r, c) { return this.cells.get(r + ',' + c); }
  _cell(r, c) { const k = r + ',' + c; let x = this.cells.get(k); if (!x) { x = { v: '', f: null, nf: null }; this.cells.set(k, x); } return x; }
  _value(r, c, depth) { const x = this._get(r, c); if (!x) return ''; if (x.f) return evalFormula(this, x.f, depth || 0); return x.v; }
  _set(r, c, v) {
    const x = this._cell(r, c);
    x.f = null;
    if (v === null || v === undefined || v === '') { x.v = ''; return; }
    if (typeof v === 'string') {
      if (v.charAt(0) === "'") { x.v = v.slice(1); return; }
      if (v.charAt(0) === '=') { x.f = v; x.v = ''; return; }
      if (x.nf === '@') { x.v = v; return; }
      if (/^-?\d+(\.\d+)?$/.test(v)) { x.v = parseFloat(v); return; }
      const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) { // như người gõ, theo locale của file
        const vn = this.ss.locale === 'vi_VN';
        const d = vn ? +m[1] : +m[2], mo = vn ? +m[2] : +m[1];
        if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) { x.v = new Date(+m[3], mo - 1, d); return; }
      }
      x.v = v; return;
    }
    x.v = v;
  }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  isSheetHidden() { return this.hidden; }
  showSheet() { this.hidden = false; this.rec('showSheet'); return this; }
  hideSheet() { this.hidden = true; return this; }
  getLastRow() { let m = 0; this.cells.forEach((x, k) => { if (x.v !== '' || x.f) m = Math.max(m, +k.split(',')[0]); }); return m; }
  getLastColumn() { let m = 0; this.cells.forEach((x, k) => { if (x.v !== '' || x.f) m = Math.max(m, +k.split(',')[1]); }); return m; }
  getMaxRows() { return Math.max(this.maxRows, this.getLastRow()); }
  getMaxColumns() { return Math.max(this.maxCols, this.getLastColumn()); }
  getRange(r, c, nr, nc) {
    if (typeof r !== 'number' || typeof c !== 'number') throw new Error('mock: chỉ hỗ trợ getRange(số, số, ...)');
    nr = nr === undefined ? 1 : nr; nc = nc === undefined ? 1 : nc;
    if (!(r >= 1 && c >= 1 && nr >= 1 && nc >= 1)) throw new Error('Exception: The coordinates of the range are outside the dimensions of the sheet. (' + [r, c, nr, nc] + ')');
    return new Range(this, r, c, nr, nc);
  }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(a) { const r = this.getLastRow() + 1; a.forEach((v, j) => this._set(r, j + 1, v)); return this; }
  _shift(from, k) { // dời mọi dòng >= from đi k (k âm = kéo lên)
    const nm = new Map();
    this.cells.forEach((x, key) => { const [r, c] = key.split(',').map(Number); nm.set((r >= from ? r + k : r) + ',' + c, x); });
    this.cells = nm;
    const nh = {};
    Object.keys(this.heights).forEach(r => { const n = +r; nh[n >= from ? n + k : n] = this.heights[r]; });
    this.heights = nh;
  }
  insertRowsAfter(r, k) {
    this.rec('insertRowsAfter', { r, k });
    this._shift(r + 1, k);
    this.merges = this.merges.map(m => (m[0] > r ? [m[0] + k, m[1], m[2] + k, m[3]] : m[2] > r ? [m[0], m[1], m[2] + k, m[3]] : m));
    return this;
  }
  insertRowsBefore(r, k) {
    this.rec('insertRowsBefore', { r, k });
    this._shift(r, k);
    this.merges = this.merges.map(m => (m[0] >= r ? [m[0] + k, m[1], m[2] + k, m[3]] : m[2] >= r ? [m[0], m[1], m[2] + k, m[3]] : m));
    return this;
  }
  deleteRows(r, k) {
    this.rec('deleteRows', { r, k });
    const end = r + k - 1;
    [...this.cells.keys()].forEach(key => { const rr = +key.split(',')[0]; if (rr >= r && rr <= end) this.cells.delete(key); });
    Object.keys(this.heights).forEach(x => { if (+x >= r && +x <= end) delete this.heights[x]; });
    this._shift(end + 1, -k);
    this.merges = this.merges.filter(m => !(m[0] >= r && m[2] <= end)).map(m => {
      if (m[0] > end) return [m[0] - k, m[1], m[2] - k, m[3]];
      if (m[2] >= r) throw new Error('mock: xóa dòng cắt ngang ô gộp ' + m);
      return m;
    });
    return this;
  }
  setRowHeights(r, k, h) { for (let i = 0; i < k; i++) this.heights[r + i] = h; this.rec('setRowHeights', { r, k, h }); return this; }
  getRowHeight(r) { return this.heights[r] || 21; }
  autoResizeRows(r, k) { this.rec('autoResizeRows', { r, k }); return this; }
  setFrozenRows() { return this; }
}

class Range {
  constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getRow() { return this.r; } getColumn() { return this.c; } getNumRows() { return this.nr; } getNumColumns() { return this.nc; }
  getSheet() { return this.sh; }
  _each(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) f(this.r + i, this.c + j, i, j); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh._value(this.r + i, this.c + j)); out.push(row); } return out; }
  getValue() { return this.sh._value(this.r, this.c); }
  getDisplayValues() { return this.getValues().map(r => r.map(v => String(v))); }
  getFormulas() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const x = this.sh._get(this.r + i, this.c + j); row.push(x && x.f ? x.f : ''); } out.push(row); } return out; }
  getNumberFormats() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const x = this.sh._get(this.r + i, this.c + j); row.push(x && x.nf ? x.nf : 'General'); } out.push(row); } return out; }
  setValues(v) {
    if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error('Exception: The number of rows/columns in the data does not match the range. (' + v.length + 'x' + (v[0] || []).length + ' vs ' + this.nr + 'x' + this.nc + ')');
    this._each((r, c, i, j) => this.sh._set(r, c, v[i][j]));
    this.sh.rec('setValues', { r: this.r, c: this.c, values: this.getFormulasOrValues() });
    return this;
  }
  getFormulasOrValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const x = this.sh._get(this.r + i, this.c + j); row.push(!x ? '' : x.f ? x.f : x.v instanceof Date ? { date: x.v.toISOString() } : x.v); } out.push(row); } return out; }
  setValue(v) { this.sh._set(this.r, this.c, v); this.sh.rec('setValues', { r: this.r, c: this.c, values: this.getFormulasOrValues() }); return this; }
  setFormula(f) { return this.setValue(f); }
  setNumberFormat(f) { this._each((r, c) => { this.sh._cell(r, c).nf = f; }); this.sh.rec('setNumberFormat', { r: this.r, c: this.c, nr: this.nr, nc: this.nc, f }); return this; }
  setNumberFormats(fs) { this._each((r, c, i, j) => { this.sh._cell(r, c).nf = fs[i][j]; }); return this; }
  setFontWeight() { return this; }
  setHorizontalAlignment(a) { this.sh.rec('halign', { r: this.r, c: this.c, nr: this.nr, nc: this.nc, a }); return this; }
  setVerticalAlignment(a) { this.sh.rec('valign', { r: this.r, c: this.c, nr: this.nr, nc: this.nc, a }); return this; }
  clearContent() { this._each((r, c) => { const x = this.sh._get(r, c); if (x) { x.v = ''; x.f = null; } }); this.sh.rec('clearContent', { r: this.r, c: this.c, nr: this.nr, nc: this.nc }); return this; }
  _hit(m) { return !(m[2] < this.r || m[0] > this.r + this.nr - 1 || m[3] < this.c || m[1] > this.c + this.nc - 1); }
  breakApart() {
    const bo = this.sh.merges.filter(m => this._hit(m));
    this.sh.merges = this.sh.merges.filter(m => !this._hit(m));
    if (bo.length) this.sh.rec('unmerge', { ranges: bo });
    return this;
  }
  merge() {
    if (this.sh.merges.some(m => this._hit(m))) throw new Error('Exception: You must select all cells in a merged range to merge or unmerge them.');
    const m = [this.r, this.c, this.r + this.nr - 1, this.c + this.nc - 1];
    this.sh.merges.push(m);
    this._each((r, c, i, j) => { if (i || j) { const x = this.sh._get(r, c); if (x) { x.v = ''; x.f = null; } } });
    this.sh.rec('merge', { range: m });
    return this;
  }
  getMergedRanges() { return this.sh.merges.filter(m => this._hit(m)).map(m => new Range(this.sh, m[0], m[1], m[2] - m[0] + 1, m[3] - m[1] + 1)); }
  copyTo(dest, type) {
    if (type !== 'PASTE_FORMAT') throw new Error('mock: chỉ hỗ trợ PASTE_FORMAT');
    for (let i = 0; i < dest.nr; i++) for (let j = 0; j < dest.nc; j++) {
      const s = this.sh._get(this.r + (i % this.nr), this.c + (j % this.nc));
      dest.sh._cell(dest.r + i, dest.c + j).nf = s ? s.nf : null;
    }
    this.sh.rec('copyFormat', { src: [this.r, this.c, this.nr, this.nc], dst: [dest.r, dest.c, dest.nr, dest.nc] });
    return this;
  }
}

class Spreadsheet {
  constructor(name) { this.id = 'ss' + (++idN); this.name = name; this.sheets = []; this.locale = 'en_US'; this.tz = 'America/New_York'; this.record = false; registry[this.id] = this; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getSheets() { return this.sheets.slice(); }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { if (this.getSheetByName(n)) throw new Error('Sheet đã tồn tại: ' + n); const s = new Sheet(this, n, ++idN); this.sheets.push(s); return s; }
  deleteSheet(s) {
    if (this.sheets.filter(x => !x.hidden && x !== s).length === 0) throw new Error('Exception: You can\'t remove all the visible sheets in a document.');
    this.sheets = this.sheets.filter(x => x !== s);
    if (this.record) opsLog.push({ op: 'deleteSheet', sheet: s.name });
  }
  setSpreadsheetTimeZone(tz) { this.tz = tz; }
  setSpreadsheetLocale(l) { this.locale = l; }
  clone(name) {
    const c = new Spreadsheet(name);
    c.locale = this.locale; c.tz = this.tz;
    c.sheets = this.sheets.map(s => {
      const n = new Sheet(c, s.name, s.id);
      n.hidden = s.hidden; n.merges = s.merges.map(m => m.slice()); n.heights = Object.assign({}, s.heights);
      s.cells.forEach((x, k) => n.cells.set(k, { v: x.v, f: x.f, nf: x.nf }));
      return n;
    });
    return c;
  }
}

function fileOf(ss) {
  return files[ss.id] || (files[ss.id] = {
    getId: () => ss.id, getUrl: () => ss.getUrl(), getName: () => ss.name,
    makeCopy(name, folder) { const c = ss.clone(name); c.record = true; opsLog.length = 0; if (folder) folder.items.push(c.id); return fileOf(c); },
  });
}

let activeSS = null;
const SpreadsheetApp = {
  CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' },
  getActive: () => activeSS, getActiveSpreadsheet: () => activeSS,
  openById: id => { if (!registry[id]) throw new Error('Exception: Unexpected error while getting the method or property openById on object SpreadsheetApp.'); return registry[id]; },
  flush() {},
  getUi() { throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); },
};

const folders = {};
const created = [];
function newFolder(name) {
  const f = { id: 'fd' + (++idN), name, items: [], trashed: false,
    getId() { return this.id; }, isTrashed() { return this.trashed; },
    createFile(blob) { const id = 'f' + (++idN); const o = { id, blob, getId: () => id, getUrl: () => 'https://drive.google.com/file/d/' + id + '/view' }; created.push(o); this.items.push(id); return o; } };
  folders[f.id] = f; return f;
}
const DriveApp = {
  getFileById(id) { if (!registry[id]) throw new Error('Exception: No item with the given ID could be found.'); return fileOf(registry[id]); },
  getFolderById(id) { if (!folders[id]) throw new Error('no folder'); return folders[id]; },
  createFolder: name => newFolder(name),
};
const ScriptApp = { getOAuthToken: () => 'oauth-test' };

/* ---------------- UrlFetchApp: Telegram + export ---------------- */
const tg = []; // các lời gọi Telegram
let msgId = 1000;
let tgHook = null; // (method, payload) → {code, body} để giả lập lỗi
const exports_ = [];
function resp(code, body) { return { getResponseCode: () => code, getContentText: () => JSON.stringify(body) }; }
const UrlFetchApp = {
  fetch(url, opts) {
    let m = url.match(/^https:\/\/api\.telegram\.org\/bot([^/]+)\/(\w+)$/);
    if (m) {
      const payload = Object.assign({}, (opts && opts.payload) || {});
      tg.push({ method: m[2], payload, token: m[1] });
      if (tgHook) { const r = tgHook(m[2], payload); if (r) return resp(r.code, r.body); }
      if (m[2] === 'sendMessage') return resp(200, { ok: true, result: { message_id: ++msgId } });
      if (m[2] === 'getWebhookInfo') return resp(200, { ok: true, result: { url: 'https://x/exec?k=secret', pending_update_count: 0 } });
      return resp(200, { ok: true, result: true });
    }
    m = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/]+)\/export\?(.*)$/);
    if (m) {
      exports_.push({ id: m[1], q: m[2], auth: opts && opts.headers && opts.headers.Authorization });
      const blob = { name: '', data: m[2], setName(n) { this.name = n; return this; }, getName() { return this.name; } };
      return { getResponseCode: () => 200, getBlob: () => blob, getContentText: () => '' };
    }
    throw new Error('mock: URL lạ ' + url);
  },
};

/* ---------------- Nạp mẫu từ JSON (dump_mau.py) ---------------- */
function loadTemplate(json) {
  const ss = new Spreadsheet('Mẫu kế toán');
  ss.locale = 'vi_VN';
  json.forEach(s => {
    const sh = new Sheet(ss, s.name, s.id);
    sh.hidden = s.hidden;
    sh.merges = s.merges.map(m => m.slice());
    Object.keys(s.heights).forEach(r => { sh.heights[+r] = s.heights[r]; });
    Object.keys(s.cells).forEach(k => {
      const v = s.cells[k];
      const x = sh._cell(...k.split(',').map(Number));
      if (typeof v === 'string' && v.charAt(0) === '=') x.f = v; else x.v = v;
    });
    ss.sheets.push(sh);
  });
  return ss;
}

function reset() {
  props.m = {}; tg.length = 0; exports_.length = 0; logs.length = 0; opsLog.length = 0; created.length = 0; tgHook = null;
  activeSS = new Spreadsheet('CTP Dữ liệu');
  activeSS.sheets.push(new Sheet(activeSS, 'Sheet1', ++idN));
  return activeSS;
}

module.exports = {
  FakeDate, setNow, PropertiesService, LockService, HtmlService, Logger, Utilities, SpreadsheetApp, DriveApp, ScriptApp, UrlFetchApp,
  props, tg, logs, opsLog, exports_, created, registry, folders, loadTemplate, reset, Spreadsheet,
  setTgHook: f => { tgHook = f; }, active: () => activeSS,
};
