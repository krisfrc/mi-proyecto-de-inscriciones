const API_URL = window.API_URL || 'http://localhost:3000';
const dashboardState = { grades: [], sections: [], documentTypes: [] };

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
    const representativeChip = document.getElementById('representative-loaded');
    if (representativeChip) {
        representativeChip.innerHTML = `
            <strong>Representante:</strong>
            <span>${user.nombre} ${user.apellido || ''}</span>
            <span>Cédula ${user.cedula}</span>
            <span>Ya cargado — no hace falta volver a pedirlo</span>
        `;
    }
    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('usuario');
        window.location.href = '../login/login.html';
    };

    const loadStudents = () => {
        const select = document.getElementById('estudiante-select');
        select.innerHTML = '<option value="">Selecciona un estudiante</option>';
        fetch(`${API_URL}/estudiantes/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                data.forEach((est) => {
                    const opt = document.createElement('option');
                    opt.value = est.id;
                    const gradeName = est.grado_nombre || est.grado || 'Sin grado';
                    const sectionName = est.seccion_nombre ? ` - ${est.seccion_nombre}` : '';
                    opt.textContent = `${est.nombre} (${gradeName}${sectionName})`;
                    select.appendChild(opt);
                });
            });
    };

    const populateAcademicCatalog = () => {
        Promise.all([
            fetch(`${API_URL}/catalogos/escolares`).then((res) => res.json()),
            fetch(`${API_URL}/catalogos/documentos`).then((res) => res.json()),
        ])
            .then(([catalog, documentTypes]) => {
                dashboardState.grades = catalog.grados || [];
                dashboardState.sections = catalog.secciones || [];
                dashboardState.documentTypes = documentTypes || [];

                const gradeSelect = document.getElementById('student-grade-select');
                const periodSelect = document.getElementById('period-select');
                const docCodeSelect = document.getElementById('doc-code');
                dashboardState.grades.forEach((grade) => {
                    const opt = document.createElement('option');
                    opt.value = String(grade.id);
                    opt.textContent = grade.nombre;
                    gradeSelect.appendChild(opt);
                });

                (catalog.periodos || []).forEach((period) => {
                    const opt = document.createElement('option');
                    opt.value = String(period.id);
                    opt.textContent = period.activo ? `${period.nombre} (activo)` : period.nombre;
                    periodSelect.appendChild(opt);
                });

                dashboardState.documentTypes.forEach((docType) => {
                    const opt = document.createElement('option');
                    opt.value = docType.codigo;
                    opt.textContent = docType.obligatorio ? `${docType.nombre} (obligatorio)` : docType.nombre;
                    docCodeSelect.appendChild(opt);
                });
                const commitment = dashboardState.documentTypes.find((doc) => doc.codigo === 'carta_compromiso');
                if (commitment) docCodeSelect.value = commitment.codigo;
            });
    };

    const refreshSections = () => {
        const gradeSelect = document.getElementById('student-grade-select');
        const sectionSelect = document.getElementById('student-section-select');
        const gradeText = document.getElementById('student-grade-text');
        const selectedGradeId = gradeSelect.value;
        const grade = dashboardState.grades.find((item) => String(item.id) === selectedGradeId);
        gradeText.value = grade ? grade.nombre : '';
        sectionSelect.innerHTML = '<option value="">Selecciona sección</option>';
        if (!selectedGradeId) return;
        dashboardState.sections
            .filter((item) => String(item.grado_id) === selectedGradeId)
            .forEach((section) => {
                const opt = document.createElement('option');
                opt.value = String(section.id);
                opt.textContent = section.nombre;
                sectionSelect.appendChild(opt);
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
    populateAcademicCatalog();

    document.getElementById('student-grade-select').addEventListener('change', refreshSections);

    document.getElementById('estudiante-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.usuario_id = user.id;
        if (!data.cedula) delete data.cedula;

        const res = await fetch(`${API_URL}/estudiantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            location.reload();
            return;
        }
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'No se pudo crear el estudiante', 'error');
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
        const periodo_id = document.getElementById('period-select').value || null;
        const selectedDocCode = document.getElementById('doc-code').value || null;
        const selectedDoc = dashboardState.documentTypes.find((doc) => doc.codigo === selectedDocCode);
        const docTypeLabel = selectedDoc?.nombre || 'Documento PDF';
        const files = document.getElementById('doc-files').files;

        const res = await fetch(`${API_URL}/inscripciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estudiante_id, usuario_id: user.id, periodo_id }),
        });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'No se pudo crear la preinscripción', 'error');
            return;
        }

        const created = await res.json();
        if (files.length) {
            const docsForm = new FormData();
            docsForm.append('usuario_id', String(user.id));
            docsForm.append('tipo_documento', docTypeLabel);
            if (selectedDocCode) docsForm.append('codigo_documento', selectedDocCode);
            Array.from(files).forEach((file) => docsForm.append('documentos', file));
            const docsRes = await fetch(`${API_URL}/inscripciones/${created.id}/documentos`, {
                method: 'POST',
                body: docsForm,
            });
            if (!docsRes.ok) {
                showToast('Preinscripción creada, pero falló la carga de PDFs', 'error');
                return;
            }
        }
        showToast('Preinscripción enviada', 'success');
        location.reload();
    };
});
