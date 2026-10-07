/*************************************************************************
 * BOT CÔNG TÁC PHÍ v2 — Telegram → Google Sheet → file in đúng mẫu kế toán
 *
 * - Chỉ 1 người dùng (chủ bot). Người lạ nhắn vào: bot im lặng.
 * - Không tự nhắc. Bạn nhập khi nào muốn; mỗi bước được lưu ngay, bị gián đoạn không mất.
 * - /xuat tạo PDF (để in) + Excel theo mẫu: "Chuyển khoản" + "Phụ lục 1"
 *   (thêm "Tiền mặt" nếu tháng đó có khoản không hóa đơn).
 *
 * Cài đặt: xem HUONG_DAN.md.
 * Sửa code về sau: Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy
 *   (giữ nguyên URL, không phải chạy lại datWebhook).
 * KHÔNG dán token vào code: token nằm ở ⚙ Project Settings → Script properties.
 *************************************************************************/

const TZ = 'Asia/Ho_Chi_Minh';

const TAB = { CHUYEN: 'Chuyen', CHIPHI: 'ChiPhi', NHANSU: 'NhanSu', TAMUNG: 'TamUng', CAUHINH: 'CauHinh', LICHSU: 'LichSuXuat', LOI: 'Loi' };

const COT = {
  Chuyen:     ['ID', 'Từ ngày', 'Đến ngày', 'Số ngày', 'Tháng TT', 'Địa bàn', 'Trường', 'Nội dung', 'Phương tiện', 'Người đi', 'Trạng thái', 'Tạo lúc'],
  ChiPhi:     ['ID', 'ID chuyến', 'Loại', 'Số tiền', 'Hóa đơn', 'Số HĐ', 'Người trả', 'Ghi chú', 'Trạng thái', 'Tạo lúc'],
  NhanSu:     ['Họ tên', 'Tên gọi', 'Bộ phận', 'Số tài khoản', 'Ngân hàng', 'Chức vụ'],
  TamUng:     ['Tháng TT', 'Họ tên', 'Số tiền', 'Ghi chú'],
  CauHinh:    ['Mục', 'Giá trị', 'Giải thích'],
  LichSuXuat: ['Thời điểm', 'Tháng', 'Chuyển khoản', 'Tiền mặt', 'File PDF', 'File Excel', 'Kế hoạch'],
  Loi:        ['Thời điểm', 'Lỗi'],
};
// Cột số; mọi cột khác lưu dạng chữ để Sheet không tự đổi "06/07/2026" thành ngày kiểu Mỹ
// hay làm mất số 0 đầu số tài khoản.
const COT_SO = ['Số ngày', 'Số tiền', 'Chuyển khoản', 'Tiền mặt'];

const CAUHINH_MAC_DINH = [
  ['Người đề nghị', '', 'Họ tên đầy đủ của bạn, viết giống hệt 1 dòng trong tab NhanSu'],
  ['Bộ phận', 'Kinh doanh', ''],
  ['CTP mỗi ngày', 200000, 'Công tác phí 1 người 1 ngày'],
  ['Nội dung mặc định', 'Triển khai eNetViet', 'Nút gợi ý khi tạo chuyến'],
  ['Mục đích', 'Thanh toán công tác phí tháng {thang}', '{thang} được thay bằng tháng xuất, vd 09/2026'],
  ['Nơi ký', 'Hà Nội', 'Dòng "Hà Nội, ngày … tháng … năm …"'],
  ['ID file mẫu', '', 'Dán đường link Google Sheet mẫu của kế toán (hoặc chỉ phần ID)'],
  ['Tối đa khoản không HĐ/tháng', 2, 'Quy định công ty; vượt thì bot cảnh báo'],
  ['Phụ lục mỗi người 1 dòng', 'Không', 'Có = mỗi người trong đoàn 1 dòng; Không = cả đoàn 1 dòng'],
  ['Tên công ty', '', 'Đầu Kế hoạch công tác. Dấu | để xuống dòng, vd: CÔNG TY CỔ PHẦN TẬP ĐOÀN|CÔNG NGHỆ ABC'],
  ['Kính gửi (kế hoạch)', 'Ban lãnh đạo Công ty', ''],
  ['Trưởng bộ phận', '', 'Họ tên, in ở chữ ký Kế hoạch công tác'],
  ['Người phê duyệt', '', 'Họ tên, in ở chữ ký Kế hoạch công tác'],
  ['Mã mẫu kế hoạch', '', 'Ghi ở chân trang Kế hoạch, vd: CTP 01 (để trống = không ghi)'],
  ['Lề PDF bảng kê (mm)', '20 15 20 30', 'Trên, phải, dưới, trái. Mặc định theo NĐ 30: 20 15 20 30'],
];

const LOAI = { KS: 'Khách sạn', XX: 'Xăng xe', TK: 'Tiếp khách', KH: 'Khác' };
const PHUONG_TIEN = ['Xe công ty', 'Xe máy', 'Taxi/ Xe khách', 'Ô tô cá nhân'];
const MAU = { CK: 'Chuyển khoản', PL: 'Phụ lục 1', TM: 'Tiền mặt' };
const THU_MUC = 'CTP - File xuất';

const LENH = [
  { command: 'moi', description: 'Tạo chuyến công tác mới' },
  { command: 'lai', description: 'Tạo chuyến giống chuyến trước' },
  { command: 'cp', description: 'Thêm chi phí cho chuyến vừa tạo' },
  { command: 'bang', description: 'Xem tổng hợp tháng (/bang 9)' },
  { command: 'xem', description: 'Xem, xóa 1 chuyến (/xem 2609001)' },
  { command: 'tamung', description: 'Ghi tạm ứng (/tamung 2tr)' },
  { command: 'xuat', description: 'Xuất file in (/xuat 9)' },
  { command: 'huy', description: 'Hủy thao tác đang dở' },
  { command: 'help', description: 'Hướng dẫn' },
];

function HELP_() {
  return '<b>Bot công tác phí</b>\n' +
    '/moi — tạo chuyến mới (bot hỏi từng bước, bấm nút là chính)\n' +
    '/lai — chuyến giống chuyến trước: chỉ hỏi ngày và trường\n' +
    '/cp — thêm chi phí cho chuyến vừa tạo (<code>/cp 2609001</code> cho chuyến khác)\n' +
    '/bang — tổng hợp tháng này (<code>/bang 8</code> cho tháng 8)\n' +
    '/xem — xem, xóa chi phí hoặc chuyến (<code>/xem 2609001</code>)\n' +
    '/tamung — ghi tạm ứng tháng này (<code>/tamung 2tr</code>)\n' +
    '/xuat — xuất PDF + Excel để in (<code>/xuat 9</code>)\n' +
    '/huy — hủy thao tác đang dở\n\n' +
    'Gõ nhanh chi phí: <code>ks 1tr8 hđ 145</code> · <code>xăng 550k khd</code> · <code>tk 1.2tr hđ 88</code> · <code>khác vé xe 120k khd</code>\n' +
    'Sửa tên trường, ngày… thì sửa thẳng trong Google Sheet. Xóa thì dùng /xem (đừng xóa dòng trong Sheet).';
}

/* ======================= WEBHOOK ======================= */

function doPost(e) {
  xoaCache_();
  try {
    const P = P_();
    const secret = P.getProperty('SECRET');
    if (!secret || !e || !e.parameter || e.parameter.k !== secret || !e.postData) return ok_();
    const upd = JSON.parse(e.postData.contents);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(28000)) return ok_();
    try {
      if (!daXuLy_(upd.update_id)) xuLyUpdate_(upd);
    } finally { lock.releaseLock(); }
  } catch (err) { ghiLoi_(err); }
  return ok_();
}
// HtmlService trả thẳng mã 200. ContentService trả 302 → Telegram tưởng lỗi, gửi lại tin cũ liên tục.
function ok_() { return HtmlService.createHtmlOutput('ok'); }
function doGet() { return HtmlService.createHtmlOutput('Bot công tác phí v2 đang chạy.'); }

// Nhớ 50 update_id gần nhất. Không so "lớn hơn" vì bot im hơn 1 tuần thì Telegram đánh số lại ngẫu nhiên.
function daXuLy_(id) {
  if (id === undefined || id === null) return false;
  const P = P_();
  let ds = [];
  try { ds = JSON.parse(P.getProperty('UPD') || '[]'); } catch (e) {}
  if (ds.indexOf(id) >= 0) return true;
  ds.push(id);
  if (ds.length > 50) ds = ds.slice(-50);
  P.setProperty('UPD', JSON.stringify(ds));
  return false;
}

let CHAT_ = null; // chat đang trả lời (= chủ bot)

function xuLyUpdate_(upd) {
  const P = P_();
  const cq = upd.callback_query, msg = upd.message;
  const from = cq ? cq.from : (msg ? msg.from : null);
  const chat = cq ? (cq.message && cq.message.chat) : (msg && msg.chat);
  if (!from || !chat || chat.type !== 'private') return;
  const owner = P.getProperty('OWNER_ID');
  if (!owner) { nhanChu_(msg, P); return; }
  if (String(from.id) !== owner) return; // người lạ: im lặng
  CHAT_ = chat.id;
  try {
    if (cq) xuLyNut_(cq);
    else xuLyTin_(String(msg.text || msg.caption || '').normalize('NFC').trim());
  } catch (err) {
    ghiLoi_(err);
    send_('⚠️ ' + esc_(err && err.message ? err.message : String(err)) + '\nKiểm tra lại bằng /bang.');
  }
}

// Lần đầu: ai gửi đúng "/start <PIN>" (PIN do caiDat() tạo) thì thành chủ bot.
function nhanChu_(msg, P) {
  if (!msg || !msg.text) return;
  const pin = P.getProperty('PIN');
  const m = msg.text.trim().match(/^\/start\s+(\d{6})$/);
  if (!pin || !m) return;
  if (m[1] !== pin) { // sai quá 10 lần → hủy PIN, phải chạy lại caiDat()
    const sai = +(P.getProperty('PIN_SAI') || 0) + 1;
    if (sai >= 10) { P.deleteProperty('PIN'); P.deleteProperty('PIN_SAI'); } else P.setProperty('PIN_SAI', String(sai));
    return;
  }
  P.deleteProperty('PIN_SAI');
  P.setProperty('OWNER_ID', String(msg.from.id));
  P.deleteProperty('PIN');
  CHAT_ = msg.chat.id;
  send_('✅ Đã nhận bạn là chủ bot. Từ giờ bot chỉ trả lời bạn.\n\n' + HELP_());
}

/* ======================= TIN NHẮN CHỮ ======================= */

function xuLyTin_(text) {
  if (!text) { send_('Bot chỉ đọc chữ. Gửi ảnh hóa đơn thì gõ số tiền vào phần chú thích ảnh.'); return; }
  if (text.charAt(0) === '/') {
    const sp = text.search(/\s/);
    const lenh = (sp < 0 ? text : text.slice(0, sp)).toLowerCase().replace(/@\S*$/, '');
    const ts = sp < 0 ? '' : text.slice(sp + 1).trim();
    const map = {
      '/start': lenhHelp_, '/help': lenhHelp_, '/huy': lenhHuy_, '/moi': batDauMoi_, '/lai': batDauLai_,
      '/cp': batDauCP_, '/bang': lenhBang_, '/xem': lenhXem_, '/xoa': lenhXoa_, '/tamung': lenhTamUng_, '/xuat': lenhXuat_,
    };
    if (map[lenh]) map[lenh](ts);
    else send_('Không có lệnh ' + esc_(lenh) + '. Gõ /help để xem các lệnh.');
    return;
  }
  const st = getSt_();
  if (!st) {
    const t = docNhanh_(text) && chuyenGanNhat_();
    if (t) {
      setSt_({ f: 'cho', b: 'cho', id: t.id, text: text });
      send_('Thêm "<b>' + esc_(text) + '</b>" vào chuyến <b>' + t.id + '</b> (' + nhanNgay_(t.tu, t.den) + ', ' + esc_(t.tinh) + ')?',
        [[nut_('✅ Thêm vào ' + t.id, 'qc|' + t.id)], [nut_('Không (chuyến khác thì gõ /cp mã chuyến)', 'xn|')]]);
      return;
    }
    send_('Gõ /moi để tạo chuyến mới, /cp để thêm chi phí, /help để xem các lệnh.');
    return;
  }
  buocChu_(st, text);
}

function lenhHelp_() { send_(HELP_()); }
function lenhHuy_() { clrSt_(); send_('Đã hủy thao tác đang dở.'); }

function buocChu_(st, text) {
  const hn = homNay_();
  switch (st.b) {
    case 'ngay': {
      const k = docKhoang_(text, hn);
      if (!k) { send_('Chưa hiểu ngày. Gõ kiểu <code>10/9</code> hoặc <code>10/9-12/9</code>.'); return; }
      if (k.den) { if (datNgay_(st, k.tu, k.den)) sauNgay_(st); return; }
      st.t.tu = k.tu; st.b = 'ngayve'; setSt_(st); hoiNgayVe_(st); return;
    }
    case 'ngayve': {
      const d = docNgay_(text, hn, st.t.tu);
      if (!d) { send_('Chưa hiểu ngày về. Gõ kiểu <code>' + dm_(congNgay_(st.t.tu, 2)) + '</code>.'); return; }
      if (datNgay_(st, st.t.tu, d)) sauNgay_(st);
      return;
    }
    case 'nguoi': nhapNguoi_(st, text); return;
    case 'tinh': st.t.tinh = text.slice(0, 60); sauTinh_(st); return;
    case 'truong':
      st.t.truong = /^[-–—]$/.test(text) ? '' : text.split(/\s*[,;\n]\s*/).filter(Boolean).join(', ').slice(0, 1500);
      sauTruong_(st); return;
    case 'pt': {
      const i = doanPT_(text);
      if (i < 0) { send_('Chưa hiểu. Bấm 1 nút phương tiện:'); hoiPT_(); return; }
      st.t.pt = PHUONG_TIEN[i]; st.b = 'nd'; setSt_(st); hoiND_(st); return;
    }
    case 'nd': st.t.nd = text.slice(0, 200); luuChuyenMoi_(st); return;
    case 'menu': {
      const q = docNhanh_(text);
      if (!q) {
        send_('Bấm nút loại chi phí, hoặc gõ nhanh: <code>ks 1tr8 hđ 145</code>, <code>xăng 550k khd</code>. Hết chi phí thì bấm ✔ Xong.', banPhimCP_(st.id));
        return;
      }
      st.c = { loai: q.loai, ghiChu: q.ghiChu };
      if (q.ma === 'KH' && !q.ghiChu) { st.b = 'kh'; setSt_(st); hoiKhac_(); return; }
      st.b = 'tien'; setSt_(st);
      if (q.rest) nhapTien_(st, q.rest); else hoiTien_(st);
      return;
    }
    case 'kh': st.c.ghiChu = text.slice(0, 100); st.b = 'tien'; setSt_(st); hoiTien_(st); return;
    case 'tien': {
      const q = docNhanh_(text); // đang hỏi tiền khách sạn mà gõ "xăng 500k" → đổi loại
      if (q && q.rest) { st.c = { loai: q.loai, ghiChu: q.ghiChu }; setSt_(st); nhapTien_(st, q.rest); return; }
      nhapTien_(st, text); return;
    }
    case 'hd': {
      const t = boDau_(text).trim();
      if (/^(co|c|co hd|co hoa don|yes|1)$/.test(t)) { st.c.hd = true; st.b = 'sohd'; setSt_(st); hoiSoHD_(); }
      else if (/^(khong|ko|k|khd|khong hd|khong co|khong hoa don|no|0)$/.test(t)) { st.c.hd = false; luuCP_(st); }
      else send_('Bấm <b>Có hóa đơn</b> hoặc <b>Không hóa đơn</b> ở trên.');
      return;
    }
    case 'sohd': {
      if (docNhanh_(text)) { // gõ luôn khoản khác → lưu khoản đang dở (không số HĐ) rồi xử lý khoản mới
        st.c.so = ''; luuCP_(st);
        const st2 = getSt_();
        if (st2 && st2.b === 'menu') buocChu_(st2, text);
        return;
      }
      const so = text.replace(/^\s*(số|so)?\s*(hđ|hd)\s*[:#.]?\s*/i, '').trim();
      if (!so || so.length > 30 || so.split(/\s+/).length > 3) {
        send_('Số hóa đơn thường ngắn (vd <code>0001234</code>). Gõ lại, hoặc bấm Bỏ qua.', [[nut_('Bỏ qua', 'sh|-')]]);
        return;
      }
      st.c.so = so; luuCP_(st); return;
    }
    default:
      clrSt_(); send_('Gõ /moi để tạo chuyến mới.');
  }
}

/* ======================= NÚT BẤM ======================= */

function xuLyNut_(cq) {
  const data = String(cq.data || '');
  const i = data.indexOf('|');
  const k = i < 0 ? data : data.slice(0, i), v = i < 0 ? '' : data.slice(i + 1);
  const st = getSt_();
  const dung = (fs, b) => st && fs.indexOf(st.f) >= 0 && (!b || st.b === b);
  let toast = '';
  try {
    switch (k) {
      case 'nd': // ngày đi
        if (!dung(['moi', 'lai'], 'ngay')) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq);
        st.t.tu = /^\d{4}-\d\d-\d\d$/.test(v) ? v : v === '1' ? congNgay_(homNay_(), -1) : homNay_();
        st.b = 'ngayve'; setSt_(st); hoiNgayVe_(st); break;
      case 've': // ngày về
        if (!dung(['moi', 'lai'], 'ngayve')) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq);
        if (datNgay_(st, st.t.tu, /^\d{4}-\d\d-\d\d$/.test(v) ? v : v === '1' ? homNay_() : st.t.tu)) sauNgay_(st);
        break;
      case 'ng': // người đi cùng
        if (!dung(['moi'], 'nguoi')) { toast = 'Nút này đã cũ.'; break; }
        if (v === 'ok' || v === 'solo') { boNut_(cq); chotNguoi_(st, v === 'ok' ? (st.chon || []).map(j => st.ds[j].ten) : []); }
        else if (v === 'them') { boNut_(cq); themNhanSu_(st.moi || []); chotNguoi_(st, (st.ok || []).concat(st.moi || [])); }
        else if (v === 'lai') { boNut_(cq); delete st.ok; delete st.moi; hoiNguoi_(st); }
        else {
          const j = +v; st.chon = st.chon || [];
          const at = st.chon.indexOf(j);
          if (at >= 0) st.chon.splice(at, 1); else st.chon.push(j);
          setSt_(st); suaNut_(cq.message.message_id, banPhimNguoi_(st));
        }
        break;
      case 'tn': // tỉnh
        if (!dung(['moi'], 'tinh') || !st.ds || !st.ds[+v]) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq); st.t.tinh = st.ds[+v]; sauTinh_(st); break;
      case 'tr': // trường
        if (!dung(['moi', 'lai'], 'truong')) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq); st.t.truong = v === '=' ? (st.t.truongCu || '') : ''; sauTruong_(st); break;
      case 'pt':
        if (!dung(['moi'], 'pt') || !PHUONG_TIEN[+v]) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq); st.t.pt = PHUONG_TIEN[+v]; st.b = 'nd'; setSt_(st); hoiND_(st); break;
      case 'nc': // nội dung
        if (!dung(['moi'], 'nd') || !st.ds || !st.ds[+v]) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq); st.t.nd = st.ds[+v]; luuChuyenMoi_(st); break;
      case 'cl': { // loại chi phí: "cl|KS|2609001"
        const ma = v.split('|')[0], id = v.split('|')[1] || (st && st.f === 'cp' ? st.id : '');
        const t = id && docChuyen_(id);
        if (!t) { toast = 'Chuyến này không còn. Gõ /cp để thêm chi phí.'; break; }
        const dangMo = st && st.f === 'cp' && st.id === id;
        if (ma === 'OK') { boNut_(cq); if (dangMo) clrSt_(); xongCP_(id); break; }
        if (!LOAI[ma]) { toast = 'Nút này đã cũ.'; break; }
        if (!dangMo) boDo_(st);
        const s2 = dangMo ? st : { f: 'cp', b: 'menu', id: id };
        s2.c = { loai: LOAI[ma], ghiChu: '' };
        if (ma === 'KH') { s2.b = 'kh'; setSt_(s2); hoiKhac_(); }
        else { s2.b = 'tien'; setSt_(s2); hoiTien_(s2); }
        break;
      }
      case 'qc': { // thêm khoản gõ nhanh vào chuyến gần nhất
        if (!dung(['cho']) || st.id !== v) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq);
        const text = st.text;
        setSt_({ f: 'cp', b: 'menu', id: v });
        buocChu_(getSt_(), text);
        break;
      }
      case 'hd':
        if (!dung(['cp'], 'hd')) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq);
        if (v === '1') { st.c.hd = true; st.b = 'sohd'; setSt_(st); hoiSoHD_(); }
        else { st.c.hd = false; luuCP_(st); }
        break;
      case 'sh':
        if (!dung(['cp'], 'sohd')) { toast = 'Nút này đã cũ.'; break; }
        boNut_(cq); st.c.so = ''; luuCP_(st); break;
      case 'xc': toast = xoaCP_(v); break;
      case 'nt': hoiNguoiTra_(v); break;
      case 'np': toast = datNguoiTra_(v); break;
      case 'ct': {
        const t = docChuyen_(v);
        if (!t) { toast = 'Không thấy chuyến này.'; break; }
        boDo_(st); setSt_({ f: 'cp', b: 'menu', id: t.id }); menuCP_(t.id); break;
      }
      case 'xt': send_('Xóa hẳn chuyến <b>' + esc_(v) + '</b> và các chi phí của nó?', [[nut_('🗑 Xóa chuyến ' + v, 'xy|' + v), nut_('Không', 'xn|')]]); break;
      case 'xy': boNut_(cq); toast = xoaChuyen_(v); break;
      case 'xn': boNut_(cq); if (st && st.f === 'cho') clrSt_(); toast = 'Đã bỏ.'; break;
      default: toast = 'Nút này đã cũ.';
    }
  } finally {
    api_('answerCallbackQuery', { callback_query_id: cq.id, text: toast });
  }
}

/* ======================= LUỒNG TẠO CHUYẾN ======================= */

// Đang nhập dở 1 chuyến mà bắt đầu việc khác → báo cho biết là đã bỏ
function boDo_(st) {
  if (st && (st.f === 'moi' || st.f === 'lai') && st.b !== 'ngay') send_('(Đã bỏ chuyến đang nhập dở, chưa lưu.)');
}

function batDauMoi_() {
  const cfg = cauHinh_();
  boDo_(getSt_());
  setSt_({ f: 'moi', b: 'ngay', t: { nguoi: [cfg.nguoiDeNghi] } });
  hoiNgay_();
}

function batDauLai_() {
  const cu = chuyenGanNhat_();
  if (!cu) { send_('Chưa có chuyến nào để chép. Gõ /moi.'); return; }
  boDo_(getSt_());
  setSt_({ f: 'lai', b: 'ngay', t: { nguoi: cu.nguoi, tinh: cu.tinh, pt: cu.pt, nd: cu.nd, truongCu: cu.truong } });
  send_('Chép chuyến <b>' + cu.id + '</b>: ' + esc_(cu.tinh) + ' · ' + esc_(tenNgan_(cu.nguoi)) + ' · ' + esc_(cu.pt) + ' · ' + esc_(cu.nd));
  hoiNgay_();
}

function hoiNgay_() {
  const hn = homNay_();
  send_('📅 <b>Ngày đi?</b> Bấm nút, hoặc gõ 1 ngày (<code>10/9</code>) hay khoảng ngày (<code>10/9-12/9</code>).',
    [[nut_('Hôm nay ' + dm_(hn), 'nd|' + hn), nut_('Hôm qua ' + dm_(congNgay_(hn, -1)), 'nd|' + congNgay_(hn, -1))]]);
}

function hoiNgayVe_(st) {
  const hn = homNay_();
  const kb = [[nut_('Đi trong ngày (' + dm_(st.t.tu) + ')', 've|0')]];
  if (st.t.tu < hn) kb[0].push(nut_('Về hôm nay ' + dm_(hn), 've|' + hn));
  send_('📅 <b>Ngày về?</b> Bấm nút hoặc gõ ngày (vd <code>' + dm_(congNgay_(st.t.tu, 2)) + '</code>).', kb);
}

function datNgay_(st, tu, den) {
  if (den < tu) { send_('Ngày về (' + dmy_(den) + ') trước ngày đi (' + dmy_(tu) + '). Gõ lại ngày về.'); return false; }
  const n = soNgay_(tu, den);
  if (n > 31) { send_('Chuyến dài ' + n + ' ngày? Gõ lại (tối đa 31 ngày).'); return false; }
  st.t.tu = tu; st.t.den = den;
  return true;
}

function sauNgay_(st) {
  const s = '📅 ' + nhanNgay_(st.t.tu, st.t.den) + ' (' + soNgay_(st.t.tu, st.t.den) + ' ngày)';
  if (st.f === 'lai') { st.b = 'truong'; setSt_(st); send_(s); hoiTruong_(st); }
  else { st.b = 'nguoi'; setSt_(st); send_(s); hoiNguoi_(st); }
}

function hoiNguoi_(st) {
  const cfg = cauHinh_();
  st.ds = nhanSu_().filter(p => p.ten !== cfg.nguoiDeNghi).slice(0, 12).map(p => ({ ten: p.ten, goi: p.goi }));
  st.chon = [];
  st.b = 'nguoi';
  setSt_(st);
  send_('👥 <b>Đi cùng ai?</b> Bấm chọn rồi bấm <b>Xong</b>. Hoặc gõ tên, cách nhau dấu phẩy.' +
    (st.ds.length ? '' : '\n(Tab NhanSu chưa có ai ngoài bạn: gõ tên, bot sẽ hỏi có thêm vào danh bạ không.)'),
    banPhimNguoi_(st));
}

function banPhimNguoi_(st) {
  const kb = [];
  let hang = [];
  (st.ds || []).forEach((p, i) => {
    hang.push(nut_(((st.chon || []).indexOf(i) >= 0 ? '✅ ' : '') + (p.goi || p.ten), 'ng|' + i));
    if (hang.length === 2) { kb.push(hang); hang = []; }
  });
  if (hang.length) kb.push(hang);
  kb.push([nut_('Một mình', 'ng|solo'), nut_('Xong ✔', 'ng|ok')]);
  return kb;
}

function nhapNguoi_(st, text) {
  const cfg = cauHinh_();
  if (/^(mot minh|1 minh|khong|ko|0|-)$/.test(boDau_(text).trim())) { chotNguoi_(st, []); return; }
  const ds = nhanSu_();
  const ok = [], khong = [], nhieu = [];
  text.split(/\s*[,;\n]\s*/).map(s => s.trim()).filter(Boolean).forEach(q => {
    const r = timNguoi_(ds, q);
    if (r.ok) { if (r.ok !== cfg.nguoiDeNghi && ok.indexOf(r.ok) < 0) ok.push(r.ok); }
    else if (r.nhieu) nhieu.push(q + ': ' + r.nhieu.join(', '));
    else khong.push(q.replace(/\s+/g, ' '));
  });
  if (nhieu.length) { send_('Tên trùng nhiều người, gõ đầy đủ hơn:\n• ' + esc_(nhieu.join('\n• '))); return; }
  if (khong.length) {
    st.ok = ok; st.moi = khong; setSt_(st);
    send_('Chưa có trong tab NhanSu: <b>' + esc_(khong.join(', ')) + '</b>',
      [[nut_('➕ Thêm vào danh bạ', 'ng|them')], [nut_('Gõ lại / chọn lại', 'ng|lai')]]);
    return;
  }
  chotNguoi_(st, ok);
}

function chotNguoi_(st, dsTen) {
  const cfg = cauHinh_();
  st.t.nguoi = [cfg.nguoiDeNghi].concat(dsTen.filter(x => x !== cfg.nguoiDeNghi));
  ['ds', 'chon', 'ok', 'moi'].forEach(x => delete st[x]);
  send_('👥 Đoàn: ' + esc_(tenNgan_(st.t.nguoi)));
  st.b = 'tinh'; setSt_(st); hoiTinh_(st);
}

function hoiTinh_(st) {
  st.ds = tinhGanDay_();
  setSt_(st);
  const kb = [];
  for (let i = 0; i < st.ds.length; i += 2) kb.push(st.ds.slice(i, i + 2).map((x, j) => nut_(x, 'tn|' + (i + j))));
  send_('📍 <b>Địa bàn</b> (tỉnh)? Bấm hoặc gõ.', kb.length ? kb : null);
}

function sauTinh_(st) { delete st.ds; st.b = 'truong'; setSt_(st); hoiTruong_(st); }

function hoiTruong_(st) {
  const kb = [[nut_('Bỏ qua (bổ sung sau trong Sheet)', 'tr|-')]];
  if (st.f === 'lai' && st.t.truongCu) kb.unshift([nut_('Giống chuyến trước', 'tr|=')]);
  send_('🏫 <b>Các trường đã đến?</b> Gõ tên, cách nhau dấu phẩy.', kb);
}

function sauTruong_(st) {
  if (st.f === 'lai') { luuChuyenMoi_(st); return; }
  st.b = 'pt'; setSt_(st); hoiPT_();
}

function hoiPT_() {
  send_('🚗 <b>Phương tiện?</b>', [[nut_(PHUONG_TIEN[0], 'pt|0'), nut_(PHUONG_TIEN[1], 'pt|1')], [nut_(PHUONG_TIEN[2], 'pt|2'), nut_(PHUONG_TIEN[3], 'pt|3')]]);
}

function doanPT_(text) {
  const t = boDau_(text);
  if (/cong ty/.test(t)) return 0;
  if (/xe may/.test(t)) return 1;
  if (/taxi|xe khach|grab|xe buyt|bus/.test(t)) return 2;
  if (/ca nhan|o to|oto/.test(t)) return 3;
  return -1;
}

function hoiND_(st) {
  const cfg = cauHinh_();
  const cu = chuyenGanNhat_();
  st.ds = [cu && cu.nd, cfg.ndMacDinh].filter((x, i, a) => x && a.indexOf(x) === i);
  setSt_(st);
  send_('📝 <b>Nội dung công việc?</b> Bấm hoặc gõ.', st.ds.length ? st.ds.map((x, i) => [nut_(x, 'nc|' + i)]) : null);
}

function luuChuyenMoi_(st) {
  const t = st.t;
  delete t.truongCu;
  const trung = chuyenTrung_(t);
  const id = themChuyen_(t);
  setSt_({ f: 'cp', b: 'menu', id: id });
  let s = '✅ Đã lưu chuyến <b>' + id + '</b> (tính vào tháng ' + t.tu.slice(5, 7) + '/' + t.tu.slice(0, 4) + ')\n' +
    moTaChuyen_(Object.assign({ id: id }, t));
  if (trung.length) s += '\n⚠️ Trùng ngày, trùng người với chuyến ' + trung.join(', ') + ' — xem lại kẻo tính công tác phí 2 lần (/xem ' + trung[0] + ').';
  menuCP_(id, s);
}

function moTaChuyen_(t) {
  const cfg = cauHinh_();
  const n = soNgay_(t.tu, t.den);
  return '📅 ' + nhanNgay_(t.tu, t.den) + '/' + t.den.slice(0, 4) + ' (' + n + ' ngày) · 📍 ' + esc_(t.tinh || '—') + '\n' +
    '👥 ' + esc_(tenNgan_(t.nguoi)) + ' · 🚗 ' + esc_(t.pt || '—') + '\n' +
    '📝 ' + esc_(t.nd || '—') + '\n' +
    '🏫 ' + (t.truong ? esc_(t.truong) : '<i>chưa có tên trường</i>') + '\n' +
    '💰 CTP: ' + n + ' ngày × ' + t.nguoi.length + ' người × ' + fmt_(cfg.ctp) + ' = <b>' + fmt_(n * t.nguoi.length * cfg.ctp) + 'đ</b>';
}

/* ======================= LUỒNG CHI PHÍ ======================= */

function batDauCP_(ts) {
  const t = ts ? docChuyen_(ts) : chuyenGanNhat_();
  if (!t) { send_(ts ? 'Không thấy chuyến ' + esc_(ts) + '.' : 'Chưa có chuyến nào. Gõ /moi.'); return; }
  boDo_(getSt_());
  setSt_({ f: 'cp', b: 'menu', id: t.id });
  menuCP_(t.id, 'Chuyến <b>' + t.id + '</b> · ' + nhanNgay_(t.tu, t.den) + ' · ' + esc_(t.tinh));
}

function menuCP_(id, dau) {
  send_((dau ? dau + '\n\n' : '') + '💵 Thêm chi phí cho chuyến <b>' + id + '</b>? Bấm loại, hoặc gõ nhanh: <code>ks 1tr8 hđ 145</code>', banPhimCP_(id));
}

function banPhimCP_(id, them) {
  const d = x => 'cl|' + x + '|' + id;
  const kb = [[nut_('🏨 Khách sạn', d('KS')), nut_('⛽ Xăng xe', d('XX'))], [nut_('🍽 Tiếp khách', d('TK')), nut_('🧾 Khác', d('KH'))], [nut_('✔ Xong', d('OK'))]];
  return them ? them.concat(kb) : kb;
}

function hoiKhac_() { send_('🧾 Khoản gì? (vd <code>vé xe khách</code>, <code>gửi xe</code>)'); }

function hoiTien_(st) {
  send_('💵 Số tiền <b>' + esc_(st.c.loai + (st.c.ghiChu ? ' (' + st.c.ghiChu + ')' : '')) + '</b> (chuyến ' + st.id + ')? vd <code>1tr8</code>, <code>864k</code>, <code>864000</code>\n' +
    'Gõ luôn hóa đơn cũng được: <code>1tr8 hđ 145</code> hoặc <code>1tr8 khd</code>');
}

function hoiSoHD_() { send_('🔢 Số hóa đơn? (gõ số, hoặc bấm Bỏ qua)', [[nut_('Bỏ qua', 'sh|-')]]); }

function nhapTien_(st, text) {
  const r = docDongTien_(text);
  if (r.loi) { send_(r.loi); return; }
  st.c.tien = r.tien;
  if (r.hd === false) { st.c.hd = false; luuCP_(st); return; }
  if (r.hd === true) {
    st.c.hd = true;
    if (r.so) { st.c.so = r.so; luuCP_(st); } else { st.b = 'sohd'; setSt_(st); hoiSoHD_(); }
    return;
  }
  st.b = 'hd'; setSt_(st);
  send_('🧾 ' + esc_(st.c.loai) + ' <b>' + fmt_(r.tien) + 'đ</b> — có hóa đơn không?', [[nut_('Có hóa đơn', 'hd|1'), nut_('Không hóa đơn', 'hd|0')]]);
}

function luuCP_(st) {
  const cfg = cauHinh_();
  const c = st.c;
  const t = docChuyen_(st.id);
  if (!t) { clrSt_(); send_('Chuyến ' + esc_(st.id) + ' không còn (đã xóa?). Chi phí chưa được lưu.'); return; }
  const id = themChiPhi_(st.id, { loai: c.loai, tien: c.tien, hd: !!c.hd, so: c.so || '', nguoiTra: cfg.nguoiDeNghi, ghiChu: c.ghiChu || '' });
  let s = '✅ ' + esc_(c.loai + (c.ghiChu ? ' (' + c.ghiChu + ')' : '')) + ' <b>' + fmt_(c.tien) + 'đ</b> · ' +
    (c.hd ? (c.so ? 'HĐ ' + esc_(c.so) : 'có HĐ') : 'không HĐ → phiếu Tiền mặt') +
    '\n→ chuyến ' + t.id + ' (' + nhanNgay_(t.tu, t.den) + ', ' + esc_(t.tinh) + ')';
  if (!c.hd) {
    const n = demKhongHD_(t.thang);
    s += '\n' + (n > cfg.maxKhongHD ? '⚠️ ' : '') + 'Tháng ' + t.thang + ' đã có ' + n + ' khoản không HĐ (quy định tối đa ' + cfg.maxKhongHD + ').';
  }
  if (c.tien < 10000 || c.tien > 20000000) s += '\n⚠️ Số tiền ' + (c.tien < 10000 ? 'nhỏ' : 'lớn') + ' bất thường — sai thì bấm Xóa.';
  const them = [[nut_('🗑 Xóa khoản này', 'xc|' + id)].concat(t.nguoi.length > 1 ? [nut_('👤 Người khác trả', 'nt|' + id)] : [])];
  delete st.c; st.b = 'menu'; setSt_(st);
  send_(s + '\n\nThêm khoản khác cho chuyến ' + st.id + ', hoặc bấm ✔ Xong.', banPhimCP_(st.id, them));
}

function xongCP_(id) {
  const t = docChuyen_(id);
  if (!t) { send_('Xong.'); return; }
  const cfg = cauHinh_();
  const cps = chiPhi_().filter(c => !c.xoa && c.idChuyen === id);
  const ctp = soNgay_(t.tu, t.den) * t.nguoi.length * cfg.ctp;
  send_('👍 Xong chuyến <b>' + id + '</b>: CTP ' + fmt_(ctp) + 'đ + chi phí ' + fmt_(tong_(cps)) + 'đ (' + cps.length + ' khoản).\n' +
    'Xem cả tháng: /bang · Thêm chi phí sau: <code>/cp ' + id + '</code>');
}

function xoaCP_(cid) {
  const b = docBang_(TAB.CHIPHI);
  const r = b.rows.find(x => String(x['ID']).trim() === cid);
  if (!r) return 'Không thấy khoản này.';
  if (laXoa_(r['Trạng thái'])) return 'Khoản này đã xóa rồi.';
  capNhat_(b, r, 'Trạng thái', 'Xóa');
  send_('🗑 Đã xóa: ' + esc_(r['Loại']) + ' ' + fmt_(Number(r['Số tiền'])) + 'đ (chuyến ' + esc_(r['ID chuyến']) + ').');
  return 'Đã xóa';
}

function hoiNguoiTra_(cid) {
  const c = chiPhi_().find(x => x.id === cid && !x.xoa);
  const t = c && docChuyen_(c.idChuyen);
  if (!t) { send_('Không thấy khoản này.'); return; }
  send_('👤 Ai trả ' + esc_(c.loai) + ' ' + fmt_(c.tien) + 'đ? (tiền hoàn sẽ ghi vào dòng người đó)',
    t.nguoi.map((n, i) => [nut_((n === c.nguoiTra ? '✅ ' : '') + n, 'np|' + cid + '|' + i)]));
}

function datNguoiTra_(v) {
  const j = v.lastIndexOf('|');
  const cid = v.slice(0, j), i = +v.slice(j + 1);
  const b = docBang_(TAB.CHIPHI);
  const r = b.rows.find(x => String(x['ID']).trim() === cid);
  const t = r && docChuyen_(String(r['ID chuyến']).trim());
  if (!t || !t.nguoi[i]) return 'Không đổi được.';
  capNhat_(b, r, 'Người trả', t.nguoi[i]);
  send_('👤 ' + esc_(r['Loại']) + ' ' + fmt_(Number(r['Số tiền'])) + 'đ: ' + esc_(t.nguoi[i]) + ' trả.');
  return 'Đã đổi';
}

/* ======================= XEM / XÓA / TẠM ỨNG ======================= */

function lenhXem_(ts) {
  const id = ts.trim();
  const t = id ? chuyen_().find(x => x.id === id) : chuyenGanNhat_();
  if (!t) { send_(id ? 'Không thấy chuyến ' + esc_(id) + '.' : 'Chưa có chuyến nào.'); return; }
  if (t.xoa) { send_('Chuyến ' + t.id + ' đã bị xóa.'); return; }
  const cps = chiPhi_().filter(c => !c.xoa && c.idChuyen === t.id);
  let s = '<b>Chuyến ' + t.id + '</b>\n' + moTaChuyen_(t);
  s += cps.length ? '\n\nChi phí:\n' + cps.map(c => '• ' + moTaCP_(c)).join('\n') : '\n\nChưa có chi phí.';
  const kb = cps.map(c => [nut_('🗑 Xóa: ' + c.loai + ' ' + fmt_(c.tien), 'xc|' + c.id)]);
  kb.push([nut_('➕ Thêm chi phí', 'ct|' + t.id), nut_('🗑 Xóa chuyến', 'xt|' + t.id)]);
  send_(s, kb);
}

function lenhXoa_(ts) {
  const t = ts ? docChuyen_(ts) : null;
  if (!t) { send_('Gõ <code>/xoa 2609001</code> (mã chuyến xem bằng /bang).'); return; }
  send_('Xóa hẳn chuyến <b>' + t.id + '</b> (' + nhanNgay_(t.tu, t.den) + ', ' + esc_(t.tinh) + ') và các chi phí của nó?',
    [[nut_('🗑 Xóa chuyến ' + t.id, 'xy|' + t.id), nut_('Không', 'xn|')]]);
}

function xoaChuyen_(id) {
  const b = docBang_(TAB.CHUYEN);
  const r = b.rows.find(x => String(x['ID']).trim() === id);
  if (!r) return 'Không thấy chuyến.';
  capNhat_(b, r, 'Trạng thái', 'Xóa');
  const st = getSt_();
  if (st && st.id === id) clrSt_();
  send_('🗑 Đã xóa chuyến ' + esc_(id) + '.');
  return 'Đã xóa';
}

function lenhTamUng_(ts) {
  const cfg = cauHinh_(), hn = homNay_();
  const p = ts.split(/\s+/).filter(Boolean);
  if (!p.length) { send_('Gõ <code>/tamung 2tr</code> (tháng này) hoặc <code>/tamung 2tr 9</code>. Xóa: <code>/tamung 0</code>'); return; }
  const tien = p[0] === '0' ? 0 : docTien_(p[0]);
  const thang = p[1] ? docThang_(p[1], hn) : thangNay_(hn);
  if (tien === null || !thang) { send_('Chưa hiểu. Gõ kiểu <code>/tamung 2tr</code> hoặc <code>/tamung 2tr 9</code>.'); return; }
  const b = docBang_(TAB.TAMUNG);
  const r = b.rows.find(x => thangO_(x['Tháng TT']) === thang && String(x['Họ tên']).trim() === cfg.nguoiDeNghi);
  if (r) capNhat_(b, r, 'Số tiền', tien);
  else themDong_(b, { 'Tháng TT': thang, 'Họ tên': cfg.nguoiDeNghi, 'Số tiền': tien, 'Ghi chú': 'Nhập qua bot ' + luc_() });
  send_('✅ Tạm ứng tháng ' + thang + ': ' + fmt_(tien) + 'đ.');
}

/* ======================= TỔNG HỢP / XUẤT ======================= */

function lenhBang_(ts) {
  const hn = homNay_();
  const thang = ts ? docThang_(ts, hn) : thangNay_(hn);
  if (!thang) { send_('Tháng không hợp lệ. Gõ kiểu <code>/bang 9</code> hoặc <code>/bang 09/2026</code>.'); return; }
  const d = duLieuThang_(thang);
  if (!d.trips.length) { send_('Tháng ' + thang + ' chưa có chuyến nào.' + (d.loiNgay.length ? '\n⚠️ ' + esc_(d.loiNgay.join('; ')) : '')); return; }
  const L = lapXuat_(d);
  const dong = ['📋 <b>Tháng ' + thang + '</b> — ' + d.trips.length + ' chuyến'];
  d.trips.forEach(t => {
    const cps = d.cps.filter(c => c.idChuyen === t.id);
    dong.push('\n<b>' + t.id + '</b> · ' + nhanNgay_(t.tu, t.den) + ' (' + t.soNgay + ' ngày) · ' + esc_(t.tinh));
    dong.push('   ' + esc_(tenNgan_(t.nguoi)) + ' · CTP ' + fmt_(t.soNgay * t.nguoi.length * d.cfg.ctp));
    cps.forEach(c => dong.push('   • ' + moTaCP_(c)));
    if (!t.truong) dong.push('   ⚠️ chưa có tên trường');
  });
  dong.push('\n💰 Chuyển khoản: <b>' + fmt_(L.tongCK) + 'đ</b>' + (L.tamUng ? ' · tạm ứng ' + fmt_(L.tamUng) + ' · còn ' + fmt_(L.conTT) : ''));
  if (L.tm.length) dong.push('💵 Tiền mặt (không HĐ): ' + fmt_(L.tongTM) + 'đ — ' + L.tm.length + '/' + d.cfg.maxKhongHD + ' lần');
  L.canhBao.concat(d.loiNgay).forEach(x => dong.push('⚠️ ' + esc_(x)));
  dong.push('\nXem 1 chuyến: <code>/xem ' + d.trips[0].id + '</code> · Xuất file: <code>/xuat ' + (+thang.slice(0, 2)) + '</code>');
  guiDai_(dong);
}

function lenhXuat_(ts) {
  const hn = homNay_();
  const thang = ts ? docThang_(ts, hn) : thangXuatMacDinh_(hn);
  if (!thang) { send_('Tháng không hợp lệ. Gõ kiểu <code>/xuat 9</code> hoặc <code>/xuat 09/2026</code>.'); return; }
  send_('⏳ Đang tạo file tháng ' + thang + '… (khoảng 20–40 giây)');
  const kq = xuatThang_(thang);
  const L = kq.L;
  const cap = 'Công tác phí tháng ' + thang + '\nChuyển khoản: ' + fmt_(L.tongCK) + 'đ' +
    (L.tamUng ? ' (tạm ứng ' + fmt_(L.tamUng) + ', còn ' + fmt_(L.conTT) + ')' : '') +
    (L.tm.length ? '\nTiền mặt: ' + fmt_(L.tongTM) + 'đ (' + L.tm.length + ' khoản)' : '');
  if (kq.khBlob) guiFile_(kq.khBlob, 'Kế hoạch đi công tác tháng ' + thang + ' (Word, trình bày theo NĐ 30/2020)', kq.kh);
  guiFile_(kq.pdfBlob, cap + '\n→ Bảng kê, PDF để in', kq.pdf);
  guiFile_(kq.xlsxBlob, 'Bảng kê dạng Excel (nếu kế toán cần file)', kq.xlsx);
  send_((L.canhBao.length ? '⚠️ Lưu ý:\n• ' + esc_(L.canhBao.join('\n• ')) + '\n\n' : '') +
    '📁 Đã lưu trong Google Drive, thư mục "' + THU_MUC + '".\nNộp: in Kế hoạch + bảng kê, ký, kèm hóa đơn và giấy đi đường.');
}

function duLieuThang_(thang) {
  const cfg = cauHinh_();
  const loiNgay = [];
  const trips = chuyen_().filter(t => {
    if (t.xoa || t.thang !== thang) return false;
    if (!t.tu || !t.den || t.den < t.tu) { loiNgay.push('Chuyến ' + t.id + ' sai ngày đi/về trong Sheet — bị bỏ qua'); return false; }
    return true;
  }).map(t => Object.assign(t, { soNgay: soNgay_(t.tu, t.den) }))
    .sort((a, b) => (a.tu < b.tu ? -1 : a.tu > b.tu ? 1 : a.id < b.id ? -1 : 1));
  const ids = trips.map(t => t.id);
  const cps = chiPhi_().filter(c => !c.xoa && ids.indexOf(c.idChuyen) >= 0);
  const tamUng = docBang_(TAB.TAMUNG).rows.filter(r => thangO_(r['Tháng TT']) === thang)
    .map(r => ({ ten: String(r['Họ tên']).trim(), tien: Number(r['Số tiền']) || 0 }));
  return { thang, cfg, trips, cps, tamUng, ns: nhanSu_(), loiNgay };
}

// Tính sẵn mọi dòng sẽ in (không đụng Sheet) — dùng cho cả /bang và /xuat.
function lapXuat_(d) {
  const cfg = d.cfg, chu = cfg.nguoiDeNghi;
  const ck = [], nhom = [], tm = [], pl = [], canhBao = [];
  const bpCua = ten => { const p = d.ns.find(x => x.ten === ten); return (p && p.bp) || cfg.boPhan; };
  d.trips.forEach(t => {
    const cps = d.cps.filter(c => c.idChuyen === t.id);
    const doan = t.nguoi.length ? t.nguoi.slice() : [chu];
    const traBoi = c => (doan.indexOf(c.nguoiTra) >= 0 ? c.nguoiTra : doan[0]);
    const ngay = nhanNgay_(t.tu, t.den);
    const from = ck.length;
    doan.forEach((ten, i) => {
      const cua = cps.filter(c => c.hd && traBoi(c) === ten);
      ck.push({
        ten, ngay, soNgay: t.soNgay, ctp: cfg.ctp, dau: i === 0,
        g: tong_(cua.filter(c => c.loai !== LOAI.TK)),
        h: tong_(cua.filter(c => c.loai === LOAI.TK)),
        ghiChu: cua.map(c => (c.loai === LOAI.KH && c.ghiChu ? c.ghiChu + ' ' : '') + (c.so ? 'HĐ ' + c.so : 'có HĐ')).join(', '),
      });
    });
    nhom.push({ from, count: doan.length });
    cps.filter(c => !c.hd).forEach(c => {
      const tra = traBoi(c);
      tm.push({ ngay, nd: c.loai + (c.ghiChu ? ' - ' + c.ghiChu : ''), diaBan: t.tinh, tien: c.tien, ghiChu: 'Không HĐ' + (tra !== chu ? ' (' + tenNgan_([tra]) + ' trả)' : '') });
    });
    if (cfg.plMoiNguoi) doan.forEach(ten => pl.push({ ngay, nd: t.nd, truong: t.truong, diaBan: t.tinh, ten, bp: bpCua(ten), pt: t.pt }));
    else pl.push({ ngay, nd: t.nd, truong: t.truong, diaBan: t.tinh, ten: doan.join(', '), bp: cfg.boPhan, pt: t.pt });
  });
  const nguoi = [];
  ck.forEach(x => {
    let p = nguoi.find(n => n.ten === x.ten);
    if (!p) { const ns = d.ns.find(n => n.ten === x.ten) || {}; p = { ten: x.ten, tien: 0, tu: 0, stk: ns.stk || '', nh: ns.nh || '' }; nguoi.push(p); }
    p.tien += x.soNgay * x.ctp + x.g + x.h;
  });
  d.tamUng.forEach(u => {
    const p = nguoi.find(n => n.ten === u.ten);
    if (p) p.tu += u.tien;
    else if (u.tien) canhBao.push('Tạm ứng của ' + u.ten + ' không khớp người nào trong các chuyến tháng này — chưa tính.');
  });
  nguoi.forEach(p => { if (!p.stk) canhBao.push('Thiếu số tài khoản của ' + p.ten + ' (tab NhanSu).'); });
  if (!d.ns.some(p => p.ten === chu)) canhBao.push('"Người đề nghị" (' + chu + ') chưa có trong tab NhanSu.');
  if (tm.length > cfg.maxKhongHD) canhBao.push('Có ' + tm.length + ' khoản không hóa đơn, vượt quy định ' + cfg.maxKhongHD + ' lần/tháng.');
  d.trips.forEach(t => { if (!t.truong) canhBao.push('Chuyến ' + t.id + ' chưa có tên trường (Phụ lục 1 sẽ trống ô Trường).'); });
  const tongCK = nguoi.reduce((a, p) => a + p.tien, 0), tamUng = nguoi.reduce((a, p) => a + p.tu, 0);
  return { ck, nhom, nguoi, pl, tm, tongCK, tamUng, conTT: tongCK - tamUng, tongTM: tong_(tm), canhBao };
}

function xuatThang_(thang) {
  const d = duLieuThang_(thang);
  if (!d.trips.length) throw new Error('Tháng ' + thang + ' chưa có chuyến nào.');
  if (!d.cfg.idMau) throw new Error('Chưa điền "ID file mẫu" trong tab CauHinh (xem hướng dẫn, bước 2).');
  const L = lapXuat_(d);
  L.canhBao = L.canhBao.concat(d.loiNgay);
  const ten = 'CTP ' + thang.replace('/', '-') + ' - ' + d.cfg.nguoiDeNghi + ' (xuất ' + luc_('yyyy-MM-dd HH') + 'h' + luc_('mm') + ')';
  let mau;
  try { mau = DriveApp.getFileById(d.cfg.idMau); } catch (e) {
    throw new Error('Không mở được file mẫu: "ID file mẫu" trong CauHinh sai, hoặc file không thuộc tài khoản Google này.');
  }
  const thuMuc = thuMuc_();
  const file = mau.makeCopy(ten, thuMuc);
  const ss = SpreadsheetApp.openById(file.getId());
  const shCK = timSheet_(ss, MAU.CK), shPL = timSheet_(ss, MAU.PL);
  const shTM = L.tm.length ? timSheet_(ss, MAU.TM) : null;
  if (!shCK) throw new Error('File mẫu không có sheet "' + MAU.CK + '".');
  if (!shPL) throw new Error('File mẫu không có sheet "' + MAU.PL + '".');
  if (L.tm.length && !shTM) L.canhBao.push('File mẫu không có sheet "' + MAU.TM + '" — các khoản không hóa đơn chưa được in.');
  const giu = [shCK, shPL, shTM].filter(Boolean);
  const giuId = giu.map(s => s.getSheetId());
  giu.forEach(s => s.showSheet());
  ss.getSheets().forEach(s => { if (giuId.indexOf(s.getSheetId()) < 0) ss.deleteSheet(s); });

  const hn = homNay_();
  const oTong = dienCK_(shCK, L, d.cfg, thang, hn);
  dienPL_(shPL, L);
  if (shTM) dienTM_(shTM, L, d.cfg, thang);
  SpreadsheetApp.flush();

  const docTong = Number(shCK.getRange(oTong.r, oTong.c).getValue());
  if (isFinite(docTong) && docTong > 0 && Math.round(docTong) !== Math.round(L.tongCK)) {
    L.canhBao.push('Tổng trong file (' + fmt_(docTong) + ') khác tổng bot tính (' + fmt_(L.tongCK) + ') — kiểm tra file trước khi in.');
  }
  const pdfBlob = taiFile_(ss.getId(), 'pdf', d.cfg.lePdf).setName(ten + '.pdf');
  const xlsxBlob = taiFile_(ss.getId(), 'xlsx').setName(ten + '.xlsx');
  const pdf = thuMuc.createFile(pdfBlob), xlsx = thuMuc.createFile(xlsxBlob);
  // Kế hoạch đi công tác (Word). Lỗi ở đây không chặn bảng kê.
  let khBlob = null, kh = null;
  try {
    if (!d.cfg.tenCongTy) L.canhBao.push('Chưa điền "Tên công ty" trong CauHinh — đầu Kế hoạch công tác đang để trống.');
    if (!d.cfg.truongBoPhan || !d.cfg.nguoiDuyet) L.canhBao.push('Chưa điền "Trưởng bộ phận" / "Người phê duyệt" trong CauHinh — chữ ký Kế hoạch còn trống tên.');
    khBlob = taoKeHoachDocx_(lapKeHoach_(d), d.cfg, hn, 'Ke hoach cong tac ' + thang.replace('/', '-') + ' - ' + d.cfg.nguoiDeNghi + '.docx');
    kh = thuMuc.createFile(khBlob);
  } catch (e) { ghiLoi_(e); L.canhBao.push('Chưa tạo được Kế hoạch công tác: ' + e.message); }
  themDong_(docBang_(TAB.LICHSU), { 'Thời điểm': luc_(), 'Tháng': thang, 'Chuyển khoản': L.tongCK, 'Tiền mặt': L.tongTM, 'File PDF': pdf.getUrl(), 'File Excel': xlsx.getUrl(), 'Kế hoạch': kh ? kh.getUrl() : '' });
  return { L, pdf, xlsx, pdfBlob, xlsxBlob, kh, khBlob, sheetUrl: file.getUrl() };
}

// Sheet "Chuyển khoản". Tìm vị trí theo chữ trong ô (không theo địa chỉ cố định) để kế toán đổi mẫu nhẹ vẫn chạy.
function dienCK_(sh, L, cfg, thang, hn) {
  const nc = sh.getLastColumn();
  let g = luoi_(sh, nc);
  const h = timDong_(g, 0, r => r.some(v => chuan_(v) === 'ten cbkd'));
  if (h < 0) throw new Error('Sheet "' + MAU.CK + '": không thấy dòng tiêu đề có ô "Tên CBKD".');
  // Thông tin đầu phiếu ở cột C (ô ký tên của mẫu là "=C5")
  ghiNhan_(sh, g, h, 'nguoi de nghi', 3, cfg.nguoiDeNghi);
  ghiNhan_(sh, g, h, 'bo phan', 3, cfg.boPhan);
  ghiNhan_(sh, g, h, 'muc dich', 3, cfg.mucDich.replace('{thang}', thang));

  const C = cotTieuDe_(g[h], { stt: 'Stt', ten: 'Tên CBKD', ngay: 'Ngày', soNgay: 'Số ngày', ctp: 'CTP', g: 'Khách sạn', h: 'Tiếp khách', tien: 'Thành tiền', ghiChu: 'Ghi chú' }, MAU.CK);
  const bd = h + 1 + gop_(sh, h + 1, C.stt);
  const tc = timDong_(g, bd - 1, r => chuan_(r[0]).indexOf('tong cong') === 0) + 1;
  if (tc < 1) throw new Error('Sheet "' + MAU.CK + '": không thấy dòng "Tổng cộng" dưới bảng.');
  const n = chinhSoDong_(sh, bd, tc - bd, L.ck.length, nc);
  const kt = bd + n - 1, dTong = kt + 1;
  const A = cotChu_;
  const rows = L.ck.map((x, i) => {
    const r = bd + i, v = rong_(nc);
    v[C.stt - 1] = i + 1; v[C.ten - 1] = an_(x.ten); v[C.ngay - 1] = x.dau ? x.ngay : '';
    v[C.soNgay - 1] = x.soNgay; v[C.ctp - 1] = x.ctp; v[C.g - 1] = x.g || ''; v[C.h - 1] = x.h || '';
    v[C.tien - 1] = '=' + A(C.soNgay) + r + '*' + A(C.ctp) + r + '+N(' + A(C.g) + r + ')+N(' + A(C.h) + r + ')';
    v[C.ghiChu - 1] = an_(x.ghiChu);
    return v;
  });
  sh.getRange(bd, C.ngay, n, 1).setNumberFormat('@').setHorizontalAlignment('center');
  sh.getRange(bd, C.ghiChu, n, 1).setNumberFormat('@');
  sh.getRange(bd, 1, n, nc).setValues(rows);
  L.nhom.forEach(m => { if (m.count > 1) sh.getRange(bd + m.from, C.ngay, m.count, 1).merge().setVerticalAlignment('middle'); });
  sh.getRange(dTong, C.tien).setFormula('=SUM(' + A(C.tien) + bd + ':' + A(C.tien) + kt + ')');

  g = luoi_(sh, nc);
  const dTU = timDong_(g, dTong, (r, i) => i < dTong + 4 && chuan_(r[0]).indexOf('tam ung') === 0) + 1;
  const dCon = timDong_(g, dTong, (r, i) => i < dTong + 4 && chuan_(r[0]).indexOf('con phai thanh toan') === 0) + 1;
  if (dTU > 0) sh.getRange(dTU, C.tien).setValue(L.tamUng);
  if (dTU > 0 && dCon > 0) sh.getRange(dCon, C.tien).setFormula('=' + A(C.tien) + dTong + '-' + A(C.tien) + dTU);

  // Bảng "Thông tin thanh toán": mỗi người 1 dòng
  const h2 = timDong_(g, dTong, r => r.some(v => chuan_(v) === 'so tai khoan'));
  if (h2 >= 0) {
    const C2 = cotTieuDe_(g[h2], { stt: 'Stt', ten: 'Đối tượng', tien: 'Số tiền', tu: 'Tạm ứng', con: 'Còn TT', stk: 'Số tài khoản', nh: 'Ngân hàng' }, MAU.CK);
    const bd2 = h2 + 1 + gop_(sh, h2 + 1, C2.stt);
    const tc2 = timDong_(g, bd2 - 1, r => chuan_(r[0]).indexOf('tong cong') === 0) + 1;
    if (tc2 < 1) throw new Error('Sheet "' + MAU.CK + '": không thấy dòng "Tổng cộng" của bảng Thông tin thanh toán.');
    const n2 = chinhSoDong_(sh, bd2, tc2 - bd2, L.nguoi.length, nc);
    const kt2 = bd2 + n2 - 1, dTong2 = kt2 + 1;
    const vung = (c, a, b) => '$' + A(c) + '$' + a + ':$' + A(c) + '$' + b;
    const rows2 = L.nguoi.map((p, i) => {
      const r = bd2 + i, v = rong_(nc);
      v[C2.stt - 1] = i + 1; v[C2.ten - 1] = an_(p.ten);
      v[C2.tien - 1] = '=SUMIFS(' + vung(C.tien, bd, kt) + ',' + vung(C.ten, bd, kt) + ',' + A(C2.ten) + r + ')';
      v[C2.tu - 1] = p.tu || '';
      v[C2.con - 1] = '=' + A(C2.tien) + r + '-N(' + A(C2.tu) + r + ')';
      v[C2.stk - 1] = an_(p.stk); v[C2.nh - 1] = an_(p.nh);
      return v;
    });
    sh.getRange(bd2, C2.stk, n2, 1).setNumberFormat('@');
    sh.getRange(bd2, 1, n2, nc).setValues(rows2);
    [C2.tien, C2.tu, C2.con].forEach(c => sh.getRange(dTong2, c).setFormula('=SUM(' + A(c) + bd2 + ':' + A(c) + kt2 + ')'));
    for (let c = C2.tien + 1; c < C2.tu; c++) sh.getRange(dTong2, c).clearContent(); // ô thừa của mẫu (cột D ẩn)
  }

  g = luoi_(sh, nc);
  const dChu = timDong_(g, dTong, r => chuan_(r[0]).indexOf('bang chu') === 0);
  if (dChu >= 0) sh.getRange(dChu + 1, 3).setValue(docSoTien_(L.conTT));
  const oNgay = timO_(g, dTong, v => /ngay .*thang .*nam/.test(chuan_(v)));
  if (oNgay) sh.getRange(oNgay.r, oNgay.c).setValue(cfg.noiKy + ', ngày ' + hn.slice(8, 10) + ' tháng ' + hn.slice(5, 7) + ' năm ' + hn.slice(0, 4));
  return { r: dTong, c: C.tien };
}

function dienPL_(sh, L) {
  const nc = sh.getLastColumn();
  const g = luoi_(sh, nc);
  const h = timDong_(g, 0, r => r.some(v => chuan_(v) === 'truong') && r.some(v => chuan_(v) === 'ngay'));
  if (h < 0) throw new Error('Sheet "' + MAU.PL + '": không thấy dòng tiêu đề (Ngày, Trường…).');
  const C = cotTieuDe_(g[h], { ngay: 'Ngày', nd: 'Nội dung', truong: 'Trường', diaBan: 'Địa bàn', ten: 'Tên', bp: 'Bộ phận', pt: 'Phương tiện' }, MAU.PL);
  const bd = h + 1 + gop_(sh, h + 1, C.ngay);
  let cu = 0;
  while (bd - 1 + cu < g.length && g[bd - 1 + cu].some(v => v !== '' && v !== null)) cu++;
  const n = chinhSoDong_(sh, bd, cu, L.pl.length, nc);
  const rows = L.pl.map(x => {
    const v = rong_(nc);
    v[C.ngay - 1] = x.ngay; v[C.nd - 1] = an_(x.nd); v[C.truong - 1] = an_(x.truong); v[C.diaBan - 1] = an_(x.diaBan);
    v[C.ten - 1] = an_(x.ten); v[C.bp - 1] = an_(x.bp); v[C.pt - 1] = an_(x.pt);
    return v;
  });
  sh.getRange(bd, 1, n, nc).setNumberFormat('@');
  sh.getRange(bd, 1, n, nc).setValues(rows);
  try { sh.autoResizeRows(bd, n); } catch (e) {}
}

function dienTM_(sh, L, cfg, thang) {
  const nc = sh.getLastColumn();
  let g = luoi_(sh, nc);
  const h = timDong_(g, 0, r => r.some(v => chuan_(v) === 'don gia'));
  if (h < 0) throw new Error('Sheet "' + MAU.TM + '": không thấy dòng tiêu đề (Đơn giá…).');
  // Thông tin đầu phiếu ở cột D (ô ký tên của mẫu là "=D6")
  ghiNhan_(sh, g, h, 'nguoi de nghi', 4, cfg.nguoiDeNghi);
  ghiNhan_(sh, g, h, 'bo phan', 4, cfg.boPhan);
  ghiNhan_(sh, g, h, 'muc dich', 4, 'Thanh toán chi phí công tác không có hóa đơn tháng ' + thang);
  const C = cotTieuDe_(g[h], { stt: 'Stt', ngay: 'Ngày', nd: 'Nội dung', diaBan: 'Địa bàn', sl: 'Số lượng', dg: 'Đơn giá', tien: 'Thành tiền', ghiChu: 'Ghi chú' }, MAU.TM);
  const bd = h + 1 + gop_(sh, h + 1, C.stt);
  const tc = timDong_(g, bd - 1, r => chuan_(r[0]).indexOf('tong cong') === 0) + 1;
  if (tc < 1) throw new Error('Sheet "' + MAU.TM + '": không thấy dòng "Tổng cộng".');
  const n = chinhSoDong_(sh, bd, tc - bd, L.tm.length, nc);
  const kt = bd + n - 1;
  const A = cotChu_;
  const rows = L.tm.map((x, i) => {
    const r = bd + i, v = rong_(nc);
    v[C.stt - 1] = i + 1; v[C.ngay - 1] = x.ngay; v[C.nd - 1] = an_(x.nd); v[C.diaBan - 1] = an_(x.diaBan);
    v[C.sl - 1] = 1; v[C.dg - 1] = x.tien; v[C.tien - 1] = '=N(' + A(C.sl) + r + ')*N(' + A(C.dg) + r + ')';
    v[C.ghiChu - 1] = an_(x.ghiChu);
    return v;
  });
  [C.ngay, C.nd, C.diaBan, C.ghiChu].forEach(c => sh.getRange(bd, c, n, 1).setNumberFormat('@'));
  sh.getRange(bd, 1, n, nc).setValues(rows);
  sh.getRange(kt + 1, C.tien).setFormula('=SUM(' + A(C.tien) + bd + ':' + A(C.tien) + kt + ')');
  g = luoi_(sh, nc);
  const dChu = timDong_(g, kt + 1, r => chuan_(r[0]).indexOf('bang chu') >= 0);
  if (dChu >= 0) sh.getRange(dChu + 1, 3).setValue(docSoTien_(L.tongTM));
}

// Đổi số dòng của 1 bảng trong mẫu từ `cu` thành `moi` (ít nhất 1), giữ định dạng dòng đầu, xóa nội dung cũ.
// Chèn/xóa ở GIỮA bảng nên các công thức bên dưới vẫn đúng chỗ.
function chinhSoDong_(sh, bd, cu, moi, nc) {
  const can = Math.max(moi, 1);
  if (cu < 1) { sh.insertRowsBefore(bd, 1); cu = 1; }
  sh.getRange(bd, 1, cu, nc).breakApart();
  if (can > cu) {
    const k = can - cu, cao = sh.getRowHeight(bd);
    sh.insertRowsAfter(bd, k);
    sh.getRange(bd, 1, 1, nc).copyTo(sh.getRange(bd + 1, 1, k, nc), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sh.setRowHeights(bd + 1, k, cao);
  } else if (can < cu) {
    sh.deleteRows(bd + can, cu - can);
  }
  sh.getRange(bd, 1, can, nc).clearContent();
  return can;
}

function timSheet_(ss, ten) { return ss.getSheets().find(s => chuan_(s.getName()) === chuan_(ten)) || null; }
function luoi_(sh, nc) { return sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), nc).getValues(); }
function rong_(n) { const v = []; for (let i = 0; i < n; i++) v.push(''); return v; }
function timDong_(g, tu, f) { for (let i = Math.max(tu, 0); i < g.length; i++) if (f(g[i], i)) return i; return -1; }
function timO_(g, tu, f) {
  for (let i = Math.max(tu, 0); i < g.length; i++) for (let j = 0; j < g[i].length; j++) if (f(g[i][j])) return { r: i + 1, c: j + 1 };
  return null;
}
function ghiNhan_(sh, g, truocDong, nhan, cot, giaTri) {
  const i = timDong_(g, 0, (r, k) => k < truocDong && chuan_(r[0]).indexOf(nhan) === 0);
  if (i >= 0) sh.getRange(i + 1, cot).setValue(giaTri);
}
function gop_(sh, dong, cot) {
  const m = sh.getRange(dong, cot).getMergedRanges();
  return m.length && m[0].getRow() === dong ? m[0].getNumRows() : 1;
}
function cotTieuDe_(hang, map, tenSheet) {
  const out = {};
  Object.keys(map).forEach(k => {
    const j = hang.findIndex(v => chuan_(v).indexOf(chuan_(map[k])) === 0);
    if (j < 0) throw new Error('Sheet "' + tenSheet + '" thiếu cột "' + map[k] + '".');
    out[k] = j + 1;
  });
  return out;
}
function cotChu_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

// le: [trên, phải, dưới, trái] (mm); Google nhận lề theo inch.
function taiFile_(id, dang, le) {
  const inch = mm => (mm / 25.4).toFixed(2);
  le = le || [20, 15, 20, 30];
  const q = dang === 'pdf'
    ? 'format=pdf&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED&fzr=false&horizontal_alignment=CENTER' +
      '&top_margin=' + inch(le[0]) + '&right_margin=' + inch(le[1]) + '&bottom_margin=' + inch(le[2]) + '&left_margin=' + inch(le[3])
    : 'format=xlsx';
  const res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?' + q,
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Google chưa xuất được file ' + dang + ' (mã ' + res.getResponseCode() + '). Thử lại sau 1 phút.');
  return res.getBlob();
}

function thuMuc_() {
  if (C_.thuMuc) return C_.thuMuc;
  const P = P_();
  const id = P.getProperty('FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return (C_.thuMuc = f); } catch (e) {} }
  const f = DriveApp.createFolder(THU_MUC);
  P.setProperty('FOLDER_ID', f.getId());
  return (C_.thuMuc = f);
}

function guiFile_(blob, caption, file) {
  const r = api_('sendDocument', { chat_id: String(CHAT_), document: blob, caption: caption });
  if (r.code !== 200) send_('Không gửi được file qua Telegram. Mở trong Drive: ' + file.getUrl());
}

/* ======================= KẾ HOẠCH ĐI CÔNG TÁC (Word, trình bày theo NĐ 30/2020/NĐ-CP) ======================= */

// Tổng hợp nội dung Kế hoạch từ các chuyến của tháng (không đụng Sheet).
function lapKeHoach_(d) {
  const cfg = d.cfg;
  const khac = a => a.filter((x, i) => x && a.indexOf(x) === i);
  const nguoi = khac([cfg.nguoiDeNghi].concat(...d.trips.map(t => t.nguoi)));
  const tu = d.trips.map(t => t.tu).sort()[0], den = d.trips.map(t => t.den).sort().pop();
  const diaDiem = khac(d.trips.map(t => t.tinh)).join(', ');
  // Nội dung: "Triển khai eNetViet, điểm danh và tập huấn" — gộp trùng không phân biệt hoa/thường,
  // chỉ viết hoa chữ đầu câu (giữ nguyên tên riêng/viết tắt như eNetViet, SMAS).
  const ndKey = [], nds = [];
  d.trips.forEach(t => { const k = boDau_(t.nd).trim(); if (t.nd && ndKey.indexOf(k) < 0) { ndKey.push(k); nds.push(t.nd.trim()); } });
  const thuongDau = x => x.length > 1 && x.charAt(1) === x.charAt(1).toLowerCase() && x.charAt(0) !== x.charAt(0).toLowerCase();
  const hoaDau = x => x.length > 1 && x.charAt(1) === x.charAt(1).toLowerCase() && x.charAt(0) === x.charAt(0).toLowerCase();
  const ndCau = nds.map((x, i) => (i && thuongDau(x) ? x.charAt(0).toLowerCase() + x.slice(1) : !i && hoaDau(x) ? x.charAt(0).toUpperCase() + x.slice(1) : x));
  const nd = ndCau.length > 1 ? ndCau.slice(0, -1).join(', ') + ' và ' + ndCau[ndCau.length - 1] : ndCau.join('');
  const m = +d.thang.slice(0, 2);
  return {
    ten: cfg.nguoiDeNghi, boPhan: cfg.boPhan, diaDiem: diaDiem,
    nguoi: nguoi.map(ten => { const p = d.ns.find(x => x.ten === ten) || {}; return { ten: ten, chucVu: p.cv || p.bp || cfg.boPhan }; }),
    thoiGian: tu === den ? 'Ngày ' + ngayVB_(tu) : 'Từ ngày ' + ngayVB_(tu) + ' đến ngày ' + ngayVB_(den),
    noiDung: nd ? nd + (diaDiem ? ' tại ' + diaDiem : '') : '',
    phuongTien: khac(d.trips.map(t => t.pt)).join(' + '),
    trichYeu: 'Đi công tác tháng ' + m + ' năm ' + d.thang.slice(3),
  };
}

// NĐ 30: ngày nhỏ hơn 10 và tháng 1, 2 thì thêm số 0 phía trước.
function ngay2_(iso) { const m = +iso.slice(5, 7); return { d: iso.slice(8, 10), m: m <= 2 ? '0' + m : String(m), y: iso.slice(0, 4) }; }
function ngayVB_(iso) { const x = ngay2_(iso); return x.d + '/' + x.m + '/' + x.y; }
function ngayKy_(noiKy, iso) { const x = ngay2_(iso); return noiKy + ', ngày ' + x.d + ' tháng ' + x.m + ' năm ' + x.y; }

// Tạo file .docx trực tiếp (không cần mẫu): A4 dọc, lề trên/dưới 20 mm, trái 30 mm, phải 15 mm,
// Times New Roman; quốc hiệu 12 in hoa đậm, tiêu ngữ 13 đậm có gạch dưới bằng độ dài dòng chữ;
// tên cơ quan in hoa đậm, gạch dưới 1/3–1/2 dòng chữ; tên loại + trích yếu 14 đậm; nội dung 13, căn đều, lùi đầu dòng 1 cm;
// địa danh – ngày tháng 13 nghiêng; chức vụ người ký in hoa đậm, họ tên đậm.
function taoKeHoachDocx_(kh, cfg, hn, tenFile) {
  const W = 9354, L = 3969, R = W - L, LE = 57;   // twip: vùng chữ 16,5 cm; cột trái 7 cm; lề ô 0,1 cm
  const e = v => String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const r = (t, o) => {
    o = o || {};
    const pr = (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/><w:iCs/>' : '') + '<w:sz w:val="' + (o.sz || 13) * 2 + '"/><w:szCs w:val="' + (o.sz || 13) * 2 + '"/>';
    return '<w:r><w:rPr>' + pr + '</w:rPr><w:t xml:space="preserve">' + e(t) + '</w:t></w:r>';
  };
  const p = (runs, o) => {
    o = o || {};
    let pr = o.giu ? '<w:keepNext/>' : '';
    if (o.gach) pr += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>';
    pr += '<w:spacing w:before="' + (o.tr || 0) + '" w:after="' + (o.sau || 0) + '" w:line="' + (o.dong || 240) + '" w:lineRule="auto"/>';
    if (o.le || o.thut) pr += '<w:ind w:left="' + (o.le || 0) + '" w:right="' + (o.le || 0) + '"' + (o.thut ? ' w:firstLine="' + o.thut + '"' : '') + '/>';
    pr += '<w:jc w:val="' + (o.jc || 'both') + '"/>';
    if (o.gach) pr += '<w:rPr><w:sz w:val="4"/><w:szCs w:val="4"/></w:rPr>';
    return '<w:p><w:pPr>' + pr + '</w:pPr>' + (Array.isArray(runs) ? runs.join('') : runs || '') + '</w:p>';
  };
  // đường kẻ ngang dài `dai` twip, đặt giữa ô/vùng rộng `rong`
  const gach = (dai, rong) => p('', { gach: true, le: Math.max(0, Math.round((rong - dai) / 2)), jc: 'center' });
  const vien = v => '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => '<w:' + k + ' w:val="' + (v ? 'single' : 'nil') + '"' + (v ? ' w:sz="4" w:space="0" w:color="000000"' : '') + '/>').join('') + '</w:tblBorders>';
  const bang = (ws, hang, coVien, o) => {
    o = o || {};
    return '<w:tbl><w:tblPr><w:tblW w:w="' + ws.reduce((a, b) => a + b, 0) + '" w:type="dxa"/><w:jc w:val="center"/>' + vien(coVien) +
      '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="' + LE + '" w:type="dxa"/><w:right w:w="' + LE + '" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + ws.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>' +
      hang.map(cs => '<w:tr>' + (o.khongTach ? '<w:trPr><w:cantSplit/></w:trPr>' : '') +
        cs.map((c, j) => '<w:tc><w:tcPr><w:tcW w:w="' + ws[j] + '" w:type="dxa"/><w:vAlign w:val="' + (o.giua ? 'center' : 'top') + '"/></w:tcPr>' + c + '</w:tc>').join('') + '</w:tr>').join('') +
      '</w:tbl>';
  };

  // 1. Đầu văn bản: tên cơ quan (trái) — quốc hiệu, tiêu ngữ, địa danh – ngày tháng (phải)
  const tenCty = String(cfg.tenCongTy || '').split('|').map(x => x.trim().toUpperCase()).filter(Boolean);
  const dongDai = Math.max.apply(null, [10].concat(tenCty.map(x => x.length)));
  const trai = tenCty.length
    ? tenCty.map(x => p(r(x, { b: true, sz: 12 }), { jc: 'center' })).join('') + gach(Math.min(L - 2 * LE, Math.max(1200, Math.round(dongDai * 150 * 0.45))), L - 2 * LE)
    : p('', { jc: 'center' }); // chưa điền tên công ty: để trống, không kẻ gạch
  const phai = p(r('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { b: true, sz: 12 }), { jc: 'center' }) +
    p(r('Độc lập - Tự do - Hạnh phúc', { b: true, sz: 13 }), { jc: 'center' }) +
    gach(3183, R - 2 * LE) +
    p(r(ngayKy_(cfg.noiKy, hn), { i: true, sz: 13 }), { jc: 'center', tr: 240 });
  let x = bang([L, R], [[trai, phai]], false);

  // 2. Tên loại và trích yếu
  x += p(r('KẾ HOẠCH', { b: true, sz: 14 }), { jc: 'center', tr: 480 }) +
    p(r(kh.trichYeu, { b: true, sz: 14 }), { jc: 'center' }) + gach(1600, W);
  x += p([r('Kính gửi: ', { sz: 14 }), r(cfg.kinhGui, { sz: 14 })], { jc: 'center', tr: 240, sau: 120 });

  // 3. Nội dung
  const dong = (nhan, giaTri, o) => p([r(nhan + ' '), r(giaTri, o)], { thut: 567, tr: 120, dong: 276 });
  x += dong('Tên tôi là:', kh.ten, { b: true }) + dong('Bộ phận:', kh.boPhan) + dong('Địa điểm công tác:', kh.diaDiem) +
    dong('Số người tham gia đi công tác:', ('0' + kh.nguoi.length).slice(-2) + ' người, gồm:');
  const o = (t, jc, b) => p(r(t, { b: b }), { jc: jc, tr: 40, sau: 40 });
  x += bang([850, 4536, 3402], [[o('STT', 'center', true), o('Họ và tên', 'center', true), o('Chức vụ', 'center', true)]]
    .concat(kh.nguoi.map((n, i) => [o(String(i + 1), 'center'), o(n.ten, 'left'), o(n.chucVu, 'center')])), true, { giua: true });
  x += dong('Thời gian công tác:', kh.thoiGian) + dong('Nội dung công tác:', kh.noiDung) + dong('Phương tiện đi công tác:', kh.phuongTien) +
    p(r('Kính trình Ban lãnh đạo, Trưởng bộ phận xem xét, phê duyệt kế hoạch công tác./.'), { thut: 567, tr: 120, dong: 276 });

  // 4. Chữ ký
  const ky = (chucVu, ten) => p(r(chucVu, { b: true }), { jc: 'center' }) + p(r('(Ký, ghi rõ họ tên)', { i: true, sz: 12 }), { jc: 'center' }) +
    [1, 2, 3].map(() => p('', { jc: 'center' })).join('') + p(r(ten || '', { b: true }), { jc: 'center' });
  x += p('', { tr: 240 }) + bang([3118, 3118, 3118], [[ky('NGƯỜI ĐỀ NGHỊ', kh.ten), ky('TRƯỞNG BỘ PHẬN', cfg.truongBoPhan), ky('NGƯỜI PHÊ DUYỆT', cfg.nguoiDuyet)]], false, { khongTach: true });

  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const dau = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const docXml = dau + '<w:document ' + W_NS + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + x +
    '<w:sectPr>' + (cfg.maMau ? '<w:footerReference w:type="default" r:id="rId2"/>' : '') + '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1701" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const font = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>';
  const styles = dau + '<w:styles ' + W_NS + '><w:docDefaults><w:rPrDefault><w:rPr>' + font + '<w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
  const types = dau + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    (cfg.maMau ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') + '</Types>';
  const rels = dau + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels = dau + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    (cfg.maMau ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : '') + '</Relationships>';
  const b = (noiDung, ten) => Utilities.newBlob(noiDung, 'application/xml', ten);
  const tep = [b(types, '[Content_Types].xml'), b(rels, '_rels/.rels'), b(docXml, 'word/document.xml'), b(docRels, 'word/_rels/document.xml.rels'), b(styles, 'word/styles.xml')];
  if (cfg.maMau) tep.push(b(dau + '<w:ftr ' + W_NS + '>' + p(r('Mẫu: ' + cfg.maMau, { sz: 10 }), { jc: 'left' }) + '</w:ftr>', 'word/footer1.xml'));
  return Utilities.zip(tep, tenFile)
    .setContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/* ======================= DỮ LIỆU ======================= */

let C_ = {}; // bộ nhớ đệm trong 1 lần chạy
function xoaCache_() { C_ = {}; CHAT_ = null; }
function P_() { return PropertiesService.getScriptProperties(); }
function SS_() {
  if (!C_.ss) { const id = P_().getProperty('DATA_ID'); C_.ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive(); }
  return C_.ss;
}

// Trạng thái hội thoại lưu lâu dài (bị ngắt vẫn nhập tiếp được). Riêng bước thêm chi phí hết hạn sau 12 giờ
// để hôm sau gõ chi phí không lặng lẽ rơi vào chuyến cũ; chuyến đang tạo dở giữ 7 ngày.
function getSt_() {
  let st = null;
  try { st = JSON.parse(P_().getProperty('STATE') || 'null'); } catch (e) {}
  if (!st) return null;
  const tuoi = Date.now() - (st.ts || 0);
  if (tuoi > (st.f === 'cp' || st.f === 'cho' ? 12 : 7 * 24) * 3600e3) { clrSt_(); return null; }
  return st;
}
function setSt_(st) { st.ts = Date.now(); P_().setProperty('STATE', JSON.stringify(st)); }
function clrSt_() { P_().deleteProperty('STATE'); }

function docBang_(ten) {
  const sh = SS_().getSheetByName(ten);
  if (!sh) throw new Error('Không thấy tab "' + ten + '". Hãy chạy hàm caiDat() một lần.');
  const nr = sh.getLastRow(), nc = sh.getLastColumn();
  if (nr < 1 || nc < 1) throw new Error('Tab "' + ten + '" trống. Hãy chạy hàm caiDat() một lần.');
  const v = sh.getRange(1, 1, nr, nc).getValues();
  const hdr = v[0].map(x => String(x).trim());
  const rows = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i].every(x => x === '' || x === null)) continue;
    const o = { _r: i + 1 };
    hdr.forEach((h, j) => { if (h) o[h] = v[i][j]; });
    rows.push(o);
  }
  return { ten, sh, hdr, rows };
}

function dinhDangCot_(h) { return COT_SO.indexOf(h) >= 0 ? '#,##0' : '@'; }

function themDong_(b, o) {
  const r = b.sh.getLastRow() + 1;
  const rg = b.sh.getRange(r, 1, 1, b.hdr.length);
  rg.setNumberFormats([b.hdr.map(dinhDangCot_)]);
  rg.setValues([b.hdr.map(h => (o[h] === undefined || o[h] === null ? '' : an_(o[h])))]);
  b.rows.push(Object.assign({ _r: r }, o));
}

function capNhat_(b, row, h, v) {
  const j = b.hdr.indexOf(h);
  if (j < 0) throw new Error('Tab "' + b.ten + '" thiếu cột "' + h + '". Chạy lại caiDat().');
  b.sh.getRange(row._r, j + 1).setValue(an_(v));
  row[h] = v;
}

// Chữ bắt đầu bằng = hoặc + sẽ bị Sheet hiểu là công thức → thêm dấu ' phía trước.
function an_(v) { return typeof v === 'string' && /^[=+]/.test(v) ? "'" + v : v; }

function cauHinh_() {
  if (C_.cfg) return C_.cfg;
  const m = {};
  docBang_(TAB.CAUHINH).rows.forEach(r => { m[String(r['Mục']).trim()] = r['Giá trị']; });
  const s = k => String(m[k] === undefined || m[k] === null ? '' : m[k]).trim();
  const so = (k, d) => { const n = Number(s(k).replace(/[.,\s]/g, '')); return isFinite(n) && n > 0 ? n : d; };
  const ten = s('Người đề nghị').replace(/\s+/g, ' ');
  if (!ten) throw new Error('Chưa điền "Người đề nghị" (họ tên của bạn) trong tab CauHinh.');
  let idMau = s('ID file mẫu');
  const mm = idMau.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (mm) idMau = mm[1];
  C_.cfg = {
    nguoiDeNghi: ten, boPhan: s('Bộ phận') || 'Kinh doanh', ctp: so('CTP mỗi ngày', 200000),
    ndMacDinh: s('Nội dung mặc định'), mucDich: s('Mục đích') || 'Thanh toán công tác phí tháng {thang}',
    noiKy: s('Nơi ký') || 'Hà Nội', idMau: idMau, maxKhongHD: so('Tối đa khoản không HĐ/tháng', 2),
    plMoiNguoi: /^co/.test(boDau_(s('Phụ lục mỗi người 1 dòng'))),
    tenCongTy: s('Tên công ty'), kinhGui: s('Kính gửi (kế hoạch)') || 'Ban lãnh đạo Công ty',
    truongBoPhan: s('Trưởng bộ phận'), nguoiDuyet: s('Người phê duyệt'), maMau: s('Mã mẫu kế hoạch'),
    lePdf: (m => (m && m.length === 4 && m.every(x => +x >= 5 && +x <= 50) ? m.map(Number) : [20, 15, 20, 30]))(s('Lề PDF bảng kê (mm)').match(/\d+(?:[.,]\d+)?/g)),
  };
  return C_.cfg;
}

function nhanSu_() {
  if (!C_.ns) {
    C_.ns = docBang_(TAB.NHANSU).rows.map(r => ({
      ten: String(r['Họ tên']).trim().replace(/\s+/g, ' '), goi: String(r['Tên gọi'] || '').trim(),
      bp: String(r['Bộ phận'] || '').trim(), stk: String(r['Số tài khoản'] || '').trim(), nh: String(r['Ngân hàng'] || '').trim(),
      cv: String(r['Chức vụ'] || '').trim(),
    })).filter(p => p.ten);
  }
  return C_.ns;
}

function themNhanSu_(ds) {
  if (!ds.length) return;
  const b = docBang_(TAB.NHANSU);
  ds.forEach(ten => themDong_(b, { 'Họ tên': ten }));
  delete C_.ns;
}

function chuyen_() {
  return docBang_(TAB.CHUYEN).rows.map(r => ({
    _r: r._r, id: String(r['ID']).trim(), tu: tuO_(r['Từ ngày']), den: tuO_(r['Đến ngày']),
    thang: thangO_(r['Tháng TT']) || (tuO_(r['Từ ngày']) ? tuO_(r['Từ ngày']).slice(5, 7) + '/' + tuO_(r['Từ ngày']).slice(0, 4) : ''),
    tinh: String(r['Địa bàn'] || '').trim(), truong: String(r['Trường'] || '').trim(), nd: String(r['Nội dung'] || '').trim(),
    pt: String(r['Phương tiện'] || '').trim(), nguoi: tachTen_(r['Người đi']), xoa: laXoa_(r['Trạng thái']),
  }));
}
function docChuyen_(id) { const k = String(id).trim(); return chuyen_().find(t => t.id === k && !t.xoa && t.tu && t.den) || null; }
function chuyenGanNhat_() { const ds = chuyen_().filter(t => !t.xoa && t.tu && t.den); return ds.length ? ds[ds.length - 1] : null; }
function chuyenTrung_(t) {
  return chuyen_().filter(x => !x.xoa && x.tu && x.den && x.tu <= t.den && t.tu <= x.den && x.nguoi.some(n => t.nguoi.indexOf(n) >= 0)).map(x => x.id);
}

function themChuyen_(t) {
  const b = docBang_(TAB.CHUYEN);
  const pre = t.tu.slice(2, 4) + t.tu.slice(5, 7);
  let max = 0;
  const xet = id => { id = String(id).trim(); if (id.length === 7 && id.indexOf(pre) === 0) max = Math.max(max, parseInt(id.slice(4), 10) || 0); };
  b.rows.forEach(r => xet(r['ID']));
  docBang_(TAB.CHIPHI).rows.forEach(r => xet(r['ID chuyến'])); // kể cả chuyến đã bị xóa dòng trong Sheet
  const id = pre + ('00' + (max + 1)).slice(-3);
  themDong_(b, {
    'ID': id, 'Từ ngày': dmy_(t.tu), 'Đến ngày': dmy_(t.den), 'Số ngày': soNgay_(t.tu, t.den),
    'Tháng TT': '', 'Địa bàn': t.tinh || '', 'Trường': t.truong || '',
    'Nội dung': t.nd || '', 'Phương tiện': t.pt || '', 'Người đi': t.nguoi.join(', '), 'Trạng thái': 'OK', 'Tạo lúc': luc_(),
  });
  return id;
}

function chiPhi_() {
  return docBang_(TAB.CHIPHI).rows.map(r => ({
    id: String(r['ID']).trim(), idChuyen: String(r['ID chuyến']).trim(), loai: String(r['Loại'] || '').trim(),
    tien: Number(String(r['Số tiền']).replace(/[.,\s]/g, '')) || 0, hd: /^(co|x|yes|y|1)(\s|$)/.test(boDau_(r['Hóa đơn'] || '').trim()),
    so: String(r['Số HĐ'] || '').trim(), nguoiTra: String(r['Người trả'] || '').trim().replace(/\s+/g, ' '),
    ghiChu: String(r['Ghi chú'] || '').trim(), xoa: laXoa_(r['Trạng thái']),
  }));
}

function themChiPhi_(idChuyen, c) {
  const b = docBang_(TAB.CHIPHI);
  let max = 0;
  b.rows.forEach(r => { const id = String(r['ID']).trim(); if (id.indexOf(idChuyen + '-') === 0) max = Math.max(max, parseInt(id.slice(idChuyen.length + 1), 10) || 0); });
  const id = idChuyen + '-' + (max + 1);
  themDong_(b, {
    'ID': id, 'ID chuyến': idChuyen, 'Loại': c.loai, 'Số tiền': c.tien, 'Hóa đơn': c.hd ? 'Có' : 'Không', 'Số HĐ': c.so,
    'Người trả': c.nguoiTra, 'Ghi chú': c.ghiChu, 'Trạng thái': 'OK', 'Tạo lúc': luc_(),
  });
  return id;
}

function demKhongHD_(thang) {
  const ids = chuyen_().filter(t => !t.xoa && t.thang === thang).map(t => t.id);
  return chiPhi_().filter(c => !c.xoa && !c.hd && ids.indexOf(c.idChuyen) >= 0).length;
}

function tinhGanDay_() {
  const ds = [];
  chuyen_().filter(t => !t.xoa && t.tinh).reverse().forEach(t => { if (ds.indexOf(t.tinh) < 0 && ds.length < 4) ds.push(t.tinh); });
  return ds;
}

function tenNgan_(ds) {
  const ns = nhanSu_();
  return ds.map(n => { const p = ns.find(x => x.ten === n); return (p && p.goi) || n.split(' ').pop(); }).join(', ');
}

function moTaCP_(c) {
  return esc_(c.loai + (c.ghiChu ? ' (' + c.ghiChu + ')' : '')) + ' ' + fmt_(c.tien) +
    (c.hd ? (c.so ? ' · HĐ ' + esc_(c.so) : ' · có HĐ') : ' · <i>không HĐ</i>');
}

/* ======================= ĐỌC CHỮ NGƯỜI DÙNG GÕ ======================= */

function boDau_(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
function chuan_(v) { return boDau_(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().replace(/:$/, '').trim(); }
function laXoa_(v) { return /^xoa/.test(boDau_(v || '').trim()); }
function tachTen_(v) { return String(v || '').split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean); }

// "1tr8" "1.8tr" "1,8 triệu" "864k" "864.000" "864000đ" "1k5" → số đồng; không đọc được → null
function docTien_(s) {
  const t = boDau_(s).replace(/\s+/g, '').replace(/(vnd|dong|d)$/, '');
  let m;
  if ((m = t.match(/^(\d+)(?:tr|trieu)(\d{1,3})$/))) return Math.round(parseFloat(m[1] + '.' + m[2]) * 1e6);
  if ((m = t.match(/^(\d+(?:[.,]\d+)?)(?:tr|trieu)$/))) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e6);
  if ((m = t.match(/^(\d+)k(\d{1,3})$/))) return Math.round(parseFloat(m[1] + '.' + m[2]) * 1e3);
  if ((m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)(?:k|nghin|ngan)$/))) return parseInt(m[1].replace(/[.,]/g, ''), 10) * 1e3;
  if ((m = t.match(/^(\d+(?:[.,]\d{1,2})?)(?:k|nghin|ngan)$/))) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e3);
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(t)) return parseInt(t.replace(/[.,]/g, ''), 10);
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return null;
}

// Tin ở bước số tiền: "1tr8" | "1tr8 hđ 145" | "900k khd" | "900k không hóa đơn" → {tien, hd: true|false|null, so} hoặc {loi}
function docDongTien_(s) {
  const low = String(s).normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
  const CHU = '(?![a-zà-ỹđ])';
  const DV = '(?: ?(?:triệu|trieu|tr)' + CHU + '(?: ?\\d{1,3}(?![\\d.,]))?| ?(?:nghìn|nghin|ngàn|ngan|k)' + CHU + '(?:\\d{1,3}(?![\\d.,]))?)?' +
    '(?: ?(?:vnđ|vnd|đồng|dong|đ|d)' + CHU + ')?';
  const m = low.match(new RegExp('^(\\d[\\d.,]*)(' + DV + ')\\s*(.*)$'));
  if (!m || docTien_(m[1] + m[2]) === null) return { loi: 'Chưa đọc được số tiền. Gõ kiểu <code>1tr8</code>, <code>864k</code> hoặc <code>864000</code>.' };
  // "550100 k có HĐ": chữ "k" đứng riêng có thể là "nghìn" hoặc "không" → thử cả 2 cách.
  // Số đã có từ 4 chữ số trở lên (550100 k…) thì gần như chắc "k" là "không".
  const cach = [[m[1] + m[2], m[3]]];
  if (/^ k$/.test(m[2])) {
    const c2 = [m[1], ('k ' + m[3]).trim()];
    if (m[1].replace(/[.,]/g, '').length >= 4) cach.unshift(c2); else cach.push(c2);
  }
  let loi = null;
  for (let i = 0; i < cach.length; i++) {
    const tien = docTien_(cach[i][0]);
    let e = null;
    if (tien === null) e = 'Chưa đọc được số tiền. Gõ kiểu <code>1tr8</code>, <code>864k</code> hoặc <code>864000</code>.';
    else if (tien < 1000) e = 'Số tiền ' + fmt_(tien) + 'đ nhỏ quá — có phải <code>' + tien + 'k</code>? Gõ lại.';
    else if (tien > 200000000) e = 'Số tiền ' + fmt_(tien) + 'đ lớn quá. Gõ lại.';
    const hd = e ? null : docHoaDon_(cach[i][1]);
    if (hd && !hd.loi) return Object.assign({ tien: tien }, hd);
    if (!loi) loi = e || hd.loi;
  }
  return { loi: loi };
}

// Phần sau số tiền: '' | "hđ 145" | "có hđ" | "khd" | "không hóa đơn"… → {hd, so} hoặc {loi}
function docHoaDon_(r) {
  r = r.trim();
  if (!r) return { hd: null };
  const HD = '(?:hđ|hd|hoá đơn|hóa đơn|hoa don)';
  if (new RegExp('^(?:khd|kohd|(?:k|ko|không|khong|chưa|chua)\\s*(?:có|co)?\\s*' + HD + ')$').test(r)) return { hd: false };
  const p = r.match(new RegExp('^(?:(?:có|co)\\s*)?' + HD + '\\s*[:#.\\-]?\\s*(?:(?:số|so)\\s*)?(.*)$'));
  if (p) return { hd: true, so: p[1].trim().toUpperCase().slice(0, 40) };
  if (/^(có|co)$/.test(r)) return { hd: true, so: '' };
  return { loi: 'Chưa hiểu phần "' + esc_(r) + '" sau số tiền. Gõ kiểu <code>1tr8 hđ 145</code> hoặc <code>1tr8 khd</code>.' };
}

// "ks 1tr8 hđ 145", "xăng 550k khd", "khác vé xe 120k" → {ma, loai, ghiChu, rest}
function docNhanh_(text) {
  const low = String(text).normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
  const kd = boDau_(low);
  if (kd.length !== low.length) return null;
  const m = kd.match(/^(khach san|ks|phong|xang xe|xang|do xang|xx|tiep khach|tk|khac)(?=$|[\s:])/);
  if (!m) return null;
  const ma = { 'khach san': 'KS', ks: 'KS', phong: 'KS', 'xang xe': 'XX', xang: 'XX', 'do xang': 'XX', xx: 'XX', 'tiep khach': 'TK', tk: 'TK', khac: 'KH' }[m[1]];
  let rest = low.slice(m[1].length).replace(/^[\s:\-]+/, '');
  let ghiChu = '';
  if (ma === 'KH') {
    const j = rest.search(/(^|\s)\d/);
    if (j < 0) { ghiChu = rest; rest = ''; } else if (j > 0) { ghiChu = rest.slice(0, j).trim(); rest = rest.slice(j).trim(); }
  }
  return { ma: ma, loai: LOAI[ma], ghiChu: ghiChu, rest: rest };
}

// "10/9" "10/9/2026" "10-9-26" "hôm nay" "hôm qua" → 'yyyy-mm-dd'. Không ghi năm: đoán năm hợp lý
// (so với ngày `ref` nếu có — dùng cho ngày về; nếu không thì không quá 31 ngày tới).
function docNgay_(s, hn, ref) {
  const t = boDau_(s).trim();
  if (/^(hom nay|homnay|hn|nay)$/.test(t)) return hn;
  if (/^(hom qua|homqua|hq|qua)$/.test(t)) return congNgay_(hn, -1);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  let y;
  if (m[3]) { y = +m[3]; if (y < 100) y += 2000; }
  else if (ref) { // ngày về: "2/1" sau "30/12" là năm sau; còn lại giữ năm của ngày đi
    y = +ref.slice(0, 4);
    if (iso_(y, mo, d) < ref && hopLe_(y + 1, mo, d) && soNgay_(ref, iso_(y + 1, mo, d)) <= 31) y += 1;
  }
  else { // chọn năm để ngày nằm trong khoảng [11 tháng trước, 31 ngày tới]
    const y0 = +hn.slice(0, 4), lo = congNgay_(hn, -330), hi = congNgay_(hn, 31);
    y = [y0, y0 - 1, y0 + 1].find(k => hopLe_(k, mo, d) && iso_(k, mo, d) >= lo && iso_(k, mo, d) <= hi) || y0;
  }
  if (y < 2020 || y > 2100 || !hopLe_(y, mo, d)) return null;
  return iso_(y, mo, d);
}

// "10/9-12/9" "10/9 đến 12/9" "10-12/9" hoặc 1 ngày → {tu, den?}
function docKhoang_(s, hn) {
  const t = boDau_(s).trim().replace(/\s*(?:den|toi|->|→|–|—|~)\s*/g, '-').replace(/\s*-\s*/g, '-');
  const D = '(\\d{1,2}[\\/.]\\d{1,2}(?:[\\/.](?:\\d{4}|\\d{2}))?)';
  let m = t.match(new RegExp('^' + D + '-' + D + '$'));
  if (m) { const tu = docNgay_(m[1], hn); const den = tu && docNgay_(m[2], hn, tu); return tu && den ? { tu, den } : null; }
  m = t.match(/^(\d{1,2})-(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{4}|\d{2}))?$/);
  if (m) {
    const duoi = '/' + m[3] + (m[4] ? '/' + m[4] : '');
    const tu = docNgay_(m[1] + duoi, hn); const den = tu && docNgay_(m[2] + duoi, hn, tu);
    return tu && den ? { tu, den } : null;
  }
  const tu = docNgay_(t, hn);
  return tu ? { tu } : null;
}

// "9" "09" "T9" "9/2026" → 'mm/yyyy'. Không ghi năm mà tháng lớn hơn tháng hiện tại → năm trước.
function docThang_(s, hn) {
  const t = boDau_(s).trim().replace(/^t(hang)?\s*/, '');
  const m = t.match(/^(\d{1,2})(?:[\/\-.](\d{4}|\d{2}))?$/);
  if (!m) return null;
  const mo = +m[1];
  if (mo < 1 || mo > 12) return null;
  let y = m[2] ? +m[2] : +hn.slice(0, 4);
  if (m[2] && y < 100) y += 2000;
  if (!m[2] && mo > +hn.slice(5, 7)) y -= 1;
  return ('0' + mo).slice(-2) + '/' + y;
}

// Tìm người trong NhanSu theo họ tên / tên gọi / tên. Gõ không dấu thì so không dấu. Không đoán gần đúng.
function timNguoi_(ds, q) {
  const coDau = s => String(s).normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
  const qq = coDau(q);
  if (!qq) return {};
  const key = boDau_(qq) === qq ? (s => boDau_(coDau(s))) : coDau;
  const k = key(qq);
  const lay = f => { const r = ds.filter(f).map(p => p.ten); return r.filter((x, i) => r.indexOf(x) === i); };
  let r = lay(p => key(p.ten) === k || (p.goi && key(p.goi) === k));
  if (!r.length) {
    const toks = k.split(' ');
    r = lay(p => { const tt = key(p.ten).split(' ').concat(p.goi ? key(p.goi).split(' ') : []); return toks.every(x => tt.indexOf(x) >= 0); });
  }
  return r.length === 1 ? { ok: r[0] } : r.length > 1 ? { nhieu: r } : {};
}

/* ======================= NGÀY THÁNG, TIỀN ======================= */

function homNay_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function luc_(f) { return Utilities.formatDate(new Date(), TZ, f || 'dd/MM/yyyy HH:mm'); }
function iso_(y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
function hopLe_(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }
function utc_(iso) { const p = iso.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
function congNgay_(iso, n) { return new Date(utc_(iso) + n * 864e5).toISOString().slice(0, 10); }
function soNgay_(tu, den) { return Math.round((utc_(den) - utc_(tu)) / 864e5) + 1; }
function dmy_(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); }
function dm_(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
function nhanNgay_(tu, den) { return tu === den ? dm_(tu) : dm_(tu) + ' - ' + dm_(den); }
function thangNay_(hn) { return hn.slice(5, 7) + '/' + hn.slice(0, 4); }
function thangTruoc_(hn) { const y = +hn.slice(0, 4), m = +hn.slice(5, 7); return m === 1 ? '12/' + (y - 1) : ('0' + (m - 1)).slice(-2) + '/' + y; }
// Từ ngày 1–10 thì /xuat mặc định là tháng trước (lúc nộp), sau đó là tháng này.
function thangXuatMacDinh_(hn) { return +hn.slice(8, 10) <= 10 ? thangTruoc_(hn) : thangNay_(hn); }

// Ô ngày trong Sheet: chữ "dd/mm/yyyy" hoặc ô kiểu ngày → 'yyyy-mm-dd' ('' nếu không đọc được)
function tuO_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m && hopLe_(+m[3], +m[2], +m[1]) ? iso_(+m[3], +m[2], +m[1]) : '';
}
function thangO_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, TZ, 'MM/yyyy');
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{4})$/);
  return m ? ('0' + m[1]).slice(-2) + '/' + m[2] : '';
}

function tong_(ds) { return ds.reduce((a, x) => a + (Number(x.tien) || 0), 0); }
function fmt_(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

// 1250000 → "Một triệu hai trăm năm mươi nghìn đồng."
function docSoTien_(n) {
  n = Math.round(Number(n) || 0);
  if (n <= 0) return 'Không đồng.';
  const so = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const donVi = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const nhom = [];
  for (let x = n; x > 0; x = Math.floor(x / 1000)) nhom.push(x % 1000);
  const doc3 = (v, du) => {
    const tr = Math.floor(v / 100), ch = Math.floor((v % 100) / 10), dv = v % 10, out = [];
    if (du || tr > 0) out.push(so[tr] + ' trăm');
    if (ch === 0) { if (dv > 0 && (du || tr > 0)) out.push('linh'); }
    else out.push(ch === 1 ? 'mười' : so[ch] + ' mươi');
    if (dv > 0) out.push(dv === 1 && ch > 1 ? 'mốt' : dv === 4 && ch > 1 ? 'tư' : dv === 5 && ch > 0 ? 'lăm' : so[dv]);
    return out.join(' ');
  };
  const parts = [];
  for (let i = nhom.length - 1; i >= 0; i--) if (nhom[i]) parts.push(doc3(nhom[i], i < nhom.length - 1) + donVi[i]);
  const s = parts.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng.';
}

/* ======================= TELEGRAM ======================= */

function api_(method, payload) {
  const token = P_().getProperty('BOT_TOKEN');
  if (!token) throw new Error('Chưa có BOT_TOKEN trong Script properties.');
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, { method: 'post', payload: payload, muteHttpExceptions: true });
  let body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  return { code: res.getResponseCode(), body: body };
}

function send_(text, kb) {
  if (!CHAT_) { Logger.log(text); return null; }
  const p = { chat_id: String(CHAT_), text: text, parse_mode: 'HTML', disable_web_page_preview: 'true' };
  if (kb) p.reply_markup = JSON.stringify({ inline_keyboard: kb });
  let r = api_('sendMessage', p);
  if (r.code !== 200) { // HTML lỗi → gửi lại dạng chữ thường
    p.text = text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    delete p.parse_mode;
    r = api_('sendMessage', p);
    if (r.code !== 200) ghiLoi_('sendMessage ' + r.code + ': ' + JSON.stringify(r.body).slice(0, 300));
  }
  return r.body && r.body.result ? r.body.result.message_id : null;
}

function guiDai_(dong) {
  let buf = '';
  dong.forEach(x => { if ((buf + '\n' + x).length > 3500) { send_(buf); buf = x; } else buf = buf ? buf + '\n' + x : x; });
  if (buf) send_(buf);
}

function nut_(text, data) { return { text: text, callback_data: data }; }
function suaNut_(msgId, kb) {
  api_('editMessageReplyMarkup', { chat_id: String(CHAT_), message_id: String(msgId), reply_markup: JSON.stringify({ inline_keyboard: kb }) });
}
function boNut_(cq) { if (cq.message) suaNut_(cq.message.message_id, []); }
function esc_(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function ghiLoi_(err) {
  try {
    console.error(err);
    const ss = SS_();
    let sh = ss.getSheetByName(TAB.LOI);
    if (!sh) { sh = ss.insertSheet(TAB.LOI); sh.appendRow(COT.Loi); }
    sh.appendRow([luc_(), String((err && err.stack) || err).slice(0, 1500)]);
    if (sh.getLastRow() > 300) sh.deleteRows(2, sh.getLastRow() - 300);
  } catch (e) {}
}

/* ======================= CÀI ĐẶT (chạy tay trong trình soạn code) ======================= */

// Bước 1: tạo các tab + mã PIN. Chạy lại bao nhiêu lần cũng được (không xóa dữ liệu).
function caiDat() {
  const P = P_();
  if (!P.getProperty('BOT_TOKEN')) throw new Error('Chưa có BOT_TOKEN. Vào ⚙ Project Settings → Script properties → Add script property: BOT_TOKEN = token lấy từ @BotFather.');
  const ss = SpreadsheetApp.getActive();
  P.setProperty('DATA_ID', ss.getId());
  ss.setSpreadsheetTimeZone(TZ);
  try { ss.setSpreadsheetLocale('vi_VN'); } catch (e) {}
  Object.keys(COT).forEach(ten => taoTab_(ss, ten));
  const b = docBang_(TAB.CAUHINH);
  const co = b.rows.map(r => String(r['Mục']).trim());
  CAUHINH_MAC_DINH.forEach(x => { if (co.indexOf(x[0]) < 0) b.sh.appendRow(x); });
  const macDinh = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (macDinh && macDinh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(macDinh);
  if (!P.getProperty('SECRET')) P.setProperty('SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  let msg = '✅ Đã tạo các tab. Tiếp theo: điền tab CauHinh và NhanSu.';
  if (!P.getProperty('OWNER_ID')) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    P.setProperty('PIN', pin);
    msg += '\nMã PIN của bạn: ' + pin + '  → sau khi chạy datWebhook(), nhắn cho bot:  /start ' + pin;
  }
  Logger.log(msg);
}

function taoTab_(ss, ten) {
  let sh = ss.getSheetByName(ten);
  if (!sh) sh = ss.insertSheet(ten);
  const can = COT[ten];
  const nc = sh.getLastColumn();
  const co = nc ? sh.getRange(1, 1, 1, nc).getValues()[0].map(x => String(x).trim()) : [];
  if (!co.filter(String).length) sh.getRange(1, 1, 1, can.length).setValues([can]);
  else { const thieu = can.filter(h => co.indexOf(h) < 0); if (thieu.length) sh.getRange(1, nc + 1, 1, thieu.length).setValues([thieu]); }
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim());
  sh.getRange(1, 1, 1, hdr.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (ten !== TAB.CAUHINH && sh.getMaxRows() > 1) hdr.forEach((h, j) => { if (h) sh.getRange(2, j + 1, sh.getMaxRows() - 1, 1).setNumberFormat(dinhDangCot_(h)); });
}

// Bước 2: sau khi Deploy web app và thêm WEBAPP_URL vào Script properties.
function datWebhook() {
  const P = P_();
  const url = String(P.getProperty('WEBAPP_URL') || '').trim();
  if (!/^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+|macros)\/s\/[^/]+\/exec$/.test(url)) {
    throw new Error('WEBAPP_URL chưa đúng. Phải là link Web app kết thúc bằng /exec (Deploy → Manage deployments).');
  }
  if (!P.getProperty('SECRET')) throw new Error('Chưa chạy caiDat().');
  const r = api_('setWebhook', {
    url: url + '?k=' + P.getProperty('SECRET'), allowed_updates: JSON.stringify(['message', 'callback_query']),
    drop_pending_updates: 'true', max_connections: '1',
  });
  api_('setMyCommands', { commands: JSON.stringify(LENH) });
  Logger.log(r.code === 200 && r.body.ok ? '✅ Đã nối bot với web app.' : '❌ ' + JSON.stringify(r.body));
}

// Xem Telegram có gọi được web app không (Lỗi gần nhất phải là "không có").
function kiemTraWebhook() {
  const i = api_('getWebhookInfo', {}).body.result || {};
  Logger.log('URL: ' + (i.url ? i.url.replace(/k=[^&]+/, 'k=***') : '(chưa đặt)') +
    '\nĐang chờ: ' + i.pending_update_count + '\nLỗi gần nhất: ' + (i.last_error_message || 'không có'));
}

// Thử xuất file tháng mặc định ngay trong trình soạn code (không qua Telegram).
function thuXuat() {
  const thang = thangXuatMacDinh_(homNay_());
  const kq = xuatThang_(thang);
  Logger.log('Tháng ' + thang + '\nSheet: ' + kq.sheetUrl + '\nPDF: ' + kq.pdf.getUrl() + '\nExcel: ' + kq.xlsx.getUrl() +
    '\nKế hoạch (Word): ' + (kq.kh ? kq.kh.getUrl() : 'chưa tạo được') +
    '\nChuyển khoản: ' + fmt_(kq.L.tongCK) + ' · Tiền mặt: ' + fmt_(kq.L.tongTM) + (kq.L.canhBao.length ? '\nLưu ý: ' + kq.L.canhBao.join(' | ') : ''));
}

// Bot bị kẹt ở 1 bước lạ: chạy hàm này để xóa trạng thái.
function xoaTrangThai() { clrSt_(); Logger.log('Đã xóa trạng thái hội thoại.'); }
