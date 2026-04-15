-- FIX: Thiết lập mối quan hệ giữa Resources và Categories thông qua category_id (slug)
-- Bước này giúp Supabase hiểu được logic JOIN 'categories(*)' trong các truy vấn API.

-- 1. Đảm bảo cột slug trong bảng categories là UNIQUE (điều kiện bắt buộc để làm Foreign Key target)
-- (Đã có trong script trước nhưng thêm vào đây để chắc chắn)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_key') THEN
        ALTER TABLE categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
    END IF;
END $$;

-- 2. Thêm Foreign Key vào bảng resources
-- Nếu đã tồn tại thì xóa đi để tạo mới chuẩn xác
ALTER TABLE resources DROP CONSTRAINT IF EXISTS fk_resources_category;

ALTER TABLE resources 
ADD CONSTRAINT fk_resources_category 
FOREIGN KEY (category_id) 
REFERENCES categories(slug)
ON UPDATE CASCADE;

-- 3. Thông báo hoàn tất
SELECT 'Foreign Key "fk_resources_category" has been successfully created.' as result;
