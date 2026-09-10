// Variable penampung data event & lokasi user
let currentEvents = [];
let userLocation = null;

// Inisialisasi saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadActiveEvents();
  initGeolocation();
  setupFormListener();
});

// 1. Cek Autentikasi Member
async function checkAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    alert('Anda belum login. Silakan login terlebih dahulu.');
    window.location.href = 'index.html';
  }
}

// 2. Ambil Daftar Event Aktif Hari Ini (Tanpa Session)
async function loadActiveEvents() {
  const eventSelect = document.getElementById('eventSelect');
  eventSelect.innerHTML = '<option value="">-- Memuat Event... --</option>';

  const now = new Date().toISOString();

  // Query langsung ke tabel events
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .lte('start_time', now) // event yang sudah/sedang mulai
    .gte('end_time', now)   // event yang belum selesai
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Gagal mengambil data event:', error);
    eventSelect.innerHTML = '<option value="">Gagal memuat event</option>';
    return;
  }

  currentEvents = events || [];

  if (currentEvents.length === 0) {
    eventSelect.innerHTML = '<option value="">Tidak ada event aktif saat ini</option>';
    return;
  }

  // Populate dropdown event
  eventSelect.innerHTML = '<option value="">-- Pilih Event --</option>';
  currentEvents.forEach(evt => {
    const opt = document.createElement('option');
    opt.value = evt.id;
    opt.textContent = `${evt.title || evt.name} (${formatTime(evt.start_time)} - ${formatTime(evt.end_time)})`;
    eventSelect.appendChild(opt);
  });
}

// Helper Format Jam
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// 3. Ambil Lokasi Real-time Pengguna
function initGeolocation() {
  const locStatus = document.getElementById('locationStatus');

  if (!navigator.geolocation) {
    locStatus.innerText = 'Geolocation tidak didukung oleh browser Anda.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      locStatus.innerText = `Lokasi terdeteksi: (${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)})`;
      locStatus.style.color = '#10b981';
    },
    (error) => {
      console.error('Gagal mengambil lokasi:', error);
      locStatus.innerText = 'Gagal mendapatkan lokasi. Pastikan GPS aktif.';
      locStatus.style.color = '#ef4444';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// 4. Perhitungan Jarak (Haversine Formula) dalam Meter
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 5. Submit Absensi
function setupFormListener() {
  const btnSubmit = document.getElementById('btnSubmitAbsen');

  btnSubmit.addEventListener('click', async () => {
    const eventSelect = document.getElementById('eventSelect');
    const selectedEventId = eventSelect.value;

    // A. Validasi Event
    if (!selectedEventId) {
      alert('Pilih event terlebih dahulu!');
      return;
    }

    // B. Validasi Lokasi User
    if (!userLocation) {
      alert('Lokasi Anda belum terdeteksi. Izinkan akses GPS terlebih dahulu.');
      return;
    }

    // C. Validasi Foto Vermuk (Base64 dari vermuk-camera.js)
    if (typeof capturedImageBase64 === 'undefined' || !capturedImageBase64) {
      alert('Silakan ambil foto verifikasi wajah terlebih dahulu.');
      return;
    }

    // D. Validasi Radius Lokasi Event (jika event memiliki batasan lokasi)
    const selectedEvent = currentEvents.find(e => e.id === selectedEventId);
    if (selectedEvent && selectedEvent.latitude && selectedEvent.longitude) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        selectedEvent.latitude,
        selectedEvent.longitude
      );

      const maxRadius = selectedEvent.radius_meters || 100;

      if (distance > maxRadius) {
        alert(`Anda berada di luar radius event! Jarak Anda: ${Math.round(distance)}m (Maksimal: ${maxRadius}m)`);
        return;
      }
    }

    // E. Proses Simpan ke Database Supabase
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Mencatat Kehadiran...';

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('attendance')
        .insert([
          {
            event_id: selectedEventId,
            user_id: user.id,
            photo_url: capturedImageBase64, // Menyimpan foto Base64 langsung
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      alert('Absensi berhasil dicatat!');
      window.location.reload();

    } catch (err) {
      console.error('Error submit absensi:', err);
      alert('Gagal mencatat absensi: ' + err.message);
      btnSubmit.disabled = false;
      btnSubmit.innerText = 'Kirim Kehadiran';
    }
  });
}
