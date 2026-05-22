-- =========================================================================
-- WhatsApp Number Cleaner, Duplicate Remover & Messaging Pro
-- Supabase Schema Migration: Tables, Row Level Security (RLS) & Triggers
-- =========================================================================

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Profiles Table (Public metadata linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY, -- References auth.users.id
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Retained for legacy support
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    telegram_chat_id TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Jobs Table
CREATE TABLE IF NOT EXISTS public.jobs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed', 'completed')),
    total_numbers INTEGER DEFAULT 0,
    valid_count INTEGER DEFAULT 0,
    invalid_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    telegram_notifications BOOLEAN DEFAULT FALSE,
    provider TEXT DEFAULT 'whatsapp_cloud',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create Numbers Table
CREATE TABLE IF NOT EXISTS public.numbers (
    id SERIAL PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    original_number TEXT NOT NULL,
    normalized_number TEXT,
    status TEXT NOT NULL CHECK (status IN ('valid', 'invalid', 'duplicate')),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Api Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('whatsapp_cloud', 'twilio', 'ultramsg')),
    name TEXT NOT NULL,
    credentials TEXT NOT NULL, -- JSON string representation
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- A. Profiles RLS Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update their own profile fields" ON public.profiles
    FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Admins can view and edit all profiles" ON public.profiles
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid()::text AND role = 'admin'
        )
    );

-- B. Jobs RLS Policies
CREATE POLICY "Users can view their own jobs" ON public.jobs
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own jobs" ON public.jobs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own jobs" ON public.jobs
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own jobs" ON public.jobs
    FOR DELETE USING (auth.uid()::text = user_id);

-- C. Numbers RLS Policies
CREATE POLICY "Users can view numbers linked to their jobs" ON public.numbers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = numbers.job_id AND jobs.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert numbers into their own jobs" ON public.numbers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = numbers.job_id AND jobs.user_id = auth.uid()::text
        )
    );

-- D. API Keys RLS Policies
CREATE POLICY "Users can manage their own API keys" ON public.api_keys
    FOR ALL USING (auth.uid()::text = user_id);

-- ==========================================
-- AUTOMATIC AUTH SYNC TRIGGER
-- ==========================================

-- Create handle_new_user function to copy registration from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, is_active, created_at)
    VALUES (
        NEW.id::text,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        TRUE,
        NEW.created_at
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users registration
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- SUPABASE REALTIME REPLICATION
-- ==========================================

-- Add tables to supabase_realtime publication to stream DB changes live
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.numbers;
