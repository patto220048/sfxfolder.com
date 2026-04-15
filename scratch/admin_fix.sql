-- scratch/admin_fix.sql
-- Đảm bảo bảng tags tồn tại
CREATE TABLE IF NOT EXISTS public.tags (
    name TEXT PRIMARY KEY,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm một số tag mẫu nếu bảng trống để test UI
INSERT INTO public.tags (name, usage_count)
SELECT 'hot', 10 WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'hot');

INSERT INTO public.tags (name, usage_count)
SELECT 'new', 5 WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'new');

INSERT INTO public.tags (name, usage_count)
SELECT 'popular', 8 WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'popular');

-- Đảm bảo cột usage_count có giá trị mặc định là 0 nếu thiếu
ALTER TABLE public.tags ALTER COLUMN usage_count SET DEFAULT 0;
