# Bot công tác phí: hướng dẫn cài đặt và sử dụng

Bot Telegram giúp bạn ghi lại công tác phí và lưu vào Google Sheet của chính bạn. Cuối tháng, gõ `/xuat` để nhận file **PDF để in** và file **Excel**, đúng mẫu *Giấy đề nghị thanh toán công tác phí* của kế toán:

- sheet **Chuyển khoản**,
- sheet **Phụ lục 1**,
- sheet **Tiền mặt**, chỉ có khi tháng đó có khoản chi không hóa đơn.

Chỉ bạn dùng được bot. Bot không tự nhắc, bạn nhập lúc nào tiện. Mỗi bước nhập được lưu ngay, nên bị ngắt giữa chừng cũng không mất dữ liệu.

Cài đặt mất khoảng **30–45 phút**, chỉ làm 1 lần. Bạn không cần biết code, chỉ cần làm theo từng bước và copy–dán.

---

## Chuẩn bị

- Tài khoản Gmail cá nhân và Telegram trên điện thoại.
- File mẫu `.xlsx` của kế toán.
- File **`Code.gs`** trong thư mục này. Mở file trên GitHub, bấm **Raw**, chọn tất cả rồi copy.

> ⚠️ **Token cũ đã bị lộ** (nó từng nằm thẳng trong code cũ). Bạn phải đổi token ở bước 1. Từ nay **không dán token vào code**, không gửi token cho ai, kể cả AI.

---

## Bước 1: Lấy token mới cho bot (5 phút)

1. Trong Telegram, nhắn cho **@BotFather**.
2. Gõ `/mybots`, chọn bot của bạn, chọn **API Token**, bấm **Revoke current token**.
3. Copy token mới, có dạng `123456789:AA…`. Để tạm vào Ghi chú trên điện thoại.
4. Vẫn trong @BotFather: `/mybots`, chọn bot, **Bot Settings**, **Allow Groups?**, chọn **Turn groups off**. Việc này chặn người khác thêm bot vào nhóm.

## Bước 2: Đưa file mẫu của kế toán lên Google Drive (5 phút)

1. Vào **drive.google.com**, bấm **Mới**, chọn **Tải tệp lên**, rồi chọn file mẫu `.xlsx`.
2. Mở file vừa tải lên. Vào menu **Tệp**, chọn **Lưu dưới dạng Google Trang tính**. Drive sẽ tạo thêm một bản Google Sheet.
3. Trong bản Google Sheet đó, kiểm tra có logo, có sheet *Chuyển khoản* và *Phụ lục 1*.
4. Copy **đường link** của bản Google Sheet này (thanh địa chỉ, dạng `https://docs.google.com/spreadsheets/d/…/edit`). Link này dùng ở bước 5.

Nếu sau này kế toán đổi mẫu, bạn chỉ cần làm lại bước 2 rồi dán link mới vào tab CauHinh.

## Bước 3: Tạo Google Sheet dữ liệu và dán code (5 phút)

> Nếu bạn đã có Google Sheet chạy bot cũ, **đừng dùng lại**. Hãy tạo Sheet mới vì cấu trúc các tab đã khác. Bot cũ chưa lưu được chuyến nào nên không có dữ liệu cần chuyển.

1. Mở **sheets.new** và đặt tên file là `CTP Dữ liệu`.
2. Vào menu **Tiện ích mở rộng**, chọn **Apps Script**.
3. Xóa hết code có sẵn, dán **toàn bộ** nội dung `Code.gs`, bấm 💾 **Lưu**.
4. Đặt tên dự án (góc trên bên trái), ví dụ `Bot CTP`.

## Bước 4: Cất token vào chỗ an toàn (2 phút)

1. Trong Apps Script, bấm ⚙ **Cài đặt dự án** (Project Settings) ở cột bên trái.
2. Kéo xuống mục **Thuộc tính tập lệnh** (Script properties), bấm **Thêm thuộc tính tập lệnh**.
3. Điền **Thuộc tính** = `BOT_TOKEN` và **Giá trị** = token mới ở bước 1. Bấm **Lưu**.

## Bước 5: Chạy cài đặt và điền thông tin (10 phút)

1. Quay lại màn hình code (biểu tượng `< >`).
2. Trên thanh công cụ, chọn hàm **`caiDat`** rồi bấm ▶ **Chạy**.
3. Lần đầu, Google hỏi quyền. Làm lần lượt:
   1. Bấm **Xem xét quyền**, rồi chọn Gmail của bạn.
   2. Nếu thấy *"Google chưa xác minh ứng dụng này"*: bấm **Nâng cao**, rồi **Đi tới Bot CTP (không an toàn)**. Đây là code của chính bạn, chạy trong tài khoản của bạn.
   3. Bấm **Cho phép**.
4. Ô **Nhật ký thực thi** hiện ra dòng `Mã PIN của bạn: 123456`. **Ghi lại mã PIN này.**
5. Mở lại Google Sheet `CTP Dữ liệu`. Các tab đã được tạo sẵn. Điền 2 tab sau:

   **Tab CauHinh**, cột *Giá trị*:

   | Mục | Điền |
   |---|---|
   | Người đề nghị | Họ tên đầy đủ của bạn, ví dụ `Nguyễn Văn An` |
   | ID file mẫu | Dán link Google Sheet mẫu ở bước 2 |
   | CTP mỗi ngày | `200000` (đã điền sẵn) |
   | Nội dung mặc định | Ví dụ `Triển khai eNetViet` |
   | Tên công ty | In hoa, dấu `\|` để xuống dòng. Ví dụ `CÔNG TY CỔ PHẦN TẬP ĐOÀN\|CÔNG NGHỆ ABC` |
   | Trưởng bộ phận | Họ tên trưởng bộ phận (ký ở Kế hoạch công tác) |
   | Người phê duyệt | Họ tên người phê duyệt |
   | Mã mẫu kế hoạch | Ví dụ `CTP 01` (ghi ở chân trang). Để trống nếu không cần |
   | Lề PDF bảng kê (mm) | Mặc định `15 10 15 20` (trên, phải, dưới, trái). Lề càng rộng thì chữ càng nhỏ, vì bảng được co cho vừa khổ ngang. Muốn lề đúng NĐ 30 thì gõ `20 15 20 30` |
   | Các mục khác | Để nguyên |

   **Tab NhanSu**: mỗi người 1 dòng. **Dòng đầu tiên là bạn**, họ tên viết giống hệt ô "Người đề nghị".

   | Họ tên | Tên gọi | Bộ phận | Số tài khoản | Ngân hàng |
   |---|---|---|---|---|
   | Nguyễn Văn An | An | Kinh doanh | 0123456789 | Vietcombank |
   | Trần Thị Bình | Bình | Kinh doanh | … | AB Bank |

   *Tên gọi* là tên hiện trên nút bấm. Để trống thì bot tự lấy chữ cuối của họ tên.
   Cột **Chức vụ** (cuối bảng) in vào Kế hoạch công tác. Để trống thì bot lấy *Bộ phận*.

## Bước 6: Mở bot cho Telegram gọi vào (5 phút)

1. Trong Apps Script, bấm **Triển khai** (Deploy), chọn **Tùy chọn triển khai mới** (New deployment).
2. Bấm ⚙ cạnh *Chọn loại*, chọn **Ứng dụng web** (Web app).
3. Chọn **Thực thi với tư cách: Tôi** (Execute as: Me).
4. Chọn **Người có quyền truy cập: Bất kỳ ai** (Anyone).
   > Phải chọn đúng *Bất kỳ ai*, **không** chọn "Bất kỳ ai có tài khoản Google". Nếu chọn sai, Telegram không gọi được bot.
5. Bấm **Triển khai**, rồi copy **URL ứng dụng web** (kết thúc bằng `/exec`).
6. Vào ⚙ **Cài đặt dự án**, mục **Thuộc tính tập lệnh**, thêm `WEBAPP_URL` = link vừa copy.
7. Quay lại màn hình code, chọn hàm **`datWebhook`** rồi bấm ▶ **Chạy**. Nhật ký phải hiện `✅ Đã nối bot với web app.`

## Bước 7: Nhận bot là của bạn (1 phút)

1. Trong Telegram, mở bot của bạn và gõ `/start 123456` (thay bằng mã PIN ở bước 5).
2. Bot trả lời *"Đã nhận bạn là chủ bot"*. Từ giờ bot chỉ trả lời bạn, người khác nhắn vào bot sẽ im lặng.
3. Kiểm tra lại: trong Apps Script, chạy hàm **`kiemTraWebhook`**. Nhật ký phải có dòng `Lỗi gần nhất: không có`.

## Bước 8: Thử 1 vòng (5 phút)

1. Gõ `/moi` và nhập thử 1 chuyến có 1 khoản chi phí.
2. Gõ `/bang` để xem tổng.
3. Gõ `/xuat` để nhận file PDF và Excel. Mở PDF xem đúng mẫu chưa.
4. **Lần đầu, đưa 1 bản PDF cho kế toán xem trước** khi nộp thật.
5. Xóa chuyến thử: gõ `/xem`, bấm **🗑 Xóa chuyến**.

---

## Dùng hằng ngày

| Việc | Gõ |
|---|---|
| Ghi 1 chuyến mới | `/moi`. Bot hỏi lần lượt: ngày, người đi cùng, tỉnh, trường, phương tiện, nội dung, chi phí. Đa số bước chỉ cần **bấm nút**. |
| Chuyến giống chuyến trước (cùng đoàn, cùng tỉnh) | `/lai`. Bot chỉ hỏi ngày và trường. |
| Thêm chi phí quên nhập | `/cp` cho chuyến gần nhất, `/cp 2609001` cho chuyến khác |
| Xem tháng này | `/bang`; tháng khác: `/bang 8` |
| Xem hoặc xóa 1 chuyến, 1 khoản chi | `/xem 2609001` rồi bấm nút 🗑 |
| Ghi tạm ứng | `/tamung 2tr` (tháng này) hoặc `/tamung 2tr 9` |
| Xuất bộ hồ sơ cuối tháng | `/xuat`. Bot gửi **Kế hoạch đi công tác (Word)**, **bảng kê (PDF)** và bảng kê dạng Excel. Nếu hôm nay là ngày 1–10, bot tự lấy **tháng trước**. Muốn chọn tháng: `/xuat 9` |
| Đang nhập dở muốn bỏ | `/huy` |

**Ngày**: bấm *Hôm nay* hoặc *Hôm qua*. Cũng có thể gõ `10/9`, hoặc gõ luôn cả khoảng `10/9-12/9`.

**Người đi cùng**: bấm tên để chọn, rồi bấm **Xong**. Nếu người đó chưa có trong danh bạ, gõ tên và bot sẽ hỏi có thêm vào danh bạ không.

**Chi phí**: bấm loại chi phí, rồi gõ số tiền. Có thể gõ luôn thông tin hóa đơn:

| Bạn gõ | Bot hiểu |
|---|---|
| `1tr8 hđ 145` | 1.800.000đ, có hóa đơn số 145 |
| `864k` | 864.000đ, bot hỏi thêm có hóa đơn không |
| `550100 khd` hoặc `550100 không hđ` | 550.100đ, **không hóa đơn**, vào phiếu Tiền mặt |
| `1.250.000 hđ 88` | 1.250.000đ, hóa đơn số 88 |

Gõ nhanh cả loại lẫn số tiền trong 1 tin: `ks 1tr8 hđ 145` · `xăng 550k khd` · `tk 1.2tr hđ 88` · `khác vé xe 120k khd`.

Bot **luôn nhắc lại số tiền** nó hiểu. Nếu sai, bấm **🗑 Xóa khoản này** rồi nhập lại. Nếu đồng nghiệp trả khoản đó, bấm **👤 Người khác trả** để tiền hoàn ghi vào dòng của người đó.

**Sửa tên trường, ngày, tỉnh…**: sửa thẳng trong tab **Chuyen** trên app Google Sheets ở điện thoại. Khi xuất file, bot tự tính lại số ngày.

**Xóa chuyến hoặc khoản chi**: luôn xóa **qua bot** (`/xem`, rồi bấm 🗑). **Đừng xóa dòng trong Sheet**, vì chi phí của chuyến đó sẽ bị mồ côi.

**Tháng tính tiền** là tháng của **ngày đi**. Chuyến 30/9–2/10 tính vào tháng 9. Khi bạn sửa ngày trong Sheet, tháng tính tiền cũng đổi theo. Muốn tính vào tháng khác thì điền cột *Tháng TT* trong tab Chuyen, ví dụ `10/2026`. Để trống cột này nghĩa là tính theo ngày đi.

**Gõ chi phí vào hôm sau**: nếu đã hơn 12 giờ kể từ lần nhập cuối, bot sẽ hỏi *"Thêm vào chuyến … ?"* rồi mới lưu. Nhờ vậy chi phí không bị ghi nhầm vào chuyến cũ.

Chữ **k** đứng riêng sau một số lớn được hiểu là "không". Ví dụ `150000 k có hđ` là 150.000đ **không** hóa đơn, còn `864 k` là 864.000đ.

### Cuối tháng

1. Gõ `/bang` và đọc các dòng ⚠️, ví dụ chuyến chưa có tên trường, thiếu số tài khoản, quá 2 khoản không hóa đơn.
2. Gõ `/xuat`, bot gửi 3 file. Cả 3 file cũng được lưu trong Drive, thư mục **CTP - File xuất**:
   - **Kế hoạch đi công tác** (Word): tổng hợp từ các chuyến trong tháng gồm địa điểm, người đi, thời gian, nội dung, phương tiện. Trình bày theo **Nghị định 30/2020/NĐ-CP**: Times New Roman, lề trái 30 mm, quốc hiệu và tiêu ngữ có gạch dưới, ngày ghi kiểu `03/8/2026`. Ngày ký là ngày bạn xuất file. File Word nên sửa được trước khi in.
   - **Bảng kê** (PDF): Giấy đề nghị thanh toán, Phụ lục 1, và Tiền mặt nếu có.
   - Bảng kê dạng **Excel**, nếu kế toán cần.
3. In Kế hoạch và bảng kê rồi ký tên. Nộp kèm **hóa đơn** và **giấy đi đường**.

### Bot KHÔNG làm thay được

- Lấy hóa đơn điện tử **ghi đúng tên công ty và mã số thuế**. Khi đổ xăng hay nhận phòng, bạn phải đọc thông tin công ty cho bên bán.
- Xin **xác nhận trên giấy đi đường**.
- **Chữ ký** của bạn, trưởng bộ phận, kế toán.
- Nhật ký **xe ô tô cá nhân** (km × 9.000đ): bot chỉ ghi phương tiện, chưa tự lập nhật ký km.

---

## Sửa code về sau

Khi có bản `Code.gs` mới:

1. Dán đè code mới, bấm **Lưu**.
2. Bấm **Triển khai**, chọn **Quản lý tùy chọn triển khai** (Manage deployments), bấm ✏ **Sửa**.
3. Ở **Phiên bản**, chọn **Phiên bản mới** (New version), rồi bấm **Triển khai**.

> Làm như vậy link web app **giữ nguyên**, không cần làm gì thêm. Nếu lỡ bấm *Tùy chọn triển khai mới*, bạn sẽ có link mới. Khi đó cập nhật `WEBAPP_URL` rồi chạy lại `datWebhook`.

Sau khi dán code mới, chạy lại hàm **`caiDat`** một lần. Hàm này chỉ thêm các mục và cột mới (ví dụ các mục cho Kế hoạch công tác), không xóa dữ liệu cũ.

Nếu code mới cần thêm quyền, Google sẽ hỏi lại khi bạn chạy một hàm bất kỳ, ví dụ `kiemTraWebhook`. Bấm cho phép như ở bước 5.

## Khi có sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Bot không trả lời | Chạy `kiemTraWebhook` và xem dòng "Lỗi gần nhất". Nếu có `302`: vào Deploy, sửa *Người có quyền truy cập* thành **Bất kỳ ai**. Nếu có `401`/`404`: token sai, sửa `BOT_TOKEN` rồi chạy `datWebhook`. |
| Bot báo ⚠️ lỗi | Đọc nội dung lỗi. Chi tiết có trong tab **Loi**. |
| Bot kẹt ở một bước lạ | Gõ `/huy`, hoặc chạy hàm `xoaTrangThai`. |
| Muốn thử xuất file mà không qua Telegram | Chạy hàm `thuXuat`. Nhật ký sẽ in link Sheet, PDF và Excel. |
| Đổi điện thoại hoặc tài khoản Telegram | Trong *Thuộc tính tập lệnh*, xóa `OWNER_ID`. Chạy `caiDat` để lấy PIN mới, rồi gõ `/start PIN` từ tài khoản mới. |
| Lộ token | Vào @BotFather, bấm **Revoke**. Cập nhật `BOT_TOKEN`, rồi chạy `datWebhook`. |

## Giữ an toàn

- **Không chia sẻ** file `CTP Dữ liệu` hay dự án Apps Script cho ai. Người có quyền sửa file sẽ xem được token.
- File PDF và Excel có **số tài khoản của đồng nghiệp**. Chỉ gửi cho kế toán.
- Link web app có kèm mã bí mật (do `caiDat` tạo, bot tự dùng), đừng đăng lên đâu. Người lạ không có mã sẽ bị bỏ qua.
