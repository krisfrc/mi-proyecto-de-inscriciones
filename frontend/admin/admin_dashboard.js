const API_URL = window.API_URL || 'http://localhost:3000';

const state = {
    user: null,
    tab: 'preinscritos',
    page: 1,
    pageSize: 10,
    gradeId: '',
    sectionId: '',
    periodId: '',
    query: '',
    grades: [],
    sections: [],
    documentTypes: [],
    representatives: [],
    selectedEnrollmentId: null,
};

const renderStatusBadge = (status) => {
    const label = (status || 'pendiente').replace('_', ' ');
    return `<span class="badge badge-${status || 'pendiente'}">${label}</span>`;
};

const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
    }
    return res.json();
};

const parseResponseError = async (res, fallback) => {
    try {
        const body = await res.json();
        return body.error || fallback;
    } catch {
        return fallback;
    }
};

const buildEnrollmentParams = () => {
    const params = new URLSearchParams({
        usuario_id: String(state.user.id),
        tab: state.tab,
        page: String(state.page),
        page_size: String(state.pageSize),
    });
    if (state.gradeId) params.set('grado_id', state.gradeId);
    if (state.sectionId) params.set('seccion_id', state.sectionId);
    if (state.periodId) params.set('periodo_id', state.periodId);
    if (state.query) params.set('q', state.query);
    return params;
};

const renderPagination = (pagination) => {
    const container = document.getElementById('inscripciones-pagination');
    if (!pagination || pagination.total <= pagination.page_size) {
        container.innerHTML = '';
        return;
    }
    const page = pagination.page;
    const totalPages = pagination.total_pages;
    container.innerHTML = `
        <span>Página ${page} de ${totalPages}</span>
        <div class="pagination-actions">
            <button class="btn btn-outline btn-sm" type="button" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">Anterior</button>
            <button class="btn btn-outline btn-sm" type="button" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">Siguiente</button>
        </div>
    `;
    container.querySelectorAll('button[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.page = Number(btn.dataset.page);
            loadEnrollmentGrid();
        });
    });
};

const renderEnrollmentRows = (rows) => {
    if (!rows.length) {
        return '<p class="empty-state">No hay resultados con esos filtros.</p>';
    }
    let html = `<div class="table-wrapper"><table class="data-table"><thead><tr>
        <th>ID</th><th>Representante</th><th>Cédula</th><th>Estudiante</th><th>Grado</th><th>Sección</th><th>Estado</th><th>Acciones</th>
    </tr></thead><tbody>`;
    rows.forEach((row) => {
        html += `<tr>
            <td>${row.id}</td>
            <td>${row.usuario_nombre} ${row.usuario_apellido}</td>
            <td>${row.usuario_cedula}</td>
            <td>${row.estudiante}</td>
            <td>${row.grado_nombre || '—'}</td>
            <td>${row.seccion_nombre || '—'}</td>
            <td>${renderStatusBadge(row.estado)}</td>
            <td class="table-actions">
                <button class="btn btn-outline btn-sm detail-btn" type="button" data-id="${row.id}">Ver</button>
                <button class="btn btn-outline btn-sm history-btn" type="button" data-id="${row.id}">Historial</button>
            </td>
        </tr>`;
    });
    return html + '</tbody></table></div>';
};

const loadEnrollmentGrid = async () => {
    const container = document.getElementById('inscripciones-container');
    container.innerHTML = '<p class="empty-state">Cargando inscripciones...</p>';
    const params = buildEnrollmentParams();
    try {
        const response = await fetchJson(`${API_URL}/admin/inscripciones?${params.toString()}`);
        container.innerHTML = renderEnrollmentRows(response.rows);
        renderPagination(response.pagination);

        container.querySelectorAll('.detail-btn').forEach((btn) => {
            btn.addEventListener('click', () => openEnrollmentModal(btn.dataset.id));
        });
        container.querySelectorAll('.history-btn').forEach((btn) => {
            btn.addEventListener('click', () => showEnrollmentHistory(btn.dataset.id));
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="empty-state">No se pudo cargar la grilla.</p>';
    }
};

const exportEnrollmentCsv = () => {
    const params = buildEnrollmentParams();
    params.delete('page');
    params.delete('page_size');
    window.open(`${API_URL}/admin/inscripciones/export.csv?${params.toString()}`, '_blank');
};

const printEnrollmentGrid = () => {
    const table = document.querySelector('#inscripciones-container .table-wrapper');
    if (!table) {
        showToast('No hay datos para imprimir', 'error');
        return;
    }
    const popup = window.open('', '_blank', 'width=1000,height=700');
    popup.document.write(`
        <html>
            <head>
                <title>Inscripciones ${state.tab}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 16px; }
                    h2 { margin: 0 0 12px 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #d0d7de; padding: 6px; text-align: left; }
                    th { background: #f6f8fa; text-transform: uppercase; }
                </style>
            </head>
            <body>
                <h2>Listado de ${state.tab}</h2>
                ${table.innerHTML}
            </body>
        </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
};

const showEnrollmentHistory = async (id) => {
    const res = await fetch(`${API_URL}/inscripciones/${id}/historial`);
    const items = await res.json();
    const text = items.map((h) => {
        const date = new Date(h.creado_en).toLocaleString('es');
        return `${date}: ${h.estado_anterior || '—'} → ${h.estado_nuevo}${h.nota ? ` (${h.nota})` : ''}`;
    }).join('\n');
    alert(text || 'Sin historial');
};

const updateEnrollmentStatus = async (enrollmentId, status) => {
    const note = status === 'rechazada'
        ? prompt('Motivo del rechazo (opcional):') || ''
        : '';
    const res = await fetch(`${API_URL}/inscripciones/${enrollmentId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            estado: status,
            observaciones: note,
            usuario_id: state.user.id,
        }),
    });
    if (!res.ok) {
        const msg = await parseResponseError(res, 'No se pudo actualizar el estado');
        showToast(msg, 'error');
        return;
    }
    showToast('Estado actualizado', 'success');
    closeEnrollmentModal();
    loadEnrollmentGrid();
};

const renderDocuments = (documents) => {
    if (!documents.length) {
        return '<p class="empty-state">Sin PDFs cargados para esta preinscripción.</p>';
    }
    let html = '<ul class="document-list">';
    documents.forEach((doc) => {
        html += `<li>
            <span>${doc.tipo_documento || 'Documento'}</span>
            <a href="${window.resolveAssetUrl(doc.ruta_archivo)}" target="_blank" rel="noopener noreferrer">${doc.nombre_archivo}</a>
        </li>`;
    });
    return html + '</ul>';
};

const openEnrollmentModal = async (enrollmentId) => {
    state.selectedEnrollmentId = Number(enrollmentId);
    const backdrop = document.getElementById('enrollment-modal-backdrop');
    const content = document.getElementById('modal-content');
    const approveBtn = document.getElementById('modal-approve-btn');
    const rejectBtn = document.getElementById('modal-reject-btn');
    content.innerHTML = '<p class="empty-state">Cargando detalle...</p>';
    backdrop.classList.add('visible');
    try {
        const [detail, documents] = await Promise.all([
            fetchJson(`${API_URL}/admin/inscripciones/${enrollmentId}/detalle?usuario_id=${state.user.id}`),
            fetchJson(`${API_URL}/admin/inscripciones/${enrollmentId}/documentos?usuario_id=${state.user.id}`),
        ]);
        content.innerHTML = `
            <div class="detail-grid">
                <div><strong>Representante:</strong> ${detail.representante_nombre} ${detail.representante_apellido}</div>
                <div><strong>Cédula:</strong> ${detail.representante_cedula}</div>
                <div><strong>Estudiante:</strong> ${detail.estudiante_nombre}</div>
                <div><strong>Grado:</strong> ${detail.grado_nombre || '—'}</div>
                <div><strong>Sección:</strong> ${detail.seccion_nombre || '—'}</div>
                <div><strong>Período:</strong> ${detail.periodo_nombre || '—'}</div>
                <div class="detail-grid__full"><strong>Dirección:</strong> ${[
                detail.calle,
                detail.av,
                detail.barrio,
                detail.n_casa,
                detail.parroquia,
                detail.municipio,
                detail.direccion_estado,
            ].filter(Boolean).join(', ') || 'No registrada'}</div>
                <div class="detail-grid__full"><strong>Observaciones:</strong> ${detail.observaciones || '—'}</div>
            </div>
            <h4>Documentos PDF</h4>
            ${renderDocuments(documents)}
        `;
        approveBtn.disabled = detail.estado === 'aprobada';
        rejectBtn.disabled = detail.estado === 'rechazada';
    } catch (err) {
        console.error(err);
        content.innerHTML = '<p class="empty-state">No se pudo cargar el detalle.</p>';
    }
};

const uploadModalDocuments = async () => {
    if (!state.selectedEnrollmentId) return;
    const files = document.getElementById('modal-doc-files').files;
    if (!files.length) {
        showToast('Selecciona al menos un PDF', 'error');
        return;
    }
    const docCode = document.getElementById('modal-doc-code').value || null;
    const docType = state.documentTypes.find((doc) => doc.codigo === docCode)?.nombre || 'Documento PDF';
    const form = new FormData();
    form.append('usuario_id', String(state.user.id));
    form.append('tipo_documento', docType);
    if (docCode) form.append('codigo_documento', docCode);
    Array.from(files).forEach((file) => form.append('documentos', file));
    const res = await fetch(`${API_URL}/inscripciones/${state.selectedEnrollmentId}/documentos`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) {
        const msg = await parseResponseError(res, 'No se pudo subir el documento');
        showToast(msg, 'error');
        return;
    }
    showToast('Documento(s) cargado(s)', 'success');
    openEnrollmentModal(state.selectedEnrollmentId);
};

const closeEnrollmentModal = () => {
    document.getElementById('enrollment-modal-backdrop').classList.remove('visible');
    state.selectedEnrollmentId = null;
};

const fillSelect = (select, items, getValue, getLabel, placeholder) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = String(getValue(item));
        opt.textContent = getLabel(item);
        select.appendChild(opt);
    });
    if (current && Array.from(select.options).some((opt) => opt.value === current)) {
        select.value = current;
    }
};

const refreshNamedSectionSelect = (gradeSelectId, sectionSelectId, placeholder) => {
    const gradeSelect = document.getElementById(gradeSelectId);
    const sectionSelect = document.getElementById(sectionSelectId);
    if (!gradeSelect || !sectionSelect) return;
    const gradeId = gradeSelect.value;
    const filtered = gradeId
        ? state.sections.filter((section) => String(section.grado_id) === gradeId)
        : [];
    fillSelect(sectionSelect, filtered, (item) => item.id, (item) => item.nombre, placeholder);
};

const loadCatalogs = async () => {
    const [data, documentTypes] = await Promise.all([
        fetchJson(`${API_URL}/admin/inscripciones/catalogos?usuario_id=${state.user.id}`),
        fetchJson(`${API_URL}/catalogos/documentos`),
    ]);
    state.grades = data.grados;
    state.sections = data.secciones;
    state.documentTypes = documentTypes;

    fillSelect(
        document.getElementById('grade-filter'),
        data.grados,
        (grade) => grade.id,
        (grade) => grade.nombre,
        'Todos'
    );
    fillSelect(
        document.getElementById('operator-grade-select'),
        data.grados,
        (grade) => grade.id,
        (grade) => grade.nombre,
        'Selecciona grado'
    );
    fillSelect(
        document.getElementById('teacher-grade-select'),
        data.grados,
        (grade) => grade.id,
        (grade) => grade.nombre,
        'Sin asignar'
    );

    const periodOptions = data.periodos.map((period) => ({
        ...period,
        label: period.activo ? `${period.nombre} (activo)` : period.nombre,
    }));
    fillSelect(
        document.getElementById('period-filter'),
        periodOptions,
        (period) => period.id,
        (period) => period.label,
        'Todos'
    );
    fillSelect(
        document.getElementById('operator-period-select'),
        periodOptions,
        (period) => period.id,
        (period) => period.label,
        'Período activo'
    );

    const docSelects = ['modal-doc-code', 'operator-doc-code'];
    docSelects.forEach((id) => {
        fillSelect(
            document.getElementById(id),
            state.documentTypes,
            (docType) => docType.codigo,
            (docType) => (docType.obligatorio ? `${docType.nombre} (obligatorio)` : docType.nombre),
            'Selecciona tipo'
        );
    });
    const commitment = state.documentTypes.find((doc) => doc.codigo === 'carta_compromiso');
    if (commitment) {
        const modalDocType = document.getElementById('modal-doc-code');
        const operatorDocType = document.getElementById('operator-doc-code');
        if (modalDocType) modalDocType.value = commitment.codigo;
        if (operatorDocType) operatorDocType.value = commitment.codigo;
    }
};

const refreshSectionOptions = () => {
    const sectionFilter = document.getElementById('section-filter');
    sectionFilter.innerHTML = '<option value="">Todas</option>';
    const filtered = state.gradeId
        ? state.sections.filter((section) => String(section.grado_id) === state.gradeId)
        : state.sections;
    filtered.forEach((section) => {
        const opt = document.createElement('option');
        opt.value = String(section.id);
        opt.textContent = `${section.grado_nombre} - ${section.nombre}`;
        sectionFilter.appendChild(opt);
    });
};

const loadAddresses = async () => {
    const dirContainer = document.getElementById('direcciones-container');
    const res = await fetch(`${API_URL}/admin/direcciones?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (!rows.length) {
        dirContainer.innerHTML = '<p class="empty-state">Sin direcciones.</p>';
        return;
    }
    let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Usuario</th><th>Barrio</th><th>Municipio</th><th>Estado</th><th></th></tr></thead><tbody>';
    rows.forEach((row) => {
        html += `<tr>
            <td>${row.usuario_nombre} ${row.usuario_apellido}</td>
            <td>${row.barrio || '—'}</td>
            <td>${row.municipio || '—'}</td>
            <td>${row.estado || '—'}</td>
            <td><button class="btn btn-danger btn-sm delete-dir-btn" type="button" data-id="${row.id}">Borrar</button></td>
        </tr>`;
    });
    dirContainer.innerHTML = html + '</tbody></table></div>';
    dirContainer.querySelectorAll('.delete-dir-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar dirección?')) return;
            await fetch(`${API_URL}/direcciones/${btn.dataset.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_user: state.user.id }),
            });
            loadAddresses();
        });
    });
};

const loadContacts = async () => {
    const box = document.getElementById('contactos-container');
    const res = await fetch(`${API_URL}/admin/contactos?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (!rows.length) {
        box.innerHTML = '<p class="empty-state">Sin mensajes.</p>';
        return;
    }
    let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nombre</th><th>Mensaje</th><th>Fecha</th></tr></thead><tbody>';
    rows.forEach((row) => {
        html += `<tr>
            <td>${row.nombre}</td>
            <td>${row.mensaje}</td>
            <td>${new Date(row.creado_en).toLocaleString('es')}</td>
        </tr>`;
    });
    box.innerHTML = html + '</tbody></table></div>';
};

const loadUsers = async () => {
    const box = document.getElementById('users-container');
    const res = await fetch(`${API_URL}/admin/usuarios?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (!rows.length) {
        box.innerHTML = '<p class="empty-state">Sin usuarios.</p>';
        return;
    }
    let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nombre</th><th>Cédula</th><th>Rol</th><th>Acción</th></tr></thead><tbody>';
    rows.forEach((row) => {
        html += `<tr>
            <td>${row.nombre} ${row.apellido}</td>
            <td>${row.cedula}</td>
            <td>${row.rol_nombre}</td>
            <td><button type="button" class="btn btn-outline btn-sm reset-pass-btn" data-id="${row.id}">Cambiar clave</button></td>
        </tr>`;
    });
    box.innerHTML = html + '</tbody></table></div>';
    box.querySelectorAll('.reset-pass-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const newPassword = prompt('Nueva contraseña para el usuario:');
            if (!newPassword) return;
            const update = await fetch(`${API_URL}/admin/usuarios/${btn.dataset.id}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: state.user.id, nueva_contraseña: newPassword }),
            });
            if (update.ok) showToast('Contraseña actualizada', 'success');
            else showToast('No se pudo actualizar la contraseña', 'error');
        });
    });
};

const loadInstitutionConfig = async () => {
    const config = await fetchJson(`${API_URL}/admin/configuracion/institucion?usuario_id=${state.user.id}`);
    document.getElementById('institution-name').value = config.nombre || '';
    document.getElementById('institution-primary').value = config.color_primario || '#0d5c63';
    document.getElementById('institution-secondary').value = config.color_secundario || '#e07a5f';
    const preview = document.getElementById('institution-logo-preview');
    if (config.logo_url) {
        preview.src = window.resolveAssetUrl(config.logo_url);
        preview.hidden = false;
    } else {
        preview.removeAttribute('src');
        preview.hidden = true;
    }
    if (config.color_primario) {
        document.documentElement.style.setProperty('--color-primary', config.color_primario);
    }
    if (config.color_secundario) {
        document.documentElement.style.setProperty('--color-accent', config.color_secundario);
    }
    if (config.nombre) {
        const brand = document.querySelector('.brand-name');
        if (brand) brand.textContent = config.nombre;
    }
};

const saveInstitutionConfig = async (e) => {
    e.preventDefault();
    const logoFile = document.getElementById('institution-logo-file').files[0];
    if (logoFile) {
        const logoForm = new FormData();
        logoForm.append('usuario_id', String(state.user.id));
        logoForm.append('logo', logoFile);
        const logoRes = await fetch(`${API_URL}/admin/configuracion/institucion/logo`, {
            method: 'POST',
            body: logoForm,
        });
        if (!logoRes.ok) {
            const msg = await parseResponseError(logoRes, 'No se pudo subir el logo');
            showToast(msg, 'error');
            return;
        }
    }
    const payload = {
        usuario_id: state.user.id,
        nombre: document.getElementById('institution-name').value.trim(),
        color_primario: document.getElementById('institution-primary').value,
        color_secundario: document.getElementById('institution-secondary').value,
    };
    const res = await fetch(`${API_URL}/admin/configuracion/institucion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const msg = await parseResponseError(res, 'No se pudo guardar la configuración');
        showToast(msg, 'error');
        return;
    }
    document.getElementById('institution-logo-file').value = '';
    await loadInstitutionConfig();
    showToast('Configuración de institución guardada', 'success');
};

const loadRepresentatives = async (query = '') => {
    const params = new URLSearchParams({ usuario_id: String(state.user.id) });
    if (query) params.set('q', query);
    const rows = await fetchJson(`${API_URL}/admin/representantes?${params.toString()}`);
    state.representatives = rows;
    fillSelect(
        document.getElementById('operator-rep-select'),
        rows,
        (row) => row.id,
        (row) => `${row.apellido}, ${row.nombre} — ${row.cedula}`,
        rows.length ? 'Selecciona un representante' : 'No hay representantes registrados'
    );
};

const updateOperatorRepresentativeInfo = () => {
    const info = document.getElementById('operator-rep-info');
    const selectedId = document.getElementById('operator-rep-select').value;
    const representative = state.representatives.find((row) => String(row.id) === selectedId);
    if (!representative) {
        info.hidden = true;
        info.innerHTML = '';
        return;
    }
    info.hidden = false;
    info.innerHTML = `
        <strong>Representante cargado:</strong>
        <span>${representative.nombre} ${representative.apellido}</span>
        <span>Cédula ${representative.cedula}</span>
    `;
};

const submitOperatorPreEnrollment = async (e) => {
    e.preventDefault();
    const representanteId = document.getElementById('operator-rep-select').value;
    if (!representanteId) {
        showToast('Primero tenés que elegir el representante', 'error');
        return;
    }
    const docCode = document.getElementById('operator-doc-code').value || '';
    const docType = state.documentTypes.find((doc) => doc.codigo === docCode)?.nombre || 'Documento PDF';
    const form = new FormData();
    form.append('usuario_id', String(state.user.id));
    form.append('representante_id', representanteId);
    form.append('nombre', document.getElementById('operator-student-name').value.trim());
    form.append('cedula', document.getElementById('operator-student-cedula').value.trim());
    form.append('grado_id', document.getElementById('operator-grade-select').value);
    form.append('seccion_id', document.getElementById('operator-section-select').value);
    const periodId = document.getElementById('operator-period-select').value;
    if (periodId) form.append('periodo_id', periodId);
    if (docCode) form.append('codigo_documento', docCode);
    form.append('tipo_documento', docType);
    Array.from(document.getElementById('operator-doc-files').files).forEach((file) => {
        form.append('documentos', file);
    });
    const res = await fetch(`${API_URL}/admin/preinscripciones`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) {
        const msg = await parseResponseError(res, 'No se pudo crear la preinscripción');
        showToast(msg, 'error');
        return;
    }
    e.target.reset();
    updateOperatorRepresentativeInfo();
    refreshNamedSectionSelect('operator-grade-select', 'operator-section-select', 'Selecciona sección');
    const commitment = state.documentTypes.find((doc) => doc.codigo === 'carta_compromiso');
    if (commitment) {
        const operatorDocType = document.getElementById('operator-doc-code');
        if (operatorDocType) operatorDocType.value = commitment.codigo;
    }
    showToast('Preinscripción creada a nombre del representante', 'success');
    state.tab = 'preinscritos';
    document.querySelectorAll('#enrollment-tabs .tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === 'preinscritos');
    });
    state.page = 1;
    loadEnrollmentGrid();
};

const loadTeachers = async () => {
    const box = document.getElementById('teachers-container');
    const res = await fetch(`${API_URL}/admin/docentes?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (!rows.length) {
        box.innerHTML = '<p class="empty-state">Sin docentes registrados.</p>';
        return;
    }
    let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nombre</th><th>Cédula</th><th>Especialidad</th><th>Grado / sección</th><th>Contacto</th><th></th></tr></thead><tbody>';
    rows.forEach((row) => {
        const assignment = [row.grado_nombre, row.seccion_nombre].filter(Boolean).join(' — ') || 'Sin asignar';
        html += `<tr>
            <td>${row.nombre} ${row.apellido}</td>
            <td>${row.cedula}</td>
            <td>${row.especialidad || '—'}</td>
            <td>${assignment}</td>
            <td>${row.telefono || '—'} ${row.email ? ` / ${row.email}` : ''}</td>
            <td><button type="button" class="btn btn-danger btn-sm delete-teacher-btn" data-id="${row.id}">Borrar</button></td>
        </tr>`;
    });
    box.innerHTML = html + '</tbody></table></div>';
    box.querySelectorAll('.delete-teacher-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar docente?')) return;
            await fetch(`${API_URL}/admin/docentes/${btn.dataset.id}?usuario_id=${state.user.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: state.user.id }),
            });
            loadTeachers();
        });
    });
};

const saveTeacher = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.usuario_id = state.user.id;
    data.grado_id = data.grado_id || null;
    data.seccion_id = data.seccion_id || null;
    const res = await fetch(`${API_URL}/admin/docentes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const msg = await parseResponseError(res, 'No se pudo registrar el docente');
        showToast(msg, 'error');
        return;
    }
    e.target.reset();
    refreshNamedSectionSelect('teacher-grade-select', 'teacher-section-select', 'Sin asignar');
    showToast('Docente registrado', 'success');
    loadTeachers();
};

const bindEvents = () => {
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.href = '../login/login.html';
    });

    document.getElementById('grade-filter').addEventListener('change', (e) => {
        state.gradeId = e.target.value;
        state.sectionId = '';
        refreshSectionOptions();
        state.page = 1;
        loadEnrollmentGrid();
    });
    document.getElementById('section-filter').addEventListener('change', (e) => {
        state.sectionId = e.target.value;
        state.page = 1;
        loadEnrollmentGrid();
    });
    document.getElementById('period-filter').addEventListener('change', (e) => {
        state.periodId = e.target.value;
        state.page = 1;
        loadEnrollmentGrid();
    });
    document.getElementById('search-filter').addEventListener('input', (e) => {
        state.query = e.target.value.trim();
        state.page = 1;
        loadEnrollmentGrid();
    });

    document.querySelectorAll('#enrollment-tabs .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#enrollment-tabs .tab-btn').forEach((el) => el.classList.remove('active'));
            btn.classList.add('active');
            state.tab = btn.dataset.tab;
            state.page = 1;
            loadEnrollmentGrid();
        });
    });

    document.getElementById('modal-close-btn').addEventListener('click', closeEnrollmentModal);
    document.getElementById('enrollment-modal-backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'enrollment-modal-backdrop') closeEnrollmentModal();
    });
    document.getElementById('modal-approve-btn').addEventListener('click', () => {
        if (!state.selectedEnrollmentId) return;
        updateEnrollmentStatus(state.selectedEnrollmentId, 'aprobada');
    });
    document.getElementById('modal-reject-btn').addEventListener('click', () => {
        if (!state.selectedEnrollmentId) return;
        updateEnrollmentStatus(state.selectedEnrollmentId, 'rechazada');
    });
    document.getElementById('export-csv-btn').addEventListener('click', exportEnrollmentCsv);
    document.getElementById('print-grid-btn').addEventListener('click', printEnrollmentGrid);
    document.getElementById('modal-upload-docs-btn').addEventListener('click', uploadModalDocuments);
    document.getElementById('institution-form').addEventListener('submit', saveInstitutionConfig);
    document.getElementById('teacher-form').addEventListener('submit', saveTeacher);
    document.getElementById('operator-form').addEventListener('submit', submitOperatorPreEnrollment);
    document.getElementById('operator-rep-select').addEventListener('change', updateOperatorRepresentativeInfo);
    document.getElementById('operator-grade-select').addEventListener('change', () => {
        refreshNamedSectionSelect('operator-grade-select', 'operator-section-select', 'Selecciona sección');
    });
    document.getElementById('teacher-grade-select').addEventListener('change', () => {
        refreshNamedSectionSelect('teacher-grade-select', 'teacher-section-select', 'Sin asignar');
    });
    let representativeSearchTimer = null;
    document.getElementById('operator-rep-search').addEventListener('input', (e) => {
        clearTimeout(representativeSearchTimer);
        representativeSearchTimer = setTimeout(() => {
            loadRepresentatives(e.target.value.trim()).then(updateOperatorRepresentativeInfo);
        }, 250);
    });
    document.getElementById('institution-logo-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('institution-logo-preview');
        if (!file) return;
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    state.user = JSON.parse(localStorage.getItem('usuario'));
    if (!state.user || state.user.rol_id !== 1) {
        window.location.href = '../login/login.html';
        return;
    }

    document.getElementById('user-greeting').textContent = state.user.nombre;
    bindEvents();
    try {
        await loadCatalogs();
        refreshSectionOptions();
        refreshNamedSectionSelect('operator-grade-select', 'operator-section-select', 'Selecciona sección');
        refreshNamedSectionSelect('teacher-grade-select', 'teacher-section-select', 'Sin asignar');
        await Promise.all([
            loadEnrollmentGrid(),
            loadAddresses(),
            loadContacts(),
            loadUsers(),
            loadInstitutionConfig(),
            loadTeachers(),
            loadRepresentatives(),
        ]);
    } catch (err) {
        console.error(err);
        showToast('No se pudieron cargar datos de administración', 'error');
    }
});
