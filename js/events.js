/* ==========================================================================
   OMB ABSENSI V2 — Halaman member (Direct Event & Vermuk Integration)
   ========================================================================== */
const $ = (id) => document.getElementById(id);

let eventData = null;
let pickedMember = null; // {id_anggota, nama}
let gpsResultData = null; // {latitude, longitude, accuracy, distance, valid}

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

// Memonitor status form untuk mengaktifkan tombol Submit
function updateSubmitState() {
  const hasPhoto = typeof capturedImageBase64 !== 'undefined' && capturedImageBase64 !== null;
  $('submitBtn').disabled = !(pickedMember && gpsResultData && gpsResultData.valid && hasPhoto);
}

// Cek foto vermuk setiap 1 detik untuk mengupdate state tombol
setInterval(updateSubmitState, 1000);

// REVISI: Fungsi konversi Base64 dari Vermuk ke File (Agar Google Drive Upload tetap bekerja)
function dataURLtoFile(dataurl, filename) {
  var arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[arr.length - 1]), 
      n = bstr.length, 
      u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}

// REVISI: Mengubah loadSession menjadi loadEvent
async function loadEvent() {
  const eventId = new URLSearchParams(location.search).get('event');
  if (!eventId) {
    await loadActiveEventList();
    return;
  }
  
  const { data: ev, error: err } = await supabaseClient
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
    
  if (err || !ev) {
    $('eventTitle').textContent = 'Event tidak ditemukan';
    showMessage($('message'), 'Event absensi tidak ditemukan atau sudah tidak aktif.', 'error');
    return;
  }
  
  eventData = ev;

  $('eventTitle').textContent = 'Absensi — ' + (eventData.title || eventData.name);
  $('eventSub').textContent = `Radius Wajib ${eventData.radius_meters ?? '-'} m`;

  const now = new Date().toISOString();
  if (now < eventData.start_time || now > eventData.end_time) {
    $('sessionClosed').classList.remove('hidden');
    return;
  }
  
  $('formArea').classList.remove('hidden');
}

// REVISI: Mengubah loadActiveSessionList menjadi loadActiveEventList
async function loadActiveEventList() {
  $('eventTitle').textContent = 'Absensi OMB';
  $('eventSub').textContent = 'Pilih event yang sedang berlangsung untuk melakukan absensi.';
  $('sessionPicker').classList.remove('hidden');

  const now = new Date().toISOString();
  const { data: eventsData, error } = await supabaseClient
    .from('events')
    .select('*')
    .lte('start_time', now)
    .gte('end_time', now)
    .order('start_time');

  if (error) {
    $('activeSessionList').innerHTML = `<div class="empty">Gagal memuat event aktif: ${escapeHtml(error.message)}</div>`;
    return;
  }
  if (!eventsData || !eventsData.length) {
    $('activeSessionList').innerHTML = '<div class="empty">Tidak ada event absensi yang aktif saat ini.</div>';
    return;
  }

  $('activeSessionList').innerHTML = eventsData
    .map((ev) => {
      return `<div class="member-item" onclick="location.href='?event=${ev.id}'">
        <span>${escapeHtml(ev.title || ev.name)}</span>
        <span class="id">Radius: ${escapeHtml(ev.radius_meters || '-')}m</span>
      </div>`;
    })
    .join('');
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

// REVISI: Menarik koordinat target lat/lng langsung dari eventData (tanpa sessionData)
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
      const targetLat = Number(eventData.latitude);
      const targetLng = Number(eventData.longitude);
      const radius = Number(eventData.radius_meters) || 0;
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
            : `<div class="invalid">⚠️ Lokasi event belum diatur oleh admin.</div>`
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

// REVISI: Payload diperbarui untuk mencatat event_id, foto dikonversi ke file lalu dikirim ke GDrive
async function submitAttendance() {
  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = 'MENGIRIM...';
  
  try {
    // 1. Konversi Base64 Vermuk menjadi objek File
    const photoFile = dataURLtoFile(capturedImageBase64, `foto_${pickedMember.id_anggota}.jpg`);
    
    // 2. Upload ke Google Drive menggunakan fungsi asli Anda
    const folderName = eventData ? (eventData.title || eventData.name) : 'Lainnya';
    const upload = await uploadPhotoToDrive(photoFile, pickedMember.id_anggota, folderName);
    
    if (!upload.ok) throw new Error(upload.error || 'Upload foto gagal.');

    // 3. Simpan data ke Supabase (tanpa session_id)
    const payload = {
      event_id: eventData.id,
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
  loadEvent(); // REVISI: Panggil fungsi loadEvent
  
  let searchTimer;
  $('memberSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchMember(e.target.value), 300);
  });
  
  $('checkLocationBtn').addEventListener('click', checkLocation);
  $('submitBtn').addEventListener('click', submitAttendance);
  
  // NOTE: Event listener 'photoInput' asli dihapus karena sudah diatasi otomatis oleh Vermuk Camera
});
