-- ==========================================
-- ADD SITE SETTINGS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    site_name TEXT DEFAULT 'EditerLor',
    tagline TEXT DEFAULT 'Free Resources for Video Editors',
    project_version TEXT DEFAULT 'v 0.1.16.4',
    status_text TEXT DEFAULT 'System Online',
    contact_email TEXT DEFAULT 'admin@editerlor.com',
    social_links JSONB DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Mọi người có thể đọc
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Allow public read on site_settings'
    ) THEN
        CREATE POLICY "Allow public read on site_settings" ON site_settings FOR SELECT USING (true);
    END IF;
END $$;

-- Admin có thể cập nhật (Giả định admin đã đăng nhập)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Allow admin update on site_settings'
    ) THEN
        CREATE POLICY "Allow admin update on site_settings" ON site_settings FOR UPDATE USING (true);
    END IF;
END $$;

-- Insert dữ liệu mặc định nếu chưa có
INSERT INTO site_settings (id, site_name, project_version) 
VALUES (1, 'EditerLor', 'v 0.1.16.4')
ON CONFLICT (id) DO NOTHING;
