/* ═══════════════════════════════════════════
   MEATMASTER — dashboard.js  v2.1  (FIXED)
   ═══════════════════════════════════════════ */

// ── CUSTOMER DASHBOARD ──
async function renderCustomerDash() {
  const wrap = document.getElementById('dashContent');
  wrap.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--ink-muted)">
    <div style="font-size:2rem;margin-bottom:1rem">⏳</div>
    <p>${t('Loading your dashboard…', 'ڈیش بورڈ لوڈ ہو رہا ہے…')}</p>
  </div>`;

  // DB column is customer_id (not user_id)
  const { data: bookings, error } = await sb
    .from('bookings')
    .select(`
      *,
      butcher:butcher_id (
        id,
        profiles:id ( full_name, city )
      )
    `)
    .eq('customer_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { wrap.innerHTML = `<p style="color:red;padding:2rem">${error.message}</p>`; return; }

  const total     = bookings?.length || 0;
  const pending   = bookings?.filter(b => b.status === 'pending').length  || 0;
  const completed = bookings?.filter(b => b.status === 'completed').length || 0;
  const accepted  = bookings?.filter(b => b.status === 'accepted').length  || 0;

  wrap.innerHTML = `
    <div class="dash-topbar">
      <div>
        <div class="dash-greeting">
          ${t('Hello', 'ہیلو')}, ${currentProfile.full_name?.split(' ')[0] || ''}
          <span class="dash-role-tag">${t('Customer', 'گاہک')}</span>
        </div>
        <div class="dash-sub">${t('View and manage your bookings', 'اپنی بکنگز دیکھیں اور منظم کریں')}</div>
      </div>
      <button class="btn btn-teal-outline"
        onclick="showPage('home');loadButchers()">
        ← ${t('Browse Butchers', 'قصائی دیکھیں')}
      </button>
    </div>

    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">${t('Total Bookings', 'کل بکنگز')}</div>
        <div class="kpi-val">${total}</div>
      </div>
      <div class="kpi amber">
        <div class="kpi-label">${t('Pending', 'زیر التواء')}</div>
        <div class="kpi-val">${pending}</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">${t('Accepted', 'قبول شدہ')}</div>
        <div class="kpi-val">${accepted}</div>
      </div>
      <div class="kpi soft">
        <div class="kpi-label">${t('Completed', 'مکمل')}</div>
        <div class="kpi-val">${completed}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">${t('My Bookings', 'میری بکنگز')}</div>
      ${buildCustomerRows(bookings)}
    </div>`;
}

function buildCustomerRows(bookings) {
  if (!bookings || bookings.length === 0) {
    return `<div class="empty">
      <div class="empty-ico">📋</div>
      <p>${t('No bookings yet. Browse butchers to get started!', 'ابھی تک کوئی بکنگ نہیں۔')}</p>
    </div>`;
  }
  return bookings.map(b => {
    const bname = b.butcher?.profiles?.full_name || t('Unknown Butcher', 'نامعلوم قصائی');
    const bcity = b.butcher?.profiles?.city || '';
    const safeN = bname.replace(/'/g, "\\'");
    const timeText = b.booking_time
      ? (typeof b.booking_time === 'string' ? b.booking_time.substring(0, 5) : b.booking_time)
      : '';
    const slotText = b.time_slot ? ` | ${b.time_slot.replace('_', ' ').toUpperCase()}` : '';

    return `<div class="brow" id="brow_${b.id}">
      <div class="brow-icon">${ANIMAL_ICONS[b.animal_type] || '🐄'}</div>
      <div class="brow-info">
        <div class="brow-title">
          ${currentLang === 'en' ? ANIMAL_EN[b.animal_type] : ANIMAL_UR[b.animal_type]}
          × ${b.quantity} — ${bname}
        </div>
        <div class="brow-meta">
          📅 ${b.booking_date} ${timeText ? '⏰ ' + timeText : ''}
          ${bcity ? '📍 ' + bcity : ''} ${slotText}
        </div>
        ${b.advance_payment_screenshot
          ? `<a href="${b.advance_payment_screenshot}" target="_blank"
              class="btn btn-sm btn-teal-outline" style="margin-top:4px;font-size:.72rem">
              👁 ${t('View Receipt', 'رسید دیکھیں')}</a>`
          : ''}
      </div>
      <div class="brow-actions">
        <span class="sbadge s-${b.status}">${b.status.toUpperCase()}</span>
        <button class="btn btn-sm" style="background:var(--teal-50);color:var(--teal-700)"
          onclick="toggleVoicePanel('${b.id}','${safeN}',this)">
          🎙 ${t('Voice', 'آواز')}
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── BUTCHER DASHBOARD ──
async function renderButcherDash() {
  const wrap = document.getElementById('dashContent');
  wrap.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--ink-muted)">
    <div style="font-size:2rem;margin-bottom:1rem">⏳</div>
    <p>${t('Loading your dashboard…', 'ڈیش بورڈ لوڈ ہو رہا ہے…')}</p>
  </div>`;

  const [bpRes, bookRes, rateRes] = await Promise.all([
    sb.from('butcher_profiles').select('*').eq('id', currentUser.id).single(),
    sb.from('bookings')
      .select(`*, customer:customer_id ( full_name, phone, city )`)
      .eq('butcher_id', currentUser.id)
      .order('created_at', { ascending: false }),
    sb.from('butcher_rates').select('*').eq('butcher_id', currentUser.id)
  ]);

  const bp       = bpRes.data || {};
  const bookings = bookRes.data || [];
  const rates    = rateRes.data || [];
  const rateMap  = {};
  rates.forEach(r => { rateMap[r.animal_type] = r.price; });

  const total    = bookings.length;
  const pending  = bookings.filter(b => b.status === 'pending').length;
  const accepted = bookings.filter(b => b.status === 'accepted').length;
  const avail    = bp.is_available ?? true;

  wrap.innerHTML = `
    <div class="dash-topbar">
      <div>
        <div class="dash-greeting">
          ${currentProfile.full_name?.split(' ')[0] || t('Butcher', 'قصائی')}
          <span class="dash-role-tag">
            ${bp.is_verified
              ? '✓ ' + t('Verified', 'تصدیق شدہ')
              : '⏳ ' + t('Butcher', 'قصائی')}
          </span>
        </div>
        <div class="dash-sub">${t('Manage your bookings and rates', 'بکنگز اور قیمتیں منظم کریں')}</div>
      </div>
      <button class="btn btn-teal-outline"
        onclick="showPage('home');loadButchers()">
        ← ${t('View Site', 'ویب سائٹ دیکھیں')}
      </button>
    </div>

    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">${t('Total Bookings', 'کل بکنگز')}</div>
        <div class="kpi-val">${total}</div>
      </div>
      <div class="kpi amber">
        <div class="kpi-label">${t('Pending', 'زیر التواء')}</div>
        <div class="kpi-val">${pending}</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">${t('Active', 'فعال')}</div>
        <div class="kpi-val">${accepted}</div>
      </div>
      <div class="kpi soft">
        <div class="kpi-label">${t('Rating', 'درجہ بندی')}</div>
        <div class="kpi-val">${bp.rating || '—'}</div>
        <div class="kpi-note">⭐ ${bp.total_reviews || 0} ${t('reviews', 'جائزے')}</div>
      </div>
    </div>

    <!-- AVAILABILITY -->
    <div class="panel">
      <div class="panel-title">${t('My Availability', 'میری دستیابی')}</div>
      <div class="avail-row" id="availRow" onclick="toggleAvail(${!avail})">
        <div class="tgl-track ${avail ? 'on' : ''}" id="tglTrack">
          <div class="tgl-knob"></div>
        </div>
        <span class="avail-label" id="tglLabel">
          ${avail
            ? t('✅ Available for new bookings', '✅ نئی بکنگز کے لیے دستیاب')
            : t('❌ Not available right now', '❌ ابھی دستیاب نہیں')}
        </span>
      </div>
    </div>

    <!-- RATES -->
    <div class="panel">
      <div class="panel-title">
        ${t('My Rates (PKR per animal)', 'میری قیمتیں (فی جانور روپے)')}
        <button class="btn btn-sm btn-teal" onclick="saveRates()">
          💾 ${t('Save Rates', 'محفوظ کریں')}
        </button>
      </div>
      <div class="rates-grid">
        ${['goat', 'cow', 'camel', 'sheep'].map(a => `
          <div class="rate-tile">
            <div class="rate-emoji">${ANIMAL_ICONS[a]}</div>
            <div class="rate-name">
              ${currentLang === 'en' ? ANIMAL_EN[a] : ANIMAL_UR[a]}
            </div>
            <input class="rate-input" type="number" id="rate_${a}"
              placeholder="PKR 0" value="${rateMap[a] || ''}"/>
          </div>`).join('')}
      </div>
    </div>

    <!-- INCOMING BOOKINGS -->
    <div class="panel">
      <div class="panel-title">
        ${t('Incoming Bookings', 'آنے والی بکنگز')}
        ${pending > 0
          ? `<span class="sbadge s-pending">${pending} ${t('pending', 'زیر التواء')}</span>`
          : ''}
      </div>
      ${buildButcherRows(bookings)}
    </div>`;
}

function buildButcherRows(bookings) {
  if (!bookings || bookings.length === 0) {
    return `<div class="empty">
      <div class="empty-ico">📋</div>
      <p>${t('No bookings received yet.', 'ابھی تک کوئی بکنگ موصول نہیں ہوئی۔')}</p>
    </div>`;
  }
  return bookings.map(b => {
    const cname   = b.customer?.full_name || t('Unknown Customer', 'نامعلوم گاہک');
    const ccity   = b.customer?.city || '';
    const safeN   = cname.replace(/'/g, "\\'");
    const timeText = b.booking_time
      ? (typeof b.booking_time === 'string' ? b.booking_time.substring(0, 5) : b.booking_time)
      : '';
    const slotText = b.time_slot ? ` | ${b.time_slot.replace('_', ' ').toUpperCase()}` : '';

    const actions = b.status === 'pending'
      ? `<button class="btn btn-sm" style="background:#dcfce7;color:#15803d"
            onclick="updateStatus('${b.id}','accepted')">
            ✓ ${t('Accept', 'قبول')}
         </button>
         <button class="btn btn-sm btn-danger"
            onclick="updateStatus('${b.id}','declined')">
            ✗ ${t('Decline', 'رد')}
         </button>`
      : '';

    const receiptBtn = b.advance_payment_screenshot
      ? `<a href="${b.advance_payment_screenshot}" target="_blank"
            class="btn btn-sm btn-teal-outline" style="font-size:.72rem">
            👁 ${t('Receipt', 'رسید')}</a>`
      : `<span style="color:var(--ink-muted);font-size:.72rem">
            ${t('No receipt', 'رسید نہیں')}</span>`;

    return `<div class="brow" id="brow_${b.id}">
      <div class="brow-icon">${ANIMAL_ICONS[b.animal_type] || '🐄'}</div>
      <div class="brow-info">
        <div class="brow-title">
          ${currentLang === 'en' ? ANIMAL_EN[b.animal_type] : ANIMAL_UR[b.animal_type]}
          × ${b.quantity} — ${cname}
        </div>
        <div class="brow-meta">
          📅 ${b.booking_date} ${timeText ? '⏰ ' + timeText : ''}
          ${ccity ? '📍 ' + ccity : ''} ${slotText}
        </div>
        <div style="margin-top:4px">${receiptBtn}</div>
      </div>
      <div class="brow-actions">
        <span class="sbadge s-${b.status}">${b.status.toUpperCase()}</span>
        ${actions}
        <button class="btn btn-sm" style="background:var(--teal-50);color:var(--teal-700)"
          onclick="toggleVoicePanel('${b.id}','${safeN}',this)">
          🎙 ${t('Voice', 'آواز')}
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── AVAILABILITY ──
async function toggleAvail(val) {
  await sb.from('butcher_profiles').update({ is_available: val }).eq('id', currentUser.id);
  const track = document.getElementById('tglTrack');
  const label = document.getElementById('tglLabel');
  if (track) track.className = 'tgl-track' + (val ? ' on' : '');
  if (label) label.textContent = val
    ? t('✅ Available for new bookings', '✅ نئی بکنگز کے لیے دستیاب')
    : t('❌ Not available right now', '❌ ابھی دستیاب نہیں');
  document.getElementById('availRow').onclick = () => toggleAvail(!val);
  showToast(t('Availability updated!', 'دستیابی اپ ڈیٹ ہوئی!'));
}

// ── SAVE RATES ──
async function saveRates() {
  const animals = ['goat', 'cow', 'camel', 'sheep'];
  const { data: existing } = await sb
    .from('butcher_rates')
    .select('*')
    .eq('butcher_id', currentUser.id);

  let saved = 0;
  for (const a of animals) {
    const val = parseFloat(document.getElementById('rate_' + a)?.value);
    if (isNaN(val) || val <= 0) continue;
    const ex = existing?.find(r => r.animal_type === a);
    if (ex) {
      await sb.from('butcher_rates').update({ price: val }).eq('id', ex.id);
    } else {
      await sb.from('butcher_rates').insert({
        butcher_id: currentUser.id,
        animal_type: a,
        price: val
      });
    }
    saved++;
  }
  showToast(saved > 0
    ? t(`${saved} rate(s) saved! ✓`, `${saved} قیمتیں محفوظ! ✓`)
    : t('No changes to save.', 'کوئی تبدیلی نہیں۔'));
}

// ── UPDATE BOOKING STATUS ──
async function updateStatus(id, status) {
  const { error } = await sb.from('bookings').update({ status }).eq('id', id);
  if (error) { showToast('Error: ' + error.message); return; }
  showToast(status === 'accepted'
    ? t('Booking accepted! ✅', 'بکنگ قبول کر لی! ✅')
    : t('Booking declined.', 'بکنگ رد کر دی۔'));
  renderButcherDash();
}
