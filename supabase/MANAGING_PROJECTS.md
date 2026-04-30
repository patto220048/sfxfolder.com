# Quản lý Đa Dự án Supabase (Dev & Prod)

Tài liệu này hướng dẫn cách quản lý an toàn giữa môi trường Phát triển (Development) và Sản xuất (Production) để tránh làm gián đoạn thanh toán của khách hàng thật.

## 1. Cấu trúc Môi trường
- **Dev Project**: Dùng để test Sandbox, tính năng mới. Không ảnh hưởng đến dữ liệu thật.
- **Prod Project**: Dành cho khách hàng thật. Chỉ deploy lên đây khi tính năng đã được test kỹ ở Dev.

## 2. Quy trình Chuyển đổi Dự án

### Bước 1: Link tới dự án mục tiêu
Sử dụng mã Project ID (lấy từ Supabase Dashboard > Settings > General) để trỏ CLI tới đúng dự án.

```powershell
# Trỏ tới dự án DEV
npx supabase link --project-ref [MÃ-PROJECT-ID-DEV]

# Trỏ tới dự án PROD
npx supabase link --project-ref [MÃ-PROJECT-ID-PROD]
```

### Bước 2: Cập nhật Secrets (Biến môi trường)
Sau khi đã link đúng dự án, hãy đẩy các biến môi trường tương ứng lên:

```powershell
# Cho dự án DEV
npx supabase secrets set --env-file supabase/secrets.dev.env

# Cho dự án PROD
npx supabase secrets set --env-file supabase/secrets.prod.env
```

### Bước 3: Deploy Function
Lệnh này sẽ deploy mã nguồn Edge Function lên dự án mà bạn vừa link ở Bước 1.

```powershell
npx supabase functions deploy paypal-webhook
```

## 3. Cấu hình Webhook trên PayPal Dashboard
Đảm bảo URL Webhook trong PayPal Dashboard khớp với Project ID tương ứng:

- **PayPal Sandbox**: URL phải là `https://[PROJECT-ID-DEV].supabase.co/functions/v1/paypal-webhook`
- **PayPal Live**: URL phải là `https://[PROJECT-ID-PROD].supabase.co/functions/v1/paypal-webhook`

---
*Lưu ý: Luôn kiểm tra kỹ Project ID trước khi chạy lệnh deploy để tránh ghi đè nhầm môi trường.*
