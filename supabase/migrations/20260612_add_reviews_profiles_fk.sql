-- Add foreign key constraint between sound_pack_reviews and profiles to support PostgREST join query
ALTER TABLE public.sound_pack_reviews
  ADD CONSTRAINT sound_pack_reviews_user_id_fkey_profiles
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
