/* ==========================================================================
   OMB ABSENSI V1 — Halaman member (tanpa login)
   ========================================================================== */
const $ = (id) => document.getElementById(id);

let sessionData = null;
let eventData = null;
let pickedMember = null; // {id_anggota, nama}
let gpsResultData = null; // {latitude, longitude, accuracy, distance, valid}
let photoFile = null;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function updateSubmitState() {
  $('submitBtn').disabled = !(pickedMember && gpsResultData && gpsResultData.valid && photoFile);
}

async function loadSession() {
  const sessionId = new URLSearchParams(location.search).get('session');
  if (!sessionId) {
    showMessage($('message'), 'Link tidak valid: session tidak ditemukan.', 'error');
    return;
  }
  const { data: session, error: err1 } = await supabaseClient
    .from('event_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (err1 || !session) {
    $('eventTitle').textContent = 'Sesi tidak ditemukan';
    showMessage($('message'), 'Sesi absensi tidak ditemukan atau sudah tidak aktif.', 'error');
    return;
  }
  sessionData = session;

  const { data: ev } = await supabaseClient.from('events').select('*').eq('id', session.event_id).single();
  eventData = ev || null;

  $('eventTitle').textContent = (eventData ? eventData.name : 'Absensi') + ' — ' + session.name;
  $('eventSub').textContent = `${session.location_name || '-'} · Radius ${session.radius_meter ?? '-'} m`;

  if (session.status !== 'active') {
    $('sessionClosed').classList.remove('hidden');
    return;
  }
  $('formArea').classList.remove('hidden');
}

async function searchMember(q) {
  const box = $('searchResults');
  if (!q || q.trim().length < 2) {
    box.innerHTML = '';
    return;
  }
  const { data, error } = await supabaseClient
    .from('anggota_omb_public')
    .select('*')
    .or(`nama.ilike.%${q}%,nama_panggilan.ilike.%${q}%,id_anggota.ilike.%${q}%`)
    .limit(8);
  if (error) {
    box.innerHTML = `<div class="empty">Gagal mencari data: ${escapeHtml(error.message)}</div>`;
    return;
  }
  const results = data || [];
  box.innerHTML = results.length
    ? results
        .map(
          (m) =>
            `<div class="member-item" data-id="${escapeHtml(m.id_anggota)}" data-nama="${escapeHtml(m.nama)}">
              <span>${escapeHtml(m.nama)}${m.nama_panggilan ? ' (' + escapeHtml(m.nama_panggilan) + ')' : ''}</span>
              <span class="id">${escapeHtml(m.id_anggota)}</span>
            </div>`
        )
        .join('')
    : '<div class="empty">Tidak ditemukan.</div>';

  box.querySelectorAll('.member-item').forEach((el) => {
    el.addEventListener('click', () => {
      pickedMember = { id_anggota: el.dataset.id, nama: el.dataset.nama };
      renderPickedMember();
      box.innerHTML = '';
      $('memberSearch').value = '';
      updateSubmitState();
    });
  });
}

function renderPickedMember() {
  const box = $('pickedMemberBox');
  if (!pickedMember) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<div class="picked-member"><span>✅ ${escapeHtml(pickedMember.nama)} (${escapeHtml(
    pickedMember.id_anggota
  )})</span><button type="button" id="clearMemberBtn">Ganti</button></div>`;
  $('clearMemberBtn').addEventListener('click', () => {
    pickedMember = null;
    renderPickedMember();
    updateSubmitState();
  });
}

function checkLocation() {
  const resultEl = $('gpsResult');
  const btn = $('checkLocationBtn');
  if (!navigator.geolocation) {
    showMessage(resultEl, 'Geolocation tidak didukung browser ini.', 'error');
    resultEl.classList.remove('hidden');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Mencari lokasi...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const targetLat = Number(sessionData.latitude);
      const targetLng = Number(sessionData.longitude);
      const radius = Number(sessionData.radius_meter) || 0;
      let distance = null;
      let valid = false;
      if (!Number.isNaN(targetLat) && !Number.isNaN(targetLng)) {
        distance = haversineMeters(latitude, longitude, targetLat, targetLng);
        valid = distance <= radius;
      }
      gpsResultData = { latitude, longitude, accuracy, distance, valid };
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <div>Akurasi GPS: ± ${Math.round(accuracy)} meter</div>
        ${
          distance !== null
            ? `<div>Jarak ke lokasi: ${Math.round(distance)} meter (radius diizinkan: ${radius} m)</div>
               <div class="${valid ? 'valid' : 'invalid'}">${valid ? '✅ Lokasi valid, dalam radius absensi' : '❌ Anda berada di luar radius absensi'}</div>`
            : `<div class="invalid">⚠️ Lokasi sesi belum diatur oleh admin.</div>`
        }
      `;
      btn.disabled = false;
      btn.textContent = '📍 Cek Ulang Lokasi';
      updateSubmitState();
    },
    (err) => {
      resultEl.classList.remove('hidden');
      showMessage(resultEl, 'Gagal mengambil lokasi: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '📍 Aktifkan GPS & Cek Lokasi';
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

function handlePhotoChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  photoFile = file;
  const preview = $('photoPreview');
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
  updateSubmitState();
}

async function submitAttendance() {
  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = 'MENGIRIM...';
  try {
    const upload = await uploadPhotoToDrive(photoFile, pickedMember.id_anggota);
    if (!upload.ok) throw new Error(upload.error || 'Upload foto gagal.');

    const payload = {
      event_id: sessionData.event_id,
      session_id: sessionData.id,
      member_id: pickedMember.id_anggota,
      latitude: gpsResultData.latitude,
      longitude: gpsResultData.longitude,
      gps_accuracy: gpsResultData.accuracy,
      distance_meter: gpsResultData.distance,
      location_valid: gpsResultData.valid,
      photo_drive_id: upload.file_id,
      photo_drive_url: upload.view_url || upload.file_url,
      status: 'hadir',
      device_info: navigator.userAgent
    };
    const { error } = await supabaseClient.from('attendance').insert(payload);
    if (error) throw error;

    document.getElementById('formArea').innerHTML =
      '<div class="notice success">✅ Absensi berhasil dikirim. Terima kasih!</div>';
  } catch (err) {
    showMessage($('message'), 'Gagal mengirim absensi: ' + (err.message || err), 'error');
    btn.disabled = false;
    btn.textContent = 'KIRIM ABSENSI';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSession();
  let searchTimer;
  $('memberSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchMember(e.target.value), 300);
  });
  $('checkLocationBtn').addEventListener('click', checkLocation);
  $('photoInput').addEventListener('change', handlePhotoChange);
  $('submitBtn').addEventListener('click', submitAttendance);
});
