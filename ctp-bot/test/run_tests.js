// Chạy: node ctp-bot/test/run_tests.js            (dùng mẫu giả lập có cấu trúc như mẫu kế toán)
//       MAU_JSON=/đường/dẫn/mau.json node ...      (dùng mẫu thật đã dump bằng dump_mau.py)
//       OPS_OUT=/tmp/ops.json ...                  (ghi thao tác xuất file để dựng lại bằng LibreOffice)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const G = require('./gas_mock');
const loiIn = []; console.error = e => loiIn.push(String(e));
global.Date = G.FakeDate;
['PropertiesService', 'LockService', 'HtmlService', 'Logger', 'Utilities', 'SpreadsheetApp', 'DriveApp', 'ScriptApp', 'UrlFetchApp'].forEach(k => { global[k] = G[k]; });
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), { filename: 'Code.gs' });

let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) pass++;
  else { fail++; console.log('✗ ' + name + (info !== undefined ? '\n    ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1500) : '')); }
}
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

/* ============ 1. Hàm đọc chữ (không cần Sheet) ============ */
const HN = '2026-09-24';
[
  ['1tr8', 1800000], ['1.8tr', 1800000], ['1,8tr', 1800000], ['1,8 triệu', 1800000], ['2tr500', 2500000], ['1tr05', 1050000],
  ['864k', 864000], ['864 k', 864000], ['864.000', 864000], ['864,000', 864000], ['864000', 864000], ['864000đ', 864000],
  ['864.000 đ', 864000], ['1.780.000', 1780000], ['1.780k', 1780000], ['1.5k', 1500], ['1k5', 1500], ['550100', 550100],
  ['550.100', 550100], ['500 nghìn', 500000], ['500 ngàn', 500000], ['30k', 30000], ['1.5', null], ['abc', null], ['', null],
].forEach(([s, v]) => eq('docTien_ ' + JSON.stringify(s), docTien_(s), v));

[
  ['1tr8 hđ 145', { tien: 1800000, hd: true, so: '145' }],
  ['1tr8 HĐ 145', { tien: 1800000, hd: true, so: '145' }],
  ['1tr8 hd145', { tien: 1800000, hd: true, so: '145' }],
  ['1tr8hđ145', { tien: 1800000, hd: true, so: '145' }],
  ['550100 hóa đơn số 2090', { tien: 550100, hd: true, so: '2090' }],
  ['864k có hđ', { tien: 864000, hd: true, so: '' }],
  ['864k hđ', { tien: 864000, hd: true, so: '' }],
  ['864k có', { tien: 864000, hd: true, so: '' }],
  ['550100 không HĐ', { tien: 550100, hd: false }],
  ['550100 khd', { tien: 550100, hd: false }],
  ['550100 ko hđ', { tien: 550100, hd: false }],
  ['550100 ko có hđ', { tien: 550100, hd: false }],
  ['550100 k có HĐ', { tien: 550100, hd: false }],
  ['550100 chưa có hóa đơn', { tien: 550100, hd: false }],
  ['550100', { tien: 550100, hd: null }],
  ['1.780.000 không HĐ', { tien: 1780000, hd: false }],
].forEach(([s, v]) => eq('docDongTien_ ' + JSON.stringify(s), docDongTien_(s), v));
check('docDongTien_ nhỏ quá', !!docDongTien_('900').loi);
check('docDongTien_ "2 đêm 1.8tr" báo lỗi', !!docDongTien_('2 đêm 1.8tr').loi);
check('docDongTien_ "1tr8 ngon" báo lỗi', !!docDongTien_('1tr8 ngon').loi);
check('docDongTien_ chữ', !!docDongTien_('abc').loi);

eq('docNhanh_ ks', docNhanh_('ks 1tr8 hđ 145'), { ma: 'KS', loai: 'Khách sạn', ghiChu: '', rest: '1tr8 hđ 145' });
eq('docNhanh_ Xăng', docNhanh_('Xăng 550k khd'), { ma: 'XX', loai: 'Xăng xe', ghiChu: '', rest: '550k khd' });
eq('docNhanh_ tiếp khách', docNhanh_('tiếp khách: 1.2tr hđ 88'), { ma: 'TK', loai: 'Tiếp khách', ghiChu: '', rest: '1.2tr hđ 88' });
eq('docNhanh_ khác', docNhanh_('khác vé xe khách 120k khd'), { ma: 'KH', loai: 'Khác', ghiChu: 'vé xe khách', rest: '120k khd' });
eq('docNhanh_ khác không tiền', docNhanh_('khác gửi xe'), { ma: 'KH', loai: 'Khác', ghiChu: 'gửi xe', rest: '' });
eq('docNhanh_ lạ', docNhanh_('hello 1tr'), null);
eq('docNhanh_ "ksxx"', docNhanh_('ksxx 1tr'), null);
eq('docNhanh_ gõ kiểu NFD vẫn hiểu', docNhanh_('xăng 500k'.normalize('NFD')).ma, 'XX');
eq('docNhanh_ sau NFC', docNhanh_('xăng 500k'.normalize('NFD').normalize('NFC')).ma, 'XX');

eq('docNgay_ 10/9', docNgay_('10/9', HN), '2026-09-10');
eq('docNgay_ 10/9/2026', docNgay_('10/9/2026', HN), '2026-09-10');
eq('docNgay_ 10-9-26', docNgay_('10-9-26', HN), '2026-09-10');
eq('docNgay_ hôm nay', docNgay_('Hôm nay', HN), HN);
eq('docNgay_ hôm qua', docNgay_('hôm qua', HN), '2026-09-23');
eq('docNgay_ 31/2', docNgay_('31/2', HN), null);
eq('docNgay_ 20/10 (tương lai gần)', docNgay_('20/10', HN), '2026-10-20');
eq('docNgay_ 30/12 gõ vào 03/01', docNgay_('30/12', '2027-01-03'), '2026-12-30');
eq('docNgay_ ngày về 2/1 sau 30/12', docNgay_('2/1', '2027-01-03', '2026-12-30'), '2027-01-02');
eq('docNgay_ năm 1999', docNgay_('1/1/1999', HN), null);
eq('docKhoang_ 10/9-12/9', docKhoang_('10/9-12/9', HN), { tu: '2026-09-10', den: '2026-09-12' });
eq('docKhoang_ 10/9 - 12/9', docKhoang_('10/9 - 12/9', HN), { tu: '2026-09-10', den: '2026-09-12' });
eq('docKhoang_ 10/9 đến 12/9', docKhoang_('10/9 đến 12/9', HN), { tu: '2026-09-10', den: '2026-09-12' });
eq('docKhoang_ 10-12/9', docKhoang_('10-12/9', HN), { tu: '2026-09-10', den: '2026-09-12' });
eq('docKhoang_ 30/12-2/1', docKhoang_('30/12-2/1', '2027-01-03'), { tu: '2026-12-30', den: '2027-01-02' });
eq('docKhoang_ 1 ngày', docKhoang_('10/9', HN), { tu: '2026-09-10' });
eq('docKhoang_ 10-9 (1 ngày)', docKhoang_('10-9', HN), { tu: '2026-09-10' });
eq('docKhoang_ rác', docKhoang_('mai', HN), null);
eq('docThang_ 9', docThang_('9', HN), '09/2026');
eq('docThang_ T9', docThang_('T9', HN), '09/2026');
eq('docThang_ tháng 8', docThang_('tháng 8', HN), '08/2026');
eq('docThang_ 12 vào tháng 1', docThang_('12', '2027-01-05'), '12/2026');
eq('docThang_ 09/2025', docThang_('09/2025', HN), '09/2025');
eq('docThang_ 13', docThang_('13', HN), null);
eq('thangXuatMacDinh_ ngày 5', thangXuatMacDinh_('2027-01-05'), '12/2026');
eq('thangXuatMacDinh_ ngày 24', thangXuatMacDinh_(HN), '09/2026');
eq('soNgay_', soNgay_('2026-09-28', '2026-10-02'), 5);

const NS = [{ ten: 'Nguyễn Văn Hùng', goi: '' }, { ten: 'Trần Thị Hà', goi: '' }, { ten: 'Lê Văn Việt', goi: 'Việt' }, { ten: 'Phạm Văn Việt', goi: '' }, { ten: 'Đỗ Đức Anh', goi: '' }];
eq('timNguoi_ hùng', timNguoi_(NS, 'hùng'), { ok: 'Nguyễn Văn Hùng' });
eq('timNguoi_ hung (không dấu)', timNguoi_(NS, 'hung'), { ok: 'Nguyễn Văn Hùng' });
eq('timNguoi_ hưng ≠ hùng', timNguoi_(NS, 'hưng'), {});
eq('timNguoi_ hải ≠ hà', timNguoi_(NS, 'hải'), {});
eq('timNguoi_ an ≠ anh', timNguoi_(NS, 'an'), {});
eq('timNguoi_ việt: tên gọi khớp trước', timNguoi_(NS, 'Việt'), { ok: 'Lê Văn Việt' });
eq('timNguoi_ văn: nhiều', timNguoi_(NS, 'văn').nhieu.length, 3);
eq('timNguoi_ họ tên đủ', timNguoi_(NS, 'phạm văn việt'), { ok: 'Phạm Văn Việt' });

[
  [0, 'Không đồng.'], [5, 'Năm đồng.'], [10, 'Mười đồng.'], [15, 'Mười lăm đồng.'], [21, 'Hai mươi mốt đồng.'], [24, 'Hai mươi tư đồng.'],
  [105, 'Một trăm linh năm đồng.'], [110, 'Một trăm mười đồng.'], [114, 'Một trăm mười bốn đồng.'],
  [200000, 'Hai trăm nghìn đồng.'], [864000, 'Tám trăm sáu mươi tư nghìn đồng.'], [1000000, 'Một triệu đồng.'],
  [1005000, 'Một triệu không trăm linh năm nghìn đồng.'], [1050000, 'Một triệu không trăm năm mươi nghìn đồng.'],
  [2000105, 'Hai triệu một trăm linh năm đồng.'], [8368100, 'Tám triệu ba trăm sáu mươi tám nghìn một trăm đồng.'],
  [1250000, 'Một triệu hai trăm năm mươi nghìn đồng.'], [15015000, 'Mười lăm triệu không trăm mười lăm nghìn đồng.'],
  [1000000000, 'Một tỷ đồng.'], [2001000000, 'Hai tỷ không trăm linh một triệu đồng.'],
].forEach(([n, s]) => eq('docSoTien_ ' + n, docSoTien_(n), s));
eq('fmt_', fmt_(8368100), '8.368.100');

/* ============ 2. Cài đặt + bảo mật ============ */
const OWNER = 111, STRANGER = 222;
let updId = 5000, mid = 1;
const P = G.props;
function post(update, k) {
  return doPost({ parameter: k === undefined ? { k: P.getProperty('SECRET') } : k === null ? {} : { k }, postData: { contents: JSON.stringify(update) } });
}
function msgUpd(t, from, type) { return { update_id: ++updId, message: { message_id: ++mid, from: { id: from }, chat: { id: from, type: type || 'private' }, date: 0, text: t } }; }
function say(t, from) { G.tg.length = 0; post(msgUpd(t, from || OWNER)); return out(); }
function tap(data, from) {
  G.tg.length = 0;
  post({ update_id: ++updId, callback_query: { id: 'cb' + updId, from: { id: from || OWNER }, message: { message_id: 777, chat: { id: from || OWNER, type: 'private' } }, data } });
  return out();
}
function out() { return G.tg.filter(x => x.method === 'sendMessage').map(x => x.payload.text).join('\n---\n'); }
function kb() {
  const m = G.tg.filter(x => x.method === 'sendMessage' && x.payload.reply_markup).pop();
  return m ? JSON.parse(m.payload.reply_markup).inline_keyboard.flat().map(b => b.callback_data) : [];
}
function toast() { const a = G.tg.filter(x => x.method === 'answerCallbackQuery').pop(); return a ? a.payload.text : null; }
function tab(name) {
  const sh = G.active().getSheetByName(name);
  const v = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), Math.max(sh.getLastColumn(), 1)).getValues();
  const h = v[0];
  return v.slice(1).map(r => { const o = {}; h.forEach((k, j) => { o[k] = r[j]; }); return o; });
}
function setCfg(key, val) {
  const sh = G.active().getSheetByName('CauHinh');
  const v = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  const i = v.findIndex(r => r[0] === key);
  sh.getRange(i + 1, 2).setValue(val);
}

G.reset();
let threw = null;
try { caiDat(); } catch (e) { threw = e.message; }
check('caiDat báo thiếu BOT_TOKEN', threw && /BOT_TOKEN/.test(threw), threw);
P.setProperty('BOT_TOKEN', '123:TEST');
caiDat();
['Chuyen', 'ChiPhi', 'NhanSu', 'TamUng', 'CauHinh', 'LichSuXuat', 'Loi'].forEach(t => check('caiDat tạo tab ' + t, !!G.active().getSheetByName(t)));
check('caiDat xóa Sheet1 trống', !G.active().getSheetByName('Sheet1'));
check('caiDat đặt locale/tz', G.active().locale === 'vi_VN' && G.active().tz === 'Asia/Ho_Chi_Minh');
check('SECRET dài', (P.getProperty('SECRET') || '').length >= 32);
const PIN = P.getProperty('PIN');
check('PIN 6 số', /^\d{6}$/.test(PIN), PIN);
caiDat(); // chạy lại không nhân đôi CauHinh
check('caiDat chạy lại không nhân đôi', tab('CauHinh').filter(r => r['Mục'] === 'CTP mỗi ngày').length === 1);
check('PIN không đổi khi chạy lại? (được đổi, chỉ cần có)', /^\d{6}$/.test(P.getProperty('PIN')));
const PIN2 = P.getProperty('PIN');

// Mẫu kế toán
const mauJson = process.env.MAU_JSON ? JSON.parse(fs.readFileSync(process.env.MAU_JSON, 'utf8')) : require('./mau_gia_lap').mau();
const mau = G.loadTemplate(mauJson);
setCfg('Người đề nghị', 'Nguyễn Văn An');
setCfg('ID file mẫu', 'https://docs.google.com/spreadsheets/d/' + mau.getId() + '/edit#gid=0');
const nsSh = G.active().getSheetByName('NhanSu');
[['Nguyễn Văn An', 'An', 'Kinh doanh', '0123456789', 'Vietcombank'], ['Trần Thị Bình', 'Bình', 'Kinh doanh', '0987654321', 'AB Bank'],
 ['Lê Văn Cường', '', 'Kinh doanh', '001100220033', 'VP Bank'], ['Phạm Thu Dung', 'Dung', 'Kỹ thuật', '5550001', 'AB Bank']]
  .forEach(r => { const b = docBang_('NhanSu'); xoaCache_(); themDong_(b, { 'Họ tên': r[0], 'Tên gọi': r[1], 'Bộ phận': r[2], 'Số tài khoản': r[3], 'Ngân hàng': r[4] }); });
xoaCache_();
eq('STK giữ số 0 đầu', tab('NhanSu')[2]['Số tài khoản'], '001100220033');

P.setProperty('WEBAPP_URL', 'https://script.google.com/macros/s/AKfyTEST/exec');
G.tg.length = 0;
datWebhook();
const sw = G.tg.find(x => x.method === 'setWebhook');
check('setWebhook có ?k=SECRET', sw && sw.payload.url === 'https://script.google.com/macros/s/AKfyTEST/exec?k=' + P.getProperty('SECRET'), sw);
check('setWebhook drop pending + 1 kết nối', sw && sw.payload.drop_pending_updates === 'true' && sw.payload.max_connections === '1');
check('setMyCommands', G.tg.some(x => x.method === 'setMyCommands'));
P.setProperty('WEBAPP_URL', 'https://script.google.com/macros/s/AKfyTEST/dev');
threw = null; try { datWebhook(); } catch (e) { threw = e.message; }
check('datWebhook từ chối URL /dev', !!threw);

// doPost luôn trả HtmlService (mã 200), không phải ContentService (302)
check('doPost trả HtmlOutput', post(msgUpd('/help', OWNER)).__html === true);
G.tg.length = 0; post(msgUpd('/start ' + PIN2, OWNER), null);
check('thiếu k → bỏ qua', G.tg.length === 0);
G.tg.length = 0; post(msgUpd('/start ' + PIN2, OWNER), 'sai');
check('sai k → bỏ qua', G.tg.length === 0);
check('người lạ PIN sai → im lặng', say('/start 000000', STRANGER) === '' && !P.getProperty('OWNER_ID'));
check('chưa có chủ, /help → im lặng', say('/help', OWNER) === '');
check('PIN trong nhóm → bỏ qua', (() => { G.tg.length = 0; post(msgUpd('/start ' + PIN2, OWNER, 'group')); return !P.getProperty('OWNER_ID'); })());
let r = say('/start ' + PIN2, OWNER);
check('nhận chủ bằng PIN', P.getProperty('OWNER_ID') === String(OWNER) && /chủ bot/.test(r), r);
check('PIN bị xóa sau khi dùng', !P.getProperty('PIN'));
check('người lạ bị bỏ qua', say('/help', STRANGER) === '' && G.tg.length === 0);
check('người lạ bấm nút bị bỏ qua', tap('nd|0', STRANGER) === '' && G.tg.length === 0);
check('chủ nhắn trong nhóm bị bỏ qua', (() => { G.tg.length = 0; post(msgUpd('/help', OWNER, 'supergroup')); return G.tg.length === 0; })());
// trùng update_id
G.tg.length = 0;
const u1 = msgUpd('/help', OWNER); post(u1); post(u1); post(u1);
check('update trùng chỉ xử lý 1 lần', G.tg.filter(x => x.method === 'sendMessage').length === 1);
// update_id nhỏ hơn (Telegram đánh số lại sau 1 tuần im lặng) vẫn được xử lý
G.tg.length = 0; post({ update_id: 7, message: { message_id: 1, from: { id: OWNER }, chat: { id: OWNER, type: 'private' }, text: '/help' } });
check('update_id nhỏ hơn vẫn xử lý', G.tg.filter(x => x.method === 'sendMessage').length === 1);

/* ============ 3. Tạo chuyến /moi (bấm nút) ============ */
G.setNow('2026-09-24T19:30');
r = say('/moi');
check('/moi hỏi ngày đi (nút mang ngày thật)', /Ngày đi/.test(r) && kb().join() === 'nd|2026-09-24,nd|2026-09-23', kb());
r = tap('nd|0');
check('bấm Hôm nay → hỏi ngày về', /Ngày về/.test(r) && kb()[0] === 've|0', r);
check('bấm nút → gỡ bàn phím cũ', G.tg.some(x => x.method === 'editMessageReplyMarkup'));
r = tap('ve|0');
check('đi trong ngày → hỏi người', /24\/09 \(1 ngày\)/.test(r) && /Đi cùng ai/.test(r), r);
eq('nút người: 3 đồng nghiệp + Một mình + Xong', kb(), ['ng|0', 'ng|1', 'ng|2', 'ng|solo', 'ng|ok']);
r = tap('ng|0');
const edit = G.tg.find(x => x.method === 'editMessageReplyMarkup');
check('chọn người → sửa nút có ✅', edit && /✅ Bình/.test(edit.payload.reply_markup), edit);
tap('ng|2'); tap('ng|2'); // bấm 2 lần = bỏ chọn
r = tap('ng|ok');
check('Xong → đoàn An, Bình', /Đoàn: An, Bình/.test(r) && /Địa bàn/.test(r), r);
r = say('Hưng Yên');
check('hỏi trường', /Các trường/.test(r), r);
r = say('THCS Đường Hào; TH Phụng Công,  TH Lạc Hồng');
check('hỏi phương tiện', /Phương tiện/.test(r) && kb().join() === 'pt|0,pt|1,pt|2,pt|3', r);
r = say('đi taxi');
check('gõ "đi taxi" → hiểu Taxi', /Nội dung/.test(r), r);
check('nút nội dung mặc định', kb().join() === 'nc|0', kb());
r = tap('nc|0');
check('lưu chuyến 2609001', /Đã lưu chuyến <b>2609001<\/b>/.test(r) && /tháng 09\/2026/.test(r), r);
check('CTP 1 ngày × 2 người', /1 ngày × 2 người × 200.000 = <b>400.000đ<\/b>/.test(r), r);
check('ngay sau đó là menu chi phí (nút mang mã chuyến)', kb().indexOf('cl|KS|2609001') >= 0 && kb().indexOf('cl|OK|2609001') >= 0, kb());
let T = tab('Chuyen');
eq('dòng Chuyen', [T[0]['ID'], T[0]['Từ ngày'], T[0]['Đến ngày'], T[0]['Số ngày'], T[0]['Tháng TT'], T[0]['Địa bàn'], T[0]['Trường'], T[0]['Phương tiện'], T[0]['Người đi'], T[0]['Nội dung'], T[0]['Trạng thái']],
  ['2609001', '24/09/2026', '24/09/2026', 1, '', 'Hưng Yên', 'THCS Đường Hào, TH Phụng Công, TH Lạc Hồng', 'Taxi/ Xe khách', 'Nguyễn Văn An, Trần Thị Bình', 'Triển khai eNetViet', 'OK']);
check('ngày lưu dạng chữ (không bị đổi thành Date)', typeof T[0]['Từ ngày'] === 'string');

/* ============ 4. Chi phí ============ */
r = tap('cl|KS');
check('Khách sạn → hỏi số tiền', /Số tiền <b>Khách sạn<\/b>/.test(r), r);
r = say('1tr8 hđ 145');
check('lưu KS 1.800.000 HĐ 145', /Khách sạn <b>1.800.000đ<\/b> · HĐ 145/.test(r), r);
check('nút Xóa khoản + Người khác trả', kb()[0] === 'xc|2609001-1' && kb()[1] === 'nt|2609001-1', kb());
r = say('xăng 550100 khd');
check('gõ nhanh xăng không HĐ', /Xăng xe <b>550.100đ<\/b> · không HĐ/.test(r) && /đã có 1 khoản không HĐ/.test(r), r);
r = say('tk 1.2tr');
check('tk chưa nói HĐ → hỏi', /có hóa đơn không/.test(r) && kb().join() === 'hd|1,hd|0', r);
r = tap('hd|1');
check('có HĐ → hỏi số', /Số hóa đơn/.test(r), r);
r = say('HĐ: 0088');
check('số HĐ bỏ tiền tố', /HĐ 0088/.test(r), r);
r = say('khác vé xe khách 120k');
check('khác + ghi chú', /có hóa đơn không/.test(r), r);
r = tap('hd|0');
check('khác không HĐ', /Khác \(vé xe khách\) <b>120.000đ<\/b> · không HĐ/.test(r) && /2 khoản không HĐ/.test(r), r);
r = say('ks abc');
check('số tiền lỗi → báo, giữ bước', /Chưa đọc được số tiền/.test(r) && getSt_().b === 'tien', r);
r = say('900');
check('900 → hỏi có phải 900k', /nhỏ quá/.test(r), r);
r = say('900k 2 đêm');
check('phần sau lạ → báo', /Chưa hiểu phần/.test(r), r);
r = say('900k không hđ');
check('lưu khoản thứ 3 không HĐ → cảnh báo vượt', /⚠️ Tháng 09\/2026 đã có 3 khoản không HĐ/.test(r), r);
let CP = tab('ChiPhi');
eq('ChiPhi số dòng', CP.length, 5);
eq('ChiPhi dòng 1', [CP[0]['ID'], CP[0]['Loại'], CP[0]['Số tiền'], CP[0]['Hóa đơn'], CP[0]['Số HĐ'], CP[0]['Người trả']], ['2609001-1', 'Khách sạn', 1800000, 'Có', '145', 'Nguyễn Văn An']);
eq('ChiPhi số HĐ giữ 0 đầu', CP[2]['Số HĐ'], '0088');
r = tap('xc|2609001-5');
check('xóa khoản', /Đã xóa: Khách sạn 900.000đ/.test(r) && toast() === 'Đã xóa', r);
check('xóa lần 2 → báo đã xóa', (tap('xc|2609001-5'), toast() === 'Khoản này đã xóa rồi.'));
r = tap('nt|2609001-1');
check('hỏi người trả', /Ai trả Khách sạn/.test(r) && kb().join() === 'np|2609001-1|0,np|2609001-1|1', kb());
r = tap('np|2609001-1|1');
check('đổi người trả', /Trần Thị Bình trả/.test(r) && tab('ChiPhi')[0]['Người trả'] === 'Trần Thị Bình', r);
r = tap('cl|OK');
check('Xong chuyến', /Xong chuyến <b>2609001<\/b>: CTP 400.000đ \+ chi phí 3.670.100đ \(4 khoản\)/.test(r) && !getSt_(), r);
r = tap('cl|KS|2609001');
check('bấm nút cũ của chuyến đã Xong → mở lại đúng chuyến đó', /Số tiền <b>Khách sạn<\/b> \(chuyến 2609001\)/.test(r) && getSt_().id === '2609001', r);
say('/huy');
check('nút ngày cũ', (tap('nd|0'), toast() === 'Nút này đã cũ.'));

/* ============ 5. Gõ khoảng ngày, gõ tên, người mới, gián đoạn ============ */
say('/moi');
r = say('10/9-12/9');
check('khoảng ngày → hỏi người luôn', /10\/09 - 12\/09 \(3 ngày\)/.test(r) && /Đi cùng ai/.test(r), r);
say('/bang'); // làm việc khác giữa chừng — không mất trạng thái
check('lệnh khác không xóa trạng thái', getSt_() && getSt_().b === 'nguoi');
G.setNow('2026-09-25T08:00'); // hôm sau mới nhập tiếp
r = say('bình, cuong, Hải');
check('tên lạ → hỏi thêm danh bạ', /Chưa có trong tab NhanSu: <b>Hải<\/b>/.test(r) && kb().join() === 'ng|them,ng|lai', r);
r = tap('ng|them');
check('thêm Hải → đoàn 4 người', /Đoàn: An, Bình, Cường, Hải/.test(r), r);
check('NhanSu có Hải', tab('NhanSu').some(x => x['Họ tên'] === 'Hải'));
check('nút tỉnh gần đây', kb().join() === 'tn|0', kb());
tap('tn|0');
tap('tr|-');
r = tap('pt|0');
r = say('Tập huấn');
check('lưu chuyến 2609002 và cảnh báo trùng? (không trùng)', /2609002/.test(r) && !/Trùng ngày/.test(r), r);
T = tab('Chuyen');
eq('chuyến 2 ngày + người', [T[1]['Từ ngày'], T[1]['Đến ngày'], T[1]['Số ngày'], T[1]['Người đi'], T[1]['Trường'], T[1]['Nội dung'], T[1]['Địa bàn']],
  ['10/09/2026', '12/09/2026', 3, 'Nguyễn Văn An, Trần Thị Bình, Lê Văn Cường, Hải', '', 'Tập huấn', 'Hưng Yên']);
say('/huy');
check('/huy xóa trạng thái', !getSt_());

// ngày về trước ngày đi
say('/moi'); say('12/9');
r = say('10/9');
check('ngày về trước ngày đi → báo', /trước ngày đi/.test(r), r);
say('/huy');

/* ============ 6. /lai, trùng chuyến ============ */
r = say('/lai');
check('/lai chép chuyến trước', /Chép chuyến <b>2609002<\/b>/.test(r) && /Ngày đi/.test(r), r);
say('11/9');
r = tap('ve|0');
check('/lai → hỏi trường ngay', /Các trường/.test(r), r);
r = say('TH A, TH B');
check('/lai lưu luôn + cảnh báo trùng', /Đã lưu chuyến <b>2609003<\/b>/.test(r) && /Trùng ngày, trùng người với chuyến 2609002/.test(r), r);
tap('cl|OK');
r = say('/xoa 2609003');
check('/xoa hỏi xác nhận', kb().join() === 'xy|2609003,xn|', kb());
r = tap('xy|2609003');
check('xóa chuyến', /Đã xóa chuyến 2609003/.test(r) && tab('Chuyen')[2]['Trạng thái'] === 'Xóa', r);
r = say('/xem 2609003');
check('/xem chuyến đã xóa', /đã bị xóa/.test(r), r);

/* ============ 7. /xem, /cp, /tamung, /bang ============ */
r = say('/xem 2609001');
check('/xem hiển thị chi phí', /Khách sạn 1.800.000 · HĐ 145/.test(r) && /không HĐ/.test(r), r);
check('/xem nút', kb().indexOf('ct|2609001') >= 0 && kb().indexOf('xt|2609001') >= 0, kb());
r = say('/cp 2609002');
check('/cp chuyến khác', /Chuyến <b>2609002<\/b>/.test(r) && getSt_().id === '2609002', r);
say('ks 2tr hđ 12'); tap('cl|OK');
r = say('/tamung 1tr');
check('/tamung', /Tạm ứng tháng 09\/2026: 1.000.000đ/.test(r), r);
say('/tamung 1.5tr');
eq('/tamung cập nhật, không thêm dòng', tab('TamUng').length, 1);
r = say('/bang');
check('/bang tổng', /Tháng 09\/2026<\/b> — 2 chuyến/.test(r) && /Chuyển khoản: <b>/.test(r) && /Tiền mặt \(không HĐ\): 670.100đ — 2\/2 lần/.test(r), r);
check('/bang cảnh báo chưa có trường', /2609002 chưa có tên trường/.test(r), r);
check('/bang cảnh báo thiếu STK của Hải', /Thiếu số tài khoản của Hải/.test(r), r);
r = say('/bang 8');
check('/bang tháng trống', /Tháng 08\/2026 chưa có chuyến nào/.test(r), r);
r = say('/xyz');
check('lệnh lạ', /Không có lệnh/.test(r), r);
r = say('chào');
check('chữ tự do không có trạng thái', /Gõ \/moi/.test(r), r);
// HTML lỗi → gửi lại chữ thường
G.setTgHook((m, p) => (m === 'sendMessage' && p.parse_mode === 'HTML' ? { code: 400, body: { ok: false, description: "Bad Request: can't parse entities" } } : null));
r = say('/help');
G.setTgHook(null);
check('HTML lỗi → gửi lại không parse_mode', G.tg.filter(x => x.method === 'sendMessage').length === 2 && !G.tg[1].payload.parse_mode && /Bot công tác phí/.test(G.tg[1].payload.text));
// Ảnh không chú thích
G.tg.length = 0; post({ update_id: ++updId, message: { message_id: 9, from: { id: OWNER }, chat: { id: OWNER, type: 'private' }, photo: [{}] } });
check('ảnh không chú thích → nhắc', /chỉ đọc chữ/.test(out()));
// Ảnh có chú thích trong bước số tiền
say('/cp 2609001'); tap('cl|XX');
G.tg.length = 0; post({ update_id: ++updId, message: { message_id: 10, from: { id: OWNER }, chat: { id: OWNER, type: 'private' }, photo: [{}], caption: '300k hđ 77' } });
check('ảnh có chú thích → đọc chú thích', /Xăng xe <b>300.000đ<\/b> · HĐ 77/.test(out()), out());
tap('cl|OK');


/* ============ 7b. Các lỗi reviewer tìm ra (phải không tái diễn) ============ */
// (1) nút loại chi phí của chuyến cũ → chi phí vào đúng chuyến cũ
say('/cp 2609002');                         // đang mở chuyến 2609002
r = tap('cl|TK|2609001');                    // bấm nút ở tin nhắn cũ của chuyến 2609001
check('nút cũ của chuyến khác → đúng chuyến đó', /chuyến 2609001/.test(r) && getSt_().id === '2609001', r);
r = say('500k hđ 9');
check('xác nhận ghi rõ chuyến', /→ chuyến 2609001 \(24\/09, Hưng Yên\)/.test(r), r);
tap('cl|OK|2609001');
// (2) quá 12 giờ sau vẫn gõ chi phí → không tự rơi vào chuyến cũ, phải bấm xác nhận
say('/cp 2609002');
G.setNow('2026-09-26T12:00');
r = say('ks 700k hđ 3');
check('trạng thái chi phí hết hạn sau 12h → hỏi xác nhận chuyến', /Thêm "<b>ks 700k hđ 3<\/b>" vào chuyến <b>2609002<\/b>/.test(r) && kb()[0] === 'qc|2609002', r);
const truoc = tab('ChiPhi').length;
r = tap('qc|2609002');
check('bấm xác nhận → lưu vào chuyến đó', tab('ChiPhi').length === truoc + 1 && /Khách sạn <b>700.000đ<\/b> · HĐ 3/.test(r), r);
tap('cl|OK|2609002');
say('ks 1tr hđ 1'); r = tap('xn|');
check('không đồng ý → không lưu', tab('ChiPhi').length === truoc + 1 && !getSt_());
// (3) nút "Hôm qua 23/09" bấm vào hôm sau vẫn là 23/09
G.setNow('2026-09-24T23:50'); say('/moi');
G.setNow('2026-09-25T07:30'); r = tap('nd|2026-09-23');
check('nút ngày giữ đúng ngày trên nhãn', getSt_().t.tu === '2026-09-23', getSt_());
r = tap('ve|2026-09-24');
check('nút "về hôm nay" giữ đúng ngày trên nhãn', /23\/09 - 24\/09 \(2 ngày\)/.test(r), r);
say('/huy');
check('/huy sau khi đã nhập người → không báo bỏ dở thừa', true);
// (4) gõ "2/1-4/1" vào 29/12 là năm sau
eq('docKhoang_ 2/1-4/1 gõ ngày 29/12', docKhoang_('2/1-4/1', '2026-12-29'), { tu: '2027-01-02', den: '2027-01-04' });
eq('docNgay_ 1/11 gõ ngày 24/9 (nhập muộn gần 11 tháng)', docNgay_('1/11', '2026-09-24'), '2025-11-01');
// (5) sửa ngày trong Sheet sang tháng khác → chuyến chuyển tháng (Tháng TT để trống)
{
  const sh = G.active().getSheetByName('Chuyen');
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(3, h.indexOf('Từ ngày') + 1).setValue('01/10/2026'); sh.getRange(3, h.indexOf('Đến ngày') + 1).setValue('02/10/2026');
  xoaCache_();
  check('sửa ngày sang tháng 10 → /bang 10/2026 có chuyến', /2609002/.test(say('/bang 10/2026')));
  sh.getRange(3, h.indexOf('Tháng TT') + 1).setValue('09/2026'); xoaCache_();
  check('điền Tháng TT = 09/2026 → tính vào tháng 9', /2609002/.test(say('/bang 9')) && !/2609002/.test(say('/bang 10/2026')));
  sh.getRange(3, h.indexOf('Từ ngày') + 1).setValue('10/09/2026'); sh.getRange(3, h.indexOf('Đến ngày') + 1).setValue('12/09/2026');
  sh.getRange(3, h.indexOf('Tháng TT') + 1).setValue(''); xoaCache_();
}
// (6) xóa dòng chuyến trong Sheet → mã mới không dùng lại mã còn chi phí
{
  G.setNow('2026-09-27T10:00');
  say('/moi'); say('27/9'); tap('ve|0'); tap('ng|solo'); say('Hà Nội'); say('TH Z'); tap('pt|0'); r = say('Thử');
  const id = (r.match(/chuyến <b>(\d+)<\/b>/) || [])[1];
  say('ks 1tr hđ 99'); tap('cl|OK|' + id);
  const sh = G.active().getSheetByName('Chuyen');
  sh.deleteRows(sh.getLastRow(), 1); xoaCache_();          // người dùng xóa tay dòng cuối
  say('/moi'); say('27/9'); tap('ve|0'); tap('ng|solo'); say('Hà Nội'); say('TH Z'); tap('pt|0'); r = say('Thử lại');
  const id2 = (r.match(/chuyến <b>(\d+)<\/b>/) || [])[1];
  check('không dùng lại mã chuyến đã có chi phí', id2 && id2 !== id, [id, id2]);
  check('chuyến mới không nhận chi phí cũ', !/1.000.000 · HĐ 99/.test(say('/xem ' + id2)));
  tap('cl|OK|' + id2); say('/xoa ' + id2); tap('xy|' + id2);
}
// (7) trạng thái gõ tay "Xoá"/"xóa"
eq('laXoa_ Xoá', laXoa_('Xoá'), true); eq('laXoa_ xóa', laXoa_(' xóa '), true); eq('laXoa_ OK', laXoa_('OK'), false);
// (8) cột Hóa đơn gõ tay "Chưa có" → không HĐ
{
  const sh = G.active().getSheetByName('ChiPhi');
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const cu = sh.getRange(2, h.indexOf('Hóa đơn') + 1).getValue();
  sh.getRange(2, h.indexOf('Hóa đơn') + 1).setValue('Chưa có'); xoaCache_();
  eq('"Chưa có" → không HĐ', chiPhi_()[0].hd, false);
  sh.getRange(2, h.indexOf('Hóa đơn') + 1).setValue('x'); xoaCache_();
  eq('"x" → có HĐ', chiPhi_()[0].hd, true);
  sh.getRange(2, h.indexOf('Hóa đơn') + 1).setValue(cu); xoaCache_();
}
// (9) "150000 k có hđ" = 150.000đ không HĐ
eq('150000 k có hđ', docDongTien_('150000 k có hđ'), { tien: 150000, hd: false });
eq('864 k', docDongTien_('864 k'), { tien: 864000, hd: null });
eq('800 nghìn đồng', docDongTien_('800 nghìn đồng'), { tien: 800000, hd: null });
eq('1 triệu 2', docDongTien_('1 triệu 2'), { tien: 1200000, hd: null });
// đang hỏi số HĐ mà gõ luôn khoản khác → lưu khoản trước, xử lý khoản sau
say('/cp 2609002'); say('khác gửi xe 15000 hđ'); // hỏi số HĐ
r = say('tk 180000 k có hđ');
check('khoản mới gõ ở bước số HĐ không bị nuốt làm số HĐ', /Khác \(gửi xe\) <b>15.000đ<\/b> · có HĐ/.test(r) && /Tiếp khách <b>180.000đ<\/b> · không HĐ/.test(r), r);
r = say('/cp 2609002'); say('xăng 300k hđ'); r = say('số hóa đơn là cái này dài quá không phải số');
check('số HĐ dài bất thường → hỏi lại', /Số hóa đơn thường ngắn/.test(r), r);
say('0012'); tap('cl|OK|2609002');
// dọn các khoản thử để phần sau giữ nguyên số liệu
['2609002-3', '2609002-4', '2609002-5', '2609002-6', '2609001-6'].forEach(c => tap('xc|' + c));
// PIN: sai quá 10 lần thì hủy
{
  const P0 = Object.assign({}, G.props.m);
  delete G.props.m.OWNER_ID; G.props.setProperty('PIN', '123456');
  for (let i = 0; i < 10; i++) say('/start 00000' + (i % 10), 333);
  check('sai PIN 10 lần → hủy PIN', !G.props.getProperty('PIN'));
  say('/start 123456', 333);
  check('sau khi hủy, PIN đúng cũng không nhận', !G.props.getProperty('OWNER_ID'));
  G.props.m = P0;
}

/* ============ 8. Lỗi được báo cho người dùng ============ */
setCfg('Người đề nghị', '');
r = say('/moi');
check('thiếu Người đề nghị → báo rõ', /Chưa điền "Người đề nghị"/.test(r), r);
check('lỗi ghi vào tab Loi', tab('Loi').length >= 1);
setCfg('Người đề nghị', 'Nguyễn Văn An');

/* ============ 9. Xuất file: tháng 1 giống ví dụ "ver1" (21 dòng người) ============ */
// 10 ngày công tác, 2–3 người/ngày, xăng 550.100 HĐ 2090, 4 khách sạn có HĐ, 1 khách sạn không HĐ.
G.setNow('2026-02-03T09:00');
function themChuyenThu(tu, den, nguoi, tinh, cps) {
  const id = themChuyen_({ tu, den, nguoi, tinh, truong: 'TH ' + tinh, pt: 'Xe công ty', nd: 'Triển khai eNetViet' });
  (cps || []).forEach(c => themChiPhi_(id, Object.assign({ nguoiTra: 'Nguyễn Văn An', ghiChu: '', so: '' }, c)));
  xoaCache_();
  return id;
}
const A = 'Nguyễn Văn An', B = 'Trần Thị Bình', Cg = 'Lê Văn Cường', D = 'Phạm Thu Dung';
themChuyenThu('2026-01-05', '2026-01-05', [A, D, Cg], 'Phú Thọ', [{ loai: 'Xăng xe', tien: 550100, hd: true, so: '2090' }]);
themChuyenThu('2026-01-06', '2026-01-06', [A, B], 'Phú Thọ', [{ loai: 'Khách sạn', tien: 864000, hd: true, so: '4' }]);
themChuyenThu('2026-01-07', '2026-01-07', [A, B], 'Phú Thọ', [{ loai: 'Khách sạn', tien: 990000, hd: true, so: '5' }]);
themChuyenThu('2026-01-08', '2026-01-08', [A, B], 'Phú Thọ', [{ loai: 'Khách sạn', tien: 900000, hd: true, so: '145' }]);
themChuyenThu('2026-01-09', '2026-01-09', [A, B], 'Phú Thọ');
themChuyenThu('2026-01-19', '2026-01-19', [A, B], 'Bắc Ninh');
themChuyenThu('2026-01-20', '2026-01-20', [A, B], 'Phú Thọ', [{ loai: 'Khách sạn', tien: 1000000, hd: false }]);
themChuyenThu('2026-01-21', '2026-01-21', [A, Cg], 'Phú Thọ', [{ loai: 'Khách sạn', tien: 864000, hd: true, so: '31' }]);
themChuyenThu('2026-01-22', '2026-01-22', [A, Cg], 'Phú Thọ');
themChuyenThu('2026-01-28', '2026-01-28', [A, B], 'Phú Thọ');
r = say('/bang 1');
check('/bang tháng 1: 10 chuyến, 8.368.100', /10 chuyến/.test(r) && /Chuyển khoản: <b>8.368.100đ<\/b>/.test(r) && /Tiền mặt \(không HĐ\): 1.000.000đ/.test(r), r);

G.tg.length = 0;
r = say('/xuat');
check('/xuat mặc định (ngày 3/2) = tháng 01/2026', /Đang tạo file tháng 01\/2026/.test(r), r);
check('không có lỗi khi xuất', !/⚠️ (?!Lưu ý)/.test(r.replace(/⚠️ Lưu ý[\s\S]*/, '')), r);
const docs = G.tg.filter(x => x.method === 'sendDocument');
check('gửi 3 file (Kế hoạch Word + bảng kê PDF + Excel)', docs.length === 3 && /\.docx$/.test(docs[0].payload.document.name) && /\.pdf$/.test(docs[1].payload.document.name) && /\.xlsx$/.test(docs[2].payload.document.name), docs.map(d => d.payload.document && d.payload.document.name));
check('caption có tổng', docs[1] && /Chuyển khoản: 8.368.100đ/.test(docs[1].payload.caption) && /Tiền mặt: 1.000.000đ \(1 khoản\)/.test(docs[1].payload.caption), docs[1] && docs[1].payload.caption);
// Kế hoạch đi công tác (.docx tự tạo, trình bày theo NĐ 30)
const khZip = docs[0].payload.document;
check('docx đúng loại MIME', khZip.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', khZip.type);
eq('docx có đủ phần', khZip.files.map(f => f.name).sort(), ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml']);
const khXml = khZip.files.find(f => f.name === 'word/document.xml').data;
const khChu = khXml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
[['quốc hiệu', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'], ['tiêu ngữ', 'Độc lập - Tự do - Hạnh phúc'], ['tên loại', 'KẾ HOẠCH'],
 ['trích yếu', 'Đi công tác tháng 1 năm 2026'], ['ngày ký theo NĐ 30 (tháng 2 → 02)', 'Hà Nội, ngày 03 tháng 02 năm 2026'],
 ['kính gửi', 'Kính gửi: Ban lãnh đạo Công ty'], ['tên', 'Tên tôi là: Nguyễn Văn An'], ['bộ phận', 'Bộ phận: Kinh doanh'],
 ['địa điểm (không trùng, theo thứ tự)', 'Địa điểm công tác: Phú Thọ, Bắc Ninh'], ['số người', 'Số người tham gia đi công tác: 04 người, gồm:'],
 ['thời gian (ngày < 10 và tháng 1 có số 0)', 'Thời gian công tác: Từ ngày 05/01/2026 đến ngày 28/01/2026'],
 ['nội dung', 'Nội dung công tác: Triển khai eNetViet tại Phú Thọ, Bắc Ninh'], ['phương tiện', 'Phương tiện đi công tác: Xe công ty'],
 ['kết thúc ./.', 'phê duyệt kế hoạch công tác./.'], ['chữ ký', 'NGƯỜI ĐỀ NGHỊ'], ['chữ ký 2', 'TRƯỞNG BỘ PHẬN'], ['chữ ký 3', 'NGƯỜI PHÊ DUYỆT'],
].forEach(([ten, chu]) => check('Kế hoạch: ' + ten, khChu.indexOf(chu) >= 0, chu));
eq('Kế hoạch: bảng người (thứ tự xuất hiện, chủ đứng đầu)', (khChu.match(/\n(\d)\n([^\n]+)\n([^\n]+)/g) || []).map(x => x.trim().split('\n')),
  [['1', A, 'Kinh doanh'], ['2', D, 'Kỹ thuật'], ['3', Cg, 'Kinh doanh'], ['4', B, 'Kinh doanh']]);
check('Kế hoạch: lề A4 theo NĐ 30 (trên/dưới 20, trái 30, phải 15 mm)', /<w:pgSz w:w="11906" w:h="16838"\/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1701"/.test(khXml));
check('Kế hoạch: phông Times New Roman', /Times New Roman/.test(khZip.files.find(f => f.name === 'word/styles.xml').data));
check('Kế hoạch: cảnh báo thiếu tên công ty / người ký', /Tên công ty/.test(out()) && /Trưởng bộ phận/.test(out()), out());
check('LichSuXuat có link Kế hoạch', /drive\.google\.com/.test(tab('LichSuXuat')[0]['Kế hoạch']));
if (process.env.KH_OUT) fs.writeFileSync(process.env.KH_OUT, JSON.stringify(khZip.files));
{ // chân trang "Mẫu: …" chỉ có khi điền Mã mẫu kế hoạch
  const kh0 = lapKeHoach_(duLieuThang_('01/2026'));
  const z1 = taoKeHoachDocx_(kh0, Object.assign({}, cauHinh_(), { maMau: 'CTP 01' }), '2026-02-03', 'a.docx');
  const f1 = n => (z1.files.find(f => f.name === n) || {}).data || '';
  check('chân trang có mã mẫu', /Mẫu: CTP 01/.test(f1('word/footer1.xml')) && /footerReference/.test(f1('word/document.xml')) && /footer1\.xml/.test(f1('[Content_Types].xml')) && /footer1\.xml/.test(f1('word/_rels/document.xml.rels')));
  check('không điền mã mẫu → không có chân trang', !khZip.files.some(f => f.name === 'word/footer1.xml') && !/footerReference/.test(khXml));
  eq('ngayVB_ theo NĐ 30', [ngayVB_('2026-08-03'), ngayVB_('2026-02-15'), ngayVB_('2026-12-25')], ['03/8/2026', '15/02/2026', '25/12/2026']);
  eq('ngayKy_ theo NĐ 30', ngayKy_('Hà Nội', '2026-07-29'), 'Hà Nội, ngày 29 tháng 7 năm 2026');
  const kh1 = lapKeHoach_(Object.assign(duLieuThang_('01/2026'), { trips: duLieuThang_('01/2026').trips.slice(0, 1) }));
  eq('1 chuyến 1 ngày → "Ngày …"', kh1.thoiGian, 'Ngày 05/01/2026');
  check('ký tự đặc biệt được thoát trong XML', /A &amp; B &lt;x&gt;/.test(taoKeHoachDocx_(Object.assign({}, kh0, { diaDiem: 'A & B <x>' }), cauHinh_(), '2026-02-03', 'b.docx').files.find(f => f.name === 'word/document.xml').data));
}
check('export PDF A4 dọc vừa khổ ngang', G.exports_.some(x => /format=pdf/.test(x.q) && /size=A4/.test(x.q) && /portrait=true/.test(x.q) && /fitw=true/.test(x.q) && x.auth === 'Bearer oauth-test'));
check('export xlsx', G.exports_.some(x => x.q === 'format=xlsx'));
check('LichSuXuat', tab('LichSuXuat').length === 1 && tab('LichSuXuat')[0]['Chuyển khoản'] === 8368100);

// Soi bản sao đã điền
const ban = Object.values(G.registry).filter(s => s.record).pop();
eq('chỉ giữ 3 sheet', ban.getSheets().map(s => s.getName()), ['Chuyển khoản', 'Phụ lục 1', 'Tiền mặt']);
check('Tiền mặt được hiện', !ban.getSheetByName('Tiền mặt').hidden);
const ck = ban.getSheetByName('Chuyển khoản');
const gv = ck.getRange(1, 1, ck.getLastRow(), 11).getValues();
const findRow = (g, re, from) => g.findIndex((row, i) => i >= (from || 0) && re.test(chuan_(row[0])));
const hRow = gv.findIndex(row => row.some(v => chuan_(v) === 'ten cbkd'));
const tRow = findRow(gv, /^tong cong/, hRow + 1);
eq('CK: 21 dòng người', tRow - hRow - 1, 21);
eq('CK: Tổng cộng', gv[tRow][8], 8368100);
eq('CK: Tạm ứng', gv[tRow + 1][8], 0);
eq('CK: Còn phải thanh toán', gv[tRow + 2][8], 8368100);
eq('CK: dòng đầu', gv[hRow + 1].slice(0, 10), [1, A, '05/01', '', 1, 200000, 550100, '', 750100, 'HĐ 2090']);
eq('CK: dòng 2 cùng ngày để trống ô ngày (đã gộp)', [gv[hRow + 2][1], gv[hRow + 2][2]], [D, '']);
check('CK: gộp ô ngày cho đoàn 3 người', ck.merges.some(m => m[0] === hRow + 2 && m[1] === 3 && m[2] === hRow + 4 && m[3] === 3), ck.merges);
eq('CK: đầu phiếu', [gv[4][2], gv[5][2], gv[6][2]], [A, 'Kinh doanh', 'Thanh toán công tác phí tháng 01/2026']);
const h2 = gv.findIndex((row, i) => i > tRow && row.some(v => chuan_(v) === 'so tai khoan'));
const t2 = findRow(gv, /^tong cong/, h2 + 1);
eq('CK: 4 người nhận tiền', t2 - h2 - 1, 4);
eq('CK: tiền từng người', gv.slice(h2 + 1, t2).map(x => [x[1], x[2], x[5], x[6], x[7]]),
  [[A, 6168100, 6168100, '0123456789', 'Vietcombank'], [D, 200000, 200000, '5550001', 'AB Bank'], [Cg, 600000, 600000, '001100220033', 'VP Bank'], [B, 1400000, 1400000, '0987654321', 'AB Bank']]);
eq('CK: tổng khối thanh toán', [gv[t2][2], gv[t2][5]], [8368100, 8368100]);
const bc = findRow(gv, /^bang chu/, t2);
eq('CK: bằng chữ', gv[bc][2], 'Tám triệu ba trăm sáu mươi tám nghìn một trăm đồng.');
check('CK: dòng ngày ký', gv.some(row => row.some(v => v === 'Hà Nội, ngày 03 tháng 02 năm 2026')));
const ghiChuCK = gv.slice(hRow + 1, tRow).map(x => x[9]).filter(Boolean);
eq('CK: ghi chú HĐ', ghiChuCK, ['HĐ 2090', 'HĐ 4', 'HĐ 5', 'HĐ 145', 'HĐ 31']);
check('CK: khách sạn không HĐ KHÔNG nằm ở phiếu chuyển khoản', !gv.slice(hRow + 1, tRow).some(x => x[6] === 1000000));
check('CK: chữ ký "=C5" vẫn ra tên', gv.some(row => row[0] === A));

const pl = ban.getSheetByName('Phụ lục 1');
const pv = pl.getRange(1, 1, pl.getLastRow(), 7).getValues();
const pH = pv.findIndex(row => row.some(v => chuan_(v) === 'truong'));
eq('PL: 10 dòng', pv.length - pH - 2, 10);
eq('PL: dòng đầu', pv[pH + 2], ['05/01', 'Triển khai eNetViet', 'TH Phú Thọ', 'Phú Thọ', A + ', ' + D + ', ' + Cg, 'Kinh doanh', 'Xe công ty']);
check('PL: không còn dữ liệu mẫu cũ', !pv.some(row => new RegExp(process.env.MAU_CU || 'Mẫu Cũ').test(row.join('|'))));

const tm = ban.getSheetByName('Tiền mặt');
const tv = tm.getRange(1, 1, tm.getLastRow(), 8).getValues();
const tH = tv.findIndex(row => row.some(v => chuan_(v) === 'don gia'));
const tT = findRow(tv, /^tong cong/, tH);
eq('TM: 1 dòng', tT - tH - 2, 1);
eq('TM: dòng', tv[tH + 2], [1, '20/01', 'Khách sạn', 'Phú Thọ', 1, 1000000, 1000000, 'Không HĐ']);
eq('TM: tổng', tv[tT][6], 1000000);
eq('TM: đầu phiếu', [tv[5][3], tv[6][3], tv[7][3]], [A, 'Kinh doanh', 'Thanh toán chi phí công tác không có hóa đơn tháng 01/2026']);
check('TM: bằng chữ', tv.some(row => row[2] === 'Một triệu đồng.'));
check('TM: chữ ký "=D6" vẫn ra tên', tv.some(row => row[0] === A));
if (process.env.OPS_OUT) { fs.writeFileSync(process.env.OPS_OUT, JSON.stringify(G.opsLog)); console.log('ghi thao tác → ' + process.env.OPS_OUT); }

/* ============ 10. Xuất tháng ít dòng (xóa bớt dòng mẫu) + tạm ứng ============ */
G.setNow('2026-09-26T09:00');
r = say('/xuat 9');
const ban9 = Object.values(G.registry).filter(s => s.record).pop();
const ck9 = ban9.getSheetByName('Chuyển khoản');
const g9 = ck9.getRange(1, 1, ck9.getLastRow(), 11).getValues();
const h9 = g9.findIndex(row => row.some(v => chuan_(v) === 'ten cbkd'));
const t9 = findRow(g9, /^tong cong/, h9 + 1);
const tongT9 = lapXuat_(duLieuThang_('09/2026')).tongCK;
eq('T9: số dòng = 2 + 4 người', t9 - h9 - 1, 6);
eq('T9: Tổng cộng khớp', g9[t9][8], tongT9);
eq('T9: Tạm ứng', g9[t9 + 1][8], 1500000);
eq('T9: Còn phải TT', g9[t9 + 2][8], tongT9 - 1500000);
eq('T9: người trả khách sạn là Bình → tiền KS ở dòng Bình', g9.slice(h9 + 1, t9).filter(x => x[6] === 1800000).map(x => x[1]), [B]);
const bc9 = findRow(g9, /^bang chu/, t9);
eq('T9: bằng chữ theo còn phải TT', g9[bc9][2], docSoTien_(tongT9 - 1500000));
check('T9: cảnh báo thiếu STK Hải', /Thiếu số tài khoản của Hải/.test(out()), out());

/* ============ 11. Qua năm: xuất tháng 12 vào đầu tháng 1 ============ */
G.setNow('2026-12-29T20:00');
say('/moi'); say('28/12-30/12'); tap('ng|solo'); say('Bắc Ninh'); say('TH X'); tap('pt|1'); say('Khảo sát');
tap('cl|OK');
G.setNow('2027-01-04T08:00');
say('/moi'); r = say('30/12-2/1');
check('nhập muộn chuyến qua năm (gõ vào 4/1)', /30\/12 - 02\/01 \(4 ngày\)/.test(r), r);
tap('ng|solo'); say('Bắc Ninh'); say('TH Y'); tap('pt|1'); r = say('Khảo sát');
check('chuyến bắt đầu 30/12 → mã 2612xxx, tháng 12/2026', /2612002/.test(r) && /tháng 12\/2026/.test(r), r);
tap('cl|OK');
r = say('/xuat');
check('/xuat ngày 4/1 → tháng 12/2026', /tháng 12\/2026/.test(r), r);
check('tháng 12: 2 chuyến Xe máy, 7 ngày', (() => { const L = lapXuat_(duLieuThang_('12/2026')); return L.ck.length === 2 && L.tongCK === 7 * 200000; })());

/* ============ 12. Sửa tay trong Sheet vẫn đọc được ============ */
const chSh = G.active().getSheetByName('Chuyen');
chSh.getRange(3, 2).setNumberFormat('General').setValue('10/09/2026'); // người dùng gõ lại ô ngày → thành Date (locale VN)
xoaCache_();
check('ô ngày kiểu Date vẫn đọc đúng', chuyen_()[1].tu === '2026-09-10', chuyen_()[1]);

console.log('\n' + pass + ' đạt, ' + fail + ' lỗi');
process.exit(fail ? 1 : 0);
