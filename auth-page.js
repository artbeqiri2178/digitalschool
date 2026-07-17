/* ============================================================
 * AI Learning Hub — Login / Register page logic
 * Plain script (no modules) so it runs from file:// too.
 * Mirrors the helpers in supabase-client.js and the
 * schema in supabase-schema.sql (profiles: username,
 * full_name, age, grade_level via user metadata).
 * ============================================================ */

(function () {
    'use strict';

    /* ---- 1. Supabase config ---- */
    /* TODO: paste your project values from Supabase → Project Settings → API */
    const SUPABASE_URL = 'https://fiscieqerjnojopnzuqe.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpc2NpZXFlcmpub2pvcG56dXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODIzNjUsImV4cCI6MjA5OTc1ODM2NX0.SRcnGlu2p3eiweLFlAtYE82-gbinSjZ6gzINDWYCD-4';

    const isConfigured = SUPABASE_URL.includes('YOUR_PROJECT_ID') === false
        && SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY') === false;

    let supabase = null;

    /* Load the Supabase UMD build dynamically (non-blocking).
       If the CDN is unreachable, the UI still works; auth calls
       will simply report "not configured". */
    function loadSupabase() {
        return new Promise(function (resolve) {
            if (typeof window.supabase !== 'undefined') {
                initSupabase();
                resolve();
                return;
            }
            if (!isConfigured) { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.async = true;
            s.onload = function () {
                initSupabase();
                resolve();
            };
            s.onerror = function () {
                console.warn('Supabase CDN could not be loaded.');
                resolve();
            };
            document.head.appendChild(s);
        });
    }

    function initSupabase() {
        if (isConfigured && typeof window.supabase !== 'undefined') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
            });
        }
    }

    /* ---- 2. Helpers (mirror supabase-client.js) ---- */
    async function signUp(email, password, metadata = {}) {
        return supabase.auth.signUp({
            email,
            password,
            options: {
                /* Redirect the confirmation link to THIS site (your Vercel URL),
                   not Supabase's default localhost. */
                emailRedirectTo: window.location.origin + '/login.html',
                data: {
                    username: metadata.username,
                    full_name: metadata.fullName,
                    age: metadata.age,
                    grade_level: metadata.gradeLevel
                }
            }
        });
    }
    async function signIn(email, password, remember = false) {
        return supabase.auth.signInWithPassword({
            email,
            password,
            options: { data: { remember } }
        });
    }
    async function signInWithOAuth(provider) {
        return supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: window.location.origin + '/index.html' }
        });
    }
    async function resetPassword(email) {
        return supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login.html'
        });
    }

    /* ---- 3. DOM refs ---- */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

    const tabLogin = $('#tab-login');
    const tabRegister = $('#tab-register');
    const panelLogin = $('#panel-login');
    const panelRegister = $('#panel-register');
    const toast = $('#toast');
    const configNotice = $('#config-notice');

    /* ---- 4. Toast ---- */
    let toastTimer;
    function showToast(message, type) {
        type = type || 'info';
        toast.textContent = message;
        toast.className = 'toast toast-' + type;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.hidden = true; }, 5000);
    }

    /* ---- 5. Config notice ---- */
    if (!isConfigured) configNotice.hidden = false;

    /* ---- 6. Already signed in? ---- */
    loadSupabase().then(function () {
        if (supabase) {
            supabase.auth.getSession().then(function (res) {
                if (res.data && res.data.session) window.location.replace('index.html');
            });
        }
    });

    /* ---- 7. Tab switching ---- */
    function switchTab(tab) {
        const isLogin = tab === 'login';
        tabLogin.classList.toggle('is-active', isLogin);
        tabRegister.classList.toggle('is-active', !isLogin);
        tabLogin.setAttribute('aria-selected', String(isLogin));
        tabRegister.setAttribute('aria-selected', String(!isLogin));
        panelLogin.hidden = !isLogin;
        panelRegister.hidden = isLogin;
        hideForgot();
    }
    tabLogin.addEventListener('click', function () { switchTab('login'); });
    tabRegister.addEventListener('click', function () { switchTab('register'); });

    /* ---- 8. Password visibility ---- */
    $$('[data-toggle-password]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const input = btn.closest('.password-wrapper').querySelector('input');
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        });
    });

    /* ---- 9. Password strength ---- */
    const regPass = $('#register-password');
    const strengthWrap = $('.password-strength');
    const strengthFill = $('.strength-fill');
    const strengthText = $('.strength-text');
    function scorePassword(p) {
        let s = 0;
        if (p.length >= 8) s++;
        if (p.length >= 12) s++;
        if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
        if (/\d/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return Math.min(s, 4);
    }
    regPass.addEventListener('input', function () {
        const v = regPass.value;
        if (!v) { strengthWrap.hidden = true; return; }
        strengthWrap.hidden = false;
        const score = scorePassword(v);
        const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Strong'];
        const classes = ['', 'weak', 'fair', 'good', 'strong'];
        strengthFill.className = 'strength-fill ' + classes[score];
        strengthText.textContent = labels[score];
    });

    /* ---- 10. Validation ---- */
    function setError(input, msg) {
        const fallback = input.closest('.form-group')
            ? input.closest('.form-group').querySelector('.form-error')
            : (input.name === 'terms' ? document.querySelector('.terms-error') : null);
        if (fallback) fallback.textContent = msg || '';
        if (input.classList) input.classList.toggle('error', Boolean(msg));
    }
    function clearErrors(form) {
        form.querySelectorAll('.form-error, .terms-error').forEach(function (e) { e.textContent = ''; });
        form.querySelectorAll('.error').forEach(function (e) { e.classList.remove('error'); });
    }
    function validateLogin(form) {
        let ok = true;
        const email = form.email;
        const pass = form.password;
        if (!email.value.trim()) { setError(email, 'Email is required'); ok = false; }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { setError(email, 'Enter a valid email'); ok = false; }
        if (!pass.value) { setError(pass, 'Password is required'); ok = false; }
        return ok;
    }
    function validateRegister(form) {
        let ok = true;
        const fields = {
            username: function (v) { return /^[a-zA-Z0-9_]{3,20}$/.test(v) ? '' : '3–20 chars: letters, numbers, _'; },
            fullName: function (v) { return v.trim().length >= 2 ? '' : 'Enter your name'; },
            age: function (v) { return (v >= 12 && v <= 18) ? '' : 'Must be 12–18'; },
            gradeLevel: function (v) { return v ? '' : 'Select your grade'; },
            email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email'; },
            password: function (v) { return v.length >= 8 ? '' : 'At least 8 characters'; },
            confirmPassword: function (v) { return v === form.password.value ? '' : 'Passwords do not match'; }
        };
        Object.keys(fields).forEach(function (name) {
            const input = form[name];
            const msg = fields[name](input.value);
            if (msg) { setError(input, msg); ok = false; }
        });
        if (!form.terms.checked) {
            const t = document.querySelector('.terms-error');
            if (t) t.textContent = 'Please accept the terms';
            ok = false;
        }
        return ok;
    }

    /* ---- 11. Submit handlers ---- */
    function setLoading(btn, loading) {
        btn.classList.toggle('loading', loading);
        btn.disabled = loading;
    }

    panelLogin.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearErrors(panelLogin);
        if (!validateLogin(panelLogin)) return;
        if (!supabase) { showToast('Supabase is not configured yet.', 'error'); return; }
        const btn = panelLogin.querySelector('.auth-submit');
        setLoading(btn, true);
        try {
            const res = await signIn(panelLogin.email.value.trim(), panelLogin.password.value, panelLogin.remember.checked);
            if (res.error) throw res.error;
            showToast('Logged in! Redirecting…', 'success');
            setTimeout(function () { window.location.replace('index.html'); }, 600);
        } catch (err) {
            showToast(err.message || 'Login failed', 'error');
        } finally {
            setLoading(btn, false);
        }
    });

    panelRegister.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearErrors(panelRegister);
        if (!validateRegister(panelRegister)) return;
        if (!supabase) { showToast('Supabase is not configured yet.', 'error'); return; }
        const btn = panelRegister.querySelector('.auth-submit');
        setLoading(btn, true);
        try {
            const res = await signUp(
                panelRegister.email.value.trim(),
                panelRegister.password.value,
                {
                    username: panelRegister.username.value.trim(),
                    fullName: panelRegister.fullName.value.trim(),
                    age: parseInt(panelRegister.age.value, 10),
                    gradeLevel: panelRegister.gradeLevel.value
                }
            );
            if (res.error) throw res.error;
            if (res.data && res.data.session) {
                showToast('Account created! Redirecting…', 'success');
                setTimeout(function () { window.location.replace('index.html'); }, 600);
            } else {
                showToast('Check your email to confirm your account.', 'success');
                switchTab('login');
            }
        } catch (err) {
            showToast(err.message || 'Registration failed', 'error');
        } finally {
            setLoading(btn, false);
        }
    });

    /* ---- 12. OAuth ---- */
    $$('.oauth-btn').forEach(function (btn) {
        btn.addEventListener('click', async function () {
            if (!supabase) { showToast('Supabase is not configured yet.', 'error'); return; }
            const res = await signInWithOAuth(btn.dataset.provider);
            if (res.error) showToast(res.error.message, 'error');
        });
    });

    /* ---- 13. Forgot password ---- */
    const forgotPanel = $('#forgot-panel');
    function showForgot() { forgotPanel.hidden = false; }
    function hideForgot() { forgotPanel.hidden = true; }
    $('[data-forgot]').addEventListener('click', function (e) { e.preventDefault(); showForgot(); });
    $('[data-back-to-login]').addEventListener('click', hideForgot);
    $('[data-send-reset]').addEventListener('click', async function () {
        if (!supabase) { showToast('Supabase is not configured yet.', 'error'); return; }
        const email = $('#forgot-email').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Enter a valid email', 'error');
            return;
        }
        const res = await resetPassword(email);
        if (res.error) showToast(res.error.message, 'error');
        else { showToast('Reset link sent!', 'success'); hideForgot(); }
    });

    /* Expose for optional external use */
    window.__authPage = { switchTab: switchTab, showToast: showToast };
})();
