const API_URL = window.API_URL || 'http://localhost:3000';
const dashboardState = { grades: [], sections: [], documentTypes: [], students: [], addresses: [], enrollments: [] };
const byId = (id) => document.getElementById(id);

const renderStatusBadge = (status) => {
    const label = (status || 'pendiente').replace('_', ' ');
    return `<span class="badge badge-${status || 'pendiente'}">${label}</span>`;
};

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('usuario') || 'null');
    if (!user) {
        window.location.href = '../login/login.html';
        return;
    }

    const greeting = byId('user-greeting');
    if (greeting) greeting.textContent = user.nombre;

    const showUserPanel = (panelId) => {
        const valid = ['estudiantes', 'inscripciones', 'avisos', 'configuracion'];
        const id = valid.includes(panelId) ? panelId : 'estudiantes';
        document.querySelectorAll('.user-panel').forEach((panel) => {
            panel.classList.toggle('is-active', panel.id === `panel-${id}`);
        });
        document.querySelectorAll('[data-panel]').forEach((link) => {
            link.classList.toggle('active', link.dataset.panel === id);
        });
        const nextHash = `#${id}`;
        if (location.hash !== nextHash) {
            history.replaceState({ panel: id }, '', `${location.pathname}${nextHash}`);
        }
        window.scrollTo(0, 0);
    };

    const mobileNav = byId('user-mobile-nav');
    if (mobileNav && !mobileNav.innerHTML.trim()) {
        mobileNav.innerHTML = `<ul>
            <li><button type="button" data-panel="estudiantes">Estudiantes</button></li>
            <li><button type="button" data-panel="inscripciones">Inscripciones</button></li>
            <li><button type="button" data-panel="avisos">Avisos</button></li>
        </ul>`;
    }

    document.querySelectorAll('[data-panel]').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showUserPanel(link.dataset.panel);
            const menu = byId('user-config-menu');
            if (menu) menu.hidden = true;
        });
    });
    bindConfigMenu(byId('user-config-toggle'), byId('user-config-menu'));

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    const logoutBtn = byId('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('usuario');
            window.location.href = '../login/login.html';
        };
    }
    showUserPanel((location.hash || '#estudiantes').replace('#', ''));
    window.addEventListener('popstate', () => {
        showUserPanel((location.hash || '#estudiantes').replace('#', ''));
    });

    const representativeChip = byId('representative-loaded');
    if (representativeChip) {
        representativeChip.innerHTML = `
            <strong>Representante:</strong>
            <span>${user.nombre} ${user.apellido || ''}</span>
            <span>Cédula ${user.cedula}</span>
            <span>${user.email || 'Sin correo'}</span>
        `;
    }

    const setStudentActions = (row) => {
        byId('student-edit-btn').disabled = !row;
        byId('student-address-btn').disabled = !row;
    };
    const setEnrollmentActions = (row) => {
        const canFix = row && row.estado !== 'aprobada';
        byId('enrollment-docs-btn').disabled = !canFix;
        byId('enrollment-resend-btn').disabled = !(row && row.estado === 'rechazada');
        byId('enrollment-delete-btn').disabled = !canFix;
    };

    const studentsGrid = createDataGrid({
        container: byId('students-list'),
        footer: byId('students-grid-footer'),
        searchInput: byId('students-search'),
        pageSize: 10,
        emptyText: 'Todavía no hay estudiantes registrados.',
        columns: [
            {
                key: 'foto',
                label: 'Foto',
                render: (row) => row.foto_url
                    ? `<img class="student-thumb" src="${window.resolveAssetUrl(row.foto_url)}" alt="">`
                    : '—',
            },
            { key: 'nombre', label: 'Nombre' },
            { key: 'cedula', label: 'Cédula', value: (row) => row.cedula || '—' },
            { key: 'grado', label: 'Grado', value: (row) => row.grado_nombre || row.grado || '—' },
            { key: 'seccion', label: 'Sección', value: (row) => row.seccion_nombre || '—' },
        ],
        onSelect: setStudentActions,
    });

    const enrollmentsGrid = createDataGrid({
        container: byId('inscripciones-container'),
        footer: byId('enrollments-grid-footer'),
        searchInput: byId('enrollments-search'),
        pageSize: 10,
        emptyText: 'Sin inscripciones.',
        columns: [
            { key: 'estudiante_nombre', label: 'Estudiante' },
            { key: 'grado', label: 'Grado' },
            { key: 'estado', label: 'Estado', render: (row) => renderStatusBadge(row.estado) },
            { key: 'fecha', label: 'Fecha', value: (row) => (row.fecha ? new Date(row.fecha).toLocaleDateString('es') : '—') },
        ],
        onSelect: setEnrollmentActions,
    });

    const loadStudents = () => {
        const select = byId('estudiante-select');
        fetch(`${API_URL}/estudiantes/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                dashboardState.students = data || [];
                const count = byId('students-count');
                if (count) count.textContent = `Registrados: ${dashboardState.students.length}`;
                if (select) {
                    select.innerHTML = '<option value="">Selecciona un estudiante</option>';
                    dashboardState.students.forEach((est) => {
                        const opt = document.createElement('option');
                        opt.value = est.id;
                        const gradeName = est.grado_nombre || est.grado || 'Sin grado';
                        const sectionName = est.seccion_nombre ? ` - ${est.seccion_nombre}` : '';
                        opt.textContent = `${est.nombre} (${gradeName}${sectionName})`;
                        select.appendChild(opt);
                    });
                }
                studentsGrid.setRows(dashboardState.students);
            });
    };

    const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

    const setStudentPhotoPreview = (url) => {
        const preview = byId('student-photo-preview');
        if (!preview) return;
        if (url) {
            preview.src = url.startsWith('blob:') ? url : window.resolveAssetUrl(url);
            preview.hidden = false;
        } else {
            preview.removeAttribute('src');
            preview.hidden = true;
        }
    };

    const fillStudentForm = (student) => {
        const form = byId('estudiante-form');
        if (!form || !student) return;
        byId('student-edit-id').value = String(student.id);
        form.nombre.value = student.nombre || '';
        form.cedula.value = student.cedula || '';
        byId('student-grade-select').value = student.grado_id ? String(student.grado_id) : '';
        refreshSections();
        byId('student-section-select').value = student.seccion_id ? String(student.seccion_id) : '';
        byId('student-birthdate').value = toDateInput(student.fecha_nacimiento);
        byId('student-sexo').value = student.sexo || '';
        byId('student-alergias').value = student.alergias || '';
        byId('student-observaciones').value = student.observaciones || '';
        byId('student-photo-file').value = '';
        setStudentPhotoPreview(student.foto_url);
        byId('student-form-title').textContent = 'Modificar estudiante';
        byId('student-submit-btn').textContent = 'Guardar';
        openModal('student-modal');
    };

    const resetStudentForm = () => {
        const form = byId('estudiante-form');
        if (!form) return;
        form.reset();
        byId('student-edit-id').value = '';
        byId('student-photo-file').value = '';
        setStudentPhotoPreview('');
        byId('student-form-title').textContent = 'Nuevo estudiante';
        byId('student-submit-btn').textContent = 'Guardar';
        refreshSections();
    };

    const populateAcademicCatalog = () => {
        return Promise.all([
            fetch(`${API_URL}/catalogos/escolares`).then((res) => res.json()),
            fetch(`${API_URL}/catalogos/documentos`).then((res) => res.json()),
        ]).then(([catalog, documentTypes]) => {
            dashboardState.grades = catalog.grados || [];
            dashboardState.sections = catalog.secciones || [];
            dashboardState.documentTypes = documentTypes || [];
            const gradeSelect = byId('student-grade-select');
            if (gradeSelect) {
                const current = gradeSelect.value;
                gradeSelect.innerHTML = '<option value="">Selecciona grado</option>';
                dashboardState.grades.forEach((grade) => {
                    const opt = document.createElement('option');
                    opt.value = String(grade.id);
                    opt.textContent = grade.nombre;
                    gradeSelect.appendChild(opt);
                });
                if (current) gradeSelect.value = current;
            }
            const periodSelect = byId('period-select');
            if (periodSelect) {
                const currentPeriod = periodSelect.value;
                periodSelect.innerHTML = '<option value="">Período activo</option>';
                (catalog.periodos || []).forEach((period) => {
                    const opt = document.createElement('option');
                    opt.value = String(period.id);
                    opt.textContent = period.activo ? `${period.nombre} (activo)` : period.nombre;
                    periodSelect.appendChild(opt);
                });
                if (currentPeriod) periodSelect.value = currentPeriod;
            }
            const docCodeSelect = byId('doc-code');
            if (docCodeSelect) {
                const currentDoc = docCodeSelect.value;
                docCodeSelect.innerHTML = '<option value="">Selecciona tipo</option>';
                dashboardState.documentTypes.forEach((docType) => {
                    const opt = document.createElement('option');
                    opt.value = docType.codigo;
                    opt.textContent = docType.obligatorio ? `${docType.nombre} (obligatorio)` : docType.nombre;
                    docCodeSelect.appendChild(opt);
                });
                const commitment = dashboardState.documentTypes.find((doc) => doc.codigo === 'carta_compromiso');
                docCodeSelect.value = currentDoc || commitment?.codigo || '';
            }
            refreshSections();
        });
    };

    const refreshSections = () => {
        const gradeSelect = byId('student-grade-select');
        const sectionSelect = byId('student-section-select');
        const gradeText = byId('student-grade-text');
        if (!gradeSelect || !sectionSelect) return;
        const selectedGradeId = gradeSelect.value;
        const currentSectionId = sectionSelect.value;
        const editingSectionId = byId('student-edit-id')?.value
            ? dashboardState.students.find((row) => String(row.id) === byId('student-edit-id').value)?.seccion_id
            : null;
        const grade = dashboardState.grades.find((item) => String(item.id) === selectedGradeId);
        if (gradeText) gradeText.value = grade ? grade.nombre : '';
        sectionSelect.innerHTML = '<option value="">Selecciona sección</option>';
        if (!selectedGradeId) return;
        dashboardState.sections
            .filter((item) => String(item.grado_id) === selectedGradeId)
            .forEach((section) => {
                const opt = document.createElement('option');
                opt.value = String(section.id);
                opt.textContent = section.nombre;
                const isCurrent = String(section.id) === String(editingSectionId || '');
                opt.disabled = section.disponible === false && !isCurrent;
                sectionSelect.appendChild(opt);
            });
        if (currentSectionId && Array.from(sectionSelect.options).some((opt) => opt.value === currentSectionId)) {
            sectionSelect.value = currentSectionId;
        } else {
            const enabled = Array.from(sectionSelect.options).filter((opt) => opt.value && !opt.disabled);
            if (enabled.length === 1) sectionSelect.value = enabled[0].value;
        }
    };

    const loadAvisos = () => {
        const box = byId('avisos-list');
        if (!box) return;
        fetch(`${API_URL}/avisos?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((rows) => {
                if (!rows.length) {
                    box.innerHTML = '<p class="empty-state">Todavía no hay avisos de la institución.</p>';
                    return;
                }
                const esc = (value) => String(value || '').replace(/</g, '&lt;');
                box.innerHTML = rows.map((row) => `
                    <article class="aviso-card">
                        <header>
                            <h3>${esc(row.titulo)}</h3>
                            <time>${row.creado_en ? new Date(row.creado_en).toLocaleString('es') : ''}</time>
                        </header>
                        <p>${esc(row.mensaje)}</p>
                    </article>
                `).join('');
            });
    };

    const uploadStudentPhoto = async (studentId) => {
        const input = byId('student-photo-file');
        if (!input?.files?.[0] || !studentId) return true;
        const form = new FormData();
        form.append('usuario_id', String(user.id));
        form.append('foto', input.files[0]);
        const res = await fetch(`${API_URL}/estudiantes/${studentId}/foto`, { method: 'POST', body: form });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'El estudiante se guardó, pero la foto no', 'error');
            return false;
        }
        return true;
    };

    const loadEnrollments = () => {
        fetch(`${API_URL}/inscripciones/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                dashboardState.enrollments = data || [];
                enrollmentsGrid.setRows(dashboardState.enrollments);
                setEnrollmentActions(null);
            });
    };

    const addDocumentsToEnrollment = async (enrollmentId) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.multiple = true;
        input.onchange = async () => {
            if (!input.files.length) return;
            const docCode = byId('doc-code')?.value || 'carta_compromiso';
            const selectedDoc = dashboardState.documentTypes.find((doc) => doc.codigo === docCode);
            const form = new FormData();
            form.append('usuario_id', String(user.id));
            form.append('tipo_documento', selectedDoc?.nombre || 'Documento PDF');
            if (docCode) form.append('codigo_documento', docCode);
            Array.from(input.files).forEach((file) => form.append('documentos', file));
            const res = await fetch(`${API_URL}/inscripciones/${enrollmentId}/documentos`, {
                method: 'POST',
                body: form,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                showToast(err.error || 'No se pudieron cargar los PDFs', 'error');
                return;
            }
            showToast('Documentos actualizados', 'success');
        };
        input.click();
    };

    const loadAddresses = () => {
        fetch(`${API_URL}/direcciones/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                dashboardState.addresses = data || [];
            });
    };

    const fillAddressForm = (address) => {
        const form = byId('direccion-form');
        if (!form) return;
        byId('address-edit-id').value = address ? String(address.id) : '';
        form.calle.value = address?.calle || '';
        form.av.value = address?.av || '';
        form.barrio.value = address?.barrio || address?.sector || '';
        form.n_casa.value = address?.n_casa || '';
        form.parroquia.value = address?.parroquia || '';
        form.municipio.value = address?.municipio || '';
        form.estado.value = address?.estado || address?.state || '';
        byId('address-form-title').textContent = address ? 'Modificar dirección' : 'Registrar dirección';
        openModal('address-modal');
    };

    const fillProfileForm = () => {
        if (!byId('profile-form')) return;
        byId('profile-nombre').value = user.nombre || '';
        byId('profile-apellido').value = user.apellido || '';
        byId('profile-cedula').value = user.cedula || '';
        byId('profile-email').value = user.email || '';
    };

    byId('student-grade-select')?.addEventListener('change', refreshSections);
    byId('student-photo-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) setStudentPhotoPreview(URL.createObjectURL(file));
    });
    byId('student-new-btn')?.addEventListener('click', () => {
        resetStudentForm();
        openModal('student-modal');
    });
    byId('student-edit-btn')?.addEventListener('click', async () => {
        const row = studentsGrid.getSelected();
        if (!row) return;
        const ok = await showConfirm(`¿Modificar el estudiante ${row.nombre}?`, 'Modificar registro');
        if (!ok) return;
        fillStudentForm(row);
    });
    byId('student-address-btn')?.addEventListener('click', () => {
        const row = studentsGrid.getSelected();
        if (!row) return;
        fillAddressForm(dashboardState.addresses[0] || null);
    });
    byId('enrollment-new-btn')?.addEventListener('click', () => openModal('enrollment-form-modal'));
    byId('enrollment-docs-btn')?.addEventListener('click', () => {
        const row = enrollmentsGrid.getSelected();
        if (row) addDocumentsToEnrollment(row.id);
    });
    byId('enrollment-resend-btn')?.addEventListener('click', async () => {
        const row = enrollmentsGrid.getSelected();
        if (!row) return;
        const ok = await showConfirm('¿Reenviar esta preinscripción a revisión?', 'Reenviar');
        if (!ok) return;
        const res = await fetch(`${API_URL}/inscripciones/${row.id}/reenviar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: user.id }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'No se pudo reenviar', 'error');
            return;
        }
        showToast('Preinscripción reenviada a revisión', 'success');
        loadEnrollments();
    });
    byId('enrollment-delete-btn')?.addEventListener('click', async () => {
        const row = enrollmentsGrid.getSelected();
        if (!row) return;
        const ok = await showConfirm('¿Borrar esta inscripción? Esta acción no se deshace.', 'Borrar registro');
        if (!ok) return;
        await fetch(`${API_URL}/inscripciones/${row.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: user.id }),
        });
        loadEnrollments();
    });

    byId('estudiante-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.usuario_id = user.id;
        if (!data.cedula) delete data.cedula;
        const editId = byId('student-edit-id').value;
        const res = await fetch(editId ? `${API_URL}/estudiantes/${editId}` : `${API_URL}/estudiantes`, {
            method: editId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const saved = await res.json();
            await uploadStudentPhoto(saved.id || editId);
            showToast(editId ? 'Estudiante modificado' : 'Estudiante registrado', 'success');
            closeModal('student-modal');
            resetStudentForm();
            await populateAcademicCatalog();
            loadStudents();
            return;
        }
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'No se pudo guardar el estudiante', 'error');
    };

    byId('direccion-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.id_user = user.id;
        const editId = byId('address-edit-id').value;
        const res = await fetch(editId ? `${API_URL}/direcciones/${editId}` : `${API_URL}/direcciones`, {
            method: editId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            showToast(editId ? 'Dirección modificada' : 'Dirección guardada', 'success');
            closeModal('address-modal');
            loadAddresses();
            return;
        }
        showToast('No se pudo guardar la dirección', 'error');
    };

    byId('inscripcion-form').onsubmit = async (e) => {
        e.preventDefault();
        const estudiante_id = byId('estudiante-select').value;
        const periodo_id = byId('period-select').value || null;
        const selectedDocCode = byId('doc-code').value || null;
        const selectedDoc = dashboardState.documentTypes.find((doc) => doc.codigo === selectedDocCode);
        const files = byId('doc-files').files;
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
            docsForm.append('tipo_documento', selectedDoc?.nombre || 'Documento PDF');
            if (selectedDocCode) docsForm.append('codigo_documento', selectedDocCode);
            Array.from(files).forEach((file) => docsForm.append('documentos', file));
            await fetch(`${API_URL}/inscripciones/${created.id}/documentos`, { method: 'POST', body: docsForm });
        }
        showToast('Preinscripción enviada', 'success');
        e.target.reset();
        closeModal('enrollment-form-modal');
        loadEnrollments();
    };

    fillProfileForm();
    byId('profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            usuario_id: user.id,
            nombre: byId('profile-nombre').value.trim(),
            apellido: byId('profile-apellido').value.trim(),
            email: byId('profile-email').value.trim(),
        };
        const password = byId('profile-password').value;
        if (password) payload.contraseña = password;
        const res = await fetch(`${API_URL}/usuarios/${user.id}/perfil`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || 'No se pudo guardar la cuenta', 'error');
            return;
        }
        localStorage.setItem('usuario', JSON.stringify({ ...user, ...data }));
        showToast('Datos de representante actualizados', 'success');
        byId('profile-password').value = '';
        if (greeting) greeting.textContent = data.nombre;
    };

    loadStudents();
    loadEnrollments();
    loadAddresses();
    loadAvisos();
    populateAcademicCatalog();
});
