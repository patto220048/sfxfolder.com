# Kết quả thực hiện - Script Bulk Upload Supabase (Hỗ trợ folder_id)

Tôi đã nâng cấp script tự động tải tài nguyên hàng loạt để hỗ trợ tự động nhận diện và tạo cấu trúc thư mục con (`folder_id` và `parent_id`) trên Supabase tương tự như cấu trúc thư mục trên máy tính của bạn.

## Các công việc đã hoàn thành

### 1. Nâng cấp Script
- **File:** [bulk-upload-resources.mjs](file:///f:/re-src-web/scripts/bulk-upload-resources.mjs)
- **Tính năng mới**:
  - Tự động quét đệ quy các thư mục nằm bên trong thư mục tag.
  - Kiểm tra xem thư mục đã tồn tại trong bảng `folders` trên database của Supabase chưa (dựa theo tên thư mục, `category_id` và `parent_id`).
  - Nếu chưa tồn tại, tự động tạo mới bản ghi thư mục trong DB với phân cấp cha-con chính xác (`parent_id` trỏ về ID thư mục cha).
  - Sử dụng Cache trong suốt thời gian chạy để tránh việc truy vấn trùng lặp dữ liệu thư mục vào Database.
  - Gán chính xác `folder_id` của tệp tin cho bản ghi tài nguyên trong bảng `resources`.

### 2. Kết quả kiểm thử (Verification)
Tôi đã tạo cấu trúc thư mục kiểm thử lồng nhau:
`scratch/test-upload/sound-effects/dog,bark/Templates/Transitions/Fido Barking.mp3`

Kết quả chạy script kiểm thử thành công:
- **Tự động nhận diện thư mục cha (Root Folder)**: Phát hiện thư mục `Templates` không tồn tại, tạo mới thành công trên Supabase.
- **Tự động nhận diện thư mục con (Subfolder)**: Phát hiện thư mục `Transitions` không tồn tại, tạo mới với `parent_id` liên kết chính xác đến ID của `Templates`.
- **Đăng ký Resource**: Tải file lên và gán `folder_id` trỏ đúng vào thư mục `Transitions`.
- **Dọn dẹp**: Xóa sạch toàn bộ bản ghi và file thử nghiệm sau khi xác nhận kết quả chính xác để tránh làm bẩn database của dự án.

---

## Hướng dẫn sắp xếp thư mục trên máy tính (`D:\Upload_San_Sang`)

Để script tự động tạo thư mục trên web, bạn sắp xếp theo cấu trúc lồng nhau tùy ý bên trong thư mục tag:

```text
D:\Upload_San_Sang\
  └── sound-effects\                        <-- Category slug
        └── dog,bark\                        <-- Tags ngăn cách bởi dấu phẩy
              ├── Templates\                 <-- Thư mục cấp 1 (Tự động tạo folder nếu chưa có)
              │     ├── Transitions\         <-- Thư mục cấp 2 (Tự động tạo và nhận diện cha là Templates)
              │     │     └── Fido Barking.mp3 <-- Tài nguyên (sẽ được gán folder_id trỏ về Transitions)
              │     └── dog-bark-1.mp3       <-- Tài nguyên nằm trực tiếp trong Templates
              └── dog-bark-standalone.mp3    <-- Tài nguyên không nằm trong thư mục nào (folder_id = null)
```

### Cách chạy Script

Chạy lệnh quen thuộc trong Terminal:

```bash
node scripts/bulk-upload-resources.mjs D:\Upload_San_Sang
```
