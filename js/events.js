document.addEventListener('DOMContentLoaded', () => {
  loadEvents();
  setupForm();
});

async function loadEvents() {
  const tbody = document.getElementById('eventTableBody');
  
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('start_time', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Gagal memuat event: ${error.message}</td></tr>`;
    return;
  }

  if (events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada event.</td></tr>';
    return;
  }

  tbody.innerHTML = events.map(evt => `
    <tr>
      <td><b>${evt.title || evt.name}</b></td>
      <td>${new Date(evt.start_time).toLocaleString()}</td>
      <td>${new Date(evt.end_time).toLocaleString()}</td>
      <td>${evt.radius_meters || 100} m</td>
      <td>
        <button onclick="deleteEvent('${evt.id}')" style="color: red;">Hapus</button>
      </td>
    </tr>
  `).join('');
}

function setupForm() {
  const form = document.getElementById('formEvent');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      title: document.getElementById('eventTitle').value,
      start_time: new Date(document.getElementById('startTime').value).toISOString(),
      end_time: new Date(document.getElementById('endTime').value).toISOString(),
      latitude: parseFloat(document.getElementById('latitude').value) || null,
      longitude: parseFloat(document.getElementById('longitude').value) || null,
      radius_meters: parseInt(document.getElementById('radiusMeters').value) || 100
    };

    const { error } = await supabase.from('events').insert([payload]);

    if (error) {
      alert('Gagal menyimpan event: ' + error.message);
    } else {
      alert('Event berhasil ditambahkan!');
      form.reset();
      loadEvents();
    }
  });
}

async function deleteEvent(id) {
  if (!confirm('Yakin ingin menghapus event ini?')) return;

  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) {
    alert('Gagal menghapus: ' + error.message);
  } else {
    loadEvents();
  }
}
