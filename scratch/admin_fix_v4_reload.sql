-- FORCE RELOAD POSTGREST CACHE
NOTIFY pgrst, 'reload schema';

-- Verify and strictly ensure columns exist in 'resources'
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'file_name') THEN
        ALTER TABLE resources ADD COLUMN file_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'file_type') THEN
        ALTER TABLE resources ADD COLUMN file_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'storage_path') THEN
        ALTER TABLE resources ADD COLUMN storage_path TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'updated_at') THEN
        ALTER TABLE resources ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Also for folders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'folders' AND column_name = 'updated_at') THEN
        ALTER TABLE folders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Disable RLS again just in case a restore happened
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE folders DISABLE ROW LEVEL SECURITY;

-- Final Reload notification
NOTIFY pgrst, 'reload schema';
