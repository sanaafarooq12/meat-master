/* ═══════════════════════════════════════════
   MEATMASTER — dashboard.js
   Handles: Customer dash, Butcher dash,
            rates, availability, booking actions
   ═══════════════════════════════════════════ */

// ── CUSTOMER DASHBOARD ──
async function renderCustomerDash() {
  const wrap = document.getElementById('dashContent');
  wrap.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--ink-muted)">
    <span class="spin" style="border-top-color:var(--teal-500);border-color:var(--teal-100)"></span>
  </div>`;

  const { data: bookings } = await sb
    .from('bookings')
    .select('*, butcher:butcher_id(id, profiles:id(full_name, city))')
    .eq('customer_id', currentUser.id)
    .order('created_at', { ascending: false });

  const total     = bookings?.length || 0;
  const pending   = bookings?.filter(b => b.status === 'pending').length  || 0;
  const completed = bookings?.filter(b => b.status === 'completed').length || 0;

  wrap.innerHTML = `
    <div class="dash-topbar">
      <div>
        <div class="dash-greeting">
          ${t('Hello','ہیلو')}, ${currentProfile.full_name?.split(' ')[0] || ''}
          <span class="dash-role-tag">${t('Customer','گاہک')}</span>
        </div>
        <div class="dash-sub">${t('Manage your bookings','اپنی بکنگز دیکھیں')}</div>
      </div>
      <button class="btn btn-teal-outline" onclick="showPage('home');loadButchers()">← ${t('Browse Butchers','قصائی دیکھیں')}</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">${t('Total Bookings','کل بکنگز')}</div><div class="kpi-val">${total}</div></div>
      <div class="kpi amber"><div class="kpi-label">${t('Pending','زیر التواء')}</div><div class="kpi-val">${pending}</div></div>
      <div class="kpi green"><div class="kpi-label">${t('Completed','مکمل')}</div><div class="kpi-val">${completed}</div></div>
    </div>

    <div class="panel">
      <div class="panel-title">${t('My Bookings','میری بکنگز')}</div>
      ${buildCustomerBookingRows(bookings)}
    </div>`;
}

function buildCustomerBookingRows(bookings) {
  if (!bookings || bookings.length === 0) {
    return `<div class="empty"><div class="empty-ico">📋</div>
      <p>${t('No bookings yet. Browse butchers to get started!','ابھی تک کوئی بکنگ نہیں۔')}</p></div>`;
  }
  return bookings.map(b => {
    const bname = b.butcher?.profiles?.full_name || t('Unknown Butcher','نامعلوم قصائی');
    const bcity = b.butcher?.profiles?.city || '';
    const safeN = bname.replace(/'/g, "\\'");
    return `<div class="brow" id="brow_${b.id}">
      <div class="brow-icon">${ANIMAL_ICONS[b.animal_type] || '🐄'}</div>
      <div class="brow-info">
        <div class="brow-title">${currentLang==='en'?ANIMAL_EN[b.animal_type]:ANIMAL_UR[b.animal_type]} × ${b.quantity} — ${bname}</div>
        <div class="brow-meta">${b.booking_date} ${b.booking_time || ''} ${bcity ? '• ' + bcity : ''}</div>
      </div>
      <div class="brow-actions">
        <span class="sbadge s-${b.status}">${b.status.toUpperCase()}</span>
        <button class="btn btn-sm" style="background:var(--teal-50);color:var(--teal-700)"
          onclick="toggleVoicePanel('${b.id}','${safeN}',this)">🎙 ${t('Voice','آواز')}</button>
      </div>
    </div>`;
  }).join('');
}

// ── BUTCHER DASHBOARD ──
async function renderButcherDash() {
  const wrap = document.getElementById('dashContent');
  wrap.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--ink-muted)">
    <span class="spin" style="border-top-color:var(--teal-500);border-color:var(--teal-100)"></span>
  </div>`;

  const [bpRes, bookRes, rateRes] = await Promise.all([
    sb.from('butcher_profiles').select('*').eq('id', currentUser.id).single(),
    sb.from('bookings').select('*, customer:customer_id(full_name, phone, city)')
      .eq('butcher_id', currentUser.id).order('created_at', { ascending: false }),
    sb.from('butcher_rates').select('*').eq('butcher_id', currentUser.id)
  ]);

  const bp      = bpRes.data;
  const bookings = bookRes.data || [];
  const rates    = rateRes.data || [];
  const rateMap  = {};
  rates.forEach(r => rateMap[r.animal_type] = r.price);

  const total    = bookings.length;
  const pending  = bookings.filter(b => b.status === 'pending').length;
  const accepted = bookings.filter(b => b.status === 'accepted').length;
  const avail    = bp?.is_available ?? true;

  wrap.innerHTML = `
    <div class="dash-topbar">
      <div>
        <div class="dash-greeting">
          ${currentProfile.full_name?.split(' ')[0] || t('Butcher','قصائی')}
          <span class="dash-role-tag">${bp?.is_verified ? '✓ ' + t('Verified','تصدیق شدہ') : t('Butcher','قصائی')}</span>
        </div>
        <div class="dash-sub">${t('Manage bookings & rates','بکنگز اور قیمتیں منظم کریں')}</div>
      </div>
      <button class="btn btn-teal-outline" onclick="showPage('home');loadButchers()">← ${t('View Site','ویب سائٹ دیکھیں')}</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">${t('Total Bookings','کل بکنگز')}</div><div class="kpi-val">${total}</div></div>
      <div class="kpi amber"><div class="kpi-label">${t('Pending','زیر التواء')}</div><div class="kpi-val">${pending}</div></div>
      <div class="kpi green"><div class="kpi-label">${t('Active','فعال')}</div><div class="kpi-val">${accepted}</div></div>
      <div class="kpi soft"><div class="kpi-label">${t('Rating','درجہ بندی')}</div><div class="kpi-val">${bp?.rating || '—'}</div>
        <div class="kpi-note">⭐ ${bp?.total_reviews || 0} ${t('reviews','جائزے')}</div>
      </div>
    </div>

    <!-- Availability -->
    <div class="panel">
      <div class="panel-title">${t('Availability','دستیابی')}</div>
      <div class="avail-row" id="availRow" onclick="toggleAvail(${!avail})">
        <div class="tgl-track ${avail ? 'on' : ''}" id="tglTrack"><div class="tgl-knob"></div></div>
        <span class="avail-label" id="tglLabel">
          ${avail ? t('Available for bookings','بکنگ کے لیے دستیاب') : t('Not available','دستیاب نہیں')}
        </span>
      </div>
    </div>

    <!-- Rates -->
    <div class="panel">
      <div class="panel-title">
        ${t('My Rates (PKR)','میری قیمتیں (روپے)')}
        <button class="btn btn-sm btn-teal" onclick="saveRates()">${t('Save Rates','محفوظ کریں')}</button>
      </div>
      <div class="rates-grid">
        ${['goat','cow','camel','sheep'].map(a => `
          <div class="rate-tile">
            <div class="rate-emoji">${ANIMAL_ICONS[a]}</div>
            <div class="rate-name">${currentLang==='en'?ANIMAL_EN[a]:ANIMAL_UR[a]}</div>
            <input class="rate-input" type="number" id="rate_${a}" placeholder="0" value="${rateMap[a] || ''}"/>
          </div>`).join('')}
      </div>
    </div>

    <!-- Incoming Bookings -->
    <div class="panel">
      <div class="panel-title">${t('Incoming Bookings','آنے والی بکنگز')}</div>
      ${buildButcherBookingRows(bookings)}
    </div>`;
}

function buildButcherBookingRows(bookings) {
    if (!bookings || bookings.length === 0) {
        return `<div class="empty"><div class="empty-ico">📁</div><p>${t('No bookings yet.', 'ابھی تک کوئی بکنگ نہیں۔')}</p></div>`;
    }

    return bookings.map(b => {
        const cname = b.customer?.profiles?.full_name || t('Unknown', 'نامعلوم');
        const actions = b.status === 'pending'
            ? `<button class="btn btn-sm btn-teal" onclick="updateStatus('${b.id}','accepted')">${t('Accept', 'قبول')}</button>
               <button class="btn btn-sm btn-danger" onclick="updateStatus('${b.id}','declined')">${t('Decline', 'رد')}</button>`
            : '';

        // Screenshot button tabhi dikhe jab user ne image upload ki ho
        const screenshotButton = b.advance_payment_screenshot 
            ? `<a href="${b.advance_payment_screenshot}" target="_blank" class="btn btn-sm btn-teal-outline" style="margin-top: 5px; display: inline-block; padding: 2px 8px; font-size: 0.75rem;">
                👁️ ${t('View Receipt', 'رسید دیکھیں')}
               </a>` 
            : `<span style="color:red; font-size:0.75rem;">${t('No Receipt', 'رسید موجود نہیں')}</span>`;

        // Time slot text tayyar karna (Eid Day 1, Day 2 etc)
        const displaySlot = b.time_slot ? ` | Slot: ${b.time_slot.toUpperCase()}` : '';

        return `<div class="brow" id="brow_${b.id}">
            <div class="brow-icon">${ANIMAL_ICONS[b.animal_type] || '🥩'}</div>
            <div class="brow-info">
                <div class="brow-title">${currentLang==='en' ? ANIMAL_EN[b.animal_type] : ANIMAL_UR[b.animal_type]} ✖ ${b.quantity} — ${cname}</div>
                <div class="brow-meta">
                    ${b.booking_date} ${b.booking_time || ''}${displaySlot}
                </div>
                <!-- Yahan screenshot dekhne ka button show hoga -->
                <div class="brow-receipt-area">
                    ${screenshotButton}
                </div>
            </div>
            <div class="brow-actions">
                <span class="sbadge s-${b.status}">${b.status.toUpperCase()}</span>
                ${actions}
                <button class="btn btn-sm" style="background:var(--teal-50);color:var(--teal-700)" onclick="toggleVoicePanel('${b.id}','${cname}',this)">🎙️ ${t('Voice','آواز')}</button>
            </div>
        </div>`;
    }).join('');
}
      

// ── AVAILABILITY TOGGLE ──
async function toggleAvail(val) {
  await sb.from('butcher_profiles').update({ is_available: val }).eq('id', currentUser.id);
  const track = document.getElementById('tglTrack');
  const label = document.getElementById('tglLabel');
  if (track) track.className = 'tgl-track' + (val ? ' on' : '');
  if (label) label.textContent = val
    ? t('Available for bookings', 'بکنگ کے لیے دستیاب')
    : t('Not available', 'دستیاب نہیں');
  document.getElementById('availRow').onclick = () => toggleAvail(!val);
  showToast(t('Availability updated!', 'دستیابی اپ ڈیٹ ہوئی!'));
}

// ── SAVE RATES ──
async function saveRates() {
  const animals = ['goat', 'cow', 'camel', 'sheep'];
  const { data: existing } = await sb.from('butcher_rates').select('*').eq('butcher_id', currentUser.id);
  for (const a of animals) {
    const val = parseFloat(document.getElementById('rate_' + a)?.value);
    if (isNaN(val) || val <= 0) continue;
    const ex = existing?.find(r => r.animal_type === a);
    if (ex) {
      await sb.from('butcher_rates').update({ price: val }).eq('id', ex.id);
    } else {
      await sb.from('butcher_rates').insert({ butcher_id: currentUser.id, animal_type: a, price: val });
    }
  }
  showToast(t('Rates saved! ✓', 'قیمتیں محفوظ ہو گئیں! ✓'));
}

// ── UPDATE BOOKING STATUS ──
async function updateStatus(id, status) {
  const { error } = await sb.from('bookings').update({ status }).eq('id', id);
  if (error) { showToast(error.message); return; }
  showToast(status === 'accepted'
    ? t('Booking accepted! ✓', 'بکنگ قبول کر لی! ✓')
    : t('Booking declined.', 'بکنگ رد کر دی۔'));
  renderButcherDash();
}
