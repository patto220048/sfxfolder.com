-- Add draft_reply column to contact_messages table
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS draft_reply TEXT;
