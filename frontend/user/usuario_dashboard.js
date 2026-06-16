const API_URL = window.API_URL || 'http://localhost:3000';

const renderStatusBadge = (status) => {
    const label = (status || 'pendiente').replace('_', ' ');
    return `<span class="badge badge-${status || 'pendiente'}">${label}</span>`;
};

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('usuario'));
    if (!user) {
        window.location.href = '../login/login.html';
        return;
    }

    document.getElementById('user-greeting').textContent = user.nombre;
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = user.nombre;
    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('usuario');
        window.location.href = '../login/login.html';
    };

    const loadStudents = () => {
        const select = document.getElementById('estudiante-select');
        fetch(`${API_URL}/estudiantes/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                data.forEach((est) => {
                    const opt = document.createElement('option');
                    opt.value = est.id;
                    opt.textContent = est.nombre;
                    select.appendChild(opt);
                });
            });
    };

    const loadEnrollments = () => {
        const container = document.getElementById('inscripciones-container');
        fetch(`${API_URL}/inscripciones/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.length === 0) {
                    container.innerHTML = '<p class="empty-state">Sin inscripciones.</p>';
                    return;
                }
                let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Estudiante</th><th>Grado</th><th>Estado</th><th>Fecha</th><th></th></tr></thead><tbody>';
                data.forEach((i) => {
                    const fecha = i.fecha ? new Date(i.fecha).toLocaleDateString('es') : '-';
                    html += `<tr><td>${i.estudiante_nombre}</td><td>${i.grado}</td>
                    <td>${renderStatusBadge(i.estado)}</td><td>${fecha}</td>
                    <td><button class="btn btn-danger btn-sm delete-enrollment-btn" data-id="${i.id}">Borrar</button></td></tr>`;
                });
                container.innerHTML = html + '</tbody></table></div>';

                container.querySelectorAll('.delete-enrollment-btn').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('¿Eliminar esta inscripción?')) return;
                        await fetch(`${API_URL}/inscripciones/${btn.dataset.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ usuario_id: user.id }),
                        });
                        location.reload();
                    });
                });
            });
    };

    const loadAddresses = () => {
        const container = document.getElementById('direcciones-container');
        fetch(`${API_URL}/direcciones/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.length === 0) {
                    container.innerHTML = '<p class="empty-state">Sin direcciones.</p>';
                    return;
                }
                let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Barrio</th><th>Parroquia</th><th>Municipio</th><th>Estado</th></tr></thead><tbody>';
                data.forEach((d) => {
                    html += `<tr><td>${d.barrio || d.sector || '—'}</td><td>${d.parroquia || '—'}</td><td>${d.municipio || '—'}</td><td>${d.estado || d.state || '—'}</td></tr>`;
                });
                container.innerHTML = html + '</tbody></table></div>';
            });
    };

    loadStudents();
    loadEnrollments();
    loadAddresses();

    document.getElementById('estudiante-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.usuario_id = user.id;

        const res = await fetch(`${API_URL}/estudiantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) location.reload();
    };

    document.getElementById('direccion-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.id_user = user.id;

        const res = await fetch(`${API_URL}/direcciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) location.reload();
    };

    document.getElementById('inscripcion-form').onsubmit = async (e) => {
        e.preventDefault();
        const estudiante_id = document.getElementById('estudiante-select').value;

        const res = await fetch(`${API_URL}/inscripciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estudiante_id, usuario_id: user.id }),
        });
        if (res.ok) location.reload();
    };
});