-- Migration: Add custom_readme to sound_packs
-- Added at: 2026-06-16

ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS custom_readme TEXT;
