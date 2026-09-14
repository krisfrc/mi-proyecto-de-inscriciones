const API_URL = window.API_URL || 'http://localhost:3000';

let currentUser = null;
let studentId = null;
const mobileState = { grades: [], sections: [], documentTypes: [] };

const setStep = (step) => {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-${i}`);
        if (el) el.classList.toggle('active', i <= step);
    }
};

const showPanel = (panelId) => {
    ['panel-registro', 'panel-estudiante', 'panel-direccion', 'panel-inscripcion'].forEach((pid) => {
        document.getElementById(pid).style.display = pid === panelId ? 'block' : 'none';
    });
};

const loadStudents = async () => {
    const select = document.getElementById('estudiante-select');
    select.innerHTML = '<option value="">Selecciona estudiante</option>';
    const res = await fetch(`${API_URL}/estudiantes/usuario?usuario_id=${currentUser.id}`);
    const data = await res.json();
    data.forEach((est) => {
        const opt = document.createElement('option');
        opt.value = est.id;
        const gradeName = est.grado_nombre || est.grado || 'Sin grado';
        const sectionName = est.seccion_nombre ? ` - ${est.seccion_nombre}` : '';
        opt.textContent = `${est.nombre} (${gradeName}${sectionName})`;
        select.appendChild(opt);
    });
    if (studentId) select.value = studentId;
};

const loadAcademicCatalog = async () => {
    const [academicRes, documentRes] = await Promise.all([
        fetch(`${API_URL}/catalogos/escolares`),
        fetch(`${API_URL}/catalogos/documentos`),
    ]);
    const data = await academicRes.json();
    mobileState.documentTypes = await documentRes.json();
    mobileState.grades = data.grados || [];
    mobileState.sections = data.secciones || [];

    const gradeSelect = document.getElementById('mobile-grade-select');
    mobileState.grades.forEach((grade) => {
        const opt = document.createElement('option');
        opt.value = String(grade.id);
        opt.textContent = grade.nombre;
        gradeSelect.appendChild(opt);
    });

    const periodSelect = document.getElementById('mobile-period-select');
    (data.periodos || []).forEach((period) => {
        const opt = document.createElement('option');
        opt.value = String(period.id);
        opt.textContent = period.activo ? `${period.nombre} (activo)` : period.nombre;
        periodSelect.appendChild(opt);
    });

    const docTypeSelect = document.getElementById('mobile-doc-code');
    mobileState.documentTypes.forEach((docType) => {
        const opt = document.createElement('option');
        opt.value = docType.codigo;
        opt.textContent = docType.obligatorio ? `${docType.nombre} (obligatorio)` : docType.nombre;
        docTypeSelect.appendChild(opt);
    });
    const commitment = mobileState.documentTypes.find((doc) => doc.codigo === 'carta_compromiso');
    if (commitment) docTypeSelect.value = commitment.codigo;
};

const refreshSections = () => {
    const gradeSelect = document.getElementById('mobile-grade-select');
    const sectionSelect = document.getElementById('mobile-section-select');
    const gradeText = document.getElementById('mobile-grade-text');
    const gradeId = gradeSelect.value;
    const grade = mobileState.grades.find((item) => String(item.id) === gradeId);
    gradeText.value = grade ? grade.nombre : '';
    sectionSelect.innerHTML = '<option value="">Selecciona sección</option>';
    if (!gradeId) return;
    mobileState.sections
        .filter((item) => String(item.grado_id) === gradeId)
        .forEach((section) => {
            const opt = document.createElement('option');
            opt.value = String(section.id);
            opt.textContent = section.nombre;
            sectionSelect.appendChild(opt);
        });
};

document.addEventListener('DOMContentLoaded', () => {
    loadAcademicCatalog();
    document.getElementById('mobile-grade-select').addEventListener('change', refreshSections);

    const saved = localStorage.getItem('usuario');
    if (saved) {
        currentUser = JSON.parse(saved);
        showPanel('panel-estudiante');
        setStep(2);
        loadStudents();
        const chip = document.getElementById('mobile-representative-loaded');
        if (chip) {
            chip.innerHTML = `<strong>Representante:</strong> ${currentUser.nombre} ${currentUser.apellido || ''} — Cédula ${currentUser.cedula}`;
        }
    }

    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const res = await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Error al registrar', 'error');
            return;
        }
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula: data.cedula, contraseña: data.contraseña }),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
            currentUser = loginData.usuario;
            localStorage.setItem('usuario', JSON.stringify(currentUser));
            const chip = document.getElementById('mobile-representative-loaded');
            if (chip) {
                chip.innerHTML = `<strong>Representante:</strong> ${currentUser.nombre} ${currentUser.apellido || ''} — Cédula ${currentUser.cedula}`;
            }
            showPanel('panel-estudiante');
            setStep(2);
        }
    };

    document.getElementById('estudiante-form').onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const data = Object.fromEntries(new FormData(e.target));
        data.usuario_id = currentUser.id;
        const res = await fetch(`${API_URL}/estudiantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const est = await res.json();
            studentId = est.id;
            showPanel('panel-direccion');
            setStep(3);
        }
    };

    document.getElementById('direccion-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.id_user = currentUser.id;
        data.av = data.av || '';
        const res = await fetch(`${API_URL}/direcciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            await loadStudents();
            showPanel('panel-inscripcion');
            setStep(4);
        }
    };

    document.getElementById('inscripcion-form').onsubmit = async (e) => {
        e.preventDefault();
        const estudiante_id = document.getElementById('estudiante-select').value || studentId;
        const periodo_id = document.getElementById('mobile-period-select').value || null;
        const docCode = document.getElementById('mobile-doc-code').value || null;
        const docType = mobileState.documentTypes.find((doc) => doc.codigo === docCode)?.nombre || 'Documento PDF';
        const files = document.getElementById('mobile-doc-files').files;
        const res = await fetch(`${API_URL}/inscripciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estudiante_id, usuario_id: currentUser.id, periodo_id }),
        });
        if (res.ok) {
            const created = await res.json();
            if (files.length) {
                const docsForm = new FormData();
                docsForm.append('usuario_id', String(currentUser.id));
                docsForm.append('tipo_documento', docType);
                if (docCode) docsForm.append('codigo_documento', docCode);
                Array.from(files).forEach((file) => docsForm.append('documentos', file));
                const docsRes = await fetch(`${API_URL}/inscripciones/${created.id}/documentos`, {
                    method: 'POST',
                    body: docsForm,
                });
                if (!docsRes.ok) {
                    showToast('Inscripción creada, pero falló la carga de PDFs', 'error');
                    return;
                }
            }
            const banner = document.getElementById('success-msg');
            banner.classList.add('visible');
            banner.textContent = '¡Inscripción enviada! Estado: pendiente de revisión.';
            e.target.querySelector('button').disabled = true;
            showToast('Inscripción completada', 'success');
        } else {
            const err = await res.json();
            showToast(err.error || 'No se pudo inscribir', 'error');
        }
    };
});
