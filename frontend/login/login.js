const API_URL = window.API_URL || 'http://localhost:3000';

const urlParams = new URLSearchParams(window.location.search);
const formType = urlParams.get('form') || 'login';

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const recoverForm = document.getElementById('recover-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const tabRecover = document.getElementById('tab-recover');

const showAuthForm = (type) => {
    loginForm.classList.toggle('active', type === 'login');
    registerForm.classList.toggle('active', type === 'register');
    recoverForm.classList.toggle('active', type === 'recover');
    tabLogin.classList.toggle('active', type === 'login');
    tabRegister.classList.toggle('active', type === 'register');
    if (tabRecover) tabRecover.classList.toggle('active', type === 'recover');
};

showAuthForm(['login', 'register', 'recover'].includes(formType) ? formType : 'login');

tabLogin.addEventListener('click', () => {
    showAuthForm('login');
    history.replaceState(null, '', 'login.html?form=login');
});
tabRegister.addEventListener('click', () => {
    showAuthForm('register');
    history.replaceState(null, '', 'login.html?form=register');
});
if (tabRecover) {
    tabRecover.addEventListener('click', () => {
        showAuthForm('recover');
        history.replaceState(null, '', 'login.html?form=recover');
    });
}
const forgotLink = document.getElementById('forgot-link');
if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('recover');
        history.replaceState(null, '', 'login.html?form=recover');
    });
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    try {
        const res = await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        });
        if (res.ok) {
            showToast('¡Registro exitoso! Ya puedes iniciar sesión.', 'success');
            showAuthForm('login');
            history.replaceState(null, '', 'login.html?form=login');
        } else {
            const err = await res.json();
            showToast(err.error || 'Error al registrar', 'error');
        }
    } catch {
        showToast('No se pudo conectar con el servidor', 'error');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            showToast(`¡Bienvenido, ${data.usuario.nombre}!`, 'success');
            setTimeout(() => {
                window.location.href = data.usuario.rol_id === 1
                    ? '../admin/admin_dashboard.html'
                    : '../user/usuario_dashboard.html';
            }, 600);
        } else {
            showToast('Cédula o contraseña incorrecta', 'error');
        }
    } catch {
        showToast('Error de conexión con el servidor', 'error');
    }
});

recoverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('recover-pass').value;
    const pass2 = document.getElementById('recover-pass-2')?.value;
    if (pass2 != null && pass !== pass2) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }
    const datos = Object.fromEntries(new FormData(e.target));
    try {
        const res = await fetch(`${API_URL}/recuperar-contrasena`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Contraseña actualizada', 'success');
            showAuthForm('login');
            history.replaceState(null, '', 'login.html?form=login');
        } else {
            showToast(data.error || 'No se pudo recuperar la contraseña', 'error');
        }
    } catch {
        showToast('No se pudo conectar con el servidor', 'error');
    }
});
