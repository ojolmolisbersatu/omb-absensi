document.addEventListener('DOMContentLoaded', async () => {
  await loadEventFilter();
  await loadAttendanceData();

  document.getElementById('filterEvent').addEventListener('change', loadAttendanceData);
});

// Dropdown filter Event di Laporan Admin
async function loadEventFilter() {
  const select = document.getElementById('filterEvent');
  const { data: events } = await supabase.from('events').select('id, title, name');

  if (events) {
    select.innerHTML = '<option value="">-- Semua Event --</option>' +
      events.map(e => `<option value="${e.id}">${e.title || e.name}</option>`).join('');
  }
}

// Fetch Rekap Absensi
async function loadAttendanceData() {
  const tbody = document.getElementById('attendanceTableBody');
  const selectedEventId = document.getElementById('filterEvent').value;

  let query = supabase
    .from('attendance')
    .select(`
      id,
      created_at,
      photo_url,
      latitude,
      longitude,
      events ( title, name ),
      users ( email, raw_user_meta_data )
    `)
    .order('created_at', { ascending: false });

  if (selectedEventId) {
    query = query.eq('event_id', selectedEventId);
  }

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Gagal memuat rekap: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data presensi.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => {
    const userEmail = row.users?.email || 'N/A';
    const eventName = row.events?.title || row.events?.name || 'N/A';
    const photoSrc = row.photo_url || '';

    return `
      <tr>
        <td>${userEmail}</td>
        <td>${eventName}</td>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td>
          ${photoSrc ? `<img src="${photoSrc}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 50%; border: 2px solid #10b981;" alt="Foto Presensi"/>` : 'Tidak Ada Foto'}
        </td>
        <td>${row.latitude && row.longitude ? `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}` : 'N/A'}</td>
      </tr>
    `;
  }).join('');
}
