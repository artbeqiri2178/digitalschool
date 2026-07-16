// Supabase Client Configuration for AI Learning Hub
// Add this to your project and import where needed

import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials (replace with your actual values)
const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY';

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// ============================================
// AUTH HELPER FUNCTIONS
// ============================================

/**
 * Sign up a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {object} metadata - Additional user data (username, full_name, age, etc.)
 * @returns {Promise<{user, error}>}
 */
export async function signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: metadata.username,
                full_name: metadata.fullName,
                age: metadata.age,
                grade_level: metadata.gradeLevel
            }
        }
    });
    return { user: data.user, error };
}

/**
 * Sign in an existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{user, error}>}
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    return { user: data.user, error };
}

/**
 * Sign in with OAuth provider (Google, GitHub, etc.)
 * @param {string} provider - 'google' | 'github' | 'azure' | etc.
 * @returns {Promise<{error}>}
 */
export async function signInWithOAuth(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback`
        }
    });
    return { error };
}

/**
 * Sign out the current user
 * @returns {Promise<{error}>}
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Get the current session/user
 * @returns {Promise<{user, session, error}>}
 */
export async function getCurrentUser() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    return { user, session, error: userError || sessionError };
}

/**
 * Listen for auth state changes
 * @param {Function} callback - Called with (event, session)
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
}

/**
 * Reset password - sends recovery email
 * @param {string} email - User's email
 * @returns {Promise<{error}>}
 */
export async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
    });
    return { error };
}

/**
 * Update user password (after reset)
 * @param {string} newPassword - New password
 * @returns {Promise<{error}>}
 */
export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
}

// ============================================
// PROFILE HELPER FUNCTIONS
// ============================================

/**
 * Get current user's profile
 * @returns {Promise<{profile, error}>}
 */
export async function getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { profile: null, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    return { profile: data, error };
}

/**
 * Update current user's profile
 * @param {object} updates - Fields to update
 * @returns {Promise<{profile, error}>}
 */
export async function updateProfile(updates) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { profile: null, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
    
    return { profile: data, error };
}

/**
 * Get any user's public profile by ID
 * @param {string} userId - Target user's ID
 * @returns {Promise<{profile, error}>}
 */
export async function getPublicProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, created_at')
        .eq('id', userId)
        .single();
    
    return { profile: data, error };
}

// ============================================
// PROGRESS HELPER FUNCTIONS
// ============================================

/**
 * Get current user's progress across all sections
 * @returns {Promise<{progress, error}>}
 */
export async function getUserProgress() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { progress: [], error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id);
    
    return { progress: data || [], error };
}

/**
 * Mark a section as complete for current user
 * @param {string} sectionId - Section identifier
 * @param {number} timeSpent - Seconds spent on section
 * @param {number} quizScore - Optional quiz score
 * @returns {Promise<{progress, error}>}
 */
export async function completeSection(sectionId, timeSpent = 0, quizScore = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { progress: null, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('user_progress')
        .upsert({
            user_id: user.id,
            section_id: sectionId,
            completed: true,
            completed_at: new Date().toISOString(),
            time_spent_seconds: timeSpent,
            quiz_score: quizScore
        })
        .select()
        .single();
    
    return { progress: data, error };
}

/**
 * Update time spent on a section (for tracking engagement)
 * @param {string} sectionId - Section identifier
 * @param {number} additionalSeconds - Seconds to add
 * @returns {Promise<{progress, error}>}
 */
export async function updateSectionTime(sectionId, additionalSeconds) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { progress: null, error: 'Not authenticated' };

    // First get current time
    const { data: current } = await supabase
        .from('user_progress')
        .select('time_spent_seconds')
        .eq('user_id', user.id)
        .eq('section_id', sectionId)
        .single();

    const newTime = (current?.time_spent_seconds || 0) + additionalSeconds;

    const { data, error } = await supabase
        .from('user_progress')
        .upsert({
            user_id: user.id,
            section_id: sectionId,
            time_spent_seconds: newTime
        })
        .select()
        .single();
    
    return { progress: data, error };
}

// ============================================
// ACHIEVEMENT HELPER FUNCTIONS
// ============================================

/**
 * Get current user's achievements with details
 * @returns {Promise<{achievements, error}>}
 */
export async function getUserAchievements() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { achievements: [], error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('user_achievements')
        .select(`
            earned_at,
            achievements:achievement_id (key, name, description, icon, xp_reward)
        `)
        .eq('user_id', user.id);
    
    return { achievements: data || [], error };
}

/**
 * Get all available achievements (for display)
 * @returns {Promise<{achievements, error}>}
 */
export async function getAllAchievements() {
    const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('xp_reward', { ascending: true });
    
    return { achievements: data || [], error };
}

/**
 * Check and award achievements based on user progress
 * Call this after completing sections
 * @returns {Promise<{newAchievements, error}>}
 */
export async function checkAndAwardAchievements() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { newAchievements: [], error: 'Not authenticated' };

    // Get user's current stats
    const { data: progress } = await supabase
        .from('user_progress')
        .select('completed')
        .eq('user_id', user.id);

    const completedSections = progress?.filter(p => p.completed).length || 0;
    
    // Get achievements not yet earned
    const { data: earned } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id);
    
    const earnedIds = new Set(earned?.map(e => e.achievement_id) || []);
    
    // Get all achievements
    const { data: allAchievements } = await supabase
        .from('achievements')
        .select('*');
    
    const newAchievements = [];
    
    for (const achievement of allAchievements || []) {
        if (earnedIds.has(achievement.id)) continue;
        
        let shouldAward = false;
        
        switch (achievement.key) {
            case 'first-section':
                shouldAward = completedSections >= 1;
                break;
            case 'ai-explorer':
                shouldAward = completedSections >= 3;
                break;
            // Add more conditions as needed
        }
        
        if (shouldAward) {
            const { data } = await supabase
                .from('user_achievements')
                .insert({ user_id: user.id, achievement_id: achievement.id })
                .select(`
                    earned_at,
                    achievements:achievement_id (key, name, description, icon, xp_reward)
                `)
                .single();
            if (data) newAchievements.push(data);
        }
    }
    
    return { newAchievements, error: null };
}

// ============================================
// SETTINGS HELPER FUNCTIONS
// ============================================

/**
 * Get current user's settings
 * @returns {Promise<{settings, error}>}
 */
export async function getUserSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { settings: null, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
    
    return { settings: data, error };
}

/**
 * Update current user's settings
 * @param {object} updates - Settings to update
 * @returns {Promise<{settings, error}>}
 */
export async function updateUserSettings(updates) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { settings: null, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
    
    return { settings: data, error };
}

// ============================================
// DASHBOARD HELPER
// ============================================

/**
 * Get complete dashboard data for current user
 * @returns {Promise<{dashboard, error}>}
 */
export async function getDashboardData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { dashboard: null, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('user_dashboard')
        .select('*')
        .eq('id', user.id)
        .single();
    
    return { dashboard: data, error };
}

export default supabase;