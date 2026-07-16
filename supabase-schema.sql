-- Supabase Database Schema for AI Learning Hub
-- Run this in Supabase SQL Editor

-- Enable UUID extension (Supabase has this by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends Supabase Auth)
-- ============================================
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    age INTEGER CHECK (age >= 12 AND age <= 18),
    grade_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================
-- USER PROGRESS TABLE (tracks learning progress)
-- ============================================
CREATE TABLE user_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    section_id TEXT NOT NULL, -- e.g., 'what-is-ai', 'ai-daily-life', etc.
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    time_spent_seconds INTEGER DEFAULT 0,
    quiz_score INTEGER, -- percentage score if quizzes added later
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, section_id)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress"
    ON user_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
    ON user_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
    ON user_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- USER ACHIEVEMENTS/BADGES TABLE
-- ============================================
CREATE TABLE achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL, -- e.g., 'first-section-complete', 'ai-explorer'
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- emoji or icon identifier
    xp_reward INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
    ON user_achievements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert achievements"
    ON user_achievements FOR INSERT
    WITH CHECK (true); -- Service role will handle this

-- ============================================
-- SEED DEFAULT ACHIEVEMENTS
-- ============================================
INSERT INTO achievements (key, name, description, icon, xp_reward) VALUES
    ('welcome', 'Welcome Aboard', 'Created your account and started learning', '🎉', 50),
    ('first-section', 'First Steps', 'Completed your first learning section', '👶', 100),
    ('ai-explorer', 'AI Explorer', 'Completed all three main sections', '🧭', 300),
    ('streak-3', '3-Day Streak', 'Learned for 3 days in a row', '🔥', 150),
    ('streak-7', 'Week Warrior', 'Learned for 7 days in a row', '⚔️', 500),
    ('quiz-master', 'Quiz Master', 'Scored 100% on a section quiz', '🧠', 200);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE user_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    email_notifications BOOLEAN DEFAULT TRUE,
    progress_reminders BOOLEAN DEFAULT TRUE,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    -- Award welcome achievement
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT NEW.id, id FROM public.achievements WHERE key = 'welcome';
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block signup
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- HELPFUL VIEWS
-- ============================================

-- User dashboard view (combines profile, progress, achievements)
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.age,
    p.grade_level,
    p.created_at as joined_at,
    COUNT(DISTINCT up.id) FILTER (WHERE up.completed) as sections_completed,
    COALESCE(SUM(up.time_spent_seconds), 0) as total_time_seconds,
    COUNT(DISTINCT ua.id) as achievements_earned,
    COALESCE(SUM(a.xp_reward), 0) as total_xp,
    s.theme,
    s.email_notifications
FROM profiles p
LEFT JOIN user_progress up ON up.user_id = p.id
LEFT JOIN user_achievements ua ON ua.user_id = p.id
LEFT JOIN achievements a ON a.id = ua.achievement_id
LEFT JOIN user_settings s ON s.user_id = p.id
GROUP BY p.id, s.theme, s.email_notifications;

-- ============================================
-- STORAGE BUCKETS (run in Storage section)
-- ============================================
-- CREATE BUCKET avatars WITH (public = true);
-- CREATE BUCKET user_uploads WITH (public = false);