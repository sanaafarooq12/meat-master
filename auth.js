/* ═══════════════════════════════════════════
   MEATMASTER — auth.js
   Handles: Supabase init, login, register,
            sign-out, session restore, lang
   ═══════════════════════════════════════════ */

// ── SUPABASE ──
const SUPA_URL  = 'https://xrwqnemxbftoyltmruqb.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhyd3FuZW14YmZ0b3lsdG1ydXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTU4MTUsImV4cCI6MjA5NjU5MTgxNX0.OqkZ-7opeHiwrrXG0685NoX0-C7IsSpw8kfrTvmuZsw';
const sb = supabase.createClient(SUPA_URL, SUPA_ANON);

// ── GLOBAL STATE ──
let currentUser    = null;
let currentProfile = null;
let currentLang    = 'en';
let selectedRole   = 'customer';

// ── LANGUAGE ──
function toggleLang() {
  currentLang = currentLang === 'en' ? 'ur' : 'en';
  document.body.setAttribute('lang', currentLang);
  document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
  document.getElementById('langBtn').textContent = currentLang === 'en' ? 'اردو' : 'English';
  applyLang();
}

function applyLang() {
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = el.getAttribute('data-' + currentLang);
    if (val) el.innerHTML = val;
  });
  const urLine = document.getElementById('heroUrduLine');
  if (urLine) urLine.style.display = 'block';
}

function t(en, ur) { return currentLang === 'en' ? en : ur; }

// ── MODAL HELPERS ──
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + type;
}
function clearMsg(id) {
  const el = document.getElementById(id);
  if (el) { el.className = 'msg'; el.textContent = ''; }
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

// ── AUTH TAB SWITCH ──
function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  const h = document.getElementById('authModalTitle');
  const s = document.getElementById('authModalSub');
  if (tab === 'login') {
    h.textContent = t('Welcome back', 'خوش آمدید');
    s.textContent = t('Sign in to your MeatMaster account', 'اپنے میٹ ماسٹر اکاؤنٹ میں لاگ ان کریں');
  } else {
    h.textContent = t('Create account', 'اکاؤنٹ بنائیں');
    s.textContent = t('Join MeatMaster — it\'s free', 'آج ہی میٹ ماسٹر سے جڑیں');
  }
}

function openAuthModal(tab = 'login') {
  clearMsg('authMsg');
  switchAuthTab(tab);
  openModal('authModal');
}

// ── ROLE SELECT ──
function selectRole(r) {
  selectedRole = r;
  document.getElementById('roleCustomer').classList.toggle('sel', r === 'customer');
  document.getElementById('roleButcher').classList.toggle('sel',  r === 'butcher');
  document.getElementById('butcherFields').style.display = r === 'butcher' ? 'block' : 'none';
}

// ── LOGIN ──
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { showMsg('authMsg', t('Please fill all fields.', 'تمام خانے بھریں۔'), 'error'); return; }
  const btn = document.getElementById('loginBtn');
  btn.innerHTML = '<span class="spin"></span>' + t('Signing in…', 'لاگ ان ہو رہا ہے…');
  btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.innerHTML = t('Sign in', 'لاگ ان کریں');
  btn.disabled = false;
  if (error) { showMsg('authMsg', error.message, 'error'); return; }
  closeModal('authModal');
  await loadUserProfile(data.user);
  showToast(t('Welcome back! 👋', 'خوش آمدید! 👋'));
}

// ── REGISTER ──
async function doRegister() {
  const name  = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const city  = document.getElementById('regCity').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPass').value;
  if (!name || !email || !pass || !city) {
    showMsg('authMsg', t('Please fill all required fields.', 'تمام ضروری خانے بھریں۔'), 'error'); return;
  }
  if (pass.length < 6) {
    showMsg('authMsg', t('Password must be at least 6 characters.', 'پاس ورڈ کم از کم ۶ حروف ہونا چاہیے۔'), 'error'); return;
  }
  const btn = document.getElementById('regBtn');
  btn.innerHTML = '<span class="spin"></span>' + t('Creating account…', 'اکاؤنٹ بن رہا ہے…');
  btn.disabled = true;

  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error) {
    showMsg('authMsg', error.message, 'error');
    btn.innerHTML = t('Create account', 'اکاؤنٹ بنائیں'); btn.disabled = false; return;
  }

  const uid = data.user.id;
  const { error: pe } = await sb.from('profiles').insert({ id: uid, role: selectedRole, full_name: name, phone, city });
  if (pe) {
    showMsg('authMsg', pe.message, 'error');
    btn.innerHTML = t('Create account', 'اکاؤنٹ بنائیں'); btn.disabled = false; return;
  }

  if (selectedRole === 'butcher') {
    const cnic = document.getElementById('regCnic').value.trim();
    const exp  = parseInt(document.getElementById('regExp').value) || 0;
    await sb.from('butcher_profiles').insert({ id: uid, cnic, experience_years: exp });
  }

  btn.innerHTML = t('Create account', 'اکاؤنٹ بنائیں'); btn.disabled = false;
  closeModal('authModal');
  await loadUserProfile(data.user);
  showToast(t('Account created! 🎉', 'اکاؤنٹ بن گیا! 🎉'));
}

// ── SIGN OUT ──
async function signOut() {
  await sb.auth.signOut();
  currentUser = null; currentProfile = null;
  document.getElementById('navUser').style.display = 'none';
  document.getElementById('navAuth').style.display = 'flex';
  showPage('home');
  showToast(t('Signed out.', 'خارج ہو گئے۔'));
}

// ── LOAD PROFILE ──
async function loadUserProfile(user) {
  currentUser = user;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (data) {
    currentProfile = data;
    document.getElementById('navUser').style.display = 'flex';
    document.getElementById('navAuth').style.display = 'none';
    document.getElementById('navUsername').textContent = data.full_name || user.email.split('@')[0];
  }
}

// ── SESSION RESTORE ──
async function restoreSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await loadUserProfile(session.user);
}

sb.auth.onAuthStateChange((_, session) => {
  if (!session && currentUser) { currentUser = null; currentProfile = null; }
});

// ── PAGE SWITCH ──
function showPage(p) {
  document.getElementById('homePage').style.display = p === 'home' ? 'block' : 'none';
  document.getElementById('dashPage').style.display = p === 'dash' ? 'block' : 'none';
}

function goToDashboard() {
  showPage('dash');
  if (currentProfile?.role === 'butcher') renderButcherDash();
  else renderCustomerDash();
}
