-- ==========================================
-- SUPABASE RECREATE SCHEMA SCRIPT
-- ==========================================

-- 0. DỌN DẸP: Xóa các bảng cũ để rebuild sạch sẽ
-- Sử dụng CASCADE để xóa các ràng buộc khóa ngoại liên quan
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- 1. Tạo bảng categories (Danh mục)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tạo bảng folders (Thư mục)
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL, -- Liên kết với slug của categories
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tạo bảng resources (Tài nguyên)
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    category_id TEXT NOT NULL, -- Liên kết với categories.slug
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    file_format TEXT,
    file_size BIGINT,
    file_type TEXT,
    tags TEXT[], 
    download_url TEXT NOT NULL,
    preview_url TEXT,
    thumbnail_url TEXT,
    storage_path TEXT,
    download_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    fts tsvector,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Thiết lập Full-Text Search trigger
CREATE OR REPLACE FUNCTION resources_fts_trigger() RETURNS trigger AS $$
begin
  new.fts :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B');
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resources_fts BEFORE INSERT OR UPDATE
ON resources FOR EACH ROW EXECUTE FUNCTION resources_fts_trigger();

-- 5. Tạo Index
CREATE INDEX idx_resources_category ON resources(category_id);
CREATE INDEX idx_resources_folder ON resources(folder_id);
CREATE INDEX idx_resources_fts ON resources USING gin(fts);

-- 6. Seed dữ liệu cho Categories
INSERT INTO categories (name, slug, icon_name) VALUES
('Video Overlay', 'video-overlay', 'Video'),
('Sound Effects', 'sound-effects', 'Music'),
('Fonts', 'fonts', 'Type'),
('Graphics', 'graphics', 'Image'),
('Transitions', 'transitions', 'Layers');

-- 7. Seed dữ liệu mẫu cho Resources
INSERT INTO resources (name, description, slug, category_id, file_format, file_size, download_url, tags)
VALUES 
('Example Resource', 'Đây là tài nguyên mẫu để kiểm tra giao diện Supabase', 'example-resource-1', 'video-overlay', 'mp4', 1024576, 'https://example.com/file.mp4', '{sample, test}');

-- 8. Kích hoạt Row Level Security (RLS)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- 9. Tạo Policy cho phép mọi người đọc (Public Read)
-- Xóa policy cũ nếu có (thường không cần vì đã DROP bảng ở bước 0)
CREATE POLICY "Allow public read on resources" ON resources FOR SELECT USING (true);
CREATE POLICY "Allow public read on categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow public read on folders" ON folders FOR SELECT USING (true);
