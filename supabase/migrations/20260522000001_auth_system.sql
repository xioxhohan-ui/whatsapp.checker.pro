-- =========================================================================
-- WA INTEL PRO
-- Complete Authentication Database System Migration (Supabase Auth & PostgreSQL)
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cleanup existing auth triggers and functions if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_login() CASCADE;
DROP FUNCTION IF EXISTS public.update_last_login() CASCADE;

-- Cleanup existing tables in dependency order
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.login_history CASCADE;
DROP TABLE IF EXISTS public.exports CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;
DROP TABLE IF EXISTS public.numbers CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==========================================
-- 1. DATABASE TABLES CREATION
-- ==========================================

-- A. Table: profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    password_hash TEXT, -- Aligned with backend model
    telegram_chat_id TEXT -- Aligned with backend model
);

-- B. Table: login_history
CREATE TABLE public.login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    login_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- C. Table: sessions
CREATE TABLE public.sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    refresh_token TEXT,
    device_info TEXT,
    ip_address TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D. Table: jobs (aligned with backend model)
CREATE TABLE public.jobs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_numbers INTEGER DEFAULT 0,
    valid_count INTEGER DEFAULT 0,
    invalid_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    processing_speed FLOAT DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'done')),
    telegram_notifications BOOLEAN DEFAULT FALSE,
    provider TEXT DEFAULT 'whatsapp_cloud',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- E. Table: numbers (aligned with backend model)
CREATE TABLE public.numbers (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    original_number TEXT NOT NULL,
    normalized_number TEXT,
    whatsapp_link TEXT,
    status TEXT CHECK (status IN ('valid', 'invalid', 'duplicate')),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- F. Table: api_keys (aligned with backend model)
CREATE TABLE public.api_keys (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    credentials TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- G. Table: exports
CREATE TABLE public.exports (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    export_type TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- H. Table: logs
CREATE TABLE public.logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_message TEXT,
    level TEXT DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on ALL tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Helper checking role is admin directly from JWT claims to prevent infinite database queries recursion
CREATE OR REPLACE FUNCTION public.is_jwt_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- A. Profiles RLS Policies
CREATE POLICY "profiles_user_isolation" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.is_jwt_admin());

CREATE POLICY "profiles_user_self_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.is_jwt_admin())
    WITH CHECK (auth.uid() = id OR public.is_jwt_admin());

CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_jwt_admin());

-- B. Login History RLS Policies
CREATE POLICY "login_history_user_isolation" ON public.login_history
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_jwt_admin());

CREATE POLICY "login_history_admin_all" ON public.login_history
    FOR ALL TO authenticated
    USING (public.is_jwt_admin());

-- C. Sessions RLS Policies
CREATE POLICY "sessions_user_isolation" ON public.sessions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR public.is_jwt_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_jwt_admin());

-- D. Jobs RLS Policies
CREATE POLICY "jobs_user_isolation" ON public.jobs
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR public.is_jwt_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_jwt_admin());

-- E. Numbers RLS Policies (linked via job_id -> jobs.user_id)
CREATE POLICY "numbers_user_isolation" ON public.numbers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = numbers.job_id AND (jobs.user_id = auth.uid() OR public.is_jwt_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = numbers.job_id AND (jobs.user_id = auth.uid() OR public.is_jwt_admin())
        )
    );

-- F. Api Keys RLS Policies
CREATE POLICY "api_keys_user_isolation" ON public.api_keys
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR public.is_jwt_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_jwt_admin());

-- G. Exports RLS Policies
CREATE POLICY "exports_user_isolation" ON public.exports
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR public.is_jwt_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_jwt_admin());

-- H. Logs RLS Policies
CREATE POLICY "logs_user_isolation" ON public.logs
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR public.is_jwt_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_jwt_admin());

-- ==========================================
-- 3. DATABASE INDEXING (Heavy Search Performance)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON public.login_history(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_numbers_job_id ON public.numbers(job_id);

-- ==========================================
-- 4. AUTOMATED TRIGGERS & FUNCTIONS
-- ==========================================

-- Trigger 1: Auto create profile after signup + Set secure role in app_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT := 'user';
BEGIN
    -- Allow initial signup to set admin role if requested or seed
    IF NEW.raw_user_meta_data ->> 'role' = 'admin' OR NEW.email = 'admin@whatsappchecker.pro' THEN
        user_role := 'admin';
    END IF;

    -- Update auth.users raw_app_meta_data to store the role securely in the JWT claims
    UPDATE auth.users
    SET raw_app_meta_data = 
        coalesce(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('role', user_role)
    WHERE id = NEW.id;

    -- Insert into public.profiles
    INSERT INTO public.profiles (id, email, username, full_name, avatar_url, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data ->> 'avatar_url',
        user_role,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        username = COALESCE(profiles.username, EXCLUDED.username),
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Update last_login and login_history after login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
        -- Update profile last_login
        UPDATE public.profiles
        SET last_login = NEW.last_sign_in_at,
            updated_at = NOW()
        WHERE id = NEW.id;

        -- Record in login history
        INSERT INTO public.login_history (user_id, ip_address, user_agent, login_status)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'ip', 'unknown'),
            COALESCE(NEW.raw_user_meta_data ->> 'user_agent', 'unknown'),
            'success'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_login
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_login();

-- Trigger 3: Auto generate whatsapp_link based on normalized_number
CREATE OR REPLACE FUNCTION public.generate_whatsapp_link()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.normalized_number IS NOT NULL AND NEW.normalized_number <> '' AND NEW.status = 'valid' THEN
        NEW.whatsapp_link := 'https://wa.me/' || NEW.normalized_number;
    ELSE
        NEW.whatsapp_link := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER on_number_insert_update
    BEFORE INSERT OR UPDATE ON public.numbers
    FOR EACH ROW EXECUTE FUNCTION public.generate_whatsapp_link();

-- ==========================================
-- 5. NUMBER NORMALIZATION FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.normalize_bd_number(number TEXT)
RETURNS TEXT AS $$
DECLARE
    digits TEXT;
BEGIN
    digits := regexp_replace(number, '[^0-9]', '', 'g');
    
    IF length(digits) = 13 AND digits LIKE '8801%' THEN
        IF substring(digits from 4 for 2) IN ('13', '14', '15', '16', '17', '18', '19') THEN
            RETURN digits;
        END IF;
    END IF;
    
    IF length(digits) = 11 AND digits LIKE '01%' THEN
        IF substring(digits from 2 for 2) IN ('13', '14', '15', '16', '17', '18', '19') THEN
            RETURN '88' || digits;
        END IF;
    END IF;

    IF length(digits) = 10 AND digits LIKE '1%' THEN
        IF substring(digits from 1 for 2) IN ('13', '14', '15', '16', '17', '18', '19') THEN
            RETURN '880' || digits;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- 6. STORED PROCEDURES & OPTIMIZATIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.process_bulk_numbers(p_job_id TEXT, p_raw_numbers TEXT[])
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_total INT := array_length(p_raw_numbers, 1);
    v_valid INT := 0;
    v_invalid INT := 0;
    v_duplicate INT := 0;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    speed FLOAT;
BEGIN
    start_time := clock_timestamp();
    
    SELECT user_id INTO v_user_id FROM public.jobs WHERE id = p_job_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Job % not found.', p_job_id;
    END IF;

    UPDATE public.jobs SET status = 'processing' WHERE id = p_job_id;

    INSERT INTO public.logs (user_id, log_message, level)
    VALUES (v_user_id, 'Started bulk processing of ' || v_total || ' numbers for Job #' || p_job_id, 'info');

    WITH processed_list AS (
        SELECT 
            raw_num,
            public.normalize_bd_number(raw_num) AS norm_num,
            row_number() OVER () as idx
        FROM unnest(p_raw_numbers) AS raw_num
    ),
    classified_list AS (
        SELECT
            raw_num,
            norm_num,
            idx,
            CASE
                WHEN norm_num IS NULL THEN 'invalid'
                WHEN ROW_NUMBER() OVER (PARTITION BY norm_num ORDER BY idx) > 1 THEN 'duplicate'
                WHEN EXISTS (
                    SELECT 1 FROM public.numbers n
                    JOIN public.jobs j ON n.job_id = j.id
                    WHERE j.user_id = v_user_id AND n.normalized_number = norm_num
                ) THEN 'duplicate'
                ELSE 'valid'
            END AS status_val
        FROM processed_list
    )
    INSERT INTO public.numbers (job_id, original_number, normalized_number, status)
    SELECT 
        p_job_id, 
        raw_num, 
        norm_num, 
        status_val
    FROM classified_list;

    SELECT count(*) FILTER (WHERE status = 'valid'),
           count(*) FILTER (WHERE status = 'invalid'),
           count(*) FILTER (WHERE status = 'duplicate')
   INTO v_valid, v_invalid, v_duplicate
    FROM public.numbers
    WHERE job_id = p_job_id;

    end_time := clock_timestamp();
    
    IF extract(epoch from (end_time - start_time)) > 0 THEN
        speed := v_total / extract(epoch from (end_time - start_time));
    ELSE
        speed := v_total;
    END IF;

    UPDATE public.jobs
    SET 
        total_numbers = v_total,
        valid_count = v_valid,
        invalid_count = v_invalid,
        duplicate_count = v_duplicate,
        processing_speed = speed,
        status = 'completed',
        completed_at = end_time
    WHERE id = p_job_id;

    INSERT INTO public.logs (user_id, log_message, level)
    VALUES (v_user_id, 'Completed Job #' || p_job_id || ': ' || v_valid || ' valid, ' || v_invalid || ' invalid, ' || v_duplicate || ' duplicates', 'info');

EXCEPTION WHEN OTHERS THEN
    UPDATE public.jobs SET status = 'failed' WHERE id = p_job_id;
    INSERT INTO public.logs (user_id, log_message, level)
    VALUES (v_user_id, 'Failed Job #' || p_job_id || ': ' || SQLERRM, 'error');
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. SUPABASE REALTIME REPLICATION
-- ==========================================

ALTER PUBLICATION supabase_realtime SET TABLE public.profiles, public.login_history;

-- ==========================================
-- 8. STORAGE BUCKETS CONFIGURATION
-- ==========================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('uploads', 'uploads', false),
    ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow users to manage their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read of avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to manage their own uploads" ON storage.objects;

CREATE POLICY "Allow users to manage their own avatar" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow public read of avatars" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'avatars');

CREATE POLICY "Allow users to manage their own uploads" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'uploads' AND (auth.uid())::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'uploads' AND (auth.uid())::text = (storage.foldername(name))[1]);
