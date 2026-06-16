const API_URL = window.API_URL || 'http://localhost:3000';

const renderStatusBadge = (status) => {
    const label = (status || 'pendiente').replace('_', ' ');
    return `<span class="badge badge-${status || 'pendiente'}">${label}</span>`;
};

const updateEnrollmentStatus = async (enrollmentId, status, user) => {
    const observaciones = status === 'rechazada'
        ? prompt('Motivo del rechazo (opcional):') || ''
        : '';
    const res = await fetch(`${API_URL}/inscripciones/${enrollmentId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: status, observaciones, usuario_id: user.id }),
    });
    if (res.ok) {
        showToast('Estado actualizado', 'success');
        setTimeout(() => location.reload(), 500);
    } else showToast('No se pudo actualizar', 'error');
};

const viewEnrollmentHistory = async (id) => {
    const res = await fetch(`${API_URL}/inscripciones/${id}/historial`);
    const items = await res.json();
    const texto = items.map((h) => {
        const cuando = new Date(h.creado_en).toLocaleString('es');
        return `${cuando}: ${h.estado_anterior || '—'} → ${h.estado_nuevo}${h.nota ? ' (' + h.nota + ')' : ''}`;
    }).join('\n');
    alert(texto || 'Sin historial');
};

const loadEnrollments = (user) => {
    const container = document.getElementById('inscripciones-container');
    fetch(`${API_URL}/admin/inscripciones?usuario_id=${user.id}`)
        .then((res) => res.json())
        .then((inscripciones) => {
            if (inscripciones.length === 0) {
                container.innerHTML = '<p class="empty-state">No hay inscripciones.</p>';
                return;
            }
            let html = `<div class="table-wrapper"><table class="data-table"><thead><tr>
                <th>ID</th><th>Familia</th><th>Estudiante</th><th>Grado</th><th>Estado</th><th>Flujo</th><th></th>
            </tr></thead><tbody>`;
            inscripciones.forEach((i) => {
                html += `<tr>
                    <td>${i.id}</td>
                    <td>${i.usuario_nombre} ${i.usuario_apellido}</td>
                    <td>${i.estudiante}</td>
                    <td>${i.grado}</td>
                    <td>${renderStatusBadge(i.estado)}</td>
                    <td>
                        <select class="estado-select" data-id="${i.id}">
                            <option value="">Cambiar a…</option>
                            <option value="en_revision">En revisión</option>
                            <option value="aprobada">Aprobada</option>
                            <option value="rechazada">Rechazada</option>
                            <option value="pendiente">Pendiente</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-outline btn-sm historial-btn" data-id="${i.id}">Historial</button>
                        <button class="btn btn-danger btn-sm delete-inscr-btn" data-id="${i.id}">Borrar</button>
                    </td>
                </tr>`;
            });
            container.innerHTML = html + '</tbody></table></div>';

            container.querySelectorAll('.estado-select').forEach((sel) => {
                sel.addEventListener('change', (e) => {
                    const status = e.target.value;
                    if (!status) return;
                    updateEnrollmentStatus(e.target.dataset.id, status, user);
                });
            });
            container.querySelectorAll('.historial-btn').forEach((btn) => {
                btn.addEventListener('click', () => viewEnrollmentHistory(btn.dataset.id));
            });
            container.querySelectorAll('.delete-inscr-btn').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Eliminar inscripción?')) return;
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

const loadAddresses = (user) => {
    const dirContainer = document.getElementById('direcciones-container');
    fetch(`${API_URL}/admin/direcciones?usuario_id=${user.id}`)
        .then((res) => res.json())
        .then((direcciones) => {
            if (direcciones.length === 0) {
                dirContainer.innerHTML = '<p class="empty-state">Sin direcciones.</p>';
                return;
            }
            let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Usuario</th><th>Barrio</th><th>Municipio</th><th>Estado</th><th></th></tr></thead><tbody>';
            direcciones.forEach((d) => {
                html += `<tr>
                    <td>${d.usuario_nombre} ${d.usuario_apellido}</td>
                    <td>${d.barrio || d.sector || '—'}</td>
                    <td>${d.municipio || '—'}</td>
                    <td>${d.estado || d.state || '—'}</td>
                    <td><button class="btn btn-danger btn-sm delete-dir-btn" data-id="${d.id}">Borrar</button></td>
                </tr>`;
            });
            dirContainer.innerHTML = html + '</tbody></table></div>';
            dirContainer.querySelectorAll('.delete-dir-btn').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Eliminar dirección?')) return;
                    await fetch(`${API_URL}/direcciones/${btn.dataset.id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id_user: user.id }),
                    });
                    location.reload();
                });
            });
        });
};

const loadContacts = (user) => {
    const box = document.getElementById('contactos-container');
    if (!box) return;
    fetch(`${API_URL}/admin/contactos?usuario_id=${user.id}`)
        .then((res) => res.json())
        .then((rows) => {
            if (!rows.length) {
                box.innerHTML = '<p class="empty-state">Sin mensajes.</p>';
                return;
            }
            let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nombre</th><th>Mensaje</th><th>Fecha</th></tr></thead><tbody>';
            rows.forEach((c) => {
                html += `<tr>
                    <td>${c.nombre}</td>
                    <td>${c.mensaje}</td>
                    <td>${new Date(c.creado_en).toLocaleString('es')}</td>
                </tr>`;
            });
            box.innerHTML = html + '</tbody></table></div>';
        });
};

const setupForms = (user) => {
    document.getElementById('estudiante-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.usuario_id = user.id;
        const res = await fetch(`${API_URL}/estudiantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) location.reload();
    });

    const estudianteSelect = document.getElementById('estudiante-select');
    fetch(`${API_URL}/estudiantes`)
        .then((res) => res.json())
        .then((estudiantes) => {
            estudiantes.forEach((est) => {
                const opt = document.createElement('option');
                opt.value = est.id;
                opt.textContent = `${est.nombre} (${est.grado})`;
                estudianteSelect.appendChild(opt);
            });
        });

    document.getElementById('inscripcion-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_URL}/inscripciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estudiante_id: estudianteSelect.value,
                usuario_id: user.id,
            }),
        });
        if (res.ok) location.reload();
        else alert('Error al inscribir');
    });

    document.getElementById('direccion-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.id_user = user.id;
        data.av = data.av || '';
        const res = await fetch(`${API_URL}/direcciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) location.reload();
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('usuario'));

    if (!user || user.rol_id !== 1) {
        window.location.href = '../login/login.html';
        return;
    }

    document.getElementById('user-greeting').textContent = user.nombre;
    const sub = document.getElementById('admin-subtitle');
    if (sub) sub.textContent = `Hola ${user.nombre}, gestioná inscripciones y mensajes.`;
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.href = '../login/login.html';
    });

    loadEnrollments(user);
    loadAddresses(user);
    loadContacts(user);
    setupForms(user);
});