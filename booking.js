/* ═══════════════════════════════════════════
   QASAIHUB — booking.js  v3.0
   Voice messages removed
   ═══════════════════════════════════════════ */

const ANIMAL_ICONS = { goat: '🐐', cow: '🐄', camel: '🐪', sheep: '🐑' };
const ANIMAL_EN    = { goat: 'Goat', cow: 'Cow', camel: 'Camel', sheep: 'Sheep' };
const ANIMAL_UR    = { goat: 'بکرا', cow: 'گائے', camel: 'اونٹ', sheep: 'دنبہ' };
const TIME_SLOTS   = [
  '06:00 AM','07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM',
  '12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM'
];

let currentBookingButcher = null;
let selectedTimeSlot      = null;

// ── CONVERT 12hr to 24hr for DB (time column) ──
function to24hr(t12) {
  if (!t12) return null;
  const [time, period] = t12.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
}

// ── LOAD BUTCHERS ──
async function loadButchers() {
  const grid = document.getElementById('butchersGrid');
  if (!grid) return;

  // If a butcher is logged in, show their banner instead
  if (currentProfile?.role === 'butcher') {
    showButcherHomeBanner();
    return;
  }

  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--ink-muted)">
    <div style="font-size:2.5rem;margin-bottom:.75rem">🔪</div>
    <p>${t('Loading butchers…', 'قصائی لوڈ ہو رہے ہیں…')}</p>
  </div>`;

  // Fetch verified available butcher profiles + rates
  const { data: butchers, error } = await sb
    .from('butcher_profiles')
    .select(`*, rates:butcher_rates ( animal_type, price )`)
    .eq('is_available', true)
    .eq('is_verified', true)
    .order('rating', { ascending: false })
    .limit(12);

  if (error || !butchers || butchers.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--ink-muted)">
      <div style="font-size:2.5rem;margin-bottom:.75rem">🔪</div>
      <p>${t('No verified butchers available right now. Check back soon!', 'ابھی تک کوئی تصدیق شدہ قصائی دستیاب نہیں۔ جلد واپس آئیں!')}</p>
    </div>`;
    if (error) console.error('loadButchers error:', error.message);
    return;
  }

  // Fetch profiles for all butcher IDs from profiles table
  const ids = butchers.map(b => b.id);
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, city, avatar_url')
    .in('id', ids);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });

  grid.innerHTML = butchers.map(b => {
    const profile  = profileMap[b.id] || {};
    const name     = profile.full_name || 'Qasai';
    const city     = profile.city || 'Pakistan';
    const initial  = name.charAt(0).toUpperCase();
    const rating   = Number(b.rating || 0);
    const filled   = Math.round(rating);
    const stars    = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    const tags     = (b.rates || []).map(r =>
      `<span class="bc-tag">${ANIMAL_ICONS[r.animal_type] || '🐄'} ${currentLang === 'en' ? ANIMAL_EN[r.animal_type] : ANIMAL_UR[r.animal_type]}</span>`
    ).join('');
    const minRate  = b.rates?.length ? Math.min(...b.rates.map(r => Number(r.price))) : null;
    const ratesStr = JSON.stringify(b.rates || []).replace(/"/g, '&quot;');

    return `<div class="butcher-card">
      <div class="bc-head">
        <div class="bc-avatar">
          ${profile.avatar_url
            ? `<img src="${profile.avatar_url}" alt="${name}" />`
            : initial}
        </div>
        <div>
          <div class="bc-name">${name}</div>
          <div class="bc-city">📍 ${city}</div>
          <span class="bc-verified">✓ ${t('Verified', 'تصدیق شدہ')}</span>
        </div>
      </div>
      <div class="bc-body">
        <div class="bc-rating">
          <span class="bc-stars">${stars}</span>
          <span class="bc-rnum">${rating.toFixed(1)}</span>
          <span class="bc-rcount">(${b.total_reviews || 0} ${t('reviews', 'جائزے')})</span>
        </div>
        <div class="bc-animals">
          ${tags || `<span class="bc-tag">${t('All animals', 'تمام جانور')}</span>`}
        </div>
        <div class="bc-exp">
          🏅 ${b.experience_years || 0} ${t('years experience', 'سال تجربہ')}
        </div>
        <div class="bc-footer">
          <div>
            <div class="bc-price-label">${t('Starting from', 'شروعات')}</div>
            <div class="bc-price-val">
              ${minRate ? `PKR ${Number(minRate).toLocaleString()}` : t('Ask for rate', 'قیمت پوچھیں')}
            </div>
          </div>
          <button class="bc-book-btn"
            onclick="startBooking('${b.id}','${name.replace(/'/g, "\\'")}',${ratesStr})">
            ${t('Book Now', 'ابھی بک کریں')}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── START BOOKING ──
function startBooking(butcherId, butcherName, rates) {
  if (!currentUser) {
    openAuthModal('login');
    showToast(t('Please sign in to book.', 'بکنگ کے لیے لاگ ان کریں۔'));
    return;
  }
  if (currentProfile?.role === 'butcher') {
    showToast(t('Butchers cannot make bookings.', 'قصائی بکنگ نہیں کر سکتے۔'));
    return;
  }

  currentBookingButcher = {
    id: butcherId,
    name: butcherName,
    rates: Array.isArray(rates) ? rates : []
  };
  selectedTimeSlot = null;

  document.getElementById('bookingButcherLabel').textContent =
    `${t('Booking with', 'بکنگ')}: ${butcherName}`;

  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('bookDate');
  dateEl.min = today;
  if (!dateEl.value) dateEl.value = today;

  renderSlots();
  updateBookingSummary();
  clearMsg('bookingMsg');
  openModal('bookingModal');
}

// ── TIME SLOTS ──
function renderSlots() {
  const wrap = document.getElementById('slotsWrap');
  if (!wrap) return;
  wrap.innerHTML = TIME_SLOTS.map(s =>
    `<div class="slot${selectedTimeSlot === s ? ' sel' : ''}"
      onclick="pickSlot('${s}',this)">${s}</div>`
  ).join('');
}

function pickSlot(s, el) {
  selectedTimeSlot = s;
  document.querySelectorAll('.slot').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
  updateBookingSummary();
}

// ── BOOKING SUMMARY ──
function updateBookingSummary() {
  const animalEl = document.getElementById('bookAnimal');
  const qtyEl    = document.getElementById('bookQty');
  const dateEl   = document.getElementById('bookDate');
  const sumEl    = document.getElementById('bookingSummary');
  if (!sumEl || !currentBookingButcher) return;

  const animal  = animalEl?.value || 'goat';
  const qty     = parseInt(qtyEl?.value) || 1;
  const date    = dateEl?.value || '—';
  const rateObj = currentBookingButcher.rates?.find(r => r.animal_type === animal);
  const unit    = rateObj ? Number(rateObj.price) : 0;
  const total   = unit * qty;

  sumEl.innerHTML = `
    <div class="bsum-row"><span>${t('Butcher','قصائی')}</span><span>${currentBookingButcher.name}</span></div>
    <div class="bsum-row"><span>${t('Animal','جانور')}</span>
      <span>${ANIMAL_ICONS[animal]} ${currentLang==='en'?ANIMAL_EN[animal]:ANIMAL_UR[animal]} × ${qty}</span></div>
    <div class="bsum-row"><span>${t('Date','تاریخ')}</span><span>${date}</span></div>
    <div class="bsum-row"><span>${t('Time','وقت')}</span>
      <span>${selectedTimeSlot || t('Not selected','منتخب نہیں')}</span></div>
    <div class="bsum-row"><span>${t('Rate / animal','فی جانور قیمت')}</span>
      <span>${unit ? 'PKR '+unit.toLocaleString() : t('Not set','قیمت نہیں')}</span></div>
    <div class="bsum-row total"><span>${t('Total Estimate','کل تخمینہ')}</span>
      <span>${total ? 'PKR '+total.toLocaleString() : '—'}</span></div>`;
}

// ── CONFIRM BOOKING ──
async function confirmBooking() {
  if (!currentBookingButcher) return;

  const animal       = document.getElementById('bookAnimal').value;
  const qty          = parseInt(document.getElementById('bookQty').value) || 1;
  const date         = document.getElementById('bookDate').value;
  const notes        = document.getElementById('bookNotes').value.trim();
  const eidSlotEl    = document.getElementById('eidSlot');
  const eidSlot      = eidSlotEl ? eidSlotEl.value : '';
  const receiptInput = document.getElementById('receiptUpload');
  const receiptFile  = receiptInput?.files[0];

  if (!date) {
    showMsg('bookingMsg', t('Please select a date.', 'تاریخ منتخب کریں۔'), 'error'); return;
  }
  if (!selectedTimeSlot) {
    showMsg('bookingMsg', t('Please select a time slot.', 'وقت منتخب کریں۔'), 'error'); return;
  }

  const submitBtn = document.getElementById('bookSubmitBtn');
  submitBtn.innerHTML = '<span class="spin"></span>' + t('Submitting…', 'جمع ہو رہا ہے…');
  submitBtn.disabled = true;

  try {
    let screenshotUrl = null;

    if (receiptFile) {
      const ext      = receiptFile.name.split('.').pop();
      const filePath = `receipts/${currentUser.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await sb.storage
        .from('qasaihub-bucket').upload(filePath, receiptFile);
      if (uploadErr) throw new Error(t('Receipt upload failed: ','رسید اپ لوڈ ناکام: ') + uploadErr.message);
      const { data: urlData } = sb.storage.from('qasaihub-bucket').getPublicUrl(filePath);
      screenshotUrl = urlData.publicUrl;
    }

    const rateObj = currentBookingButcher.rates?.find(r => r.animal_type === animal);
    const total   = rateObj ? Number(rateObj.price) * qty : null;

    const { error } = await sb.from('bookings').insert({
      customer_id:                currentUser.id,
      butcher_id:                 currentBookingButcher.id,
      animal_type:                animal,
      quantity:                   qty,
      booking_date:               date,
      booking_time:               to24hr(selectedTimeSlot),
      notes:                      notes || null,
      total_price:                total,
      status:                     'pending',
      time_slot:                  eidSlot || null,
      advance_payment_screenshot: screenshotUrl
    });

    if (error) throw error;

    closeModal('bookingModal');
    selectedTimeSlot = null;
    if (receiptInput) receiptInput.value = '';
    showToast(t('Booking confirmed! ✅ Awaiting butcher acceptance.', 'بکنگ کامیاب! ✅ قصائی کی منظوری کا انتظار ہے۔'));

  } catch (err) {
    showMsg('bookingMsg', err.message, 'error');
  } finally {
    submitBtn.innerHTML = t('Confirm Booking', 'بکنگ کی تصدیق کریں');
    submitBtn.disabled = false;
  }
}
