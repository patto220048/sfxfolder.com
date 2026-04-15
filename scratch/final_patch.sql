-- FINAL PATCH: Bổ sung cột 'order' và củng cố Relationships
-- Chạy script này để khôi phục hiển thị trang chủ và danh mục.

-- 1. Bổ sung cột 'order' vào bảng categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- 2. Bổ sung cột 'order' vào bảng folders
ALTER TABLE folders ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- 3. Cập nhật dữ liệu mẫu để có thứ tự (Order)
UPDATE categories SET "order" = 1 WHERE slug = 'video-overlay';
UPDATE categories SET "order" = 2 WHERE slug = 'sound-effects';
UPDATE categories SET "order" = 3 WHERE slug = 'fonts';
UPDATE categories SET "order" = 4 WHERE slug = 'graphics';
UPDATE categories SET "order" = 5 WHERE slug = 'transitions';

-- 4. Củng cố Foreign Key giữa resources và categories (dùng cho việc đếm tài nguyên)
-- (Nếu script trước chưa chạy thành công thì script này sẽ đảm bảo)
ALTER TABLE resources DROP CONSTRAINT IF EXISTS fk_resources_category;
ALTER TABLE resources 
ADD CONSTRAINT fk_resources_category 
FOREIGN KEY (category_id) 
REFERENCES categories(slug)
ON UPDATE CASCADE;

-- 5. Củng cố Foreign Key giữa folders và categories
ALTER TABLE folders DROP CONSTRAINT IF EXISTS fk_folders_category;
ALTER TABLE folders 
ADD CONSTRAINT fk_folders_category 
FOREIGN KEY (category_id) 
REFERENCES categories(slug)
ON UPDATE CASCADE;

-- 6. Tạo lại Index để tối ưu hóa việc sắp xếp
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories("order");
CREATE INDEX IF NOT EXISTS idx_folders_order ON folders("order");

-- 7. Thông báo hoàn tất
SELECT 'Final patch applied successfully. Home page should now display categories.' as result;
