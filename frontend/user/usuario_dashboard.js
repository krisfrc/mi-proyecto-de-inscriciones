const API_URL = window.API_URL || 'http://localhost:3000';
const dashboardState = { grades: [], sections: [], documentTypes: [], students: [], addresses: [] };

const renderStatusBadge = (status) => {
    const label = (status || 'pendiente').replace('_', ' ');
    return `<span class="badge badge-${status || 'pendiente'}">${label}</span>`;
};

const byId = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('usuario') || 'null');
    if (!user) {
        window.location.href = '../login/login.html';
        return;
    }

    const greeting = byId('user-greeting');
    if (greeting) greeting.textContent = user.nombre;
    const nameEl = byId('user-name');
    if (nameEl) nameEl.textContent = user.nombre;

    const showUserPanel = (panelId) => {
        const valid = ['estudiantes', 'direcciones', 'inscripciones', 'configuracion'];
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
            <li><button type="button" data-panel="direcciones">Direcciones</button></li>
            <li><button type="button" data-panel="inscripciones">Inscripciones</button></li>
        </ul>`;
    }

    document.querySelectorAll('[data-panel]').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showUserPanel(link.dataset.panel);
        });
    });
    const logoutBtn = byId('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('usuario');
            window.location.href = '../login/login.html';
        };
    }
    const hashPanel = (location.hash || '#estudiantes').replace('#', '');
    if (document.querySelector('.user-panel')) showUserPanel(hashPanel);
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

    const loadStudents = () => {
        const select = byId('estudiante-select');
        const list = byId('students-list');
        fetch(`${API_URL}/estudiantes/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                dashboardState.students = data || [];
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
                if (!list) return;
                if (!dashboardState.students.length) {
                    list.innerHTML = '<p class="empty-state">Todavía no cargaste estudiantes.</p>';
                    return;
                }
                let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nombre</th><th>Cédula</th><th>Grado</th><th>Sección</th><th></th></tr></thead><tbody>';
                dashboardState.students.forEach((est) => {
                    html += `<tr>
                        <td>${est.nombre}</td>
                        <td>${est.cedula || '—'}</td>
                        <td>${est.grado_nombre || est.grado || '—'}</td>
                        <td>${est.seccion_nombre || '—'}</td>
                        <td><button class="btn btn-outline btn-sm edit-student-btn" type="button" data-id="${est.id}">Corregir</button></td>
                    </tr>`;
                });
                list.innerHTML = html + '</tbody></table></div>';
                list.querySelectorAll('.edit-student-btn').forEach((btn) => {
                    btn.addEventListener('click', () => fillStudentForm(Number(btn.dataset.id)));
                });
            });
    };

    const fillStudentForm = (studentId) => {
        const student = dashboardState.students.find((item) => Number(item.id) === studentId);
        if (!student) return;
        const form = byId('estudiante-form');
        if (!form) return;
        byId('student-edit-id').value = String(student.id);
        form.nombre.value = student.nombre || '';
        form.cedula.value = student.cedula || '';
        byId('student-grade-select').value = student.grado_id ? String(student.grado_id) : '';
        refreshSections();
        byId('student-section-select').value = student.seccion_id ? String(student.seccion_id) : '';
        byId('student-form-title').textContent = 'Corregir estudiante';
        byId('student-submit-btn').textContent = 'Guardar corrección';
        const cancel = byId('student-cancel-edit');
        if (cancel) cancel.hidden = false;
        form.scrollIntoView({ behavior: 'smooth' });
    };

    const resetStudentForm = () => {
        const form = byId('estudiante-form');
        if (!form) return;
        form.reset();
        byId('student-edit-id').value = '';
        byId('student-form-title').textContent = 'Nuevo estudiante';
        byId('student-submit-btn').textContent = 'Crear estudiante';
        const cancel = byId('student-cancel-edit');
        if (cancel) cancel.hidden = true;
        refreshSections();
    };

    const populateAcademicCatalog = () => {
        if (!byId('student-grade-select') && !byId('period-select') && !byId('doc-code')) return;
        Promise.all([
            fetch(`${API_URL}/catalogos/escolares`).then((res) => res.json()),
            fetch(`${API_URL}/catalogos/documentos`).then((res) => res.json()),
        ])
            .then(([catalog, documentTypes]) => {
                dashboardState.grades = catalog.grados || [];
                dashboardState.sections = catalog.secciones || [];
                dashboardState.documentTypes = documentTypes || [];

                const gradeSelect = byId('student-grade-select');
                if (gradeSelect) {
                    dashboardState.grades.forEach((grade) => {
                        const opt = document.createElement('option');
                        opt.value = String(grade.id);
                        opt.textContent = grade.nombre;
                        gradeSelect.appendChild(opt);
                    });
                }

                const periodSelect = byId('period-select');
                if (periodSelect) {
                    (catalog.periodos || []).forEach((period) => {
                        const opt = document.createElement('option');
                        opt.value = String(period.id);
                        opt.textContent = period.activo ? `${period.nombre} (activo)` : period.nombre;
                        periodSelect.appendChild(opt);
                    });
                }

                const docCodeSelect = byId('doc-code');
                if (docCodeSelect) {
                    dashboardState.documentTypes.forEach((docType) => {
                        const opt = document.createElement('option');
                        opt.value = docType.codigo;
                        opt.textContent = docType.obligatorio ? `${docType.nombre} (obligatorio)` : docType.nombre;
                        docCodeSelect.appendChild(opt);
                    });
                    const commitment = dashboardState.documentTypes.find((doc) => doc.codigo === 'carta_compromiso');
                    if (commitment) docCodeSelect.value = commitment.codigo;
                }
            });
    };

    const refreshSections = () => {
        const gradeSelect = byId('student-grade-select');
        const sectionSelect = byId('student-section-select');
        const gradeText = byId('student-grade-text');
        if (!gradeSelect || !sectionSelect) return;
        const selectedGradeId = gradeSelect.value;
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
                sectionSelect.appendChild(opt);
            });
    };

    const loadEnrollments = () => {
        const container = byId('inscripciones-container');
        if (!container) return;
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
                    const canFix = i.estado !== 'aprobada';
                    html += `<tr><td>${i.estudiante_nombre}</td><td>${i.grado}</td>
                    <td>${renderStatusBadge(i.estado)}</td><td>${fecha}</td>
                    <td class="table-actions">
                        ${canFix ? `<button class="btn btn-outline btn-sm fix-enrollment-btn" data-id="${i.id}">Corregir docs</button>` : ''}
                        ${i.estado === 'rechazada' ? `<button class="btn btn-primary btn-sm resend-enrollment-btn" data-id="${i.id}">Reenviar</button>` : ''}
                        ${canFix ? `<button class="btn btn-danger btn-sm delete-enrollment-btn" data-id="${i.id}">Borrar</button>` : ''}
                    </td></tr>`;
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
                        loadEnrollments();
                    });
                });
                container.querySelectorAll('.resend-enrollment-btn').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const res = await fetch(`${API_URL}/inscripciones/${btn.dataset.id}/reenviar`, {
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
                });
                container.querySelectorAll('.fix-enrollment-btn').forEach((btn) => {
                    btn.addEventListener('click', () => addDocumentsToEnrollment(btn.dataset.id));
                });
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
        const container = byId('direcciones-container');
        if (!container) return;
        fetch(`${API_URL}/direcciones/usuario?usuario_id=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                dashboardState.addresses = data || [];
                if (data.length === 0) {
                    container.innerHTML = '<p class="empty-state">Sin direcciones.</p>';
                    return;
                }
                let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Barrio</th><th>Parroquia</th><th>Municipio</th><th>Estado</th><th></th></tr></thead><tbody>';
                data.forEach((d) => {
                    html += `<tr>
                        <td>${d.barrio || d.sector || '—'}</td>
                        <td>${d.parroquia || '—'}</td>
                        <td>${d.municipio || '—'}</td>
                        <td>${d.estado || d.state || '—'}</td>
                        <td><button class="btn btn-outline btn-sm edit-address-btn" type="button" data-id="${d.id}">Corregir</button></td>
                    </tr>`;
                });
                container.innerHTML = html + '</tbody></table></div>';
                container.querySelectorAll('.edit-address-btn').forEach((btn) => {
                    btn.addEventListener('click', () => fillAddressForm(Number(btn.dataset.id)));
                });
            });
    };

    const fillAddressForm = (addressId) => {
        const address = dashboardState.addresses.find((item) => Number(item.id) === addressId);
        const form = byId('direccion-form');
        if (!address || !form) return;
        byId('address-edit-id').value = String(address.id);
        form.calle.value = address.calle || '';
        form.av.value = address.av || '';
        form.barrio.value = address.barrio || address.sector || '';
        form.n_casa.value = address.n_casa || '';
        form.parroquia.value = address.parroquia || '';
        form.municipio.value = address.municipio || '';
        form.estado.value = address.estado || address.state || '';
        byId('address-form-title').textContent = 'Corregir dirección';
        byId('address-submit-btn').textContent = 'Guardar corrección';
        const cancel = byId('address-cancel-edit');
        if (cancel) cancel.hidden = false;
        form.scrollIntoView({ behavior: 'smooth' });
    };

    const resetAddressForm = () => {
        const form = byId('direccion-form');
        if (!form) return;
        form.reset();
        byId('address-edit-id').value = '';
        byId('address-form-title').textContent = 'Registrar dirección';
        byId('address-submit-btn').textContent = 'Guardar dirección';
        const cancel = byId('address-cancel-edit');
        if (cancel) cancel.hidden = true;
    };

    const fillProfileForm = () => {
        if (!byId('profile-form')) return;
        byId('profile-nombre').value = user.nombre || '';
        byId('profile-apellido').value = user.apellido || '';
        byId('profile-cedula').value = user.cedula || '';
        byId('profile-email').value = user.email || '';
    };

    if (byId('student-grade-select')) {
        byId('student-grade-select').addEventListener('change', refreshSections);
    }
    if (byId('student-cancel-edit')) {
        byId('student-cancel-edit').addEventListener('click', resetStudentForm);
    }
    if (byId('address-cancel-edit')) {
        byId('address-cancel-edit').addEventListener('click', resetAddressForm);
    }

    if (byId('estudiante-form')) {
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
                showToast(editId ? 'Estudiante corregido' : 'Estudiante creado', 'success');
                resetStudentForm();
                loadStudents();
                return;
            }
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'No se pudo guardar el estudiante', 'error');
        };
    }

    if (byId('direccion-form')) {
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
                showToast(editId ? 'Dirección corregida' : 'Dirección guardada', 'success');
                resetAddressForm();
                loadAddresses();
                return;
            }
            showToast('No se pudo guardar la dirección', 'error');
        };
    }

    if (byId('inscripcion-form')) {
        byId('inscripcion-form').onsubmit = async (e) => {
            e.preventDefault();
            const estudiante_id = byId('estudiante-select').value;
            const periodo_id = byId('period-select').value || null;
            const selectedDocCode = byId('doc-code').value || null;
            const selectedDoc = dashboardState.documentTypes.find((doc) => doc.codigo === selectedDocCode);
            const docTypeLabel = selectedDoc?.nombre || 'Documento PDF';
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
            e.target.reset();
            loadEnrollments();
        };
    }

    if (byId('profile-form')) {
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
            const greet = byId('user-greeting');
            if (greet) greet.textContent = data.nombre;
        };
    }

    loadStudents();
    loadEnrollments();
    loadAddresses();
    populateAcademicCatalog();
});
