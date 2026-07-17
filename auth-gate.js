/* ============================================================
 * AI Learning Hub — auth gate for the main page (index.html)
 * Plain script (no modules) so it runs on a static Vercel deploy.
 *
 * Behaviour:
 *  - index.html?preview=1  -> shows the site without auth (dev escape hatch)
 *  - Supabase NOT configured -> sends visitors to /login.html
 *                               (so the login UI shows on deploy, with its
 *                                "set your keys" notice)
 *  - Supabase configured + logged in  -> reveals the main page
 *  - Supabase configured + logged out -> redirects to /login.html
 *
 * The two lines below must match auth-page.js (keep them in sync).
 * ============================================================ */
(function () {
    'use strict';

    /* Keep these in sync with auth-page.js (same URLs/keys in both files) */
    const SUPABASE_URL = 'https://fiscieqerjnojopnzuqe.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpc2NpZXFlcmpub2pvcG56dXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODIzNjUsImV4cCI6MjA5OTc1ODM2NX0.SRcnGlu2p3eiweLFlAtYE82-gbinSjZ6gzINDWYCD-4';

    var isConfigured = SUPABASE_URL.indexOf('YOUR_PROJECT_ID') === -1
        && SUPABASE_ANON_KEY.indexOf('YOUR_ANON_KEY') === -1;

    function reveal() { document.documentElement.style.visibility = 'visible'; }
    function goLogin() { window.location.replace('login.html'); }

    /* Safety: never leave the page hidden if something goes wrong */
    setTimeout(reveal, 5000);

    /* Dev preview escape hatch */
    if (/[?&]preview=1\b/.test(window.location.search)) { reveal(); return; }

    /* Not configured yet -> show the login page (with setup notice) on deploy */
    if (!isConfigured) { goLogin(); return; }

    function loadSupabase(cb) {
        if (typeof window.supabase !== 'undefined') { cb(); return; }
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.async = true;
        s.onload = cb;
        s.onerror = reveal; /* offline: don't trap the visitor */
        document.head.appendChild(s);
    }

    loadSupabase(function () {
        if (typeof window.supabase === 'undefined') { reveal(); return; }
        var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
        });
        client.auth.getSession().then(function (res) {
            if (res.data && res.data.session) reveal();
            else goLogin();
        }).catch(reveal);
    });
})();
