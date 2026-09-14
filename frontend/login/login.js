const API_URL = window.API_URL || 'http://localhost:3000';

const urlParams = new URLSearchParams(window.location.search);
const formType = urlParams.get('form') || 'login';

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');

const showAuthForm = (type) => {
    const isLogin = type === 'login';
    loginForm.classList.toggle('active', isLogin);
    registerForm.classList.toggle('active', !isLogin);
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
};

showAuthForm(formType === 'register' ? 'register' : 'login');

tabLogin.addEventListener('click', () => {
    showAuthForm('login');
    history.replaceState(null, '', 'login.html?form=login');
});
tabRegister.addEventListener('click', () => {
    showAuthForm('register');
    history.replaceState(null, '', 'login.html?form=register');
});

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
