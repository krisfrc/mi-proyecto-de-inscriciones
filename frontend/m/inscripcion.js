const API_URL = window.API_URL || 'http://localhost:3000';

let currentUser = null;
let studentId = null;

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
        opt.textContent = `${est.nombre} (${est.grado})`;
        select.appendChild(opt);
    });
    if (studentId) select.value = studentId;
};

document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('usuario');
    if (saved) {
        currentUser = JSON.parse(saved);
        showPanel('panel-estudiante');
        setStep(2);
        loadStudents();
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
        const res = await fetch(`${API_URL}/inscripciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estudiante_id, usuario_id: currentUser.id }),
        });
        if (res.ok) {
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