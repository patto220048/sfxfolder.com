-- Add ads_config column to site_settings table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='ads_config') THEN
        ALTER TABLE public.site_settings ADD COLUMN ads_config JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
