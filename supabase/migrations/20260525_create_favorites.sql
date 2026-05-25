-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, resource_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Allow users to read their own favorites" 
    ON public.favorites 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own favorites" 
    ON public.favorites 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own favorites" 
    ON public.favorites 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_resource_id_idx ON public.favorites(resource_id);
