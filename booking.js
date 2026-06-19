// /* ═══════════════════════════════════════════
//    MEATMASTER — booking.js  v2.2  (FIXED)
//    ═══════════════════════════════════════════ */

// const ANIMAL_ICONS = { goat: '🐐', cow: '🐄', camel: '🐪', sheep: '🐑' };
// const ANIMAL_EN    = { goat: 'Goat', cow: 'Cow', camel: 'Camel', sheep: 'Sheep' };
// const ANIMAL_UR    = { goat: 'بکرا', cow: 'گائے', camel: 'اونٹ', sheep: 'دنبہ' };
// const TIME_SLOTS   = [
//   '06:00 AM','07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM',
//   '12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM'
// ];
// const EID_SLOTS = ['eid_day1', 'eid_day2', 'eid_day3', 'normal_day'];
// const EID_LABELS_EN = {
//   eid_day1: 'Eid Day 1', eid_day2: 'Eid Day 2',
//   eid_day3: 'Eid Day 3', normal_day: 'Normal Day'
// };
// const EID_LABELS_UR = {
//   eid_day1: 'عید پہلا دن', eid_day2: 'عید دوسرا دن',
//   eid_day3: 'عید تیسرا دن', normal_day: 'عام دن'
// };

// let currentBookingButcher = null;
// let selectedTimeSlot      = null;
// let mediaRecorder         = null;
// let recordedChunks        = [];

// // ── CONVERT 12hr to 24hr for DB (time column) ──
// function to24hr(t12) {
//   if (!t12) return null;
//   const [time, period] = t12.split(' ');
//   let [h, m] = time.split(':').map(Number);
//   if (period === 'PM' && h !== 12) h += 12;
//   if (period === 'AM' && h === 12) h = 0;
//   return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
// }

// // ── LOAD BUTCHERS ──
// // FIX: butcher_profiles.id → profiles.id is a FK but Supabase needs explicit
// // relationship name. We fetch butcher_profiles + butcher_rates, then fetch
// // profiles separately and merge.
// async function loadButchers() {
//   const grid = document.getElementById('butchersGrid');
//   if (!grid) return;

//   grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--ink-muted)">
//     <div style="font-size:2.5rem;margin-bottom:.75rem">🔪</div>
//     <p>${t('Loading butchers…', 'قصائی لوڈ ہو رہے ہیں…')}</p>
//   </div>`;

//   // Step 1: fetch verified available butcher profiles + rates
//   const { data: butchers, error } = await sb
//     .from('butcher_profiles')
//     .select(`*, rates:butcher_rates ( animal_type, price )`)
//     .eq('is_available', true)
//     .eq('is_verified', true)
//     .order('rating', { ascending: false })
//     .limit(12);

//   if (error || !butchers || butchers.length === 0) {
//     grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--ink-muted)">
//       <div style="font-size:2.5rem;margin-bottom:.75rem">🔪</div>
//       <p>${t('No verified butchers available right now. Check back soon!', 'ابھی تک کوئی تصدیق شدہ قصائی دستیاب نہیں۔ جلد واپس آئیں!')}</p>
//     </div>`;
//     if (error) console.error('loadButchers error:', error.message);
//     return;
//   }

//   // Step 2: fetch profiles for all butcher IDs
//   const ids = butchers.map(b => b.id);
//   const { data: profiles } = await sb
//     .from('profiles')
//     .select('id, full_name, city, avatar_url')
//     .in('id', ids);

//   // Step 3: merge profiles into butchers
//   const profileMap = {};
//   (profiles || []).forEach(p => { profileMap[p.id] = p; });

//   grid.innerHTML = butchers.map(b => {
//     const profile  = profileMap[b.id] || {};
//     const name     = profile.full_name || 'Qasai';
//     const city     = profile.city || 'Pakistan';
//     const initial  = name.charAt(0).toUpperCase();
//     const rating   = Number(b.rating || 0);
//     const filled   = Math.round(rating);
//     const stars    = '★'.repeat(filled) + '☆'.repeat(5 - filled);
//     const tags     = (b.rates || []).map(r =>
//       `<span class="bc-tag">${ANIMAL_ICONS[r.animal_type] || '🐄'} ${currentLang === 'en' ? ANIMAL_EN[r.animal_type] : ANIMAL_UR[r.animal_type]}</span>`
//     ).join('');
//     const minRate  = b.rates?.length ? Math.min(...b.rates.map(r => Number(r.price))) : null;
//     const ratesStr = JSON.stringify(b.rates || []).replace(/"/g, '&quot;');

//     return `<div class="butcher-card">
//       <div class="bc-head">
//         <div class="bc-avatar">
//           ${profile.avatar_url
//             ? `<img src="${profile.avatar_url}" alt="${name}" />`
//             : initial}
//         </div>
//         <div>
//           <div class="bc-name">${name}</div>
//           <div class="bc-city">📍 ${city}</div>
//           <span class="bc-verified">✓ ${t('Verified', 'تصدیق شدہ')}</span>
//         </div>
//       </div>
//       <div class="bc-body">
//         <div class="bc-rating">
//           <span class="bc-stars">${stars}</span>
//           <span class="bc-rnum">${rating.toFixed(1)}</span>
//           <span class="bc-rcount">(${b.total_reviews || 0} ${t('reviews', 'جائزے')})</span>
//         </div>
//         <div class="bc-animals">
//           ${tags || `<span class="bc-tag">${t('All animals', 'تمام جانور')}</span>`}
//         </div>
//         <div class="bc-exp">
//           🏅 ${b.experience_years || 0} ${t('years experience', 'سال تجربہ')}
//         </div>
//         <div class="bc-footer">
//           <div>
//             <div class="bc-price-label">${t('Starting from', 'شروعات')}</div>
//             <div class="bc-price-val">
//               ${minRate ? `PKR ${Number(minRate).toLocaleString()}` : t('Ask for rate', 'قیمت پوچھیں')}
//             </div>
//           </div>
//           ${currentProfile?.role === 'butcher'
//             ? `<button class="bc-book-btn" style="opacity:.4;cursor:not-allowed" disabled>
//                 🔪 ${t('Your Listing', 'آپ کی لسٹنگ')}
//                </button>`
//             : `<button class="bc-book-btn"
//                 onclick="startBooking('${b.id}','${name.replace(/'/g, "\\'")}',${ratesStr})">
//                 ${t('Book Now', 'ابھی بک کریں')}
//                </button>`
//           }
//         </div>
//       </div>
//     </div>`;
//   }).join('');
// }

// // ── START BOOKING ──
// function startBooking(butcherId, butcherName, rates) {
//   if (!currentUser) {
//     openAuthModal('login');
//     showToast(t('Please sign in to book.', 'بکنگ کے لیے لاگ ان کریں۔'));
//     return;
//   }
//   if (currentProfile?.role === 'butcher') {
//     showToast(t('Butchers cannot make bookings.', 'قصائی بکنگ نہیں کر سکتے۔'));
//     return;
//   }

//   currentBookingButcher = {
//     id: butcherId,
//     name: butcherName,
//     rates: Array.isArray(rates) ? rates : []
//   };
//   selectedTimeSlot = null;

//   document.getElementById('bookingButcherLabel').textContent =
//     `${t('Booking with', 'بکنگ')}: ${butcherName}`;

//   const today = new Date().toISOString().split('T')[0];
//   const dateEl = document.getElementById('bookDate');
//   dateEl.min = today;
//   if (!dateEl.value) dateEl.value = today;

//   renderSlots();
//   updateBookingSummary();
//   clearMsg('bookingMsg');
//   openModal('bookingModal');
// }

// // ── TIME SLOTS ──
// function renderSlots() {
//   const wrap = document.getElementById('slotsWrap');
//   if (!wrap) return;
//   wrap.innerHTML = TIME_SLOTS.map(s =>
//     `<div class="slot${selectedTimeSlot === s ? ' sel' : ''}"
//       onclick="pickSlot('${s}',this)">${s}</div>`
//   ).join('');
// }

// function pickSlot(s, el) {
//   selectedTimeSlot = s;
//   document.querySelectorAll('.slot').forEach(x => x.classList.remove('sel'));
//   el.classList.add('sel');
//   updateBookingSummary();
// }

// // ── BOOKING SUMMARY ──
// function updateBookingSummary() {
//   const animalEl = document.getElementById('bookAnimal');
//   const qtyEl    = document.getElementById('bookQty');
//   const dateEl   = document.getElementById('bookDate');
//   const sumEl    = document.getElementById('bookingSummary');
//   if (!sumEl || !currentBookingButcher) return;

//   const animal  = animalEl?.value || 'goat';
//   const qty     = parseInt(qtyEl?.value) || 1;
//   const date    = dateEl?.value || '—';
//   const rateObj = currentBookingButcher.rates?.find(r => r.animal_type === animal);
//   const unit    = rateObj ? Number(rateObj.price) : 0;
//   const total   = unit * qty;

//   sumEl.innerHTML = `
//     <div class="bsum-row"><span>${t('Butcher','قصائی')}</span><span>${currentBookingButcher.name}</span></div>
//     <div class="bsum-row"><span>${t('Animal','جانور')}</span>
//       <span>${ANIMAL_ICONS[animal]} ${currentLang==='en'?ANIMAL_EN[animal]:ANIMAL_UR[animal]} × ${qty}</span></div>
//     <div class="bsum-row"><span>${t('Date','تاریخ')}</span><span>${date}</span></div>
//     <div class="bsum-row"><span>${t('Time','وقت')}</span>
//       <span>${selectedTimeSlot || t('Not selected','منتخب نہیں')}</span></div>
//     <div class="bsum-row"><span>${t('Rate / animal','فی جانور قیمت')}</span>
//       <span>${unit ? 'PKR '+unit.toLocaleString() : t('Not set','قیمت نہیں')}</span></div>
//     <div class="bsum-row total"><span>${t('Total Estimate','کل تخمینہ')}</span>
//       <span>${total ? 'PKR '+total.toLocaleString() : '—'}</span></div>`;
// }

// // ── CONFIRM BOOKING ──
// async function confirmBooking() {
//   if (!currentBookingButcher) return;

//   const animal       = document.getElementById('bookAnimal').value;
//   const qty          = parseInt(document.getElementById('bookQty').value) || 1;
//   const date         = document.getElementById('bookDate').value;
//   const notes        = document.getElementById('bookNotes').value.trim();
//   const eidSlotEl    = document.getElementById('eidSlot');
//   const eidSlot      = eidSlotEl ? eidSlotEl.value : '';
//   const receiptInput = document.getElementById('receiptUpload');
//   const receiptFile  = receiptInput?.files[0];

//   if (!date) {
//     showMsg('bookingMsg', t('Please select a date.', 'تاریخ منتخب کریں۔'), 'error'); return;
//   }
//   if (!selectedTimeSlot) {
//     showMsg('bookingMsg', t('Please select a time slot.', 'وقت منتخب کریں۔'), 'error'); return;
//   }

//   const submitBtn = document.getElementById('bookSubmitBtn');
//   submitBtn.innerHTML = '<span class="spin"></span>' + t('Submitting…', 'جمع ہو رہا ہے…');
//   submitBtn.disabled = true;

//   try {
//     let screenshotUrl = null;

//     if (receiptFile) {
//       const ext      = receiptFile.name.split('.').pop();
//       const filePath = `receipts/${currentUser.id}_${Date.now()}.${ext}`;
//       const { error: uploadErr } = await sb.storage
//         .from('meatmaster-bucket').upload(filePath, receiptFile);
//       if (uploadErr) throw new Error(t('Receipt upload failed: ','رسید اپ لوڈ ناکام: ') + uploadErr.message);
//       const { data: urlData } = sb.storage.from('meatmaster-bucket').getPublicUrl(filePath);
//       screenshotUrl = urlData.publicUrl;
//     }

//     const rateObj = currentBookingButcher.rates?.find(r => r.animal_type === animal);
//     const total   = rateObj ? Number(rateObj.price) * qty : null;

//     // FIX: convert 12hr slot to 24hr time for DB time column
//     const { error } = await sb.from('bookings').insert({
//       customer_id:                currentUser.id,
//       butcher_id:                 currentBookingButcher.id,
//       animal_type:                animal,
//       quantity:                   qty,
//       booking_date:               date,
//       booking_time:               to24hr(selectedTimeSlot),
//       notes:                      notes || null,
//       total_price:                total,
//       status:                     'pending',
//       time_slot:                  eidSlot || null,
//       advance_payment_screenshot: screenshotUrl
//     });

//     if (error) throw error;

//     closeModal('bookingModal');
//     selectedTimeSlot = null;
//     if (receiptInput) receiptInput.value = '';
//     showToast(t('Booking confirmed! ✅ Awaiting butcher acceptance.', 'بکنگ کامیاب! ✅ قصائی کی منظوری کا انتظار ہے۔'));

//   } catch (err) {
//     showMsg('bookingMsg', err.message, 'error');
//   } finally {
//     submitBtn.innerHTML = t('Confirm Booking', 'بکنگ کی تصدیق کریں');
//     submitBtn.disabled = false;
//   }
// }

// // ── VOICE MESSAGES ──
// async function toggleVoicePanel(bookingId, otherName, anchorEl) {
//   const existing = document.getElementById('vp_' + bookingId);
//   if (existing) { existing.remove(); return; }

//   const panel = document.createElement('div');
//   panel.id = 'vp_' + bookingId;
//   panel.className = 'voice-panel';
//   panel.innerHTML = `
//     <div style="font-weight:600;font-size:.82rem;color:var(--teal-700);margin-bottom:.6rem">
//       🎙 ${t('Voice messages with','آواز پیغامات')} ${otherName}
//     </div>
//     <div class="vm-list" id="vml_${bookingId}">
//       <p style="font-size:.78rem;color:var(--ink-muted)">${t('Loading…','لوڈ ہو رہا ہے…')}</p>
//     </div>
//     <div class="rec-row">
//       <button class="rec-btn" id="rb_${bookingId}" onclick="toggleRecording('${bookingId}')">🎙</button>
//       <span class="rec-status" id="rs_${bookingId}">${t('Tap mic to record','ریکارڈ کرنے کے لیے دبائیں')}</span>
//       <button class="btn btn-sm btn-teal" id="sv_${bookingId}" style="display:none"
//         onclick="sendVoice('${bookingId}')">
//         ${t('Send','بھیجیں')}
//       </button>
//     </div>`;
//   anchorEl.closest('.brow').after(panel);
//   loadVoiceMsgs(bookingId);
// }

// async function loadVoiceMsgs(bookingId) {
//   const list = document.getElementById('vml_' + bookingId);
//   if (!list) return;
//   const { data } = await sb
//     .from('voice_messages')
//     .select('*, sender:sender_id ( full_name )')
//     .eq('booking_id', bookingId)
//     .order('created_at');

//   if (!data || data.length === 0) {
//     list.innerHTML = `<p style="font-size:.78rem;color:var(--ink-muted)">${t('No voice messages yet.','ابھی تک کوئی پیغام نہیں۔')}</p>`;
//     return;
//   }
//   list.innerHTML = data.map(m => `
//     <div class="vm-item">
//       <span class="vm-sender">${m.sender?.full_name?.split(' ')[0] || 'You'}</span>
//       <audio controls src="${m.audio_url}"></audio>
//       <span class="vm-time">${new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
//     </div>`).join('');
// }

// async function toggleRecording(bookingId) {
//   const btn = document.getElementById('rb_' + bookingId);
//   const sts = document.getElementById('rs_' + bookingId);
//   const sv  = document.getElementById('sv_' + bookingId);

//   if (!mediaRecorder || mediaRecorder.state === 'inactive') {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       mediaRecorder  = new MediaRecorder(stream);
//       recordedChunks = [];
//       mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
//       mediaRecorder.onstop = () => {
//         stream.getTracks().forEach(tr => tr.stop());
//         sv.style.display = 'inline-flex';
//         sts.textContent  = t('Ready to send ✓','بھیجنے کے لیے تیار ✓');
//       };
//       mediaRecorder.start();
//       btn.classList.add('recording');
//       btn.textContent = '⏹';
//       sts.textContent = t('Recording…','ریکارڈنگ جاری…');
//     } catch {
//       showToast(t('Microphone access denied','مائکروفون تک رسائی نہیں'));
//     }
//   } else if (mediaRecorder.state === 'recording') {
//     mediaRecorder.stop();
//     btn.classList.remove('recording');
//     btn.textContent = '🎙';
//   }
// }

// async function sendVoice(bookingId) {
//   if (!recordedChunks.length) return;
//   const blob     = new Blob(recordedChunks, { type: 'audio/webm' });
//   const filename = `${currentUser.id}_${Date.now()}.webm`;
//   const { error: ue } = await sb.storage
//     .from('voice-messages')
//     .upload(filename, blob, { contentType: 'audio/webm' });
//   if (ue) { showToast('Upload failed: ' + ue.message); return; }
//   const { data: urlData } = sb.storage.from('voice-messages').getPublicUrl(filename);
//   await sb.from('voice_messages').insert({
//     booking_id:       bookingId,
//     sender_id:        currentUser.id,
//     audio_url:        urlData.publicUrl,
//     duration_seconds: Math.round(blob.size / 3000)
//   });
//   recordedChunks = [];
//   document.getElementById('sv_' + bookingId).style.display = 'none';
//   document.getElementById('rs_' + bookingId).textContent   = t('Sent! ✓','بھیج دیا! ✓');
//   loadVoiceMsgs(bookingId);
//   showToast(t('Voice message sent! 🎙','آواز پیغام بھیج دیا! 🎙'));
// }



/* ═══════════════════════════════════════════
   MEATMASTER — booking.js  v2.2  (FIXED)
   ═══════════════════════════════════════════ */

const ANIMAL_ICONS = { goat: '🐐', cow: '🐄', camel: '🐪', sheep: '🐑' };
const ANIMAL_EN    = { goat: 'Goat', cow: 'Cow', camel: 'Camel', sheep: 'Sheep' };
const ANIMAL_UR    = { goat: 'بکرا', cow: 'گائے', camel: 'اونٹ', sheep: 'دنبہ' };
const TIME_SLOTS   = [
  '06:00 AM','07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM',
  '12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM'
];
const EID_SLOTS = ['eid_day1', 'eid_day2', 'eid_day3', 'normal_day'];
const EID_LABELS_EN = {
  eid_day1: 'Eid Day 1', eid_day2: 'Eid Day 2',
  eid_day3: 'Eid Day 3', normal_day: 'Normal Day'
};
const EID_LABELS_UR = {
  eid_day1: 'عید پہلا دن', eid_day2: 'عید دوسرا دن',
  eid_day3: 'عید تیسرا دن', normal_day: 'عام دن'
};

let currentBookingButcher = null;
let selectedTimeSlot      = null;
let mediaRecorder         = null;
let recordedChunks        = [];

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
// FIX: butcher_profiles.id → profiles.id is a FK but Supabase needs explicit
// relationship name. We fetch butcher_profiles + butcher_rates, then fetch
// profiles separately and merge.
async function loadButchers() {
  const grid = document.getElementById('butchersGrid');
  if (!grid) return;

  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--ink-muted)">
    <div style="font-size:2.5rem;margin-bottom:.75rem">🔪</div>
    <p>${t('Loading butchers…', 'قصائی لوڈ ہو رہے ہیں…')}</p>
  </div>`;

  // Step 1: fetch verified available butcher profiles + rates
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

  // Step 2: fetch profiles for all butcher IDs
  const ids = butchers.map(b => b.id);
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, city, avatar_url')
    .in('id', ids);

  // Step 3: merge profiles into butchers
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
          ${currentProfile?.role === 'butcher'
            ? `<button class="bc-book-btn" onclick="goToDashboard()"
                style="background:var(--teal-700);color:#fff">
                🔪 ${t('My Dashboard', 'میرا ڈیش بورڈ')}
               </button>`
            : `<button class="bc-book-btn"
                onclick="startBooking('${b.id}','${name.replace(/'/g, "\\'")}',${ratesStr})">
                ${t('Book Now', 'ابھی بک کریں')}
               </button>`
          }
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
        .from('meatmaster-bucket').upload(filePath, receiptFile);
      if (uploadErr) throw new Error(t('Receipt upload failed: ','رسید اپ لوڈ ناکام: ') + uploadErr.message);
      const { data: urlData } = sb.storage.from('meatmaster-bucket').getPublicUrl(filePath);
      screenshotUrl = urlData.publicUrl;
    }

    const rateObj = currentBookingButcher.rates?.find(r => r.animal_type === animal);
    const total   = rateObj ? Number(rateObj.price) * qty : null;

    // FIX: convert 12hr slot to 24hr time for DB time column
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

// ── VOICE MESSAGES ──
async function toggleVoicePanel(bookingId, otherName, anchorEl) {
  const existing = document.getElementById('vp_' + bookingId);
  if (existing) { existing.remove(); return; }

  const panel = document.createElement('div');
  panel.id = 'vp_' + bookingId;
  panel.className = 'voice-panel';
  panel.innerHTML = `
    <div style="font-weight:600;font-size:.82rem;color:var(--teal-700);margin-bottom:.6rem">
      🎙 ${t('Voice messages with','آواز پیغامات')} ${otherName}
    </div>
    <div class="vm-list" id="vml_${bookingId}">
      <p style="font-size:.78rem;color:var(--ink-muted)">${t('Loading…','لوڈ ہو رہا ہے…')}</p>
    </div>
    <div class="rec-row">
      <button class="rec-btn" id="rb_${bookingId}" onclick="toggleRecording('${bookingId}')">🎙</button>
      <span class="rec-status" id="rs_${bookingId}">${t('Tap mic to record','ریکارڈ کرنے کے لیے دبائیں')}</span>
      <button class="btn btn-sm btn-teal" id="sv_${bookingId}" style="display:none"
        onclick="sendVoice('${bookingId}')">
        ${t('Send','بھیجیں')}
      </button>
    </div>`;
  anchorEl.closest('.brow').after(panel);
  loadVoiceMsgs(bookingId);
}

async function loadVoiceMsgs(bookingId) {
  const list = document.getElementById('vml_' + bookingId);
  if (!list) return;
  const { data } = await sb
    .from('voice_messages')
    .select('*, sender:sender_id ( full_name )')
    .eq('booking_id', bookingId)
    .order('created_at');

  if (!data || data.length === 0) {
    list.innerHTML = `<p style="font-size:.78rem;color:var(--ink-muted)">${t('No voice messages yet.','ابھی تک کوئی پیغام نہیں۔')}</p>`;
    return;
  }
  list.innerHTML = data.map(m => `
    <div class="vm-item">
      <span class="vm-sender">${m.sender?.full_name?.split(' ')[0] || 'You'}</span>
      <audio controls src="${m.audio_url}"></audio>
      <span class="vm-time">${new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
    </div>`).join('');
}

async function toggleRecording(bookingId) {
  const btn = document.getElementById('rb_' + bookingId);
  const sts = document.getElementById('rs_' + bookingId);
  const sv  = document.getElementById('sv_' + bookingId);

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder  = new MediaRecorder(stream);
      recordedChunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop());
        sv.style.display = 'inline-flex';
        sts.textContent  = t('Ready to send ✓','بھیجنے کے لیے تیار ✓');
      };
      mediaRecorder.start();
      btn.classList.add('recording');
      btn.textContent = '⏹';
      sts.textContent = t('Recording…','ریکارڈنگ جاری…');
    } catch {
      showToast(t('Microphone access denied','مائکروفون تک رسائی نہیں'));
    }
  } else if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    btn.classList.remove('recording');
    btn.textContent = '🎙';
  }
}

async function sendVoice(bookingId) {
  if (!recordedChunks.length) return;
  const blob     = new Blob(recordedChunks, { type: 'audio/webm' });
  const filename = `${currentUser.id}_${Date.now()}.webm`;
  const { error: ue } = await sb.storage
    .from('voice-messages')
    .upload(filename, blob, { contentType: 'audio/webm' });
  if (ue) { showToast('Upload failed: ' + ue.message); return; }
  const { data: urlData } = sb.storage.from('voice-messages').getPublicUrl(filename);
  await sb.from('voice_messages').insert({
    booking_id:       bookingId,
    sender_id:        currentUser.id,
    audio_url:        urlData.publicUrl,
    duration_seconds: Math.round(blob.size / 3000)
  });
  recordedChunks = [];
  document.getElementById('sv_' + bookingId).style.display = 'none';
  document.getElementById('rs_' + bookingId).textContent   = t('Sent! ✓','بھیج دیا! ✓');
  loadVoiceMsgs(bookingId);
  showToast(t('Voice message sent! 🎙','آواز پیغام بھیج دیا! 🎙'));
}