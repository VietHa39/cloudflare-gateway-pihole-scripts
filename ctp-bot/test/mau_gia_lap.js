// Mẫu giả lập có CÙNG BỐ CỤC với mẫu "Giấy đề nghị thanh toán công tác phí" của kế toán
// (vị trí dòng/cột, ô gộp, công thức), nhưng dữ liệu công ty/người là giả — để test không chứa thông tin thật.
'use strict';
function mau() {
  const ck = {}, pl = {}, tm = {}, v1 = {}, note = {};
  const set = (o, r, c, v) => { o[r + ',' + c] = v; };
  // ---- Chuyển khoản ----
  set(ck, 1, 3, 'CÔNG TY MẪU\nĐịa chỉ mẫu\nMST: 0000000000');
  set(ck, 3, 1, 'GIẤY ĐỀ NGHỊ THANH TOÁN CÔNG TÁC PHÍ');
  set(ck, 5, 1, 'Người đề nghị: '); set(ck, 6, 1, 'Bộ phận: '); set(ck, 6, 3, 'Kinh doanh '); set(ck, 7, 1, 'Mục đích: ');
  ['Stt', 'Tên CBKD', 'Ngày', 'Đối tượng', 'Số ngày', 'CTP', 'Khách sạn/ Xăng xe,...', 'Tiếp khách', 'Thành tiền', 'Ghi chú'].forEach((h, j) => set(ck, 9, j + 1, h));
  for (let r = 10; r <= 16; r++) { set(ck, r, 1, r - 9); set(ck, r, 6, 200000); set(ck, r, 9, '=+E' + r + '*F' + r + '+SUM(G' + r + ':H' + r + ')'); }
  set(ck, 17, 1, 'Tổng cộng:'); set(ck, 17, 9, '=SUM(I10:I16)');
  set(ck, 18, 1, 'Tạm ứng'); set(ck, 18, 9, 0);
  set(ck, 19, 1, 'Còn phải thanh toán'); set(ck, 19, 9, '=I17-I18');
  set(ck, 21, 2, 'Thông tin thanh toán');
  [[1, 'Stt'], [2, 'Đối tượng'], [3, 'Số tiền'], [5, 'Tạm ứng'], [6, 'Còn TT'], [7, 'Số tài khoản'], [8, 'Ngân hàng']].forEach(([c, h]) => set(ck, 22, c, h));
  for (let r = 23; r <= 29; r++) { set(ck, r, 1, r - 22); set(ck, r, 3, '=SUMIFS($I$10:$I$16,$B$10:$B$16,B' + r + ')'); set(ck, r, 6, '=C' + r + '-E' + r); set(ck, r, 8, 'Ngân hàng mẫu'); }
  set(ck, 30, 1, 'Tổng cộng:'); set(ck, 30, 3, '=SUM(C23:D29)'); set(ck, 30, 4, '=SUM(D23:E23)'); set(ck, 30, 6, '=SUM(F23:F29)');
  set(ck, 32, 1, 'Bằng chữ:');
  set(ck, 33, 1, 'Tôi xác nhận là người đại diện nhận khoản công tác phí của đoàn…');
  set(ck, 36, 5, 'Hà Nội, ngày 03 tháng 09 năm 2026');
  [[1, 'Người đề nghị'], [3, 'Trưởng bộ phận'], [6, 'Kế toán thanh toán'], [8, 'Kế toán trưởng'], [9, 'Người duyệt']].forEach(([c, h]) => set(ck, 37, c, h));
  set(ck, 42, 1, '=C5'); set(ck, 42, 6, 'Kế Toán Mẫu'); set(ck, 42, 9, 'Giám Đốc Mẫu');
  // ---- Phụ lục 1 ----
  set(pl, 2, 1, 'PHỤ LỤC 1:');
  ['Ngày', 'Nội dung', 'Trường', 'Địa bàn', 'Tên ', 'Bộ phận', 'Phương tiện'].forEach((h, j) => set(pl, 4, j + 1, h));
  for (let r = 6; r <= 9; r++) ['0' + (r - 5) + '/08 - 0' + (r - 4) + '/08', 'Triển khai', 'Trường Mẫu Cũ ' + r, 'Tỉnh Mẫu', 'Mẫu Cũ', 'Kinh doanh', 'Xe công ty'].forEach((v, j) => set(pl, r, j + 1, v));
  // ---- Tiền mặt (ẩn) ----
  set(tm, 2, 3, 'CÔNG TY MẪU');
  set(tm, 4, 1, 'GIẤY ĐỀ NGHỊ THANH TOÁN');
  set(tm, 6, 1, 'Người đề nghị: '); set(tm, 7, 1, 'Bộ phận: '); set(tm, 8, 1, 'Mục đích: ');
  ['Stt', 'Ngày, tháng', 'Nội dung, diễn giải', 'Địa bàn', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Ghi chú'].forEach((h, j) => set(tm, 10, j + 1, h));
  set(tm, 12, 1, 1); set(tm, 12, 7, '=E12*F12');
  set(tm, 13, 1, 'Tổng cộng'); set(tm, 13, 7, '=SUM(G12:G12)');
  set(tm, 14, 1, 'Số tiền bằng chữ:');
  [[1, 'Người đề nghị'], [3, 'Trưởng bộ phận'], [5, 'Kế toán/thủ quỹ'], [7, 'Người duyệt']].forEach(([c, h]) => set(tm, 16, c, h));
  set(tm, 20, 1, '=D6'); set(tm, 20, 5, 'Kế Toán Mẫu');
  // ---- sheet ẩn khác ----
  set(v1, 4, 1, 'GIẤY THANH TOÁN CÔNG TÁC PHÍ (bản cũ)'); set(v1, 6, 3, 'Người Cũ');
  set(note, 1, 2, 'Ghi chú nội bộ');
  const tmMerges = [[10, 1, 11, 1], [10, 2, 11, 2], [10, 3, 11, 3], [10, 4, 11, 4], [10, 5, 11, 5], [10, 6, 11, 6], [10, 7, 11, 7], [10, 8, 11, 8], [13, 1, 13, 4], [4, 1, 4, 7], [16, 1, 16, 2], [20, 1, 20, 2]];
  const plMerges = [[2, 1, 2, 7]].concat([1, 2, 3, 4, 5, 6, 7].map(c => [4, c, 5, c]));
  return [
    { name: 'ver1', hidden: true, id: 1, merges: [], heights: {}, cells: v1 },
    { name: 'Chuyển khoản', hidden: false, id: 3, merges: [[1, 1, 1, 2], [1, 3, 1, 10], [3, 1, 3, 10], [10, 3, 12, 3], [17, 1, 17, 2], [18, 1, 18, 2], [19, 1, 19, 2], [30, 1, 30, 2], [33, 1, 33, 10], [36, 5, 36, 10], [37, 1, 37, 2], [37, 3, 37, 5], [37, 6, 37, 7], [37, 9, 37, 10], [42, 1, 42, 2], [42, 3, 42, 5], [42, 6, 42, 7], [42, 9, 42, 10]], heights: { 10: 24, 11: 24, 12: 24, 13: 24, 14: 24, 15: 24, 16: 24 }, cells: ck },
    { name: 'Phụ lục 1', hidden: false, id: 6, merges: plMerges, heights: { 6: 72.6, 7: 78, 8: 62.4, 9: 62.4 }, cells: pl },
    { name: 'Tiền mặt', hidden: true, id: 5, merges: tmMerges, heights: { 12: 37.2 }, cells: tm },
    { name: 'Note', hidden: true, id: 4, merges: [], heights: {}, cells: note },
  ];
}
module.exports = { mau };
