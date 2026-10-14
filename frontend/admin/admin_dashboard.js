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

const grids = {};

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

const setEnrollmentToolbar = (row) => {
    const has = Boolean(row);
    const viewBtn = document.getElementById('enrollment-view-btn');
    const approveBtn = document.getElementById('enrollment-approve-btn');
    const rejectBtn = document.getElementById('enrollment-reject-btn');
    if (viewBtn) viewBtn.disabled = !has;
    if (approveBtn) approveBtn.disabled = !has || row.estado === 'aprobada';
    if (rejectBtn) rejectBtn.disabled = !has || row.estado === 'rechazada';
};

const renderEnrollmentRows = (rows) => {
    if (!rows.length) {
        return '<p class="empty-state">No hay resultados con esos filtros.</p>';
    }
    let html = `<div class="table-responsive data-grid-wrap"><table class="table table-striped table-hover table-sm align-middle data-grid"><thead class="table-light"><tr>
        <th>ID</th><th>Representante</th><th>Cédula</th><th>Estudiante</th><th>Grado</th><th>Sección</th><th>Estado</th>
    </tr></thead><tbody>`;
    rows.forEach((row) => {
        const selected = Number(state.selectedEnrollmentId) === Number(row.id);
        html += `<tr data-id="${row.id}" class="${selected ? 'table-primary is-selected' : ''}">
            <td>${row.id}</td>
            <td>${row.usuario_nombre} ${row.usuario_apellido}</td>
            <td>${row.usuario_cedula}</td>
            <td>${row.estudiante}</td>
            <td>${row.grado_nombre || '—'}</td>
            <td>${row.seccion_nombre || '—'}</td>
            <td>${renderStatusBadge(row.estado)}</td>
        </tr>`;
    });
    return html + '</tbody></table></div>';
};

const loadEnrollmentGrid = async () => {
    const container = document.getElementById('inscripciones-container');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">Cargando inscripciones...</p>';
    const params = buildEnrollmentParams();
    try {
        const response = await fetchJson(`${API_URL}/admin/inscripciones?${params.toString()}`);
        container.innerHTML = renderEnrollmentRows(response.rows);
        renderPagination(response.pagination);
        state.enrollmentRows = response.rows || [];
        setEnrollmentToolbar(state.enrollmentRows.find((row) => Number(row.id) === Number(state.selectedEnrollmentId)) || null);
        container.querySelectorAll('tbody tr').forEach((tr) => {
            tr.addEventListener('click', () => {
                state.selectedEnrollmentId = Number(tr.dataset.id);
                const row = state.enrollmentRows.find((item) => Number(item.id) === state.selectedEnrollmentId);
                setEnrollmentToolbar(row);
                container.querySelectorAll('tbody tr').forEach((el) => el.classList.toggle('is-selected', el === tr));
                container.querySelectorAll('tbody tr').forEach((el) => el.classList.toggle('table-primary', el === tr));
            });
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
    showAlert(text || 'Sin historial', 'Historial');
};

const updateEnrollmentStatus = async (enrollmentId, status) => {
    let note = '';
    if (status === 'rechazada') {
        const typed = await showPrompt('Motivo del rechazo (opcional):', 'Rechazar inscripción');
        if (typed === null) return;
        note = typed;
    }
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
    const backdrop = document.getElementById('enrollment-modal-backdrop');
    if (backdrop) backdrop.classList.remove('visible');
    state.selectedEnrollmentId = null;
};

const fillSelect = (select, items, getValue, getLabel, placeholder, getDisabled) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = String(getValue(item));
        opt.textContent = getLabel(item);
        if (typeof getDisabled === 'function' && getDisabled(item)) {
            opt.disabled = true;
        }
        select.appendChild(opt);
    });
    if (current && Array.from(select.options).some((opt) => opt.value === current)) {
        select.value = current;
    }
};

const updateOperatorCupoHint = () => {
    const hint = document.getElementById('operator-cupo-hint');
    const sectionSelect = document.getElementById('operator-section-select');
    if (!hint || !sectionSelect) return;
    const section = state.sections.find((item) => String(item.id) === sectionSelect.value);
    if (!section) {
        hint.textContent = 'Cada aula tiene un cupo máximo.';
        return;
    }
    const quota = window.formatSectionQuota(section);
    hint.textContent = quota.full
        ? `Sin cupo: ${quota.ocupados} de ${quota.cupo} lugares ocupados.`
        : `Disponibles: ${quota.disponibles} de ${quota.cupo} cupos.`;
};

const refreshNamedSectionSelect = (gradeSelectId, sectionSelectId, placeholder, withQuota = false) => {
    const gradeSelect = document.getElementById(gradeSelectId);
    const sectionSelect = document.getElementById(sectionSelectId);
    if (!gradeSelect || !sectionSelect) return;
    const gradeId = gradeSelect.value;
    const filtered = gradeId
        ? state.sections.filter((section) => String(section.grado_id) === gradeId)
        : [];
    fillSelect(
        sectionSelect,
        filtered,
        (item) => item.id,
        (item) => (withQuota ? window.formatSectionQuota(item).label : item.nombre),
        placeholder,
        withQuota ? (item) => window.formatSectionQuota(item).full : undefined
    );
    if (!sectionSelect.value && filtered.length === 1) {
        sectionSelect.value = String(filtered[0].id);
    }
    if (withQuota) updateOperatorCupoHint();
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
    if (grids.cupos) grids.cupos.setRows(state.sections || []);

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
    if (!sectionFilter) return;
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
    if (!dirContainer) return;
    const res = await fetch(`${API_URL}/admin/direcciones?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (grids.addresses) {
        grids.addresses.setRows(rows || []);
        return;
    }
    dirContainer.innerHTML = rows.length
        ? rows.map((row) => `${row.usuario_nombre} — ${row.barrio || '—'}`).join('<br>')
        : '<p class="empty-state">Sin direcciones.</p>';
};

const loadAvisos = async () => {
    const box = document.getElementById('avisos-container');
    if (!box) return;
    const res = await fetch(`${API_URL}/admin/avisos?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (grids.avisos) {
        grids.avisos.setRows(rows || []);
        return;
    }
    box.innerHTML = '<p class="empty-state">Sin avisos enviados.</p>';
};

const saveAviso = async (e) => {
    e.preventDefault();
    const payload = {
        usuario_id: state.user.id,
        titulo: document.getElementById('aviso-titulo').value.trim(),
        mensaje: document.getElementById('aviso-mensaje').value.trim(),
    };
    const res = await fetch(`${API_URL}/admin/avisos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const msg = await parseResponseError(res, 'No se pudo enviar el aviso');
        showToast(msg, 'error');
        return;
    }
    e.target.reset();
    showToast('Aviso enviado a todos los representantes', 'success');
    loadAvisos();
};

const loadContacts = async () => {
    const box = document.getElementById('contactos-container');
    if (!box) return;
    const res = await fetch(`${API_URL}/admin/contactos?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (grids.contacts) {
        grids.contacts.setRows(rows || []);
        return;
    }
    box.innerHTML = '<p class="empty-state">Sin mensajes.</p>';
};

const loadUsers = async () => {
    const box = document.getElementById('users-container');
    if (!box) return;
    const res = await fetch(`${API_URL}/admin/usuarios?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (grids.users) {
        grids.users.setRows(rows || []);
        return;
    }
    box.innerHTML = '<p class="empty-state">Sin usuarios.</p>';
};

const loadInstitutionConfig = async () => {
    const nameInput = document.getElementById('institution-name');
    if (!nameInput) return;
    const config = await fetchJson(`${API_URL}/admin/configuracion/institucion?usuario_id=${state.user.id}`);
    nameInput.value = config.nombre || '';
    const preview = document.getElementById('institution-logo-preview');
    if (config.logo_url) {
        preview.src = window.resolveAssetUrl(config.logo_url);
        preview.hidden = false;
    } else {
        preview.removeAttribute('src');
        preview.hidden = true;
    }
    if (window.applyInstitutionTheme) window.applyInstitutionTheme(config);
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
    const saved = await res.json();
    document.getElementById('institution-logo-file').value = '';
    await loadInstitutionConfig();
    if (window.applyInstitutionTheme) window.applyInstitutionTheme(saved);
    showToast('Configuración de institución guardada', 'success');
};

const loadRepresentatives = async (query = '') => {
    if (!document.getElementById('operator-rep-select')) return;
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
    if (!info) return;
    const select = document.getElementById('operator-rep-select');
    const selectedId = select ? select.value : '';
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
    await loadCatalogs();
    refreshNamedSectionSelect('operator-grade-select', 'operator-section-select', 'Selecciona sección', true);
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
    if (!box) return;
    const res = await fetch(`${API_URL}/admin/docentes?usuario_id=${state.user.id}`);
    const rows = await res.json();
    if (grids.teachers) {
        grids.teachers.setRows(rows || []);
        return;
    }
    box.innerHTML = '<p class="empty-state">Sin docentes registrados.</p>';
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

const on = (id, event, handler) => {
    const node = document.getElementById(id);
    if (node) node.addEventListener(event, handler);
};

const bindEvents = () => {
    on('grade-filter', 'change', (e) => {
        state.gradeId = e.target.value;
        state.sectionId = '';
        refreshSectionOptions();
        state.page = 1;
        loadEnrollmentGrid();
    });
    on('section-filter', 'change', (e) => {
        state.sectionId = e.target.value;
        state.page = 1;
        loadEnrollmentGrid();
    });
    on('period-filter', 'change', (e) => {
        state.periodId = e.target.value;
        state.page = 1;
        loadEnrollmentGrid();
    });
    on('search-filter', 'input', (e) => {
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

    on('modal-close-btn', 'click', closeEnrollmentModal);
    on('enrollment-modal-backdrop', 'click', (e) => {
        if (e.target.id === 'enrollment-modal-backdrop') closeEnrollmentModal();
    });
    on('modal-approve-btn', 'click', () => {
        if (!state.selectedEnrollmentId) return;
        updateEnrollmentStatus(state.selectedEnrollmentId, 'aprobada');
    });
    on('modal-reject-btn', 'click', () => {
        if (!state.selectedEnrollmentId) return;
        updateEnrollmentStatus(state.selectedEnrollmentId, 'rechazada');
    });
    on('export-csv-btn', 'click', exportEnrollmentCsv);
    on('print-grid-btn', 'click', printEnrollmentGrid);
    on('modal-upload-docs-btn', 'click', uploadModalDocuments);
    on('institution-form', 'submit', saveInstitutionConfig);
    on('aviso-form', 'submit', saveAviso);
    on('teacher-form', 'submit', saveTeacher);
    on('operator-form', 'submit', submitOperatorPreEnrollment);
    on('operator-rep-select', 'change', updateOperatorRepresentativeInfo);
    on('operator-grade-select', 'change', () => {
        refreshNamedSectionSelect('operator-grade-select', 'operator-section-select', 'Selecciona sección', true);
    });
    on('operator-section-select', 'change', updateOperatorCupoHint);
    on('teacher-grade-select', 'change', () => {
        refreshNamedSectionSelect('teacher-grade-select', 'teacher-section-select', 'Sin asignar');
    });
    let representativeSearchTimer = null;
    on('operator-rep-search', 'input', (e) => {
        clearTimeout(representativeSearchTimer);
        representativeSearchTimer = setTimeout(() => {
            loadRepresentatives(e.target.value.trim()).then(updateOperatorRepresentativeInfo);
        }, 250);
    });
    on('institution-logo-file', 'change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('institution-logo-preview');
        if (!file || !preview) return;
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

    const greeting = document.getElementById('user-greeting');
    if (greeting) greeting.textContent = state.user.nombre;

    const showAdminPanel = (panelId) => {
        const valid = ['inscripciones', 'preinscribir', 'docentes', 'direcciones', 'mensajes', 'configuracion'];
        const id = valid.includes(panelId) ? panelId : 'inscripciones';
        document.querySelectorAll('.admin-panel').forEach((panel) => {
            panel.classList.toggle('is-active', panel.id === `panel-${id}`);
        });
        document.querySelectorAll('[data-panel]').forEach((link) => {
            link.classList.toggle('active', link.dataset.panel === id);
            link.classList.toggle('is-active', link.classList.contains('header-config-btn') && id === 'configuracion');
        });
        const nextHash = `#${id}`;
        if (location.hash !== nextHash) {
            history.replaceState({ panel: id }, '', `${location.pathname}${nextHash}`);
        }
        window.scrollTo(0, 0);
    };

    const mobileNav = document.getElementById('admin-mobile-nav');
    if (mobileNav && !mobileNav.innerHTML.trim()) {
        mobileNav.innerHTML = `<ul>
            <li><button type="button" data-panel="inscripciones">Inscripciones</button></li>
            <li><button type="button" data-panel="preinscribir">Preinscribir</button></li>
            <li><button type="button" data-panel="docentes">Docentes</button></li>
            <li><button type="button" data-panel="direcciones">Direcciones</button></li>
            <li><button type="button" data-panel="mensajes">Mensajes</button></li>
        </ul>`;
    }

    document.querySelectorAll('[data-panel]').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showAdminPanel(link.dataset.panel);
            const menu = document.getElementById('admin-config-menu');
            if (menu) menu.hidden = true;
        });
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('usuario');
            window.location.href = '../login/login.html';
        });
    }

    if (document.querySelector('.admin-panel')) {
        showAdminPanel((location.hash || '#inscripciones').replace('#', ''));
        window.addEventListener('popstate', () => {
            showAdminPanel((location.hash || '#inscripciones').replace('#', ''));
        });
    }

    bindConfigMenu(document.getElementById('admin-config-toggle'), document.getElementById('admin-config-menu'));
    document.querySelectorAll('[data-config-goto]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const map = { usuarios: 'config-usuarios', cupos: 'config-cupos', institucion: 'configuraciones' };
            const target = document.getElementById(map[btn.dataset.configGoto] || 'configuraciones');
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    if (window.createDataGrid) {
        grids.teachers = createDataGrid({
            container: document.getElementById('teachers-container'),
            footer: document.getElementById('teachers-grid-footer'),
            searchInput: document.getElementById('teachers-search'),
            emptyText: 'Sin docentes registrados.',
            columns: [
                { key: 'nombre', label: 'Nombre', value: (row) => `${row.nombre} ${row.apellido}` },
                { key: 'cedula', label: 'Cédula' },
                { key: 'especialidad', label: 'Especialidad', value: (row) => row.especialidad || '—' },
                { key: 'asignacion', label: 'Grado / sección', value: (row) => [row.grado_nombre, row.seccion_nombre].filter(Boolean).join(' — ') || 'Sin asignar' },
            ],
            onSelect: (row) => {
                const btn = document.getElementById('teacher-delete-btn');
                if (btn) btn.disabled = !row;
            },
        });
        grids.addresses = createDataGrid({
            container: document.getElementById('direcciones-container'),
            footer: document.getElementById('admin-address-footer'),
            searchInput: document.getElementById('admin-address-search'),
            emptyText: 'Sin direcciones.',
            columns: [
                { key: 'usuario', label: 'Usuario', value: (row) => `${row.usuario_nombre} ${row.usuario_apellido}` },
                { key: 'barrio', label: 'Barrio', value: (row) => row.barrio || '—' },
                { key: 'municipio', label: 'Municipio', value: (row) => row.municipio || '—' },
                { key: 'estado', label: 'Estado', value: (row) => row.estado || '—' },
            ],
            onSelect: (row) => {
                const btn = document.getElementById('admin-address-delete-btn');
                if (btn) btn.disabled = !row;
            },
        });
        grids.avisos = createDataGrid({
            container: document.getElementById('avisos-container'),
            footer: document.getElementById('avisos-grid-footer'),
            searchInput: document.getElementById('avisos-search'),
            emptyText: 'Sin avisos enviados.',
            columns: [
                { key: 'titulo', label: 'Título' },
                { key: 'mensaje', label: 'Mensaje' },
                { key: 'fecha', label: 'Fecha', value: (row) => new Date(row.creado_en).toLocaleString('es') },
            ],
        });
        grids.cupos = createDataGrid({
            container: document.getElementById('cupos-container'),
            footer: document.getElementById('cupos-grid-footer'),
            searchInput: document.getElementById('cupos-search'),
            emptyText: 'Sin aulas.',
            columns: [
                { key: 'grado_nombre', label: 'Grado' },
                { key: 'nombre', label: 'Aula' },
                { key: 'cupo', label: 'Cupo' },
                { key: 'ocupados', label: 'Ocupados' },
                { key: 'disponibles', label: 'Disponibles' },
            ],
            onSelect: (row) => {
                const btn = document.getElementById('cupo-edit-btn');
                if (btn) btn.disabled = !row;
            },
        });
        grids.contacts = createDataGrid({
            container: document.getElementById('contactos-container'),
            footer: document.getElementById('contacts-grid-footer'),
            searchInput: document.getElementById('contacts-search'),
            emptyText: 'Sin mensajes.',
            columns: [
                { key: 'nombre', label: 'Nombre' },
                { key: 'mensaje', label: 'Mensaje' },
                { key: 'fecha', label: 'Fecha', value: (row) => new Date(row.creado_en).toLocaleString('es') },
            ],
        });
        grids.users = createDataGrid({
            container: document.getElementById('users-container'),
            footer: document.getElementById('users-grid-footer'),
            searchInput: document.getElementById('users-search'),
            emptyText: 'Sin usuarios.',
            columns: [
                { key: 'nombre', label: 'Nombre', value: (row) => `${row.nombre} ${row.apellido}` },
                { key: 'cedula', label: 'Cédula' },
                { key: 'email', label: 'Correo', value: (row) => row.email || '—' },
                { key: 'rol_nombre', label: 'Rol' },
            ],
            onSelect: (row) => {
                const btn = document.getElementById('user-password-btn');
                if (btn) btn.disabled = !row;
            },
        });
    }

    on('enrollment-view-btn', 'click', () => {
        if (state.selectedEnrollmentId) openEnrollmentModal(state.selectedEnrollmentId);
    });
    on('enrollment-approve-btn', 'click', async () => {
        if (!state.selectedEnrollmentId) return;
        const ok = await showConfirm('¿Aprobar esta inscripción?', 'Aprobar');
        if (ok) updateEnrollmentStatus(state.selectedEnrollmentId, 'aprobada');
    });
    on('enrollment-reject-btn', 'click', async () => {
        if (!state.selectedEnrollmentId) return;
        const ok = await showConfirm('¿Rechazar esta inscripción?', 'Rechazar');
        if (ok) updateEnrollmentStatus(state.selectedEnrollmentId, 'rechazada');
    });
    on('teacher-delete-btn', 'click', async () => {
        const row = grids.teachers?.getSelected();
        if (!row) return;
        const ok = await showConfirm(`¿Eliminar al docente ${row.nombre} ${row.apellido}?`, 'Borrar docente');
        if (!ok) return;
        await fetch(`${API_URL}/admin/docentes/${row.id}?usuario_id=${state.user.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: state.user.id }),
        });
        loadTeachers();
    });
    on('admin-address-delete-btn', 'click', async () => {
        const row = grids.addresses?.getSelected();
        if (!row) return;
        const ok = await showConfirm('¿Eliminar esta dirección?', 'Borrar dirección');
        if (!ok) return;
        await fetch(`${API_URL}/direcciones/${row.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_user: state.user.id }),
        });
        loadAddresses();
    });
    on('cupo-edit-btn', 'click', async () => {
        const row = grids.cupos?.getSelected();
        if (!row) return;
        const typed = await showPrompt(
            `${row.grado_nombre} ${row.nombre} tiene ${row.ocupados} alumnos. Nuevo cupo:`,
            'Editar cupo',
            String(row.cupo)
        );
        if (typed === null || !String(typed).trim()) return;
        const cupo = Number(typed);
        if (!Number.isInteger(cupo) || cupo < 0) {
            showToast('El cupo debe ser un número entero', 'error');
            return;
        }
        const res = await fetch(`${API_URL}/admin/secciones/${row.id}/cupo`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: state.user.id, cupo }),
        });
        if (!res.ok) {
            const msg = await parseResponseError(res, 'No se pudo guardar el cupo');
            showToast(msg, 'error');
            return;
        }
        showToast('Cupo actualizado', 'success');
        await loadCatalogs();
        refreshNamedSectionSelect('operator-grade-select', 'operator-section-select', 'Selecciona sección', true);
        refreshNamedSectionSelect('teacher-grade-select', 'teacher-section-select', 'Sin asignar');
    });
    on('user-password-btn', 'click', async () => {
        const row = grids.users?.getSelected();
        if (!row) return;
        const newPassword = await showPrompt(`Nueva contraseña para ${row.nombre}:`, 'Cambiar clave');
        if (!newPassword) return;
        const update = await fetch(`${API_URL}/admin/usuarios/${row.id}/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: state.user.id, nueva_contraseña: newPassword }),
        });
        if (update.ok) showToast('Contraseña actualizada', 'success');
        else showToast('No se pudo actualizar la contraseña', 'error');
    });

    bindEvents();
    try {
        await loadCatalogs();
        refreshSectionOptions();
        refreshNamedSectionSelect('operator-grade-select', 'operator-section-select', 'Selecciona sección', true);
        refreshNamedSectionSelect('teacher-grade-select', 'teacher-section-select', 'Sin asignar');
        await Promise.all([
            loadEnrollmentGrid(),
            loadAddresses(),
            loadContacts(),
            loadAvisos(),
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
